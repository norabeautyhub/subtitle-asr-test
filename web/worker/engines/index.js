// Speech-to-text engines (plug-ins)
// අලුත් engine එකක් එකතු කරන්න: මේ folder එකේ file එකක් හදලා පහළ ENGINES එකට එකතු කරන්න.
// හැම engine එකක්ම: transcribe(env, { audio: ArrayBuffer (16kHz WAV), language: 'si'|'en'|'auto', apiKey? })
//                  → { words: [{text, start, end}], text, model }
import * as elevenlabs from './elevenlabs.js';
import * as mock from './mock.js';

export const ENGINES = {
  elevenlabs: { label: 'ElevenLabs', byok: false, impl: elevenlabs },
  elevenlabs_byok: { label: 'ElevenLabs (ඔයාගේ key)', byok: true, impl: elevenlabs },
  // පස්සේ: whisper_sinhala: { label: 'Sinhala Whisper', byok: false, impl: whisperSinhala },
};

export function getEngine(env, name) {
  const e = ENGINES[name];
  if (!e) throw new Error(`Engine "${name}" නෑ`);
  // Local testing වලට: ELEVENLABS_MOCK=1 නම් ඇත්ත API එකට යන්නේ නෑ
  if (env.ELEVENLABS_MOCK === '1') return { ...e, impl: mock };
  return e;
}
