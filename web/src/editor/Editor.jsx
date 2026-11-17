// Subtitle studio: top bar + tools rail + panel + video canvas + timeline
import { Player } from '@remotion/player';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api } from '../api.js';
import { Link } from '../App.jsx';
import Timeline from './Timeline.jsx';
import ExportPanel from './ExportPanel.jsx';
import LinesPanel from './LinesPanel.jsx';
import { DEFAULT_STYLE, activeLineIndex, deleteLine, lineEnd, lineStart, newDoc, regroup, splitLine } from './model.js';
import StylePanel from './StylePanel.jsx';
import SubtitleVideo, { FPS, compositionSize, durationInFrames } from './SubtitleVideo.jsx';
import { ensureFonts } from './fonts.js';

const HISTORY_MAX = 100;

/** Undo / redo: doc එකේ පරණ versions. ඉක්මනට එකම දේ (slider drag) වෙනස් කළොත් එක step එකක් විදිහට */
function historyReducer(st, a) {
  switch (a.type) {
    case 'set': {
      const next = typeof a.next === 'function' ? a.next(st.doc) : a.next;
      if (next === st.doc) return st;
      const same = a.key && st.lastKey === a.key && a.at - st.lastAt < 800;
      return {
        doc: next,
        past: same ? st.past : [...st.past, st.doc].slice(-HISTORY_MAX),
        future: [],
        lastKey: a.key || null,
        lastAt: a.at,
      };
    }
    case 'undo':
      if (!st.past.length) return st;
      return { doc: st.past.at(-1), past: st.past.slice(0, -1), future: [st.doc, ...st.future], lastKey: null, lastAt: 0 };
    case 'redo':
      if (!st.future.length) return st;
      return { doc: st.future[0], past: [...st.past, st.doc], future: st.future.slice(1), lastKey: null, lastAt: 0 };
    default:
      return st;
  }
}

function initialDoc(transcript, saved) {
  const style = { ...DEFAULT_STYLE, ...(saved?.style || {}) };
  for (const k of ['gradient', 'shadow', 'glow', 'box', 'position']) style[k] = { ...DEFAULT_STYLE[k], ...(saved?.style?.[k] || {}) };
  // Subtitles ආයේ generate කරලා නම් අලුත් words වලින් lines හදනවා (style එක තියාගෙන)
  if (saved?.lines && (saved.sourceUpdatedAt || 0) >= (transcript?.updated_at || 0)) return { ...saved, style };
  return newDoc(transcript, style);
}

const TOOLS = [
  ['subtitles', '💬', 'Subtitles'],
  ['templates', '✨', 'Templates'],
  ['text', '🔤', 'Text style'],
  ['animation', '🎞', 'Animation'],
  ['layout', '📐', 'Layout'],
  ['ai', '🤖', 'AI'],
  ['export', '⬇', 'Export'],
];
const TOOL_TITLE = {
  subtitles: 'Subtitles edit කරන්න', templates: 'Templates', text: 'Text style', animation: 'Animation',
  layout: 'Position / Layout', ai: 'AI subtitles', export: 'Export',
};
const isTyping = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;

