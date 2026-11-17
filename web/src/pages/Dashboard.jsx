import { useEffect, useState } from 'react';
import { api, fmtDate, fmtDuration, fmtHM, fmtMinutes } from '../api.js';
import { Link, useSession } from '../App.jsx';

const STATUS_LABEL = { committed: '✅ සාර්ථකයි', refunded: '↩ ආපහු දුන්නා', reserved: '⏳ Process වෙනවා' };
const TYPE_LABEL = {
  signup_bonus: 'Sign up bonus', purchase: 'Extra minutes මිලදී ගැනීම', admin: 'Admin', usage: 'පාවිච්චිය', refund: 'ආපහු ලැබුණා',
};

export default function Dashboard() {
  const { user, plan, balance, refresh } = useSession();
  const [hist, setHist] = useState({ ledger: [], usage: [] });
  const [projects, setProjects] = useState(null);
  useEffect(() => {
    refresh();
    api('/me/history').then(setHist).catch(() => {});
    api('/projects').then(d => setProjects(d.projects)).catch(() => setProjects([]));
  }, [refresh]);

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
          <div className="muted small">{balance.unlimited ? 'Limit නෑ' : `මේ මාසේ ඉතුරු: ${fmtMinutes(balance.allowanceLeft)} · Extra minutes: ${fmtMinutes(balance.credits)}`}</div>
          {!balance.unlimited && <Link to="/buy" className={`btn sm ${balance.available < 5 ? '' : 'ghost'}`} style={{ marginTop: 8 }}>⏱ Extra minutes ගන්න</Link>}
        </div>
        <div className="card stat">
          <div className="muted small">මේ මාසේ transcription ({balance.period})</div>
          {plan.monthly_minutes > 0 ? (
            <>
              <div className="big">{fmtHM(balance.allowanceUsed)} <span className="muted small">/ {fmtHM(plan.monthly_minutes)}</span></div>
              <div className={`bar ${pct >= 90 ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
              {pct >= 100 && <div className="small" style={{ color: '#fbbf24', marginTop: 6 }}>මාසික කාලය ඉවරයි — Extra minutes වලින් පාවිච්චි වෙනවා</div>}
            </>
          ) : <div className="big">—</div>}
        </div>
      </div>

      <div className="row between">
        <h2 style={{ margin: '10px 0' }}>ඔයාගේ videos</h2>
        <Link to="/new" className="btn">➕ අලුත් video එකක්</Link>
      </div>
      {projects && projects.length === 0 && (
        <Link to="/new" className="card soon empty-link">
          <div className="drop-icon">🎬</div>
          <h3>පළවෙනි video එක upload කරන්න</h3>
          <p className="muted">Video එක upload කරලා එක click එකකින් සිංහල subtitles හදන්න</p>
        </Link>
      )}
      <div className="projects">
        {projects?.map(p => (
          <Link key={p.id} to={`/projects/${p.id}`} className="card proj">
            <div className="proj-thumb">🎞</div>
            <div>
              <b>{p.title}</b>
              <div className="muted small">{fmtDuration(p.duration)} · {fmtDate(p.created_at)}</div>
              <span className={`pill ${p.has_subtitles ? 'ok' : ''}`}>{p.has_subtitles ? '✅ Subtitles තියෙනවා' : 'Subtitles නෑ'}</span>
            </div>
          </Link>
        ))}
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
                  <td>{STATUS_LABEL[u.status] || u.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
