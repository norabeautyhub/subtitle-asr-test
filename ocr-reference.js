#!/usr/bin/env node
// Video එකේ දැනටමත් burn කරලා තියෙන subtitles Google Cloud Vision OCR වලින් කියවලා
// reference text එකක් (draft) හදනවා. Ayu_1 වගේ subtitles තියෙන videos වලට විතරයි.
//
// පාවිච්චිය:
//   node ocr-reference.js videos/Ayu_1.mp4
//   node ocr-reference.js videos/Ayu_1.mp4 --band 0.60 0.98 --every 0.5
//
// ප්‍රතිඵලය: results/<video>/reference_ocr.txt සහ reference_ocr.srt
// OCR එකත් 100% නිවැරදි නෑ — txt file එක open කරලා වැරදි හදලා save කරන්න.
import dotenv from 'dotenv';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vision from '@google-cloud/vision';
import { mediaDuration, run, ts } from './src/common.js';

dotenv.config({ quiet: true });
// Google Cloud VM එකක නැති නිසා metadata server check එක අවශ්‍ය නෑ (warning නවත්වනවා)
process.env.METADATA_SERVER_DETECTION ??= 'none';

const argv = process.argv.slice(2);
let video = null, every = 0.5, band = [0.60, 0.98], out = 'results';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--every') every = +argv[++i];
  else if (argv[i] === '--band') band = [+argv[++i], +argv[++i]];
  else if (argv[i] === '--out') out = argv[++i];
  else video = argv[i];
}
if (!video || !fs.existsSync(video)) {
  console.log('පාවිච්චිය: node ocr-reference.js videos/<video>.mp4 [--band 0.60 0.98] [--every 0.5]');
  process.exit(1);
}

const outDir = path.join(out, path.parse(video).name);
fs.mkdirSync(outDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-'));
const [y0, y1] = band;
run('ffmpeg', ['-v', 'error', '-i', video, '-vf',
  `fps=1/${every},crop=iw:ih*${(y1 - y0).toFixed(3)}:0:ih*${y0.toFixed(3)},scale=-2:360`,
  path.join(tmp, 'f_%05d.jpg')]);
const frames = fs.readdirSync(tmp).filter(f => f.endsWith('.jpg')).sort();
const dur = mediaDuration(video);
console.log(`Frames ${frames.length} ක් OCR කරනවා...`);

const client = new vision.ImageAnnotatorClient();
const seq = [];
for (let i = 0; i < frames.length; i++) {
  const [res] = await client.textDetection({
    image: { content: fs.readFileSync(path.join(tmp, frames[i])) },
    imageContext: { languageHints: ['si', 'en'] },
  });
  const text = (res.fullTextAnnotation?.text || '').split(/\s+/).filter(Boolean).join(' ');
  seq.push([i * every, text]);
  if (i % 20 === 0) process.stdout.write(`\r  ${i + 1}/${frames.length}`);
}
fs.rmSync(tmp, { recursive: true, force: true });

// එකම text එක දිගටම තියෙන frames එකතු කරනවා
const cues = [];
for (const [t, text] of seq) {
  if (cues.length && cues.at(-1)[2] === text) cues.at(-1)[1] = t + every;
  else cues.push([t, t + every, text]);
}
const real = cues.filter(c => c[2]);
fs.writeFileSync(path.join(outDir, 'reference_ocr.srt'),
  real.map(([s, e, x], i) => `${i + 1}\n${ts(s, ',')} --> ${ts(Math.min(e, dur), ',')}\n${x}\n`).join('\n'), 'utf8');
fs.writeFileSync(path.join(outDir, 'reference_ocr.txt'), real.map(c => c[2]).join(' '), 'utf8');
console.log(`\nහරි! ${path.join(outDir, 'reference_ocr.txt')} — open කරලා OCR වැරදි හදලා save කරන්න.`);
console.log('Product label වගේ subtitle නොවන අකුරු ආවොත් ඒවා මකන්න, නැත්නම් --band වෙනස් කරන්න.');
