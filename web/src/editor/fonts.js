// Fonts — @fontsource packages වලින් (අපේම website එකෙන් load වෙනවා, Google ට යන්නේ නෑ).
// Export (Remotion web renderer) එකේ වැඩ කරන්න @remotion/fonts loadFont() පාවිච්චි කරනවා.
// මේ file එක generate කළේ script එකකින් — font එකක් එකතු කරන්න: npm i @fontsource/<name> → පහළ list එකට එකතු කරන්න.
import { loadFont } from '@remotion/fonts';
import f0 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-400-normal.woff2?url';
import f1 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-700-normal.woff2?url';
import f2 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-sinhala-800-normal.woff2?url';
import f3 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-latin-400-normal.woff2?url';
import f4 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-latin-700-normal.woff2?url';
import f5 from '@fontsource/noto-sans-sinhala/files/noto-sans-sinhala-latin-800-normal.woff2?url';
import f6 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-sinhala-400-normal.woff2?url';
import f7 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-sinhala-700-normal.woff2?url';
import f8 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-sinhala-800-normal.woff2?url';
import f9 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-latin-400-normal.woff2?url';
import f10 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-latin-700-normal.woff2?url';
import f11 from '@fontsource/noto-serif-sinhala/files/noto-serif-sinhala-latin-800-normal.woff2?url';
import f12 from '@fontsource/abhaya-libre/files/abhaya-libre-sinhala-400-normal.woff2?url';
import f13 from '@fontsource/abhaya-libre/files/abhaya-libre-sinhala-700-normal.woff2?url';
import f14 from '@fontsource/abhaya-libre/files/abhaya-libre-sinhala-800-normal.woff2?url';
import f15 from '@fontsource/abhaya-libre/files/abhaya-libre-latin-400-normal.woff2?url';
import f16 from '@fontsource/abhaya-libre/files/abhaya-libre-latin-700-normal.woff2?url';
import f17 from '@fontsource/abhaya-libre/files/abhaya-libre-latin-800-normal.woff2?url';
import f18 from '@fontsource/yaldevi/files/yaldevi-sinhala-400-normal.woff2?url';
import f19 from '@fontsource/yaldevi/files/yaldevi-sinhala-700-normal.woff2?url';
import f20 from '@fontsource/yaldevi/files/yaldevi-latin-400-normal.woff2?url';
import f21 from '@fontsource/yaldevi/files/yaldevi-latin-700-normal.woff2?url';
import f22 from '@fontsource/gemunu-libre/files/gemunu-libre-sinhala-400-normal.woff2?url';
import f23 from '@fontsource/gemunu-libre/files/gemunu-libre-sinhala-700-normal.woff2?url';
import f24 from '@fontsource/gemunu-libre/files/gemunu-libre-sinhala-800-normal.woff2?url';
import f25 from '@fontsource/gemunu-libre/files/gemunu-libre-latin-400-normal.woff2?url';
import f26 from '@fontsource/gemunu-libre/files/gemunu-libre-latin-700-normal.woff2?url';
import f27 from '@fontsource/gemunu-libre/files/gemunu-libre-latin-800-normal.woff2?url';
import f28 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import f29 from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import f30 from '@fontsource/inter/files/inter-latin-800-normal.woff2?url';
import f31 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url';
import f32 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import f33 from '@fontsource/montserrat/files/montserrat-latin-800-normal.woff2?url';
import f34 from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import f35 from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import f36 from '@fontsource/poppins/files/poppins-latin-800-normal.woff2?url';
import f37 from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import f38 from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import f39 from '@fontsource/oswald/files/oswald-latin-400-normal.woff2?url';
import f40 from '@fontsource/oswald/files/oswald-latin-700-normal.woff2?url';
import f41 from '@fontsource/lilita-one/files/lilita-one-latin-400-normal.woff2?url';

export const FONTS = [
  { name: 'Noto Sans Sinhala', kind: 'si', sinhala: { 400: f0, 700: f1, 800: f2 }, latin: { 400: f3, 700: f4, 800: f5 } },
  { name: 'Noto Serif Sinhala', kind: 'si', sinhala: { 400: f6, 700: f7, 800: f8 }, latin: { 400: f9, 700: f10, 800: f11 } },
  { name: 'Abhaya Libre', kind: 'si', sinhala: { 400: f12, 700: f13, 800: f14 }, latin: { 400: f15, 700: f16, 800: f17 } },
  { name: 'Yaldevi', kind: 'si', sinhala: { 400: f18, 700: f19 }, latin: { 400: f20, 700: f21 } },
  { name: 'Gemunu Libre', kind: 'si', sinhala: { 400: f22, 700: f23, 800: f24 }, latin: { 400: f25, 700: f26, 800: f27 } },
  { name: 'Inter', kind: 'en', latin: { 400: f28, 700: f29, 800: f30 } },
  { name: 'Montserrat', kind: 'en', latin: { 400: f31, 700: f32, 800: f33 } },
  { name: 'Poppins', kind: 'en', latin: { 400: f34, 700: f35, 800: f36 } },
  { name: 'Bebas Neue', kind: 'en', latin: { 400: f37 } },
  { name: 'Anton', kind: 'en', latin: { 400: f38 } },
  { name: 'Oswald', kind: 'en', latin: { 400: f39, 700: f40 } },
  { name: 'Lilita One', kind: 'en', latin: { 400: f41 } },
];

export const SINHALA_FONTS = FONTS.filter(f => f.kind === 'si').map(f => f.name);
export const ENGLISH_FONTS = FONTS.map(f => f.name); // English අකුරු වලට ඕනම font එකක්

const SI_RANGE = 'U+0D80-0DFF, U+200C-200D, U+25CC';
const LATIN_RANGE = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-200B, U+200E-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

/** CSS font-family alias names: සිංහල අකුරු → "SI <font>", අනිත් ඒවා → "EN <font>" */
export const siAlias = name => `SI ${name}`;
export const enAlias = name => `EN ${name}`;

const nearest = (files, weight) => {
  const ws = Object.keys(files).map(Number).sort((a, b) => a - b);
  if (!ws.length) return null;
  return String(ws.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), ws[0]));
};

const loaded = new Map();
function load(alias, url, weight, unicodeRange) {
  const key = `${alias}|${weight}`;
  if (!loaded.has(key)) {
    loaded.set(key, loadFont({ family: alias, url, weight, unicodeRange, format: 'woff2' }).catch(e => {
      console.warn('Font load failed', alias, e);
    }));
  }
  return loaded.get(key);
}

/** Style එකට ඕන fonts load කරනවා (දෙපාරක් load වෙන්නේ නෑ) */
export function ensureFonts({ fontSi, fontEn, weight = 700 }) {
  const jobs = [];
  const si = FONTS.find(f => f.name === fontSi);
  if (si?.sinhala) {
    const w = nearest(si.sinhala, weight);
    if (w) jobs.push(load(siAlias(si.name), si.sinhala[w], w, SI_RANGE));
  }
  const en = FONTS.find(f => f.name === fontEn);
  if (en?.latin) {
    const w = nearest(en.latin, weight);
    if (w) jobs.push(load(enAlias(en.name), en.latin[w], w, LATIN_RANGE));
  }
  return Promise.all(jobs);
}

/** CSS font-family string එක: සිංහල අකුරු සිංහල font එකෙන්, English අකුරු English font එකෙන් */
export const fontFamilyCss = ({ fontSi, fontEn }) => `"${siAlias(fontSi)}", "${enAlias(fontEn)}", sans-serif`;
