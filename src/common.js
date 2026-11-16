// පොදු උපකාරක functions: audio extract, chunking, SRT/VTT ලිවීම.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** @typedef {{text: string, start: number, end: number}} Word */
/** @typedef {{engine: string, words: Word[], text: string, secondsTaken: number, timingNote?: string, error?: string}} EngineResult */

export function result(engine, words = [], text = '', secondsTaken = 0, extra = {}) {
  return { engine, words, text, secondsTaken, timingNote: '', error: '', ...extra };
}

export function run(cmd, args) {
  const p = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (p.error) {
    if (p.error.code === 'ENOENT') throw new Error(`${cmd} හම්බවුණේ නෑ — install කරලා terminal එක ආයේ open කරන්න`);
    throw p.error;
  }
  if (p.status !== 0) throw new Error(`Command failed: ${cmd} ${args.join(' ')}\n${(p.stderr || '').slice(-2000)}`);
  return (p.stderr || '') + (p.stdout || '');
}

export function mediaDuration(file) {
  const out = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return parseFloat(out.trim());
}

/** Video එකෙන් audio දෙකක්: mp3 (upload වලට) සහ 16kHz mono flac (Google වලට) */
export function extractAudio(video, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const mp3 = path.join(outDir, 'audio.mp3');
  const flac = path.join(outDir, 'audio_16k.flac');
  run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '44100', '-b:a', '128k', mp3]);
  run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vn', '-ac', '1', '-ar', '16000', '-sample_fmt', 's16', flac]);
  return { mp3, flac };
}

/** නිශ්ශබ්ද තැන්වල මැද තත්පර (audio කපන්න හොඳම තැන්) */
export function silencePoints(audio, noiseDb = -35, minSil = 0.2) {
  const log = run('ffmpeg', ['-v', 'info', '-i', audio, '-af', `silencedetect=noise=${noiseDb}dB:d=${minSil}`, '-f', 'null', '-']);
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  return starts.slice(0, ends.length).map((s, i) => (s + ends[i]) / 2);
}

/**
 * Audio එක maxLen ට අඩු කෑලිවලට, පුළුවන් තරම් නිහඬ තැනකින් කපනවා.
 * Background music තියෙන videos වලට threshold එක ක්‍රමයෙන් ලිහිල් කරනවා.
 * @returns {{file: string, offset: number}[]}
 */
export function splitAudio(audio, outDir, maxLen = 50) {
  const total = mediaDuration(audio);
  const levels = [-40, -35, -30, -25, -20].map(db => silencePoints(audio, db, 0.2));
  const cuts = [0];
  while (total - cuts.at(-1) > maxLen) {
    const lo = cuts.at(-1) + maxLen * 0.5, hi = cuts.at(-1) + maxLen;
    let cut = hi;
    for (const sil of levels) {
      const c = sil.filter(s => s >= lo && s <= hi);
      if (c.length) { cut = Math.max(...c); break; }
    }
    cuts.push(cut);
  }
  cuts.push(total);
  fs.mkdirSync(outDir, { recursive: true });
  const chunks = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const file = path.join(outDir, `chunk_${String(i).padStart(3, '0')}.flac`);
    run('ffmpeg', ['-y', '-v', 'error', '-ss', cuts[i].toFixed(3), '-to', cuts[i + 1].toFixed(3),
      '-i', audio, '-ac', '1', '-ar', '16000', file]);
    chunks.push({ file, offset: cuts[i] });
  }
  return chunks;
}

// ---------- Subtitle lines ----------

/** වචන subtitle lines වලට එකතු කරනවා → Word[][] */
export function groupWordLists(words, { maxWords = 5, maxChars = 32, maxDur = 3.0, gap = 0.6 } = {}) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    if (cur.length) {
      const len = [...cur, w].map(x => x.text).join(' ').length;
      if (cur.length >= maxWords || len > maxChars || w.end - cur[0].start > maxDur || w.start - cur.at(-1).end > gap) {
        lines.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

export function ts(t, sep) {
  const ms = Math.round(Math.max(0, t) * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(h)}:${p(m)}:${p(s)}${sep}${p(ms % 1000, 3)}`;
}

export function toSrt(words) {
  return groupWordLists(words).map((l, i) =>
    `${i + 1}\n${ts(l[0].start, ',')} --> ${ts(l.at(-1).end, ',')}\n${l.map(w => w.text).join(' ')}\n`).join('\n');
}

export function toVtt(words) {
  return 'WEBVTT\n\n' + groupWordLists(words).map(l =>
    `${ts(l[0].start, '.')} --> ${ts(l.at(-1).end, '.')}\n${l.map(w => w.text).join(' ')}\n`).join('\n');
}

export function saveResult(res, outDir) {
  fs.writeFileSync(path.join(outDir, `${res.engine}.json`), JSON.stringify(res, null, 2), 'utf8');
  if (res.words.length) {
    fs.writeFileSync(path.join(outDir, `${res.engine}.srt`), toSrt(res.words), 'utf8');
    fs.writeFileSync(path.join(outDir, `${res.engine}.vtt`), toVtt(res.words), 'utf8');
  }
}

/** Segment එකක timing එක වචනවලට අකුරු ගණන අනුව බෙදනවා (approximate) */
export function spreadTiming(text, start, end) {
  const toks = text.split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const total = toks.reduce((a, t) => a + t.length, 0);
  const dur = Math.max(end - start, 0.01);
  let t = start;
  return toks.map(tok => {
    const d = dur * tok.length / total;
    const w = { text: tok, start: +t.toFixed(3), end: +(t + d).toFixed(3) };
    t += d;
    return w;
  });
}
