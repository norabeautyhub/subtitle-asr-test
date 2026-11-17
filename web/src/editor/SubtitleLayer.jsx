// Subtitles අඳින component එක — editor preview එකේයි MP4 export එකේයි දෙකේම මේකමයි.
// Remotion web renderer එක support කරන CSS විතරයි පාවිච්චි කරන්නේ
// (color, -webkit-text-stroke, paint-order, text-shadow, transform, opacity, background, border-radius).
import { fontFamilyCss } from './fonts.js';
import { activeLineIndex, lineEnd, lineStart } from './model.js';

const SINHALA_RE = /[\u0D80-\u0DFF]/;
const clamp01 = x => Math.max(0, Math.min(1, x));
const easeOutCubic = x => 1 - (1 - x) ** 3;
const easeOutBack = x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
const easeOutBounce = x => {
  const n = 7.5625, d = 2.75;
  if (x < 1 / d) return n * x * x;
  if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
  if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
  return n * (x -= 2.625 / d) * x + 0.984375;
};

const segmenter = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('si', { granularity: 'grapheme' }) : null;
/** සිංහල අක්ෂර නොකැඩෙන විදිහට කඩනවා (කො = එක අක්ෂරයක්) */
export const graphemes = s => (segmenter ? [...segmenter.segment(s)].map(x => x.segment) : [...s]);

const hexToRgba = (hex, a) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Line එක එන animation එක (container එකට) */
function lineAnim(anim, t, start, end, speed) {
  const d = 0.28 / speed;
  const p = clamp01((t - start) / d);
  const out = clamp01((end + 0.15 - t) / 0.12); // අන්තිමට පොඩි fade out එකක්
  switch (anim) {
    case 'fade': return { opacity: p * out, y: 0, scale: 1 };
    case 'pop': return { opacity: Math.min(1, p * 2) * out, y: 0, scale: 0.55 + 0.45 * easeOutBack(p) };
    case 'slide': return { opacity: p * out, y: (1 - easeOutCubic(p)) * 0.7, scale: 1 };
    case 'bounce': return { opacity: Math.min(1, p * 3) * out, y: -(1 - easeOutBounce(p)) * 0.9, scale: 1 };
    default: return { opacity: out, y: 0, scale: 1 };
  }
}

