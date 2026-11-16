// Accuracy මැනීම: WER (වචන වැරදි %) සහ CER (අකුරු වැරදි %)

export function normalize(text) {
  return text.normalize('NFC')
    .replace(/[‍‌]/g, '') // ZWJ/ZWNJ engines අතර වෙනස් වෙනවා
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
    }
    prev = cur;
  }
  return prev[b.length];
}

const words = t => normalize(t).split(' ').filter(Boolean);
const chars = t => [...normalize(t).replace(/ /g, '')];

export function wer(ref, hyp) {
  const r = words(ref);
  return 100 * editDistance(r, words(hyp)) / Math.max(r.length, 1);
}

/** හිස්තැන් නැතුව අකුරු මට්ටමින් — වචන බෙදීමේ වෙනස්කම් වලට බලපාන්නේ නෑ */
export function cer(ref, hyp) {
  const r = chars(ref);
  return 100 * editDistance(r, chars(hyp)) / Math.max(r.length, 1);
}

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Reference එකට සාපේක්ෂව වැරදි වචන <del>/<ins> වලින් (LCS diff) */
export function diffHtml(ref, hyp) {
  const a = words(ref), b = words(hyp);
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0, del = [], ins = [];
  const flush = () => {
    if (del.length) out.push(`<del>${esc(del.join(' '))}</del>`);
    if (ins.length) out.push(`<ins>${esc(ins.join(' '))}</ins>`);
    del = []; ins = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { flush(); out.push(esc(b[j])); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) ins.push(b[j++]);
    else del.push(a[i++]);
  }
  flush();
  return out.join(' ');
}

export { esc };
