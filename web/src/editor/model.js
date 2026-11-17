// Editor data model: subtitle lines + style
//   doc = { v: 1, sourceUpdatedAt, lines: [{ id, words: [{text, start, end}] }], style: {...} }
// Sizes (font size, stroke, ...) 1080px උස video එකකට — export කරනකොට video එකේ උසට scale වෙනවා.

export const DEFAULT_STYLE = {
  template: 'tiktok',
  fontSi: 'Noto Sans Sinhala',
  fontEn: 'Montserrat',
  fontSize: 64,
  siScale: 1.15, // සිංහල අකුරු English අකුරු වලට වඩා පොඩියට පේන නිසා
  weight: 800,
  uppercase: false,
  letterSpacing: 0,
  lineHeight: 1.3,
  color: '#ffffff',
  highlightColor: '#facc15',
  gradient: { enabled: false, from: '#ffffff', to: '#22d3ee' },
  strokeWidth: 7,
  strokeColor: '#000000',
  shadow: { blur: 8, x: 0, y: 4, color: '#000000' },
  glow: { size: 0, color: '#22d3ee' },
  box: { enabled: false, color: '#000000', opacity: 0.6, radius: 16, padding: 18 },
  highlight: 'color', // 'color' | 'scale' | 'box' | 'underline' | 'none'
  highlightBoxColor: '#7c3aed',
  animation: 'pop', // 'none' | 'fade' | 'pop' | 'slide' | 'bounce' | 'typewriter' | 'word'
  animSpeed: 1,
  position: { x: 50, y: 78 }, // % (subtitle එකේ මැද)
  maxWidth: 86, // % of video width
  maxWords: 4,
  maxChars: 28,
};

export const TEMPLATES = [
  {
    id: 'tiktok', name: 'TikTok Bold',
    style: { fontEn: 'Montserrat', weight: 800, fontSize: 66, uppercase: true, color: '#ffffff', highlightColor: '#facc15', strokeWidth: 8, strokeColor: '#000000', shadow: { blur: 0, x: 0, y: 6, color: '#000000' }, glow: { size: 0, color: '#22d3ee' }, box: { ...DEFAULT_STYLE.box, enabled: false }, highlight: 'scale', animation: 'pop', maxWords: 3, gradient: { ...DEFAULT_STYLE.gradient, enabled: false } },
  },
  {
    id: 'clean', name: 'Clean White',
    style: { fontEn: 'Inter', weight: 700, fontSize: 52, uppercase: false, color: '#ffffff', highlightColor: '#ffffff', strokeWidth: 0, shadow: { blur: 12, x: 0, y: 3, color: 'rgba(0,0,0,0.85)' }, glow: { size: 0, color: '#ffffff' }, box: { ...DEFAULT_STYLE.box, enabled: false }, highlight: 'none', animation: 'fade', maxWords: 6, gradient: { ...DEFAULT_STYLE.gradient, enabled: false } },
  },
  {
    id: 'karaoke', name: 'Karaoke',
    style: { fontEn: 'Poppins', weight: 800, fontSize: 60, uppercase: false, color: '#ffffff', highlightColor: '#22d3ee', strokeWidth: 6, strokeColor: '#1e1b4b', shadow: { blur: 6, x: 0, y: 4, color: '#000000' }, glow: { size: 0, color: '#22d3ee' }, box: { ...DEFAULT_STYLE.box, enabled: false }, highlight: 'color', animation: 'word', maxWords: 5, gradient: { ...DEFAULT_STYLE.gradient, enabled: false } },
  },
  {
    id: 'news', name: 'News Box',
    style: { fontEn: 'Oswald', weight: 700, fontSize: 50, uppercase: false, color: '#ffffff', highlightColor: '#fde047', strokeWidth: 0, shadow: { blur: 0, x: 0, y: 0, color: '#000000' }, glow: { size: 0, color: '#ffffff' }, box: { enabled: true, color: '#b91c1c', opacity: 0.92, radius: 6, padding: 16 }, highlight: 'color', animation: 'slide', maxWords: 7, position: { x: 50, y: 84 }, gradient: { ...DEFAULT_STYLE.gradient, enabled: false } },
  },
  {
    id: 'neon', name: 'Neon Glow',
    style: { fontEn: 'Lilita One', weight: 400, fontSize: 64, uppercase: false, color: '#f0abfc', highlightColor: '#ffffff', strokeWidth: 2, strokeColor: '#701a75', shadow: { blur: 0, x: 0, y: 0, color: '#000000' }, glow: { size: 22, color: '#e879f9' }, box: { ...DEFAULT_STYLE.box, enabled: false }, highlight: 'scale', animation: 'bounce', maxWords: 4, gradient: { ...DEFAULT_STYLE.gradient, enabled: false } },
  },
];

