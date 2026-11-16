// Free plan test — Whisper එක browser එකේ (WebGPU) run කරලා සිංහල subtitles හදනවා.
import { cer, wer, diffHtml, esc } from '../src/metrics.js';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const MOCK = new URLSearchParams(location.search).has('mock'); // developer test mode

const MODELS = [
  { key: 'base', id: 'onnx-community/whisper-base_timestamped', size: '~206 MB', note: 'වේගවත්ම, quality අඩුයි' },
  { key: 'small', id: 'onnx-community/whisper-small_timestamped', size: '~586 MB', note: 'මධ්‍යම' },
  { key: 'large-v3-turbo', id: 'onnx-community/whisper-large-v3-turbo_timestamped', size: '~1.6 GB', note: 'හොඳම quality, හෙමින්, ලොකු GPU එකක් ඕනේ', turbo: true },
];

const $ = id => document.getElementById(id);
const state = { file: null, audio: null, duration: 0, results: [], pipes: new Map(), webgpu: false, f16: false, active: null };

// ---------------- Environment check ----------------
async function checkEnv() {
  const pills = [];
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        state.webgpu = true;
        state.f16 = adapter.features.has('shader-f16');
        pills.push('<span class="pill ok">✔ WebGPU තියෙනවා</span>');
        if (!state.f16) pills.push('<span class="pill warn">GPU එකේ fp16 නෑ — turbo model එක ලොකුයි</span>');
      }
    } catch { /* ignore */ }
  }
  if (!state.webgpu) pills.push('<span class="pill bad">✘ WebGPU නෑ — CPU (WASM) එකෙන් run වෙනවා, ගොඩක් හෙමින්. Chrome/Edge අලුත් version එකක් පාවිච්චි කරන්න.</span>');
  pills.push(`<span class="pill">CPU cores: ${navigator.hardwareConcurrency || '?'}</span>`);
  if (navigator.deviceMemory) pills.push(`<span class="pill">RAM: ~${navigator.deviceMemory} GB+</span>`);
  if (MOCK) pills.push('<span class="pill warn">MOCK MODE</span>');
  $('env').innerHTML = pills.join('');
}

// ---------------- UI setup ----------------
$('models').innerHTML = MODELS.map((m, i) => `
  <label class="model"><input type="radio" name="model" value="${m.key}" ${i === 1 ? 'checked' : ''}>
  <b>whisper-${m.key}</b><span class="muted small">${m.size} · ${m.note}</span></label>`).join('');

