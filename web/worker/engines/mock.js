// Testing වලට විතරයි (ELEVENLABS_MOCK=1). ඇත්ත API එකට යන්නේ නෑ, credits වැය වෙන්නේ නෑ.
import { parseWav } from '../wav.js';

const SI = ['මෙය', 'පරීක්ෂණ', 'උපසිරැසි', 'වේ', 'ශරීරයේ', 'මේදය', 'අඩුවෙලා', 'ඔබේ', 'සිරුර', 'ලස්සන', 'වෙනවා'];
const EN = ['this', 'is', 'a', 'test', 'subtitle', 'for', 'your', 'video'];

export async function transcribe(env, { audio, language = 'si' }) {
  const { seconds } = parseWav(audio);
  const list = language === 'en' ? EN : SI;
  const words = [];
  for (let t = 0.3, i = 0; t + 0.4 < seconds; t += 0.55, i++) {
    words.push({ text: list[i % list.length], start: +t.toFixed(2), end: +(t + 0.45).toFixed(2) });
  }
  return { words, text: words.map(w => w.text).join(' '), model: 'mock' };
}
