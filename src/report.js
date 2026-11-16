// Engines සංසන්දනය කරන HTML report එක
import fs from 'node:fs';
import path from 'node:path';
import { groupWordLists } from './common.js';
import { cer, diffHtml, esc, wer } from './metrics.js';

const CSS = `
*{box-sizing:border-box}body{font-family:'Noto Sans Sinhala','Iskoola Pota',system-ui,sans-serif;
margin:0;background:#0f1115;color:#e8e8ea;line-height:1.6}
main{max-width:1200px;margin:auto;padding:24px}h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 12px;border-bottom:1px solid #2a2d35;padding-bottom:6px}
.muted{color:#9aa0aa;font-size:13px}table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid #2a2d35;text-align:left;vertical-align:top}
th{color:#9aa0aa;font-weight:600}.best{color:#4ade80;font-weight:700}.err{color:#f87171}
.player{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:16px;align-items:start}
.vwrap{position:relative;background:#000;border-radius:8px;overflow:hidden}
video{width:100%;display:block}
#cap{position:absolute;left:5%;right:5%;bottom:12%;text-align:center;font-size:clamp(18px,3.4vw,40px);
font-weight:700;text-shadow:0 0 6px #000,0 2px 2px #000;pointer-events:none}
#cap span.on{color:#facc15}.side label{display:block;padding:8px 10px;border:1px solid #2a2d35;
border-radius:6px;margin-bottom:8px;cursor:pointer}.side input{margin-right:8px}
.card{background:#171a21;border:1px solid #2a2d35;border-radius:8px;padding:14px;margin-bottom:14px}
.card h3{margin:0 0 6px;font-size:15px}.txt{white-space:pre-wrap;font-size:15px}
del{background:#7f1d1d;color:#fecaca;text-decoration:line-through;padding:0 2px}
ins{background:#14532d;color:#bbf7d0;text-decoration:none;padding:0 2px}
@media(max-width:800px){.player{grid-template-columns:1fr}}`;

const JS = `
const data = JSON.parse(document.getElementById('data').textContent);
const v = document.getElementById('v'), cap = document.getElementById('cap');
let eng = Object.keys(data)[0];
document.querySelectorAll('input[name=eng]').forEach(r => r.onchange = () => { eng = r.value; tick(); });
function tick(){
  const t = v.currentTime, lines = data[eng] || [];
  const line = lines.find(l => t >= l.s && t <= l.e + 0.15);
  if(!line){ cap.innerHTML=''; return; }
  let k = -1; line.w.forEach((w, i) => { if (t >= w.s) k = i; });
  cap.innerHTML = line.w.map((w, i) => '<span class="' + (i===k?'on':'') + '">' + w.t + '</span>').join(' ');
}
v.addEventListener('timeupdate', tick);
(function loop(){ if(!v.paused) tick(); requestAnimationFrame(loop); })();`;

const playerLines = res => groupWordLists(res.words).map(l => ({
  s: l[0].start, e: l.at(-1).end, w: l.map(w => ({ t: esc(w.text), s: w.start, e: w.end })),
}));

export function buildReport(results, outPath, video, audioSeconds, reference) {
  const ok = results.filter(r => !r.error);
  const scores = {};
  if (reference) for (const r of ok) scores[r.engine] = [wer(reference, r.text), cer(reference, r.text)];
  const best = Object.keys(scores).sort((a, b) => scores[a][1] - scores[b][1])[0];

  const rows = results.map(r => {
    if (r.error) return `<tr><td>${r.engine}</td><td colspan=6 class=err>${esc(r.error)}</td></tr>`;
    const [w, c] = scores[r.engine] || [];
    const cls = r.engine === best ? ' class="best"' : '';
    return `<tr><td${cls}>${r.engine}${r.engine === best ? ' ⭐' : ''}</td>` +
      `<td${cls}>${c === undefined ? '' : (100 - c).toFixed(1) + '%'}</td>` +
      `<td>${w === undefined ? '' : w.toFixed(1) + '%'}</td>` +
      `<td>${c === undefined ? '' : c.toFixed(1) + '%'}</td>` +
      `<td>${r.words.length}</td><td>${r.secondsTaken.toFixed(1)}s</td>` +
      `<td class=muted>${esc(r.timingNote || 'word-level')}</td></tr>`;
  }).join('');

  const radios = ok.map((r, i) =>
    `<label><input type=radio name=eng value="${r.engine}" ${i === 0 ? 'checked' : ''}>${r.engine}</label>`).join('');
  const playerData = Object.fromEntries(ok.map(r => [r.engine, playerLines(r)]));

  const cards = [];
  if (reference) cards.push(`<div class=card><h3>Reference (නිවැරදි text එක)</h3><div class=txt>${esc(reference)}</div></div>`);
  for (const r of ok) {
    const body = reference ? diffHtml(reference, r.text) : esc(r.text);
    cards.push(`<div class=card><h3>${r.engine}</h3><div class=txt>${body}</div></div>`);
  }

  const videoSrc = path.relative(path.dirname(path.resolve(outPath)), path.resolve(video)).split(path.sep).join('/');
  const legend = reference ? '<p class=muted><del>රතු</del> = reference එකේ තිබුණත් engine එක වැරදියට/මඟහැරපු වචන, <ins>කොළ</ins> = engine එක ලියපු වෙනස් වචන.</p>' : '';
  const accNote = reference
    ? '<p class=muted>Accuracy = 100 − CER. සිංහලට CER (අකුරු මට්ටමේ වැරදි) වඩා සාධාරණයි, මොකද engines වචන බෙදන විදිහ වෙනස් වෙන්න පුළුවන්.</p>'
    : '<p class=muted>Reference text එකක් දුන්නේ නැති නිසා accuracy ගණන් කළේ නෑ (--reference බලන්න).</p>';
  const vname = esc(path.basename(video));

  const doc = `<!DOCTYPE html><html lang="si"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>සිංහල Speech-to-Text Test — ${vname}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style></head><body><main>
<h1>සිංහල Speech-to-Text Engine Test</h1>
<div class=muted>Video: ${vname} · දිග: ${audioSeconds.toFixed(0)}s</div>
<h2>1. ප්‍රතිඵල සාරාංශය</h2>
<table><tr><th>Engine</th><th>Accuracy</th><th>WER</th><th>CER</th><th>වචන</th><th>කාලය</th><th>Timing</th></tr>
${rows}</table>${accNote}
<h2>2. Video එකත් එක්ක බලන්න</h2>
<p class=muted>Engine එක තෝරලා video එක play කරන්න. දැනට කියවෙන වචනය කහ පාටින් පේනවා — timing එක හරිද කියලා බලන්න.</p>
<div class=player><div class=vwrap><video id=v controls src="${esc(videoSrc)}"></video><div id=cap></div></div>
<div class=side>${radios}</div></div>
<h2>3. Text සංසන්දනය</h2>${legend}
${cards.join('')}
<script id=data type="application/json">${JSON.stringify(playerData).replace(/</g, '\\u003c')}</script>
<script>${JS}</script>
</main></body></html>`;
  fs.writeFileSync(outPath, doc, 'utf8');
}