export const ANIMATIONS = [
  ['none', 'නෑ'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide up'],
  ['bounce', 'Bounce'], ['typewriter', 'Typewriter'], ['word', 'Word by word'],
];
export const HIGHLIGHTS = [['color', 'Color'], ['scale', 'ලොකු වෙනවා'], ['box', 'Box'], ['underline', 'Underline'], ['none', 'නෑ']];

let seq = 0;
export const lineId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export const lineStart = l => l.words[0]?.start ?? 0;
export const lineEnd = l => l.words.at(-1)?.end ?? 0;
export const lineText = l => l.words.map(w => w.text).join(' ');

/** Transcript words → lines (style එකේ maxWords / maxChars අනුව) */
export function buildLines(words, { maxWords = 4, maxChars = 28, maxDur = 3.2, gap = 0.6 } = {}) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    if (cur.length) {
      const len = [...cur, w].map(x => x.text).join(' ').length;
      if (cur.length >= maxWords || len > maxChars || w.end - cur[0].start > maxDur || w.start - cur.at(-1).end > gap) {
        lines.push({ id: lineId(), words: cur });
        cur = [];
      }
    }
    cur.push({ text: w.text, start: w.start, end: w.end });
  }
  if (cur.length) lines.push({ id: lineId(), words: cur });
  return lines;
}

export const allWords = lines => lines.flatMap(l => l.words);

export function newDoc(transcript, style = DEFAULT_STYLE) {
  return { v: 1, sourceUpdatedAt: transcript?.updated_at || 0, style: { ...style }, lines: buildLines(transcript?.words || [], style) };
}

/** Line එකක text එක edit කළාම: වචන ගණන එකම නම් timing එහෙම්මම, නැත්නම් line එකේ කාලය අකුරු ගණන අනුව බෙදනවා */
export function setLineText(line, text) {
  const toks = text.split(/\s+/).filter(Boolean);
  if (!toks.length) return { ...line, words: [] };
  if (toks.length === line.words.length) {
    return { ...line, words: line.words.map((w, i) => ({ ...w, text: toks[i] })) };
  }
  const start = lineStart(line), end = Math.max(lineEnd(line), start + 0.3);
  const total = toks.reduce((a, t) => a + t.length, 0);
  let t = start;
  return {
    ...line,
    words: toks.map(tok => {
      const d = ((end - start) * tok.length) / total;
      const w = { text: tok, start: +t.toFixed(3), end: +(t + d).toFixed(3) };
      t += d;
      return w;
    }),
  };
}

/** wordIndex එකෙන් line එක දෙකට කඩනවා (wordIndex එකේ වචනය දෙවෙනි line එකේ මුලට) */
export function splitLine(lines, idx, wordIndex) {
  const l = lines[idx];
  if (!l || wordIndex <= 0 || wordIndex >= l.words.length) return lines;
  const a = { ...l, words: l.words.slice(0, wordIndex) };
  const b = { id: lineId(), words: l.words.slice(wordIndex) };
  return [...lines.slice(0, idx), a, b, ...lines.slice(idx + 1)];
}

export function mergeWithNext(lines, idx) {
  if (idx < 0 || idx >= lines.length - 1) return lines;
  const merged = { ...lines[idx], words: [...lines[idx].words, ...lines[idx + 1].words] };
  return [...lines.slice(0, idx), merged, ...lines.slice(idx + 2)];
}

export const deleteLine = (lines, idx) => lines.filter((_, i) => i !== idx);

/** Line එකේ timing එක shift / වෙනස් කරනවා (start/end දෙකම, වචන proportion එකට) */
export function setLineTiming(line, newStart, newEnd) {
  const s0 = lineStart(line), e0 = lineEnd(line);
  newStart = Math.max(0, newStart);
  newEnd = Math.max(newStart + 0.1, newEnd);
  const k = e0 > s0 ? (newEnd - newStart) / (e0 - s0) : 1;
  return {
    ...line,
    words: line.words.map(w => ({ ...w, start: +(newStart + (w.start - s0) * k).toFixed(3), end: +(newStart + (w.end - s0) * k).toFixed(3) })),
  };
}

export const regroup = (lines, style) => buildLines(allWords(lines), style);

/** දැනට පේන line එක (time t) */
export function activeLineIndex(lines, t, tail = 0.15) {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.words.length) continue;
    const next = lines[i + 1];
    const end = Math.min(lineEnd(l) + tail, next?.words.length ? lineStart(next) : Infinity);
    if (t >= lineStart(l) && t < end) return i;
  }
  return -1;
}

// ---------------- SRT / VTT ----------------
const stamp = (t, sep) => {
  const ms = Math.round(Math.max(0, t) * 1000);
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`;
};
const nonEmpty = lines => lines.filter(l => l.words.length);
export const linesToSrt = lines => nonEmpty(lines).map((l, i) => `${i + 1}\n${stamp(lineStart(l), ',')} --> ${stamp(lineEnd(l), ',')}\n${lineText(l)}\n`).join('\n');
export const linesToVtt = lines => 'WEBVTT\n\n' + nonEmpty(lines).map(l => `${stamp(lineStart(l), '.')} --> ${stamp(lineEnd(l), '.')}\n${lineText(l)}\n`).join('\n');
