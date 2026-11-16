// ElevenLabs Scribe — සිංහල language code: 'sin'
import fs from 'node:fs';
import path from 'node:path';
import { result } from '../common.js';

const URL = 'https://api.elevenlabs.io/v1/speech-to-text';

export async function transcribe(mp3, modelId = 'scribe_v2', language = 'sin') {
  const name = `elevenlabs_${modelId}`;
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return result(name, [], '', 0, { error: 'ELEVENLABS_API_KEY නෑ (.env බලන්න)' });

  const t0 = Date.now();
  try {
    const form = new FormData();
    form.append('model_id', modelId);
    form.append('language_code', language);
    form.append('timestamps_granularity', 'word');
    form.append('tag_audio_events', 'false');
    form.append('file', new Blob([fs.readFileSync(mp3)], { type: 'audio/mpeg' }), path.basename(mp3));

    const r = await fetch(URL, { method: 'POST', headers: { 'xi-api-key': key }, body: form });
    const took = (Date.now() - t0) / 1000;
    if (!r.ok) return result(name, [], '', took, { error: `HTTP ${r.status}: ${(await r.text()).slice(0, 500)}` });

    const data = await r.json();
    const words = (data.words || [])
      .filter(w => w.type === 'word' && (w.text || '').trim())
      .map(w => ({ text: w.text.trim(), start: +w.start, end: +w.end }));
    return result(name, words, data.text || '', took);
  } catch (e) {
    return result(name, [], '', (Date.now() - t0) / 1000, { error: `${e.name}: ${e.message}` });
  }
}
