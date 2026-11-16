import { useEffect, useState } from 'react';
import { api, fmtDate, fmtMinutes } from '../api.js';
import { useSession } from '../App.jsx';

const TYPE_LABEL = {
  signup_bonus: 'Sign up bonus', purchase: 'මිලදී ගැනීම', admin: 'Admin', usage: 'පාවිච්චිය', refund: 'ආපහු ලැබුණා',
};

export default function Dashboard() {
  const { user, plan, balance, refresh } = useSession();
  const [hist, setHist] = useState({ ledger: [], usage: [] });
  useEffect(() => { refresh(); api('/me/history').then(setHist).catch(() => {}); }, [refresh]);

  if (!plan || !balance) return null;
  const pct = plan.monthly_minutes > 0 ? Math.min(100, (balance.allowanceUsed / plan.monthly_minutes) * 100) : 0;

  return (
    <div className="dash">
      <h1>ආයුබෝවන්{user.name ? `, ${user.name}` : ''} 👋</h1>

      <div className="grid3">
        <div className="card stat">
          <div className="muted small">ඔයාගේ plan එක</div>
          <div className="big">{plan.name}</div>
          <div className="muted small">Export {plan.export_quality.toUpperCase()} · {plan.watermark ? 'Watermark එක්ක' : 'Watermark නෑ'}</div>
        </div>
        <div className="card stat">
          <div className="muted small">පාවිච්චි කරන්න පුළුවන් විනාඩි</div>
          <div className="big accent">{balance.unlimited ? '∞' : fmtMinutes(balance.available)}</div>
          <div className="muted small">{balance.unlimited ? 'ඔයාගේම ElevenLabs key එක — limit නෑ' : `Credits: ${fmtMinutes(balance.credits)}${plan.monthly_minutes > 0 ? ` · මේ මාසේ ඉතුරු: ${fmtMinutes(balance.allowanceLeft)}` : ''}`}</div>
        </div>
        <div className="card stat">
          <div className="muted small">මේ මාසේ ({balance.period})</div>
          {plan.monthly_minutes > 0 ? (
            <>
              <div className="big">{fmtMinutes(balance.allowanceUsed)} <span className="muted small">/ {plan.monthly_minutes}</span></div>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
            </>
          ) : <div className="big">—</div>}
        </div>
      </div>

      <div className="card soon">
        <h3>🎬 Video upload සහ editor එක</h3>
        <p className="muted">ඊළඟ update එකේ (Phase 1 — කොටස 2 සහ 3) එනවා.</p>
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Credits ඉතිහාසය</h3>
          <table className="table">
            <thead><tr><th>දිනය</th><th>වර්ගය</th><th>විනාඩි</th><th>සටහන</th></tr></thead>
            <tbody>
              {hist.ledger.length === 0 && <tr><td colSpan={4} className="muted">තාම කිසිවක් නෑ</td></tr>}
              {hist.ledger.map((l, i) => (
                <tr key={i}>
                  <td>{fmtDate(l.created_at)}</td>
                  <td>{TYPE_LABEL[l.type] || l.type}</td>
                  <td className={l.minutes >= 0 ? 'pos' : 'neg'}>{l.minutes >= 0 ? '+' : ''}{fmtMinutes(l.minutes)}</td>
                  <td className="muted">{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Videos process කළ ඉතිහාසය</h3>
          <table className="table">
            <thead><tr><th>දිනය</th><th>Video</th><th>විනාඩි</th><th>තත්ත්වය</th></tr></thead>
            <tbody>
              {hist.usage.length === 0 && <tr><td colSpan={4} className="muted">තාම videos process කරලා නෑ</td></tr>}
              {hist.usage.map(u => (
                <tr key={u.id}>
                  <td>{fmtDate(u.created_at)}</td>
                  <td>{u.description || '—'}</td>
                  <td>{fmtMinutes(u.minutes)}</td>
                  <td>{u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
