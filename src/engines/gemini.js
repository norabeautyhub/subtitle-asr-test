// Gemini (general model) — audio එක අහලා timestamps එක්ක සිංහල text දෙනවා.
// සැලකිය යුතුයි: Gemini 3.5 Transcribe සිංහල support කරන්නේ නෑ, ඒ නිසා සාමාන්‍ය Gemini
// model එකක් prompt එකකින් පාවිච්චි කරනවා. Timing segment මට්ටමින් විතරයි — approximate.
import { GoogleGenAI, createUserContent, createPartFromUri } from '@google/genai';
import { result, spreadTiming } from '../common.js';

const PROMPT = `You are a professional Sinhala subtitle transcriber.
Transcribe the spoken audio EXACTLY as spoken (verbatim), in Sinhala Unicode script.
If the speaker says an English word, write it in English letters.
Do not translate, summarise or correct grammar.
Return ONLY a JSON array of short subtitle segments (2-6 words each), in time order:
[{"start": 0.00, "end": 1.25, "text": "..."}]
start/end are seconds from the beginning of the audio, with 2 decimals.`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function parseJson(text) {
  const m = text.match(/\[[\s\S]*\]/);
  return JSON.parse(m ? m[0] : text);
}

export async function transcribe(mp3) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const name = `gemini_${model}`;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return result(name, [], '', 0, { error: 'GEMINI_API_KEY නෑ (.env බලන්න)' });

  const t0 = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    let file = await ai.files.upload({ file: mp3, config: { mimeType: 'audio/mpeg' } });
    for (let i = 0; i < 60 && file.state !== 'ACTIVE'; i++) {
      if (file.state === 'FAILED') throw new Error('Gemini file upload failed');
      await sleep(2000);
      file = await ai.files.get({ name: file.name });
    }
    const resp = await ai.models.generateContent({
      model,
      contents: createUserContent([createPartFromUri(file.uri, file.mimeType), PROMPT]),
      config: { temperature: 0, responseMimeType: 'application/json' },
    });
    const words = [], texts = [];
    for (const s of parseJson(resp.text)) {
      const t = String(s.text || '').trim();
      if (!t) continue;
      texts.push(t);
      words.push(...spreadTiming(t, +s.start, +s.end));
    }
    return result(name, words, texts.join(' '), (Date.now() - t0) / 1000,
      { timingNote: 'approximate (segment-level)' });
  } catch (e) {
    return result(name, [], '', (Date.now() - t0) / 1000, { error: `${e.name}: ${e.message}` });
  }
}
