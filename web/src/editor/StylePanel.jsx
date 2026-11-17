// Style + animation settings
import { ENGLISH_FONTS, SINHALA_FONTS } from './fonts.js';
import { ANIMATIONS, DEFAULT_STYLE, HIGHLIGHTS, TEMPLATES } from './model.js';

function Slider({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <label className="ctl">
      <span>{label} <b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} />
    </label>
  );
}
function Color({ label, value, onChange }) {
  return (
    <label className="ctl color">
      <span>{label}</span>
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
function Toggle({ label, value, onChange }) {
  return <label className="ctl check"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} /> {label}</label>;
}
function Select({ label, value, options, onChange }) {
  return (
    <label className="ctl">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>))}
      </select>
    </label>
  );
}

export function TemplatesBar({ style, onStyle }) {
  return (
    <div className="templates">
      {TEMPLATES.map(t => (
        <button key={t.id} className={`tpl ${style.template === t.id ? 'on' : ''}`}
          onClick={() => onStyle({ ...DEFAULT_STYLE, ...t.style, fontSi: style.fontSi, position: t.style.position || style.position, template: t.id }, 'template')}>
          <span className={`tpl-prev tpl-${t.id}`}>අ Aa</span>{t.name}
        </button>
      ))}
    </div>
  );
}

export default function StylePanel({ style, onStyle, onRegroup }) {
  const set = (k, coalesce = true) => v => onStyle({ ...style, [k]: v }, coalesce ? `style-${k}` : undefined);
  const setIn = (k, sub) => v => onStyle({ ...style, [k]: { ...style[k], [sub]: v } }, `style-${k}-${sub}`);

  return (
    <div className="style-panel">
      <h4>🎨 Templates</h4>
      <TemplatesBar style={style} onStyle={onStyle} />

      <h4>🔤 Font</h4>
      <div className="grid-ctl">
        <Select label="සිංහල font" value={style.fontSi} options={SINHALA_FONTS} onChange={set('fontSi', false)} />
        <Select label="English font" value={style.fontEn} options={ENGLISH_FONTS} onChange={set('fontEn', false)} />
        <Slider label="Size" value={style.fontSize} min={24} max={140} onChange={set('fontSize')} />
        <Slider label="සිංහල අකුරු size" value={style.siScale} min={0.7} max={1.6} step={0.05} unit="×" onChange={set('siScale')} />
        <Select label="Thickness" value={String(style.weight)} options={[['400', 'Normal'], ['700', 'Bold'], ['800', 'Extra bold']]} onChange={v => set('weight', false)(Number(v))} />
        <Slider label="Letter spacing" value={style.letterSpacing} min={-4} max={20} onChange={set('letterSpacing')} />
        <Slider label="Line height" value={style.lineHeight} min={0.9} max={2} step={0.05} onChange={set('lineHeight')} />
        <Toggle label="UPPERCASE (English)" value={style.uppercase} onChange={set('uppercase', false)} />
      </div>

      <h4>🎨 Colors</h4>
      <div className="grid-ctl">
        <Color label="Text" value={style.color} onChange={set('color')} />
        <Color label="Highlight වචනය" value={style.highlightColor} onChange={set('highlightColor')} />
        <Toggle label="Gradient" value={style.gradient.enabled} onChange={setIn('gradient', 'enabled')} />
        {style.gradient.enabled && <>
          <Color label="Gradient උඩ" value={style.gradient.from} onChange={setIn('gradient', 'from')} />
          <Color label="Gradient යට" value={style.gradient.to} onChange={setIn('gradient', 'to')} />
        </>}
      </div>

      <h4>✏️ Outline / Shadow / Glow</h4>
      <div className="grid-ctl">
        <Slider label="Outline" value={style.strokeWidth} min={0} max={20} onChange={set('strokeWidth')} unit="px" />
        <Color label="Outline color" value={style.strokeColor} onChange={set('strokeColor')} />
        <Slider label="Shadow blur" value={style.shadow.blur} min={0} max={40} onChange={setIn('shadow', 'blur')} />
        <Slider label="Shadow X" value={style.shadow.x} min={-20} max={20} onChange={setIn('shadow', 'x')} />
        <Slider label="Shadow Y" value={style.shadow.y} min={-20} max={20} onChange={setIn('shadow', 'y')} />
        <Color label="Shadow color" value={style.shadow.color} onChange={setIn('shadow', 'color')} />
        <Slider label="Glow" value={style.glow.size} min={0} max={40} onChange={setIn('glow', 'size')} />
        <Color label="Glow color" value={style.glow.color} onChange={setIn('glow', 'color')} />
      </div>

      <h4>⬛ Background box</h4>
      <div className="grid-ctl">
        <Toggle label="Line එක පිටුපස box" value={style.box.enabled} onChange={setIn('box', 'enabled')} />
        {style.box.enabled && <>
          <Color label="Box color" value={style.box.color} onChange={setIn('box', 'color')} />
          <Slider label="Transparency" value={style.box.opacity} min={0.1} max={1} step={0.05} onChange={setIn('box', 'opacity')} />
          <Slider label="Rounded" value={style.box.radius} min={0} max={60} onChange={setIn('box', 'radius')} />
          <Slider label="Padding" value={style.box.padding} min={0} max={60} onChange={setIn('box', 'padding')} />
        </>}
      </div>

      <h4>✨ Animation</h4>
      <div className="grid-ctl">
        <Select label="Line එක එන විදිහ" value={style.animation} options={ANIMATIONS} onChange={set('animation', false)} />
        <Slider label="Speed" value={style.animSpeed} min={0.4} max={2.5} step={0.1} unit="×" onChange={set('animSpeed')} />
        <Select label="කියවෙන වචනය" value={style.highlight} options={HIGHLIGHTS} onChange={set('highlight', false)} />
        {style.highlight === 'box' && <Color label="Highlight box" value={style.highlightBoxColor} onChange={set('highlightBoxColor')} />}
      </div>

      <h4>📐 Position / Layout</h4>
      <div className="row">
        <button className="btn ghost xs" onClick={() => onStyle({ ...style, position: { ...style.position, y: 15 } })}>⬆ උඩ</button>
        <button className="btn ghost xs" onClick={() => onStyle({ ...style, position: { ...style.position, y: 50 } })}>⏺ මැද</button>
        <button className="btn ghost xs" onClick={() => onStyle({ ...style, position: { ...style.position, y: 78 } })}>⬇ පහළ</button>
        <span className="muted small">නැත්නම් video එක උඩ ✥ එක drag කරන්න</span>
      </div>
      <div className="grid-ctl">
        <Slider label="Width" value={style.maxWidth} min={30} max={100} onChange={set('maxWidth')} unit="%" />
        <Slider label="Line එකකට වචන" value={style.maxWords} min={1} max={12} onChange={set('maxWords')} />
        <Slider label="Line එකකට අකුරු" value={style.maxChars} min={8} max={80} onChange={set('maxChars')} />
      </div>
      <button className="btn ghost sm" onClick={onRegroup}>↻ Lines ආයේ හදන්න (වචන / අකුරු ගණනට)</button>
      <p className="muted small">⚠ Lines ආයේ හැදුවම split / merge කරපු ඒවා අලුත් settings වලට ආයේ සැකසෙනවා. Text edit කරපු දේවල් තියෙනවා.</p>
    </div>
  );
}