const drop = $('drop');
['dragover', 'dragenter'].forEach(e => drop.addEventListener(e, ev => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(e => drop.addEventListener(e, () => drop.classList.remove('over')));
drop.addEventListener('drop', ev => { ev.preventDefault(); if (ev.dataTransfer.files[0]) loadFile(ev.dataTransfer.files[0]); });
$('file').addEventListener('change', ev => ev.target.files[0] && loadFile(ev.target.files[0]));
$('run').addEventListener('click', run);
$('refText').addEventListener('input', renderAll);
$('refFromEl').addEventListener('change', renderAll);
$('loadJson').addEventListener('change', loadJsonFiles);

function setStatus(html, pct = null) {
  $('status').innerHTML = html;
  if (pct !== null) $('bar').style.width = `${Math.max(0, Math.min(100, pct))}%`;
}

// ---------------- Audio ----------------
async function loadFile(file) {
  state.file = file;
  state.audio = null;
  $('video').src = URL.createObjectURL(file);
  $('fileInfo').textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)} MB — audio එක කියවනවා...`;
  try {
    const ctx = new AudioContext({ sampleRate: 16000 }); // Whisper ට 16kHz mono ඕනේ
    const buf = await ctx.decodeAudioData(await file.arrayBuffer());
    await ctx.close();
    let data = buf.getChannelData(0);
    if (buf.numberOfChannels > 1) {
      const mix = new Float32Array(buf.length);
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const ch = buf.getChannelData(c);
        for (let i = 0; i < ch.length; i++) mix[i] += ch[i] / buf.numberOfChannels;
      }
      data = mix;
    }
    state.audio = data;
    state.duration = buf.duration;
    $('fileInfo').textContent = `✔ ${file.name} · දිග ${buf.duration.toFixed(1)}s`;
    $('run').disabled = false;
  } catch (e) {
    $('fileInfo').textContent = `❌ Audio එක කියවන්න බැරි වුණා: ${e.message}`;
  }
}

// ---------------- Whisper ----------------
async function getPipeline(modelId, turbo, device) {
  const key = `${modelId}|${device}`;
  if (state.pipes.has(key)) return state.pipes.get(key);
  const { pipeline } = MOCK ? mockLib() : await import(TRANSFORMERS_URL);
  const files = {};
  const pipe = await pipeline('automatic-speech-recognition', modelId, {
    device,
    dtype: { encoder_model: turbo && state.f16 ? 'fp16' : 'fp32', decoder_model_merged: 'q4' },
    progress_callback: p => {
      if (p.status === 'progress' && p.total) {
        files[p.file] = [p.loaded, p.total];
        const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
        setStatus(`⬇ Model එක download වෙනවා... ${(l / 1048576).toFixed(0)} / ${(t / 1048576).toFixed(0)} MB`, 100 * l / t);
      } else if (p.status === 'ready') {
        setStatus('Model එක GPU එකට load කරනවා...', 100);
      }
    },
  });
  state.pipes.set(key, pipe);
  return pipe;
}

async function run() {
  if (!state.audio) return;
  const custom = $('customModel').value.trim();
  const m = custom ? { key: custom.split('/').pop(), id: custom, turbo: /turbo|large/.test(custom) }
    : MODELS.find(x => x.key === document.querySelector('input[name=model]:checked').value);
  const device = state.webgpu ? 'webgpu' : 'wasm';
  const language = $('lang').value;
  $('run').disabled = true;
  try {
    const t0 = performance.now();
    setStatus('Model එක load කරනවා...', 0);
    const asr = await getPipeline(m.id, m.turbo, device);
    const loadSec = (performance.now() - t0) / 1000;

    const t1 = performance.now();
    const timer = setInterval(() => setStatus(`🎧 Subtitles හදනවා... ${((performance.now() - t1) / 1000).toFixed(0)}s (මේ tab එක close කරන්න එපා)`, null), 500);
    $('bar').style.width = '100%';
    let out;
    try {
      out = await asr(state.audio, {
        language, task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5,
      });
    } finally { clearInterval(timer); }
    const sec = (performance.now() - t1) / 1000;

    const res = toResult(out, `browser_${m.key}`, sec);
    res.device = device;
    res.loadSeconds = loadSec;
    addResult(res);
    setStatus(`✔ ඉවරයි — subtitles හදන්න ${sec.toFixed(1)}s ගියා (video එක ${state.duration.toFixed(0)}s)`, 100);
  } catch (e) {
    console.error(e);
    setStatus(`❌ ${esc(e.message || String(e))}<br><span class="muted small">GPU memory මදි නම් පොඩි model එකක් try කරන්න.</span>`, 0);
  } finally {
    $('run').disabled = false;
  }
}

/** transformers.js output → test tool එකේ EngineResult format එක */
function toResult(out, engine, secondsTaken) {
  const chunks = out.chunks || [];
  const starts = chunks.map(c => Math.max(0, Math.min(c.timestamp[0] ?? 0, state.duration)));
  const words = chunks.map((c, i) => {
    const s = starts[i];
    const next = starts[i + 1] ?? state.duration;
    const e = Number.isFinite(c.timestamp[1]) && c.timestamp[1] >= s ? c.timestamp[1] : next;
    return { text: c.text.trim(), start: +s.toFixed(3), end: +Math.min(e, state.duration).toFixed(3) };
  }).filter(w => w.text);
  return { engine, words, text: (out.text || '').trim(), secondsTaken, timingNote: chunks.length ? '' : 'word timings නෑ', error: '' };
}

// ---------------- Results ----------------
function addResult(res) {
  state.results = state.results.filter(r => r.engine !== res.engine);
  state.results.push(res);
  state.active = res.engine;
  renderAll();
}

async function loadJsonFiles(ev) {
  for (const f of ev.target.files) {
    try {
      const r = JSON.parse(await f.text());
      if (!r.engine || !Array.isArray(r.words)) throw new Error('test tool JSON එකක් නෙවෙයි');
      if (r.error) continue;
      r.device = 'loaded';
      addResult(r);
    } catch (e) { alert(`${f.name}: ${e.message}`); }
  }
  ev.target.value = '';
}

function reference() {
  const t = $('refText').value.trim();
  if (t) return { text: t, from: 'reference text' };
  if ($('refFromEl').checked) {
    const el = state.results.find(r => r.engine.startsWith('elevenlabs'));
    if (el) return { text: el.text, from: el.engine };
  }
  return null;
}

function renderAll() {
  const ref = reference();
  const scored = state.results.map(r => ({ r, c: ref && r.text !== ref.text ? cer(ref.text, r.text) : ref ? 0 : null, w: ref ? wer(ref.text, r.text) : null }));
  const cand = scored.filter(s => s.c !== null && !(ref && s.r.text === ref.text));
  const best = cand.length ? cand.reduce((a, b) => (b.c < a.c ? b : a)).r.engine : null;

  document.querySelector('#table tbody').innerHTML = scored.map(({ r, c, w }) => {
    const isRef = ref && r.text === ref.text && ref.from === r.engine;
    const cls = r.engine === best ? ' class="best"' : '';
    const speed = r.device !== 'loaded' && r.secondsTaken ? `${(state.duration / r.secondsTaken).toFixed(1)}×` : '';
    return `<tr><td${cls}>${esc(r.engine)}${r.engine === best ? ' ⭐' : ''}${isRef ? ' <span class="muted">(reference)</span>' : ''}</td>
      <td>${esc(r.device || '')}</td>
      <td${cls}>${c === null || isRef ? '' : (100 - c).toFixed(1) + '%'}</td>
      <td>${c === null || isRef ? '' : c.toFixed(1) + '%'}</td>
      <td>${w === null || isRef ? '' : w.toFixed(1) + '%'}</td>
      <td>${r.words.length}</td>
      <td>${r.loadSeconds ? r.loadSeconds.toFixed(1) + 's' : ''}</td>
      <td>${r.secondsTaken ? (+r.secondsTaken).toFixed(1) + 's' : ''}</td>
      <td>${speed}</td>
      <td>${r.device !== 'loaded' ? `<button class="small" data-dl="${esc(r.engine)}">⬇ JSON</button>` : ''}</td></tr>`;
  }).join('');
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => download(b.dataset.dl));

  $('engines').innerHTML = state.results.map(r =>
    `<label><input type="radio" name="eng" value="${esc(r.engine)}" ${r.engine === state.active ? 'checked' : ''}> ${esc(r.engine)}</label>`).join('');
  document.querySelectorAll('input[name=eng]').forEach(x => x.onchange = () => { state.active = x.value; tick(); });

  $('texts').innerHTML = (ref ? `<div class="tcard"><h3>Reference (${esc(ref.from)})</h3><div>${esc(ref.text)}</div></div>` : '') +
    state.results.filter(r => !(ref && ref.from === r.engine)).map(r =>
      `<div class="tcard"><h3>${esc(r.engine)}</h3><div>${ref ? diffHtml(ref.text, r.text) : esc(r.text)}</div></div>`).join('');
  tick();
}

function download(engine) {
  const r = state.results.find(x => x.engine === engine);
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${engine}.json` });
  a.click();
}

