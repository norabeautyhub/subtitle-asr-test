// Subtitle editor: video preview (Remotion Player) + text / style / export panels
import { Player } from '@remotion/player';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { api } from '../api.js';
import ExportPanel from './ExportPanel.jsx';
import LinesPanel from './LinesPanel.jsx';
import { DEFAULT_STYLE, activeLineIndex, lineStart, newDoc, regroup } from './model.js';
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

export default function Editor({ project, transcript, saved, plan, licenseKey, generatePanel }) {
  const [hist, dispatch] = useReducer(historyReducer, null, () => ({ doc: initialDoc(transcript, saved), past: [], future: [], lastKey: null, lastAt: 0 }));
  const doc = hist.doc;
  const [tab, setTab] = useState('text');
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
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    return () => { p.removeEventListener('frameupdate', onFrame); p.removeEventListener('seeked', onFrame); };
  }, []);
  useEffect(() => { if (current >= 0 && tab === 'text') setSelected(current); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const setLines = (lines, key) => update(d => ({ ...d, lines }), key);
  const setStyle = (style, key) => update(d => ({ ...d, style }), key);

  const aspect = size.width / size.height;

  return (
    <div className="editor">
      <div className="editor-left">
        <div className="player-box" ref={boxRef} style={{ aspectRatio: `${size.width} / ${size.height}`, maxWidth: aspect < 1 ? `${72 * aspect}vh` : '100%' }}>
          <Player
            ref={playerRef}
            component={SubtitleVideo}
            inputProps={inputProps}
            durationInFrames={durationInFrames(project.duration)}
            fps={FPS}
            compositionWidth={size.width}
            compositionHeight={size.height}
            controls
            style={{ width: '100%', height: '100%' }}
            acknowledgeRemotionLicense
          />
          <div className="pos-overlay">
            <div className="pos-handle" title="Subtitle එක drag කරන්න"
              style={{ left: `${doc.style.position.x}%`, top: `${doc.style.position.y}%` }}
              onPointerDown={e => { e.preventDefault(); dragging.current = true; }}>✥</div>
          </div>
        </div>
        <div className="row between small editor-status">
          <span>
            <button className="btn ghost xs" onClick={undo} disabled={!hist.past.length} title="Ctrl + Z">↶ Undo</button>{' '}
            <button className="btn ghost xs" onClick={redo} disabled={!hist.future.length} title="Ctrl + Y">↷ Redo</button>
          </span>
          <span className={`save ${saveState}`}>
            {{ saved: '✓ Save වුණා', dirty: '● වෙනස්කම්...', saving: '⟳ Save වෙනවා...', error: '⚠ Save වුණේ නෑ — internet බලන්න' }[saveState]}
          </span>
        </div>
      </div>

      <div className="editor-right card">
        <div className="tabs">
          {[['text', '✏️ Text'], ['style', '🎨 Style'], ['export', '⬇ Export']].map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'text' && (
          <>
            <LinesPanel lines={doc.lines} current={current} selected={Math.min(selected, doc.lines.length - 1)}
              onSelect={selectLine} onLines={setLines} singlish={singlish} onToggleSinglish={() => setSinglish(s => !s)} />
            {generatePanel}
          </>
        )}
        {tab === 'style' && (
          <StylePanel style={doc.style} onStyle={setStyle} onRegroup={() => update(d => ({ ...d, lines: regroup(d.lines, d.style) }))} />
        )}
        {tab === 'export' && <ExportPanel project={project} doc={doc} plan={plan} licenseKey={licenseKey} />}
      </div>
    </div>
  );
}
