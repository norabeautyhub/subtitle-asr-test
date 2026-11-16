// Google Cloud Speech-to-Text V2 — Chirp 2, si-LK (asia-southeast1 region)
// Sync recognize එකට විනාඩියකට අඩු audio විතරයි, ඒ නිසා audio එක කෑලිවලට කපලා යවනවා.
// Login: `gcloud auth application-default login` සහ .env එකේ GOOGLE_CLOUD_PROJECT
import fs from 'node:fs';
import path from 'node:path';
import speech from '@google-cloud/speech';
import { result, splitAudio } from '../common.js';

const secs = d => (d ? Number(d.seconds || 0) + (d.nanos || 0) / 1e9 : 0);

export async function transcribe(flac, workDir, model = 'chirp_2') {
  const name = `google_${model}`;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const region = process.env.GOOGLE_STT_REGION || 'asia-southeast1';
  if (!project) return result(name, [], '', 0, { error: 'GOOGLE_CLOUD_PROJECT නෑ (.env බලන්න)' });

  const t0 = Date.now();
  let client;
  try {
    client = new speech.v2.SpeechClient({ apiEndpoint: `${region}-speech.googleapis.com` });
    // Login කරලාද කියලා මුලින්ම check කරනවා (නැත්නම් පැහැදිලි error එකක්)
    try { await client.auth.getClient(); } catch {
      throw new Error('Google login නෑ — `gcloud auth application-default login` run කරන්න');
    }
    const config = {
      autoDecodingConfig: {},
      languageCodes: ['si-LK'],
      model,
      features: { enableWordTimeOffsets: true, enableAutomaticPunctuation: true },
    };
    const recognizer = `projects/${project}/locations/${region}/recognizers/_`;
    const words = [], texts = [];
    for (const { file, offset } of splitAudio(flac, path.join(workDir, 'google_chunks'))) {
      const [resp] = await client.recognize({ recognizer, config, content: fs.readFileSync(file) });
      for (const r of resp.results || []) {
        const alt = r.alternatives?.[0];
        if (!alt) continue;
        texts.push((alt.transcript || '').trim());
        for (const w of alt.words || []) {
          words.push({
            text: (w.word || '').trim(),
            start: +(offset + secs(w.startOffset)).toFixed(3),
            end: +(offset + secs(w.endOffset)).toFixed(3),
          });
        }
      }
    }
    await client.close();
    return result(name, words, texts.join(' '), (Date.now() - t0) / 1000,
      { timingNote: words.length ? '' : 'word timings ලැබුණේ නෑ' });
  } catch (e) {
    client?.close().catch(() => {});
    return result(name, [], '', (Date.now() - t0) / 1000, { error: `${e.name}: ${e.message}` });
  }
}