// ---------------- Caption overlay ----------------
function groupLines(words, maxWords = 5, maxChars = 32, maxDur = 3, gap = 0.6) {
  const lines = []; let cur = [];
  for (const w of words) {
    if (cur.length) {
      const len = [...cur, w].map(x => x.text).join(' ').length;
      if (cur.length >= maxWords || len > maxChars || w.end - cur[0].start > maxDur || w.start - cur.at(-1).end > gap) { lines.push(cur); cur = []; }
    }
    cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

const lineCache = new WeakMap();
function tick() {
  const r = state.results.find(x => x.engine === state.active);
  const cap = $('cap');
  if (!r) { cap.innerHTML = ''; return; }
  if (!lineCache.has(r)) lineCache.set(r, groupLines(r.words));
  const t = $('video').currentTime;
  const line = lineCache.get(r).find(l => t >= l[0].start && t <= l.at(-1).end + 0.15);
  if (!line) { cap.innerHTML = ''; return; }
  let k = -1; line.forEach((w, i) => { if (t >= w.start) k = i; });
  cap.innerHTML = line.map((w, i) => `<span class="${i === k ? 'on' : ''}">${esc(w.text)}</span>`).join(' ');
}
$('video').addEventListener('timeupdate', tick);
(function loop() { if (!$('video').paused) tick(); requestAnimationFrame(loop); })();

// ---------------- Mock (developer testing only) ----------------
function mockLib() {
  return {
    pipeline: async (_task, _id, opts) => {
      for (let i = 1; i <= 5; i++) {
        opts.progress_callback({ status: 'progress', file: 'onnx/encoder.onnx', loaded: i * 40e6, total: 200e6 });
        await new Promise(r => setTimeout(r, 50));
      }
      opts.progress_callback({ status: 'ready' });
      return async () => {
        await new Promise(r => setTimeout(r, 300));
        const txt = ['ශරීරයේ', 'මේදය', 'අඩුවෙලා', 'ඔබේ', 'සිරුර', 'ලස්සණ', 'වෙනවා'];
        return { text: ' ' + txt.join(' '), chunks: txt.map((t, i) => ({ text: ' ' + t, timestamp: [1 + i * 0.6, i === 6 ? null : 1.5 + i * 0.6] })) };
      };
    },
  };
}

checkEnv();
