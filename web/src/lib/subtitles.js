// Subtitle lines සහ SRT

/** වචන subtitle lines වලට එකතු කරනවා */
export function groupLines(words, { maxWords = 5, maxChars = 32, maxDur = 3, gap = 0.6 } = {}) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    if (cur.length) {
      const len = [...cur, w].map(x => x.text).join(' ').length;
      if (cur.length >= maxWords || len > maxChars || w.end - cur[0].start > maxDur || w.start - cur.at(-1).end > gap) {
        lines.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const ts = t => {
  const ms = Math.round(Math.max(0, t) * 1000);
  const p = (n, k = 2) => String(n).padStart(k, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

export function toSrt(words) {
  return groupLines(words).map((l, i) =>
    `${i + 1}\n${ts(l[0].start)} --> ${ts(l.at(-1).end)}\n${l.map(w => w.text).join(' ')}\n`).join('\n');
}

export function downloadText(filename, text, type = 'text/plain') {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` })),
    download: filename,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
