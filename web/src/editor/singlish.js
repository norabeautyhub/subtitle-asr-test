// Singlish → සිංහල (Helakuru / Google Input වගේ phonetic typing)
//   kohomada → කොහොමද · amma → අම්ම · shrii lankaawa → ශ්‍රී ලංකාව · prashnaya → ප්‍රශ්නය
// Helakuru වගේ: t → ට, th → ත (mata → මට, thaththa → තාත්තා).
// d/dh → ද (kohomada → කොහොමද), D → ඩ, N → ණ, L → ළ

const ZWJ = '‍';
const HAL = '්'; // ්

// [Singlish, ස්වර අකුර (තනියම), පිල්ල (ව්‍යංජනයකට පස්සේ)]
const VOWELS = [
  ['aae', 'ඈ', 'ෑ'], ['aee', 'ඈ', 'ෑ'], ['AA', 'ඈ', 'ෑ'],
  ['aa', 'ආ', 'ා'], ['ae', 'ඇ', 'ැ'], ['A', 'ඇ', 'ැ'],
  ['ii', 'ඊ', 'ී'], ['ee', 'ඒ', 'ේ'], ['ai', 'ඓ', 'ෛ'], ['au', 'ඖ', 'ෞ'],
  ['uu', 'ඌ', 'ූ'], ['oo', 'ඕ', 'ෝ'],
  ['a', 'අ', ''], ['i', 'ඉ', 'ි'], ['u', 'උ', 'ු'], ['e', 'එ', 'ෙ'], ['o', 'ඔ', 'ො'],
];

const CONSONANTS = [
  ['chh', 'ඡ'], ['ndh', 'ඳ'],
  ['ch', 'ච'], ['kh', 'ඛ'], ['gh', 'ඝ'], ['jh', 'ඣ'], ['gn', 'ඥ'], ['ny', 'ඤ'],
  ['Th', 'ථ'], ['th', 'ත'], ['Dh', 'ධ'], ['dh', 'ද'], ['ph', 'ඵ'], ['bh', 'භ'],
  ['Sh', 'ෂ'], ['sh', 'ශ'],
  ['k', 'ක'], ['g', 'ග'], ['G', 'ඟ'], ['c', 'ච'], ['j', 'ජ'],
  ['T', 'ට'], ['t', 'ට'], ['D', 'ඩ'], ['d', 'ද'], ['N', 'ණ'], ['n', 'න'],
  ['p', 'ප'], ['f', 'ෆ'], ['b', 'බ'], ['m', 'ම'], ['y', 'ය'], ['r', 'ර'],
  ['L', 'ළ'], ['l', 'ල'], ['w', 'ව'], ['v', 'ව'], ['s', 'ස'], ['z', 'ස'],
  ['h', 'හ'], ['q', 'ක'], ['x', 'ක්ෂ'],
];

function match(table, src, i) {
  for (const row of table) if (src.startsWith(row[0], i)) return row;
  // Case-sensitive key එකක් නැත්නම් (උදා: "Kohomada" → K) simple අකුරෙන් බලනවා
  const ch = src[i];
  if (ch && ch.toLowerCase() !== ch) {
    const s2 = src.slice(0, i) + ch.toLowerCase() + src.slice(i + 1);
    for (const row of table) if (s2.startsWith(row[0], i)) return row;
  }
  return null;
}

/** Singlish → සිංහල. English අකුරු නොවන දේවල් (ඉලක්කම්, සිංහල, punctuation) එහෙම්මම */
export function toSinhala(src, { eeAsII = false } = {}) {
  const vowels = eeAsII ? VOWELS.map(v => (v[0] === 'ee' ? ['ee', 'ඊ', 'ී'] : v)) : VOWELS;
  const vowelAt = j => match(vowels, src, j);
  let out = '';
  let i = 0;

  // ව්‍යංජනයකට පස්සේ: ස්වරය තියෙනවා නම් පිල්ල, නැත්නම් හල් කිරීම (්)
  const afterConsonant = () => {
    const v = vowelAt(i);
    if (v) { out += v[2]; i += v[0].length; } else out += HAL;
  };

  while (i < src.length) {
    const ch = src[i];
    if (!/[a-zA-Z]/.test(ch)) { out += ch; i++; continue; }

    // ං (බින්දුව): "ng" + ව්‍යංජනය/අවසානය → ං, "ng" + ස්වරය → ංග (mangala → මංගල)
    if (ch === 'n' && src[i + 1] === 'g' && src[i + 2] !== 'h') {
      i += 2;
      if (vowelAt(i)) { out += 'ංග'; afterConsonant(); } else out += 'ං';
      continue;
    }
    // "lanka" → ලංකා, "sinhala" → සිංහල
    if (ch === 'n' && (src[i + 1] === 'k' || (src[i + 1] === 'h' && vowelAt(i + 2)))) {
      out += 'ං'; i += 1; continue;
    }

    const c = match(CONSONANTS, src, i);
    if (c) {
      i += c[0].length;
      out += c[1];
      // යංසය / රකාරාංශය: "vidyaawa" → විද්‍යාව, "prashnaya" → ප්‍රශ්නය, "shrii" → ශ්‍රී
      const nxt = vowelAt(i) ? null : match(CONSONANTS, src, i);
      if (nxt && (nxt[1] === 'ය' || nxt[1] === 'ර') && c[1] !== 'ර' && c[1] !== 'ක්ෂ') {
        out += HAL + ZWJ + nxt[1];
        i += nxt[0].length;
      }
      afterConsonant();
      continue;
    }
    const v = vowelAt(i);
    if (v) { out += v[1]; i += v[0].length; continue; }
    out += ch; i++;
  }
  return out;
}

/** Suggestions bar එකට: ප්‍රධාන එක + සමාන විකල්ප (ඒ↔ඊ, ංග↔ඟ, ත↔ට, ද↔ඩ, න↔ණ, ල↔ළ, ස↔ශ) */
export function suggestions(word) {
  if (!word) return [];
  const main = toSinhala(word);
  const list = [main];
  const add = s => { if (s && !list.includes(s)) list.push(s); };
  // "yanawa" → "යනවා" — කතා කරන භාෂාවේ වචන ගොඩක් දීර්ඝ "ා" එකෙන් ඉවර වෙනවා
  if (/[^aA]a$/.test(word)) add(toSinhala(word + 'a'));
  add(toSinhala(word, { eeAsII: true }));
  add(main.replace(/ංග/g, 'ඟ'));
  add(main.replace(/[තට]/g, m => (m === 'ත' ? 'ට' : 'ත')));
  add(main.replace(/[දඩ]/g, m => (m === 'ද' ? 'ඩ' : 'ද')));
  add(main.replace(/[නණ]/g, m => (m === 'න' ? 'ණ' : 'න')));
  add(main.replace(/[ලළ]/g, m => (m === 'ල' ? 'ළ' : 'ල')));
  add(main.replace(/[සශ]/g, m => (m === 'ස' ? 'ශ' : 'ස')));
  return list.slice(0, 5);
}
