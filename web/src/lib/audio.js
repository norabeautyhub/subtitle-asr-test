// Browser එක ඇතුළෙම video එකෙන් audio එක වෙන් කරලා 16kHz mono WAV කෑලි හදනවා.
// Server එකට යන්නේ පොඩි audio එක විතරයි (video එක නෙවෙයි).

export const RATE = 16000;

/** Video/audio file එක (File / Blob / ArrayBuffer) → 16kHz mono Float32Array */
export async function decodeToMono16k(input) {
  const buf = input instanceof ArrayBuffer ? input : await input.arrayBuffer();
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: RATE });
  try {
    const audio = await ctx.decodeAudioData(buf);
    if (audio.numberOfChannels === 1) return audio.getChannelData(0);
    const out = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const ch = audio.getChannelData(c);
      for (let i = 0; i < ch.length; i++) out[i] += ch[i] / audio.numberOfChannels;
    }
    return out;
  } catch {
    throw new Error('මේ video එකේ audio එක කියවන්න බැරි වුණා (audio track එකක් නැද්ද?)');
  } finally {
    ctx.close();
  }
}

/**
 * දිග audio එක maxSec කෑලිවලට කපනවා — කපන්නේ ඒ කාලය අතර තියෙන නිහඬම තැනින්
 * (වචනයක් මැදින් කැපෙන්නේ නැති වෙන්න).
 * @returns {{start: number, samples: Float32Array}[]}  start = තත්පර
 */
export function splitAtSilence(samples, maxSec = 300, searchSec = 30) {
  const max = maxSec * RATE;
  const chunks = [];
  let pos = 0;
  while (samples.length - pos > max) {
    const winStart = pos + max - searchSec * RATE;
    const frame = RATE / 10; // 100ms
    let best = pos + max, bestE = Infinity;
    for (let f = winStart; f + frame <= pos + max; f += frame) {
      let e = 0;
      for (let i = f; i < f + frame; i++) e += samples[i] * samples[i];
      if (e < bestE) { bestE = e; best = f + frame / 2; }
    }
    best = Math.floor(best);
    chunks.push({ start: pos / RATE, samples: samples.subarray(pos, best) });
    pos = best;
  }
  chunks.push({ start: pos / RATE, samples: samples.subarray(pos) });
  return chunks;
}

/** Float32Array → 16-bit PCM WAV (ArrayBuffer) */
export function encodeWav(samples) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** Video file එකේ දිග, width, height */
export function readMediaMeta(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const r = { duration: el.duration, width: el.videoWidth || 0, height: el.videoHeight || 0 };
      URL.revokeObjectURL(url);
      Number.isFinite(r.duration) && r.duration > 0 ? resolve(r) : reject(new Error('Video එකේ දිග කියවන්න බැරි වුණා'));
    };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('මේ file එක browser එකට කියවන්න බෑ. MP4 (H.264) file එකක් try කරන්න.')); };
    el.src = url;
  });
}
