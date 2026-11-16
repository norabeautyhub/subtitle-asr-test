#!/usr/bin/env node
// Phase 0 — සිංහල Speech-to-Text engines සංසන්දනය
//
// පාවිච්චිය:
//   node run-test.js videos/Ayu_1.mp4
//   node run-test.js videos/Ayu_1.mp4 --reference reference.txt
//   node run-test.js videos/Ayu_1.mp4 --engines elevenlabs_v2 gemini
//
// Engines: elevenlabs_v2, elevenlabs_v3, cloudflare, google, gemini  (default: key තියෙන ඔක්කොම)
import dotenv from 'dotenv';
import { ensureEnv } from './src/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { extractAudio, mediaDuration, saveResult } from './src/common.js';
import * as cloudflare from './src/engines/cloudflare.js';
import * as elevenlabs from './src/engines/elevenlabs.js';
import * as gemini from './src/engines/gemini.js';
import * as google from './src/engines/google-chirp.js';
import { buildReport } from './src/report.js';

ensureEnv();
dotenv.config({ quiet: true });
// Google Cloud VM එකක නැති නිසා metadata server check එක අවශ්‍ය නෑ (warning නවත්වනවා)
process.env.METADATA_SERVER_DETECTION ??= 'none';
// එක engine එකක background error එකකින් මුළු test එකම නවතින්න එපා
process.on('unhandledRejection', e => console.warn(`\n⚠️  ${e?.message || e}`));

const ALL = ['elevenlabs_v2', 'elevenlabs_v3', 'cloudflare', 'google', 'gemini'];

export const ENGINES = {
  elevenlabs_v2: ({ mp3 }) => elevenlabs.transcribe(mp3, 'scribe_v2'),
  elevenlabs_v3: ({ mp3 }) => elevenlabs.transcribe(mp3, 'scribe_v3'),
  cloudflare: ({ mp3, workDir }) => cloudflare.transcribe(mp3, workDir),
  google: ({ flac, workDir }) => google.transcribe(flac, workDir),
  gemini: ({ mp3 }) => gemini.transcribe(mp3),
};

function parseArgs(argv) {
  const a = { video: null, reference: null, engines: null, out: 'results' };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--reference') a.reference = argv[++i];
    else if (x === '--out') a.out = argv[++i];
    else if (x === '--engines') {
      a.engines = [];
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) a.engines.push(argv[++i]);
    } else if (!a.video) a.video = x;
  }
  return a;
}

/** Engines දුන්නේ නැත්නම් key එක තියෙන ඒවා විතරක් තෝරනවා */
function defaultEngines() {
  const e = [];
  if (process.env.ELEVENLABS_API_KEY) e.push('elevenlabs_v2', 'elevenlabs_v3');
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) e.push('cloudflare');
  if (process.env.GOOGLE_CLOUD_PROJECT) e.push('google');
  if (process.env.GEMINI_API_KEY) e.push('gemini');
  return e.length ? e : ALL;
}

export async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv);
  if (!a.video) {
    console.log('පාවිච්චිය: node run-test.js videos/<video>.mp4 [--reference reference.txt] [--engines ...]');
    process.exit(1);
  }
  if (!fs.existsSync(a.video)) { console.error(`Video එක හම්බවුණේ නෑ: ${a.video}`); process.exit(1); }
  const engines = a.engines?.length ? a.engines : defaultEngines();
  const bad = engines.filter(e => !ALL.includes(e));
  if (bad.length) { console.error(`නොදන්නා engine: ${bad.join(', ')}  (තියෙන්නේ: ${ALL.join(', ')})`); process.exit(1); }

  const stem = path.parse(a.video).name;
  const outDir = path.join(a.out, stem);
  const workDir = path.join(outDir, 'audio');
  fs.mkdirSync(outDir, { recursive: true });

  console.log('1/3  Audio එක වෙන් කරනවා...');
  const { mp3, flac } = extractAudio(a.video, workDir);
  const secs = mediaDuration(mp3);

  console.log('2/3  Engines run කරනවා...');
  const results = [];
  for (const e of engines) {
    process.stdout.write(`     → ${e} ... `);
    const r = await ENGINES[e]({ mp3, flac, workDir });
    saveResult(r, outDir);
    results.push(r);
    console.log(r.error ? `❌ ${r.error.slice(0, 150)}` : `✔ වචන ${r.words.length} (${r.secondsTaken.toFixed(1)}s)`);
  }

  const reference = a.reference ? fs.readFileSync(a.reference, 'utf8').replace(/^﻿/, '').trim() : null;

  console.log('3/3  Report එක හදනවා...');
  const reportPath = path.join(outDir, 'report.html');
  buildReport(results, reportPath, a.video, secs, reference);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(results.map(r => ({
    engine: r.engine, error: r.error, words: r.words.length, secondsTaken: +r.secondsTaken.toFixed(1),
  })), null, 2), 'utf8');
  console.log(`\nහරි! Report එක browser එකේ open කරන්න: ${path.resolve(reportPath)}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run-test.js')) {
  main().catch(e => { console.error('❌', e.message); process.exit(1); });
}
