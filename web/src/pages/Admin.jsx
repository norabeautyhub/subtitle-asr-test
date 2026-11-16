import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtMinutes } from '../api.js';
import { useSession } from '../App.jsx';

const TABS = [['overview', 'Overview'], ['users', 'Users'], ['plans', 'Plans'], ['settings', 'Settings']];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <h1>Admin panel</h1>
      <div className="tabs">
        {TABS.map(([k, label]) => (
          <button key={k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'plans' && <Plans />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState(null);
  const show = (text, kind = 'ok') => { setMsg({ text, kind }); setTimeout(() => setMsg(null), 3000); };
  const el = msg && <div className={`alert ${msg.kind === 'ok' ? 'ok' : 'error'}`}>{msg.text}</div>;
  return [el, show];
}

// ---------------- Overview ----------------
function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => { api('/admin/stats').then(setS).catch(() => {}); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  return (
    <div className="grid3">
      <div className="card stat"><div className="muted small">මුළු users</div><div className="big">{s.users}</div>
        <div className="muted small">{Object.entries(s.byPlan).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div></div>
      <div className="card stat"><div className="muted small">මේ මාසේ ({s.period}) process කළ විනාඩි</div><div className="big accent">{fmtMinutes(s.minutesUsedThisMonth)}</div></div>
      <div className="card stat"><div className="muted small">මේ මාසේ videos</div><div className="big">{s.jobsThisMonth}</div>
        <div className="muted small">ElevenLabs වියදම ≈ ${(s.minutesUsedThisMonth / 60 * 0.22).toFixed(2)}</div></div>
    </div>
  );
}

// ---------------- Users ----------------
function Users() {
  const [q, setQ] = useState('');
  const [data, setData] = useState({ users: [], hasMore: false, page: 1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    api(`/admin/users?q=${encodeURIComponent(q)}&page=${page}`).then(setData).catch(() => {});
  }, [q, page]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  return (
    <div className="admin-users">
      <div className="card">
        <input className="search" placeholder="Email හරි නම හරි search කරන්න..." value={q}
          onChange={e => { setQ(e.target.value); setPage(1); }} />
        <table className="table clickable">
          <thead><tr><th>Email</th><th>නම</th><th>Plan</th><th>Credits</th><th>Role</th><th>Status</th><th>හැදුවේ</th></tr></thead>
          <tbody>
            {data.users.map(u => (
              <tr key={u.id} className={selected === u.id ? 'sel' : ''} onClick={() => setSelected(u.id)}>
                <td>{u.email}</td><td>{u.name}</td><td>{u.plan_id}</td><td>{fmtMinutes(u.credits)}</td>
                <td>{u.role === 'admin' ? <b>admin</b> : 'user'}</td>
                <td className={u.status === 'blocked' ? 'neg' : ''}>{u.status}</td>
                <td>{fmtDate(u.created_at)}</td>
              </tr>
            ))}
            {data.users.length === 0 && <tr><td colSpan={7} className="muted">Users නෑ</td></tr>}
          </tbody>
        </table>
        <div className="row">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← කලින්</button>
          <span className="muted small">Page {page}</span>
          <button className="btn ghost sm" disabled={!data.hasMore} onClick={() => setPage(p => p + 1)}>ඊළඟ →</button>
        </div>
      </div>
      {selected && <UserDetail id={selected} onChange={load} onClose={() => setSelected(null)} />}
    </div>
  );
}

function UserDetail({ id, onChange, onClose }) {
  const { user: me } = useSession();
  const [d, setD] = useState(null);
  const [plans, setPlans] = useState([]);
  const [credit, setCredit] = useState({ minutes: '', note: '' });
  const [toast, show] = useToast();

  const load = useCallback(() => { api(`/admin/users/${id}`).then(setD).catch(e => show(e.message, 'err')); }, [id]);
  useEffect(() => { load(); api('/admin/plans').then(x => setPlans(x.plans)); }, [load]);

  const patch = async body => {
    try { await api(`/admin/users/${id}`, { method: 'PATCH', body }); show('Save වුණා'); load(); onChange(); }
    catch (e) { show(e.message, 'err'); }
  };
  const addCredit = async e => {
    e.preventDefault();
    try {
      await api(`/admin/users/${id}/credits`, { method: 'POST', body: { minutes: Number(credit.minutes), note: credit.note } });
      setCredit({ minutes: '', note: '' }); show('Credits update වුණා'); load(); onChange();
    } catch (err) { show(err.message, 'err'); }
  };

  if (!d) return <div className="card">Loading...</div>;
  const { user, balance, ledger } = d;
  return (
    <div className="card detail">
      <div className="row between"><h3>{user.email}</h3><button className="btn ghost sm" onClick={onClose}>✕</button></div>
      {toast}
      <div className="grid2 tight">
        <label>Plan
          <select value={user.plan_id} onChange={e => patch({ plan_id: e.target.value })}>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Role
          <select value={user.role} disabled={user.id === me.id} onChange={e => patch({ role: e.target.value })}>
            <option value="user">user</option><option value="admin">admin</option>
          </select>
        </label>
        <label>Status
          <select value={user.status} disabled={user.id === me.id} onChange={e => patch({ status: e.target.value })}>
            <option value="active">active</option><option value="blocked">blocked</option>
          </select>
        </label>
        <div className="stat"><div className="muted small">ලැබිය හැකි විනාඩි</div>
          <div className="big accent">{balance.unlimited ? '∞' : fmtMinutes(balance.available)}</div>
          <div className="muted small">Credits {fmtMinutes(balance.credits)} · මාසික ඉතුරු {fmtMinutes(balance.allowanceLeft)}</div></div>
      </div>

      <form className="row" onSubmit={addCredit}>
        <input type="number" step="0.1" placeholder="විනාඩි (+ එකතු / − අඩු)" required value={credit.minutes}
          onChange={e => setCredit(c => ({ ...c, minutes: e.target.value }))} />
        <input placeholder="සටහන (උදා: Payment #123)" value={credit.note} onChange={e => setCredit(c => ({ ...c, note: e.target.value }))} />
        <button className="btn sm">Credits update</button>
      </form>

      <h4>Credits ඉතිහාසය</h4>
      <table className="table">
        <thead><tr><th>දිනය</th><th>වර්ගය</th><th>විනාඩි</th><th>සටහන</th></tr></thead>
        <tbody>
          {ledger.map(l => (
            <tr key={l.id}><td>{fmtDate(l.created_at)}</td><td>{l.type}</td>
              <td className={l.minutes >= 0 ? 'pos' : 'neg'}>{l.minutes >= 0 ? '+' : ''}{fmtMinutes(l.minutes)}</td><td className="muted">{l.note}</td></tr>
          ))}
          {ledger.length === 0 && <tr><td colSpan={4} className="muted">නෑ</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Plans ----------------
function Plans() {
  const [plans, setPlans] = useState([]);
  const load = () => api('/admin/plans').then(d => setPlans(d.plans));
  useEffect(() => { load(); }, []);
  return <div className="grid3">{plans.map(p => <PlanEditor key={p.id} plan={p} onSaved={load} />)}</div>;
}

function PlanEditor({ plan, onSaved }) {
  const [f, setF] = useState(plan);
  const [toast, show] = useToast();
  useEffect(() => setF(plan), [plan]);
  const set = (k, num) => e => setF(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : num ? Number(e.target.value) : e.target.value }));
  const save = async e => {
    e.preventDefault();
    const { id, sort_order, ...body } = f;
    try { await api(`/admin/plans/${plan.id}`, { method: 'PUT', body }); show('Save වුණා'); onSaved(); }
    catch (err) { show(err.message, 'err'); }
  };
  return (
    <form className="card plan-edit" onSubmit={save}>
      <h3>{plan.id}</h3>
      {toast}
      <label>නම<input value={f.name} onChange={set('name')} /></label>
      <label>විස්තරය<input value={f.description} onChange={set('description')} /></label>
      <label>Engine
        <select value={f.engine} onChange={set('engine')}>
          <option value="elevenlabs">ElevenLabs (අපේ key)</option>
          <option value="elevenlabs_byok">ElevenLabs (user ගේ key — BYOK)</option>
        </select>
      </label>
      <label>මාසික විනාඩි<input type="number" min="0" step="1" value={f.monthly_minutes} onChange={set('monthly_minutes', true)} /></label>
      <label className="check"><input type="checkbox" checked={f.unlimited} onChange={set('unlimited')} /> Minutes limit නෑ (unlimited)</label>
      <label>උපරිම video දිග (තත්පර)<input type="number" min="1" value={f.max_video_seconds} onChange={set('max_video_seconds', true)} /></label>
      <label>Export quality
        <select value={f.export_quality} onChange={set('export_quality')}>
          <option>720p</option><option>1080p</option><option>4k</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={f.watermark} onChange={set('watermark')} /> Watermark</label>
      <label>උපරිම projects<input type="number" min="0" value={f.max_projects} onChange={set('max_projects', true)} /></label>
      <label>Render
        <select value={f.render_mode} onChange={set('render_mode')}>
          <option value="browser">Browser</option><option value="server">Server</option>
        </select>
      </label>
      <label>මිල (රු./මාසෙට — පෙන්වන්න විතරයි)<input type="number" min="0" value={f.price_lkr} onChange={set('price_lkr', true)} /></label>
      <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Website එකේ පෙන්වන්න</label>
      <button className="btn full">Save</button>
    </form>
  );
}

// ---------------- Settings ----------------
function Settings() {
  const [s, setS] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => { api('/admin/settings').then(d => setS(d.settings)); }, []);
  if (!s) return <p className="muted">Loading...</p>;
  const save = async e => {
    e.preventDefault();
    try { await api('/admin/settings', { method: 'PUT', body: s }); show('Save වුණා'); }
    catch (err) { show(err.message, 'err'); }
  };
  return (
    <form className="card narrow" onSubmit={save}>
      {toast}
      <label>Sign up bonus (විනාඩි) — අලුත් users ලට ලැබෙන free විනාඩි
        <input type="number" min="0" step="0.5" value={s.signup_bonus_minutes} onChange={e => setS({ ...s, signup_bonus_minutes: e.target.value })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={s.signups_enabled === '1'} onChange={e => setS({ ...s, signups_enabled: e.target.checked ? '1' : '0' })} />
        අලුත් users ලට sign up වෙන්න ඉඩ දෙන්න
      </label>
      <button className="btn">Save</button>
    </form>
  );
}
