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

function Section({ title, children }) {
  return <section className="ps"><h5>{title}</h5>{children}</section>;
}

export function TemplatesBar({ style, onStyle }) {
  return (
    <div className="templates">
      {TEMPLATES.map(t => (
        <button key={t.id} className={`tpl ${style.template === t.id ? 'on' : ''}`}
          onClick={() => onStyle({ ...DEFAULT_STYLE, ...t.style, fontSi: style.fontSi, position: t.style.position || style.position, template: t.id }, 'template')}>
          <span className="tpl-stage"><span className={`tpl-prev tpl-${t.id}`}>සිංහල Aa</span></span>
          <span className="tpl-name">{t.name}</span>
        </button>
      ))}
    </div>
  );
}

/** section: 'templates' | 'text' | 'animation' | 'layout' */
export default function StylePanel({ style, onStyle, onRegroup, section = 'text' }) {
  const set = (k, coalesce = true) => v => onStyle({ ...style, [k]: v }, coalesce ? `style-${k}` : undefined);
  const setIn = (k, sub) => v => onStyle({ ...style, [k]: { ...style[k], [sub]: v } }, `style-${k}-${sub}`);

  if (section === 'templates') {
    return (
      <div className="style-panel">
        <p className="panel-hint">Template එකක් තෝරලා, ඊට පස්සේ "Text style" එකෙන් ඕන විදිහට වෙනස් කරන්න.</p>
        <TemplatesBar style={style} onStyle={onStyle} />
      </div>
    );
  }

  if (section === 'animation') {
    return (
      <div className="style-panel">
        <Section title="Line එක එන විදිහ">
          <div className="chips">
            {ANIMATIONS.map(([k, l]) => <button key={k} className={`chip ${style.animation === k ? 'on' : ''}`} onClick={() => set('animation', false)(k)}>{l}</button>)}
          </div>
          <Slider label="Speed" value={style.animSpeed} min={0.4} max={2.5} step={0.1} unit="×" onChange={set('animSpeed')} />
        </Section>
        <Section title="කියවෙන වචනය highlight කරන විදිහ">
          <div className="chips">
            {HIGHLIGHTS.map(([k, l]) => <button key={k} className={`chip ${style.highlight === k ? 'on' : ''}`} onClick={() => set('highlight', false)(k)}>{l}</button>)}
          </div>
          <div className="grid-ctl">
            <Color label="Highlight පාට" value={style.highlightColor} onChange={set('highlightColor')} />
            {style.highlight === 'box' && <Color label="Highlight box" value={style.highlightBoxColor} onChange={set('highlightBoxColor')} />}
          </div>
        </Section>
      </div>
    );
  }

  if (section === 'layout') {
    const pos = y => onStyle({ ...style, position: { ...style.position, y } }, 'pos');
    return (
      <div className="style-panel">
        <Section title="Position">
          <div className="seg">
            <button className={style.position.y < 35 ? 'on' : ''} onClick={() => pos(15)}>⬆ උඩ</button>
            <button className={style.position.y >= 35 && style.position.y <= 65 ? 'on' : ''} onClick={() => pos(50)}>⏺ මැද</button>
            <button className={style.position.y > 65 ? 'on' : ''} onClick={() => pos(78)}>⬇ පහළ</button>
          </div>
          <p className="panel-hint">නැත්නම් video එක උඩ තියෙන ✥ එක drag කරන්න.</p>
          <Slider label="Width" value={style.maxWidth} min={30} max={100} onChange={set('maxWidth')} unit="%" />
        </Section>
        <Section title="Lines කඩන විදිහ">
          <div className="grid-ctl">
            <Slider label="Line එකකට වචන" value={style.maxWords} min={1} max={12} onChange={set('maxWords')} />
            <Slider label="Line එකකට අකුරු" value={style.maxChars} min={8} max={80} onChange={set('maxChars')} />
          </div>
          <button className="btn ghost sm full" onClick={onRegroup}>↻ Lines ආයේ හදන්න</button>
          <p className="panel-hint">⚠ Split / merge කරපු ඒවා අලුත් settings වලට ආයේ සැකසෙනවා. Edit කරපු text එක තියෙනවා.</p>
        </Section>
      </div>
    );
  }

  // 'text'
  return (
    <div className="style-panel">
      <Section title="Font">
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
      </Section>
      <Section title="Colors">
        <div className="grid-ctl">
          <Color label="Text" value={style.color} onChange={set('color')} />
          <Color label="Highlight වචනය" value={style.highlightColor} onChange={set('highlightColor')} />
          <Toggle label="Gradient" value={style.gradient.enabled} onChange={setIn('gradient', 'enabled')} />
          {style.gradient.enabled && <>
            <Color label="Gradient උඩ" value={style.gradient.from} onChange={setIn('gradient', 'from')} />
            <Color label="Gradient යට" value={style.gradient.to} onChange={setIn('gradient', 'to')} />
          </>}
        </div>
      </Section>
      <Section title="Outline">
        <div className="grid-ctl">
          <Slider label="Outline" value={style.strokeWidth} min={0} max={20} onChange={set('strokeWidth')} unit="px" />
          <Color label="Outline color" value={style.strokeColor} onChange={set('strokeColor')} />
        </div>
      </Section>
      <Section title="Shadow / Glow">
        <div className="grid-ctl">
          <Slider label="Shadow blur" value={style.shadow.blur} min={0} max={40} onChange={setIn('shadow', 'blur')} />
          <Color label="Shadow color" value={style.shadow.color} onChange={setIn('shadow', 'color')} />
          <Slider label="Shadow X" value={style.shadow.x} min={-20} max={20} onChange={setIn('shadow', 'x')} />
          <Slider label="Shadow Y" value={style.shadow.y} min={-20} max={20} onChange={setIn('shadow', 'y')} />
          <Slider label="Glow" value={style.glow.size} min={0} max={40} onChange={setIn('glow', 'size')} />
          <Color label="Glow color" value={style.glow.color} onChange={setIn('glow', 'color')} />
        </div>
      </Section>
      <Section title="Background box">
        <Toggle label="Line එක පිටුපස box එකක්" value={style.box.enabled} onChange={setIn('box', 'enabled')} />
        {style.box.enabled && <div className="grid-ctl">
          <Color label="Box color" value={style.box.color} onChange={setIn('box', 'color')} />
          <Slider label="Transparency" value={style.box.opacity} min={0.1} max={1} step={0.05} onChange={setIn('box', 'opacity')} />
          <Slider label="Rounded" value={style.box.radius} min={0} max={60} onChange={setIn('box', 'radius')} />
          <Slider label="Padding" value={style.box.padding} min={0} max={60} onChange={setIn('box', 'padding')} />
        </div>}
      </Section>
    </div>
  );
}
