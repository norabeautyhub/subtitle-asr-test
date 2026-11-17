// Helakuru වගේ Singlish typing: English අකුරෙන් type කරලා space / Enter ගැහුවම සිංහලට හැරෙනවා.
// Ctrl + Space → සිංහල ↔ English. Type කරනකොට suggestions bar එකේ විකල්ප පේනවා.
import { useRef, useState } from 'react';
import { suggestions } from './singlish.js';

const LATIN_TAIL = /[a-zA-Z]+$/;

export default function SinglishInput({ value, onChange, singlish, onToggle, rows = 2, autoFocus }) {
  const ref = useRef(null);
  const [pending, setPending] = useState(''); // cursor එකට කලින් තියෙන English වචනය

  const currentLatin = (text, caret) => (text.slice(0, caret).match(LATIN_TAIL)?.[0] || '');

  const replaceTail = (choice, extra = '') => {
    const el = ref.current;
    const caret = el.selectionStart;
    const before = value.slice(0, caret);
    const tail = currentLatin(value, caret);
    if (!tail) return false;
    const next = before.slice(0, before.length - tail.length) + choice + extra + value.slice(caret);
    onChange(next);
    const pos = caret - tail.length + choice.length + extra.length;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
    setPending('');
    return true;
  };

  const onKeyDown = e => {
    if (e.key === ' ' && e.ctrlKey) { e.preventDefault(); onToggle?.(); return; }
    if (!singlish) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === ',' || e.key === '.' || e.key === '?' || e.key === '!') {
      const tail = currentLatin(value, e.currentTarget.selectionStart);
      if (tail) {
        e.preventDefault();
        replaceTail(suggestions(tail)[0], e.key === 'Enter' ? '' : e.key);
      }
    }
  };

  const onInput = e => {
    onChange(e.target.value);
    setPending(singlish ? currentLatin(e.target.value, e.target.selectionStart) : '');
  };

  const sugg = singlish && pending ? suggestions(pending) : [];

  return (
    <div className="singlish">
      <div className="singlish-bar">
        <button type="button" className={`mode ${singlish ? 'on' : ''}`} onClick={onToggle} title="Ctrl + Space">
          {singlish ? 'අ සිංහල (Singlish)' : 'A English'}
        </button>
        {sugg.length > 0 ? (
          <div className="sugg">
            {sugg.map((s, i) => (
              <button key={s} type="button" className={i === 0 ? 'first' : ''} onMouseDown={e => { e.preventDefault(); replaceTail(s, ' '); }}>{s}</button>
            ))}
          </div>
        ) : <span className="muted small">{singlish ? 'Singlish type කරලා space ගහන්න (kohomada → කොහොමද)' : 'Ctrl + Space → සිංහල'}</span>}
      </div>
      <textarea ref={ref} rows={rows} value={value} onChange={onInput} onKeyDown={onKeyDown} autoFocus={autoFocus}
        onClick={e => setPending(singlish ? currentLatin(value, e.currentTarget.selectionStart) : '')} />
    </div>
  );
}
