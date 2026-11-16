// Cloudflare Workers AI — Whisper large-v3-turbo (Standard plan engine)
// සැලකිය යුතුයි: මේක සාමාන්‍ය Whisper එක, සිංහල fine-tuned model එකක් නෙවෙයි.
// .env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
import fs from 'node:fs';
import path from 'node:path';
import { result, splitAudio, spreadTiming } from '../common.js';

const MODEL = '@cf/openai/whisper-large-v3-turbo';
// සිංහල අකුරෙන් ලියන්න model එකට ඉඟියක් (romanized/Tamil script එක එන එක අඩු කරන්න)
const DEFAULT_PROMPT = 'මෙය සිංහල භාෂාවෙන් කරන කථාවකි.';

async function runChunk(file, accountId, token, language) {
  const body = {
    audio: fs.readFileSync(file).toString('base64'),
    task: 'transcribe',
    language,
    initial_prompt: process.env.CLOUDFLARE_INITIAL_PROMPT ?? (language === 'si' ? DEFAULT_PROMPT : undefined),
    condition_on_previous_text: false, // repeat වෙන "hallucination" අඩු කරන්න
  };
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.success === false) {
    const msg = data.errors?.map(e => e.message).join('; ') || JSON.stringify(data).slice(0, 300);
    throw new Error(`HTTP ${r.status}: ${msg}`);
  }
  return data.result || data;
}

export async function transcribe(mp3, workDir, language = 'si') {
  const name = 'cloudflare_whisper_turbo';
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) {
    return result(name, [], '', 0, { error: 'CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN නෑ (.env බලන්න)' });
  }
  const t0 = Date.now();
  try {
    const words = [], texts = [];
    let segmentOnly = false;
    // දිග audio එකක් එකපාර යවනවට වඩා විනාඩි 2 කෑලිවලට කපලා යවනවා (request size සීමා නිසා)
    for (const { file, offset } of splitAudio(mp3, path.join(workDir, 'cloudflare_chunks'), 120, 'mp3')) {
      const res = await runChunk(file, accountId, token, language);
      texts.push((res.text || '').trim());
      for (const seg of res.segments || []) {
        if (seg.words?.length) {
          for (const w of seg.words) {
            const t = String(w.word || '').trim();
            if (t) words.push({ text: t, start: +(offset + w.start).toFixed(3), end: +(offset + w.end).toFixed(3) });
          }
        } else if ((seg.text || '').trim()) {
          // Word timing නැත්නම් segment එකේ timing එක වචනවලට බෙදනවා
          segmentOnly = true;
          words.push(...spreadTiming(seg.text.trim(), offset + seg.start, offset + seg.end));
        }
      }
    }
    return result(name, words, texts.join(' '), (Date.now() - t0) / 1000,
      { timingNote: segmentOnly ? 'සමහර කොටස් approximate (segment-level)' : '' });
  } catch (e) {
    return result(name, [], '', (Date.now() - t0) / 1000, { error: `${e.name}: ${e.message}` });
  }
}
