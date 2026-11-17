// Subtitle lines list: text edit (Singlish), split, merge, delete, timing
import { useEffect, useRef, useState } from 'react';
import { deleteLine, lineEnd, lineStart, lineText, mergeWithNext, setLineText, setLineTiming, splitLine } from './model.js';
import SinglishInput from './SinglishInput.jsx';

const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export default function LinesPanel({ lines, current, selected, onSelect, onLines, singlish, onToggleSinglish }) {
  const listRef = useRef(null);
  const [draft, setDraft] = useState('');
  const sel = lines[selected];

  useEffect(() => { setDraft(sel ? lineText(sel) : ''); }, [selected, sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Video play වෙනකොට දැනට පේන line එක list එකේ පේන තැනට scroll කරනවා
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${current}"]`);
    if (el && listRef.current) {
      const box = listRef.current.getBoundingClientRect(), r = el.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) el.scrollIntoView({ block: 'nearest' });
    }
  }, [current]);

  const commitText = text => {
    setDraft(text);
    if (!sel) return;
    const updated = setLineText(sel, text);
    onLines(lines.map((l, i) => (i === selected ? updated : l)), `text-${sel.id}`);
  };

  const split = () => {
    if (!sel || sel.words.length < 2) return;
    onLines(splitLine(lines, selected, Math.ceil(sel.words.length / 2)));
  };
  const merge = () => onLines(mergeWithNext(lines, selected));
  const remove = () => {
    onLines(deleteLine(lines, selected));
    onSelect(Math.max(0, selected - 1));
  };
  const nudge = (which, d) => {
    if (!sel) return;
    const s = lineStart(sel), e = lineEnd(sel);
    const upd = which === 'start' ? setLineTiming(sel, Math.min(s + d, e - 0.1), e) : setLineTiming(sel, s, Math.max(e + d, s + 0.1));
    onLines(lines.map((l, i) => (i === selected ? upd : l)), `time-${sel.id}-${which}`);
  };

  return (
    <div className="lines-panel">
      {sel && (
        <div className="line-edit">
          <div className="row between small">
            <b>Line {selected + 1}</b>
            <span className="muted">{fmt(lineStart(sel))} → {fmt(lineEnd(sel))}</span>
          </div>
          <SinglishInput value={draft} onChange={commitText} singlish={singlish} onToggle={onToggleSinglish} />
          <div className="row tools">
            <button className="btn ghost xs" onClick={split} disabled={sel.words.length < 2} title="Line එක දෙකට කඩන්න">✂ Split</button>
            <button className="btn ghost xs" onClick={merge} disabled={selected >= lines.length - 1} title="ඊළඟ line එකත් එක්ක එකතු කරන්න">⤵ Merge</button>
            <button className="btn ghost xs danger" onClick={remove}>🗑</button>
            <span className="timing">
              Start <button className="btn ghost xs" onClick={() => nudge('start', -0.1)}>−</button><button className="btn ghost xs" onClick={() => nudge('start', 0.1)}>+</button>
              End <button className="btn ghost xs" onClick={() => nudge('end', -0.1)}>−</button><button className="btn ghost xs" onClick={() => nudge('end', 0.1)}>+</button>
            </span>
          </div>
        </div>
      )}
      <div className="lines-list" ref={listRef}>
        {lines.map((l, i) => (
          <button key={l.id} data-i={i} className={`line-item ${i === selected ? 'sel' : ''} ${i === current ? 'cur' : ''}`} onClick={() => onSelect(i, true)}>
            <span className="tc">{fmt(lineStart(l))}</span>
            <span className="tx">{lineText(l) || <i className="muted">(හිස්)</i>}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