export default function Editor({ project, transcript, saved, plan, licenseKey, generatePanel, mockMode, isAdmin, onRename, onDelete }) {
  const [hist, dispatch] = useReducer(historyReducer, null, () => ({ doc: initialDoc(transcript, saved), past: [], future: [], lastKey: null, lastAt: 0 }));
  const doc = hist.doc;
  const [tab, setTab] = useState('subtitles');
  const [playing, setPlaying] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [toast, setToast] = useState('');
  const canvasRef = useRef(null);
  const [fit, setFit] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState(0);
  const [selected, setSelected] = useState(0);
  const [singlish, setSinglish] = useState(true);
  const [saveState, setSaveState] = useState('saved');
  const playerRef = useRef(null);
  const boxRef = useRef(null);

  const size = useMemo(() => compositionSize(project), [project]);
  const time = frame / FPS;
  const current = activeLineIndex(doc.lines, time);

  // ---------- History (undo / redo) ----------
  const update = useCallback((next, key) => dispatch({ type: 'set', next, key, at: Date.now() }), []);
  const undo = useCallback(() => dispatch({ type: 'undo' }), []);
  const redo = useCallback(() => dispatch({ type: 'redo' }), []);

  useEffect(() => {
    const onKey = e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ---------- Auto save ----------
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState('dirty');
    const t = setTimeout(async () => {
      setSaveState('saving');
      try {
        await api(`/projects/${project.id}/editor`, { method: 'PUT', body: { doc } });
        setSaveState('saved');
      } catch { setSaveState('error'); }
    }, 1200);
    return () => clearTimeout(t);
  }, [doc, project.id]);
  useEffect(() => {
    const warn = e => { if (saveState === 'dirty' || saveState === 'saving') { e.preventDefault(); e.returnValue = ''; } };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [saveState]);

  // ---------- Player ----------
  useEffect(() => { ensureFonts(doc.style); }, [doc.style.fontSi, doc.style.fontEn, doc.style.weight]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = e => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    p.addEventListener('ended', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame); p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay); p.removeEventListener('pause', onPause); p.removeEventListener('ended', onPause);
    };
  }, [fit.w > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (current >= 0 && playing) setSelected(current); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Studio එක full screen — පිටුපස page එක scroll වෙන්නේ නෑ
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Video එක canvas එකට ගැලපෙන size එක
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const W = el.clientWidth - 32, H = el.clientHeight - 32;
      const a = size.width / size.height;
      const w = Math.max(80, Math.min(W, H * a));
      setFit({ w: Math.round(w), h: Math.round(w / a) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [size.width, size.height]);

  const seek = t => { playerRef.current?.seekTo(Math.round(t * FPS)); setFrame(Math.round(t * FPS)); };
  const selectLine = (i, jump) => { setSelected(i); if (jump && doc.lines[i]) seek(lineStart(doc.lines[i]) + 0.01); };

  const inputProps = useMemo(() => ({
    src: `${location.origin}/api/projects/${project.id}/video`, lines: doc.lines, style: doc.style, watermark: !!plan.watermark,
  }), [project.id, doc.lines, doc.style, plan.watermark]);

  // ---------- Drag to position ----------
  const dragging = useRef(false);
  const onDragMove = useCallback(e => {
    if (!dragging.current || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - r.top) / r.height) * 100));
    update(d => ({ ...d, style: { ...d.style, position: { x: Math.round(x * 2) / 2, y: Math.round(y * 2) / 2 } } }), 'drag');
  }, [update]);
  useEffect(() => {
    const up = () => { dragging.current = false; };
    addEventListener('pointermove', onDragMove);
    addEventListener('pointerup', up);
    return () => { removeEventListener('pointermove', onDragMove); removeEventListener('pointerup', up); };
  }, [onDragMove]);

  const setLines = useCallback((lines, key) => update(d => ({ ...d, lines: typeof lines === 'function' ? lines(d.lines) : lines }), key), [update]);
  const togglePlay = useCallback(() => playerRef.current?.toggle(), []);
  const flash = msg => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  const splitAtPlayhead = useCallback(() => {
    const i = doc.lines.findIndex(l => l.words.length && time >= lineStart(l) && time < lineEnd(l));
    if (i < 0) return flash('Playhead එක subtitle line එකක් උඩ තියන්න');
    const wi = doc.lines[i].words.findIndex(w => w.start >= time - 0.01);
    if (wi <= 0) return flash('මේ තැනින් කඩන්න බෑ — වචන දෙකක් අතරට playhead එක ගේන්න');
    setLines(splitLine(doc.lines, i, wi));
    setSelected(i + 1);
  }, [doc.lines, time, setLines]);
  const deleteSelected = useCallback(() => {
    if (!doc.lines[selected]) return;
    setLines(deleteLine(doc.lines, selected));
    setSelected(Math.max(0, selected - 1));
  }, [doc.lines, selected, setLines]);

  // Keyboard: Space = play, S = split, Delete = line එක මකන්න (type කරනකොට නෙවෙයි)
  useEffect(() => {
    const onKey = e => {
      if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitAtPlayhead(); }
      else if (e.key === 'Delete') { e.preventDefault(); deleteSelected(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [togglePlay, splitAtPlayhead, deleteSelected]);

  const saveTitle = async () => {
    const t = title.trim();
    if (!t) { setTitle(project.title); return; }
    if (t === project.title) return;
    try { await onRename?.(t); } catch { setTitle(project.title); flash('නම save වුණේ නෑ'); }
  };
  const setStyle = (style, key) => update(d => ({ ...d, style }), key);

  const saveLabel = { saved: '✓ Save වුණා', dirty: '● වෙනස්කම්', saving: '⟳ Save වෙනවා', error: '⚠ Save වුණේ නෑ' }[saveState];

  return (
    <div className="studio">
      <header className="st-top">
        <div className="st-top-l">
          <Link to="/dashboard" className="st-back" title="Dashboard">←</Link>
          <span className="st-logo">N</span>
          <input className="st-title" value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} aria-label="Project නම" maxLength={150} />
        </div>
        <div className="st-top-c">
          <button className="icon-btn" onClick={undo} disabled={!hist.past.length} title="Undo (Ctrl + Z)">↶</button>
          <button className="icon-btn" onClick={redo} disabled={!hist.future.length} title="Redo (Ctrl + Y)">↷</button>
          <span className={`save ${saveState}`}>{saveLabel}</span>
        </div>
        <div className="st-top-r">
          {mockMode && (isAdmin
            ? <Link to="/admin" className="mock-pill" title="Admin → Settings වලින් off කරන්න">🧪 Test mode</Link>
            : <span className="mock-pill">🧪 Test mode</span>)}
          <button className="btn st-export" onClick={() => setTab('export')}>⬇ Export</button>
        </div>
      </header>

      <div className="st-body">
        <nav className="st-rail">
          {TOOLS.map(([k, icon, label]) => (
            <button key={k} className={`rail-btn ${tab === k ? 'on' : ''} ${k === 'export' ? 'rail-export' : ''}`} onClick={() => setTab(k)} data-tool={k}>
              <span className="ri">{icon}</span><span className="rl">{label}</span>
            </button>
          ))}
        </nav>

        <aside className="st-panel">
          <div className="st-panel-h">{TOOL_TITLE[tab]}</div>
          <div className="st-panel-b">
            {tab === 'subtitles' && (
              <LinesPanel lines={doc.lines} current={current} selected={Math.min(selected, doc.lines.length - 1)}
                onSelect={selectLine} onLines={setLines} singlish={singlish} onToggleSinglish={() => setSinglish(s => !s)} />
            )}
            {['templates', 'text', 'animation', 'layout'].includes(tab) && (
              <StylePanel section={tab} style={doc.style} onStyle={setStyle} onRegroup={() => update(d => ({ ...d, lines: regroup(d.lines, d.style) }))} />
            )}
            {tab === 'ai' && (
              <div className="ai-panel">
                {generatePanel}
                <div className="danger-zone">
                  <h5>Project එක</h5>
                  <button className="btn ghost sm danger full" onClick={onDelete}>🗑 මේ project එක delete කරන්න</button>
                </div>
              </div>
            )}
            {tab === 'export' && <ExportPanel project={{ ...project, title }} doc={doc} plan={plan} licenseKey={licenseKey} />}
          </div>
        </aside>

        <main className="st-main">
          <div className="st-canvas" ref={canvasRef}>
            {fit.w > 0 && (
              <div className="player-box" ref={boxRef} style={{ width: fit.w, height: fit.h }}>
                <Player
                  ref={playerRef}
                  component={SubtitleVideo}
                  inputProps={inputProps}
                  durationInFrames={durationInFrames(project.duration)}
                  fps={FPS}
                  compositionWidth={size.width}
                  compositionHeight={size.height}
                  controls={false}
                  clickToPlay
                  spaceKeyToPlayOrPause={false}
                  style={{ width: '100%', height: '100%' }}
                  acknowledgeRemotionLicense
                />
                <div className="pos-overlay">
                  <div className="pos-handle" title="Subtitle එක drag කරන්න"
                    style={{ left: `${doc.style.position.x}%`, top: `${doc.style.position.y}%` }}
                    onPointerDown={e => { e.preventDefault(); e.stopPropagation(); dragging.current = true; }}>✥</div>
                </div>
              </div>
            )}
            {toast && <div className="st-toast">{toast}</div>}
          </div>
          <Timeline lines={doc.lines} duration={project.duration || 1} time={time} playing={playing}
            selected={Math.min(selected, doc.lines.length - 1)}
            onSeek={seek} onTogglePlay={togglePlay}
            onSelect={setSelected}
            onLines={setLines} onSplitAtPlayhead={splitAtPlayhead} onDelete={deleteSelected} />
        </main>
      </div>
    </div>
  );
}
