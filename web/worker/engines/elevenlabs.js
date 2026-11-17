// ElevenLabs Scribe — Phase 0 test එකේ හොඳම ප්‍රතිඵලය දුන්න engine එක
// scribe_v3 මුලින්, ඒක fail වුණොත් scribe_v2.
import { HttpError } from '../util.js';

const URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODELS = ['scribe_v3', 'scribe_v2'];
const LANG = { si: 'sin', en: 'eng' }; // auto → language_code දාන්නේ නෑ

async function callModel(apiKey, model, audio, language) {
  const form = new FormData();
  form.append('model_id', model);
  if (LANG[language]) form.append('language_code', LANG[language]);
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
  return fetch(URL, { method: 'POST', headers: { 'xi-api-key': apiKey }, body: form });
}

export async function transcribe(env, { audio, language = 'si', apiKey }) {
  const key = apiKey || env.ELEVENLABS_API_KEY;
  if (!key) throw new HttpError(500, 'ElevenLabs API key එක server එකේ set කරලා නෑ');

  let lastErr = '';
  for (const model of MODELS) {
    const r = await callModel(key, model, audio, language);
    if (r.ok) {
      const data = await r.json();
      const words = (data.words || [])
        .filter(w => w.type === 'word' && String(w.text || '').trim())
        .map(w => ({ text: w.text.trim(), start: +w.start, end: +w.end }));
      return { words, text: data.text || '', model };
    }
    const body = (await r.text()).slice(0, 300);
    // Key එකේ ප්‍රශ්නයක් / credits ඉවර නම් අනිත් model එකත් fail වෙනවා — කෙලින්ම කියනවා
    if (r.status === 401) throw new HttpError(502, apiKey ? 'ඔයාගේ ElevenLabs API key එක වැරදියි හරි Speech to Text permission එක නෑ' : 'ElevenLabs API key error (server)');
    if (r.status === 402 || /quota|credits/i.test(body)) throw new HttpError(502, apiKey ? 'ඔයාගේ ElevenLabs account එකේ credits ඉවරයි' : 'ElevenLabs credits ඉවරයි (server)');
    if (r.status === 429) throw new HttpError(503, 'ElevenLabs busy — ටික වෙලාවකින් ආයේ try කරන්න');
    lastErr = `HTTP ${r.status}: ${body}`;
  }
  console.error('ElevenLabs failed', lastErr);
  throw new HttpError(502, 'Subtitles හදන්න බැරි වුණා (ElevenLabs). ආයේ try කරන්න.');
}