function SubtitleLine({ line, t, style, s }) {
  const start = lineStart(line), end = lineEnd(line);
  const speed = style.animSpeed || 1;
  const a = lineAnim(style.animation, t, start, end, speed);
  const fontSize = style.fontSize * s;

  let k = -1;
  line.words.forEach((w, i) => { if (t >= w.start) k = i; });

  const shadows = [];
  if (style.shadow && (style.shadow.blur || style.shadow.x || style.shadow.y)) {
    shadows.push(`${style.shadow.x * s}px ${style.shadow.y * s}px ${style.shadow.blur * s}px ${style.shadow.color}`);
  }
  if (style.glow?.size > 0) {
    shadows.push(`0 0 ${style.glow.size * s}px ${style.glow.color}`, `0 0 ${style.glow.size * 2 * s}px ${style.glow.color}`);
  }

  const baseWord = {
    display: 'inline-block',
    whiteSpace: 'pre',
    color: style.color,
    WebkitTextStroke: style.strokeWidth > 0 ? `${style.strokeWidth * 2 * s}px ${style.strokeColor}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: shadows.length ? shadows.join(', ') : undefined,
    transformOrigin: '50% 60%',
  };
  if (style.gradient?.enabled) {
    Object.assign(baseWord, {
      backgroundImage: `linear-gradient(180deg, ${style.gradient.from}, ${style.gradient.to})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent',
    });
  }

  const words = line.words.map((w, i) => {
    const active = i === k && style.highlight !== 'none';
    const ws = { ...baseWord };
    if (SINHALA_RE.test(w.text) && style.siScale && style.siScale !== 1) ws.fontSize = `${fontSize * style.siScale}px`;
    if (active) {
      if (style.gradient?.enabled) Object.assign(ws, { backgroundImage: 'none', WebkitTextFillColor: style.highlightColor });
      if (style.highlight === 'color' || style.highlight === 'scale' || style.highlight === 'underline') ws.color = style.highlightColor;
      if (style.highlight === 'scale') ws.transform = 'scale(1.12)';
      if (style.highlight === 'box') {
        Object.assign(ws, { backgroundColor: style.highlightBoxColor, borderRadius: `${0.18 * fontSize}px`, padding: `0 ${0.14 * fontSize}px`, margin: `0 ${-0.14 * fontSize}px` });
      }
      if (style.highlight === 'underline') {
        Object.assign(ws, { textDecorationLine: 'underline', textDecorationColor: style.highlightColor, textDecorationThickness: `${0.08 * fontSize}px`, textUnderlineOffset: `${0.12 * fontSize}px` });
      }
    }
    // Word by word: කියවෙනකොට විතරයි පේන්නේ
    if (style.animation === 'word') {
      const p = clamp01((t - w.start + 0.03) / (0.16 / speed));
      if (p <= 0) ws.opacity = 0;
      else ws.transform = `${ws.transform || ''} scale(${0.7 + 0.3 * easeOutBack(p)})`;
    }
    let content = w.text;
    if (style.animation === 'typewriter') {
      const g = graphemes(w.text);
      const dur = Math.min(Math.max(w.end - w.start, 0.12), 0.5) / speed;
      const n = Math.round(clamp01((t - w.start) / dur) * g.length);
      if (n < g.length) {
        content = [<span key="v">{g.slice(0, n).join('')}</span>, <span key="h" style={{ opacity: 0 }}>{g.slice(n).join('')}</span>];
      }
    }
    return <span key={i} style={ws}>{content}</span>;
  });

  const box = style.box?.enabled ? {
    backgroundColor: hexToRgba(style.box.color, style.box.opacity),
    borderRadius: `${style.box.radius * s}px`,
    padding: `${style.box.padding * 0.5 * s}px ${style.box.padding * s}px`,
  } : {};

  return (
    <div
      data-sub-line
      style={{
        position: 'absolute',
        left: `${style.position.x}%`,
        top: `${style.position.y}%`,
        width: `${style.maxWidth}%`,
        transform: `translate(-50%, -50%) translateY(${a.y * fontSize}px) scale(${a.scale})`,
        opacity: a.opacity,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline',
          columnGap: `${0.28 * fontSize}px`,
          fontFamily: fontFamilyCss(style),
          fontSize: `${fontSize}px`,
          fontWeight: style.weight,
          lineHeight: style.lineHeight,
          letterSpacing: `${style.letterSpacing * s}px`,
          textTransform: style.uppercase ? 'uppercase' : 'none',
          textAlign: 'center',
          ...box,
        }}
      >
        {words}
      </div>
    </div>
  );
}

/** time (තත්පර), width/height = video එකේ px ප්‍රමාණය */
export default function SubtitleLayer({ lines, style, time, width, height }) {
  const s = height / 1080;
  const i = activeLineIndex(lines, time);
  return (
    <div style={{ position: 'absolute', inset: 0, width, height, overflow: 'hidden', pointerEvents: 'none' }}>
      {i >= 0 && <SubtitleLine key={lines[i].id} line={lines[i]} t={time} style={style} s={s} />}
    </div>
  );
}

export function Watermark({ height }) {
  const s = height / 1080;
  return (
    <div style={{
      position: 'absolute', right: `${24 * s}px`, bottom: `${20 * s}px`, fontFamily: 'sans-serif', fontWeight: 700,
      fontSize: `${26 * s}px`, color: 'rgba(255,255,255,0.8)', textShadow: `0 ${2 * s}px ${6 * s}px rgba(0,0,0,0.8)`,
      backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: `${8 * s}px`, padding: `${4 * s}px ${10 * s}px`,
    }}>
      Novi Subtitles
    </div>
  );
}
