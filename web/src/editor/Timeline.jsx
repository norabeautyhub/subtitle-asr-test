// Timeline: play controls + time ruler + subtitle blocks (drag කරලා timing වෙනස් කරන්න)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lineEnd, lineStart, lineText, setLineTiming } from './model.js';

const MIN_DUR = 0.2;
const fmtTime = t => {
  t = Math.max(0, t);
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`;
};

/** ruler ticks: zoom එක අනුව තත්පර 1 / 2 / 5 / 10 / 30 / 60 */
function tickStep(pps) {
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120]) if (s * pps >= 70) return s;
  return 300;
}

export default function Timeline({ lines, duration, time, playing, selected, onSeek, onTogglePlay, onSelect, onLines, onSplitAtPlayhead, onDelete }) {
  const scrollRef = useRef(null);
  const [width, setWidth] = useState(800);
  const [zoom, setZoom] = useState(1); // 1 = මුළු video එකම පේනවා
  const drag = useRef(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const pad = 16;
  const fitPps = Math.max(4, (width - pad * 2) / Math.max(1, duration));
  const pps = fitPps * zoom;
  const total = duration * pps + pad * 2;
  const x = t => pad + t * pps;

  // Play වෙද්දී playhead එක පේන්න scroll කරනවා
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !playing || drag.current) return;
    const px = x(time);
    if (px < el.scrollLeft + 40 || px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = px - 80;
  }, [time, playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const timeAt = useCallback(clientX => {
    const el = scrollRef.current;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(duration, (clientX - r.left + el.scrollLeft - pad) / pps));
  }, [duration, pps]);

  // ---------- Drag (move / resize / playhead) ----------
  useEffect(() => {
    const move = e => {
      const d = drag.current;
      if (!d) return;
      if (d.mode === 'seek') { onSeek(timeAt(e.clientX)); return; }
      const dt = (e.clientX - d.x0) / pps;
      if (Math.abs(e.clientX - d.x0) > 2) d.moved = true;
      if (!d.moved) return;
      const { s0, e0, prevEnd, nextStart } = d;
      let s = s0, en = e0;
      if (d.mode === 'move') {
        const dur = e0 - s0;
        s = Math.max(prevEnd, Math.min(nextStart - dur, s0 + dt));
        en = s + dur;
      } else if (d.mode === 'l') {
        s = Math.max(prevEnd, Math.min(e0 - MIN_DUR, s0 + dt));
      } else if (d.mode === 'r') {
        en = Math.min(nextStart, Math.max(s0 + MIN_DUR, e0 + dt));
      }
      s = Math.round(s * 100) / 100; en = Math.round(en * 100) / 100;
      onLines(ls => ls.map((l, i) => (i === d.idx ? setLineTiming(d.orig, s, en) : l)), `tl-${d.idx}-${d.mode}`);
    };
    const up = () => {
      const d = drag.current;
      drag.current = null;
      if (d && d.mode !== 'seek' && !d.moved) onSeek(lineStart(d.orig) + 0.01);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    return () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  }, [pps, timeAt, onLines, onSeek]);

  const startBlockDrag = (e, idx, mode) => {
    e.preventDefault(); e.stopPropagation();
    onSelect(idx);
    const l = lines[idx];
    const prev = lines.slice(0, idx).reverse().find(x => x.words.length);
    const next = lines.slice(idx + 1).find(x => x.words.length);
    drag.current = {
      mode, idx, x0: e.clientX, moved: false, orig: l,
      s0: lineStart(l), e0: lineEnd(l),
      prevEnd: prev ? lineEnd(prev) : 0,
      nextStart: next ? lineStart(next) : duration,
    };
  };
  const startSeek = e => { e.preventDefault(); drag.current = { mode: 'seek' }; onSeek(timeAt(e.clientX)); };

  // Ctrl + scroll → zoom
  const onWheel = e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setZoom(z => Math.max(1, Math.min(40, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2))));
  };

  const step = tickStep(pps);
  const ticks = [];
  for (let t = 0; t <= duration + 0.001; t += step) ticks.push(t);

  return (
    <div className="timeline">
      <div className="tl-bar">
        <div className="tl-left">
          <button className="icon-btn play" onClick={onTogglePlay} title="Play / Pause (Space)">{playing ? '❚❚' : '▶'}</button>
          <span className="tl-time"><b>{fmtTime(time)}</b> / {fmtTime(duration)}</span>
        </div>
        <div className="tl-tools">
          <button className="tool-btn" onClick={onSplitAtPlayhead} title="Playhead එක තියෙන තැනින් line එක කඩන්න (S)">✂ Split</button>
          <button className="tool-btn" onClick={onDelete} disabled={selected < 0} title="තෝරපු line එක මකන්න (Delete)">🗑 Delete</button>
        </div>
        <div className="tl-zoom">
          <button className="icon-btn" onClick={() => setZoom(z => Math.max(1, z / 1.5))} title="Zoom out">−</button>
          <input type="range" min="1" max="40" step="0.1" value={zoom} onChange={e => setZoom(Number(e.target.value))} aria-label="Zoom" />
          <button className="icon-btn" onClick={() => setZoom(z => Math.min(40, z * 1.5))} title="Zoom in">+</button>
          <button className="tool-btn" onClick={() => setZoom(1)} title="මුළු video එකම">Fit</button>
        </div>
      </div>

      <div className="tl-scroll" ref={scrollRef} onWheel={onWheel}>
        <div className="tl-inner" style={{ width: total }}>
          <div className="tl-ruler" onPointerDown={startSeek}>
            {ticks.map(t => (
              <span key={t} className="tick" style={{ left: x(t) }}><i>{fmtTime(t).replace(/\.\d$/, '')}</i></span>
            ))}
          </div>
          <div className="tl-track subs" onPointerDown={startSeek}>
            <span className="track-label">💬</span>
            {lines.map((l, i) => {
              if (!l.words.length) return null;
              const s = lineStart(l), en = lineEnd(l);
              return (
                <div key={l.id} data-i={i}
                  className={`tl-block ${i === selected ? 'sel' : ''} ${time >= s && time < en ? 'cur' : ''}`}
                  style={{ left: x(s), width: Math.max(6, (en - s) * pps) }}
                  title={lineText(l)}
                  onPointerDown={e => startBlockDrag(e, i, 'move')}>
                  <span className="h l" onPointerDown={e => startBlockDrag(e, i, 'l')} />
                  <span className="txt">{lineText(l)}</span>
                  <span className="h r" onPointerDown={e => startBlockDrag(e, i, 'r')} />
                </div>
              );
            })}
          </div>
          <div className="tl-track video" onPointerDown={startSeek}>
            <span className="track-label">🎬</span>
            <div className="tl-video" style={{ left: x(0), width: duration * pps }} />
          </div>
          <div className="playhead" style={{ left: x(time) }} onPointerDown={startSeek}><span /></div>
        </div>
      </div>
    </div>
  );
}
