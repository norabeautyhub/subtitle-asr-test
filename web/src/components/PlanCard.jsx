import { fmtHM, fmtPrice } from '../api.js';

export default function PlanCard({ plan, current = false, currency = 'LKR', children }) {
  const price = currency === 'USD' ? plan.price_usd : plan.price_lkr;
  return (
    <div className={`card plan ${current ? 'current' : ''}`}>
      {current && <div className="badge">ඔයාගේ plan එක</div>}
      <h3>{plan.name}</h3>
      <p className="muted">{plan.description}</p>
      <div className="price">{price > 0 ? <>{fmtPrice(price, currency)}<span>/මාසෙට</span></> : 'නොමිලේ'}</div>
      <ul className="features">
        <li><b>{plan.unlimited ? 'Transcription limit නෑ' : `Transcription: මාසෙට ${fmtHM(plan.monthly_minutes)}`}</b></li>
        <li>ElevenLabs AI (හොඳම සිංහල quality)</li>
        <li>උපරිම video දිග: විනාඩි {Math.round(plan.max_video_seconds / 60)}</li>
        <li>Export: {plan.export_quality.toUpperCase()}</li>
        <li>{plan.watermark ? 'Watermark එක්ක' : 'Watermark නෑ'}</li>
        {!plan.unlimited && <li>විනාඩි ඉවර වුණාම Extra minutes ගන්න පුළුවන්</li>}
      </ul>
      {children}
    </div>
  );
}

export function CurrencyToggle({ value, onChange }) {
  return (
    <div className="cur-toggle" role="group" aria-label="Currency">
      {['LKR', 'USD'].map(c => <button key={c} type="button" className={value === c ? 'on' : ''} onClick={() => onChange(c)}>{c}</button>)}
    </div>
  );
}

const KEY = 'novi-currency';
export function savedCurrency() { try { return localStorage.getItem(KEY) === 'USD' ? 'USD' : 'LKR'; } catch { return 'LKR'; } }
export function saveCurrency(c) { try { localStorage.setItem(KEY, c); } catch { /* ignore */ } }
