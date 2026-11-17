// Browser එකෙන් එවන WAV audio එක check කරලා දිග (තත්පර) ගණන් කරනවා.
// Credits අඩු කරන්නේ මේ දිග අනුව — browser එක කියන දිග විශ්වාස කරන්නේ නෑ.
import { HttpError } from './util.js';

export const WAV_RATE = 16000; // 16kHz, mono, 16-bit PCM

export function parseWav(buf) {
  const v = new DataView(buf instanceof ArrayBuffer ? buf : buf.buffer);
  const str = (o, n) => String.fromCharCode(...new Uint8Array(v.buffer, v.byteOffset + o, n));
  if (v.byteLength < 44 || str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE') throw new HttpError(400, 'Audio එක WAV format එකේ නෙවෙයි');

  let fmt = null, dataBytes = 0, off = 12;
  while (off + 8 <= v.byteLength) {
    const id = str(off, 4);
    const size = v.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = {
        format: v.getUint16(off + 8, true),
        channels: v.getUint16(off + 10, true),
        rate: v.getUint32(off + 12, true),
        bits: v.getUint16(off + 22, true),
      };
    } else if (id === 'data') {
      dataBytes = Math.min(size, v.byteLength - off - 8);
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || fmt.format !== 1 || fmt.channels !== 1 || fmt.bits !== 16 || fmt.rate !== WAV_RATE) {
    throw new HttpError(400, 'Audio එක 16kHz mono 16-bit WAV විය යුතුයි');
  }
  if (!dataBytes) throw new HttpError(400, 'Audio එක හිස්');
  return { seconds: dataBytes / (WAV_RATE * 2) };
}
