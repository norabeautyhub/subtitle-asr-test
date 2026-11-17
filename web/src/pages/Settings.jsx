import { useState } from 'react';
import { api, fmtHM, fmtMinutes } from '../api.js';
import { Link, useSession } from '../App.jsx';

export default function Settings() {
  const { plan, balance } = useSession();
  return (
    <div className="narrow-page">
      <h1>Settings</h1>
      {plan && balance && (
        <div className="card">
          <h3>📦 Plan එක</h3>
          <div className="row between">
            <div>
              <b style={{ fontSize: 18 }}>{plan.name}</b>
              <div className="muted small">
                {plan.unlimited ? 'Limit නෑ' : `Transcription: මාසෙට ${fmtHM(plan.monthly_minutes)} · Extra minutes: ${fmtMinutes(balance.credits)}`}
              </div>
            </div>
            {!plan.unlimited && <Link to="/buy" className="btn sm">⏱ Extra minutes ගන්න</Link>}
          </div>
          <p className="small muted">Plan එක මාරු කරන්න admin ට කතා කරන්න (online payment ළඟදීම).</p>
        </div>
      )}
      <PasswordForm />
    </div>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const save = async e => {
    e.preventDefault(); setMsg(null);
    try { await api('/me/password', { method: 'POST', body: f }); setF({ current: '', next: '' }); setMsg({ ok: true, t: 'Password එක වෙනස් වුණා ✅' }); }
    catch (err) { setMsg({ ok: false, t: err.message }); }
  };
  return (
    <form className="card" onSubmit={save}>
      <h3>🔒 Password එක වෙනස් කරන්න</h3>
      <label>දැනට තියෙන password එක<input type="password" required value={f.current} onChange={e => setF({ ...f, current: e.target.value })} autoComplete="current-password" /></label>
      <label>අලුත් password එක (අවම අකුරු 8)<input type="password" required minLength={8} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} autoComplete="new-password" /></label>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.t}</div>}
      <button className="btn">Password එක වෙනස් කරන්න</button>
    </form>
  );
}
