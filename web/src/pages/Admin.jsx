import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fmtDate, fmtHM, fmtMinutes, fmtPrice } from '../api.js';
import { useSession } from '../App.jsx';

const TABS = [['overview', 'Overview'], ['users', 'Users'], ['plans', 'Plans'], ['orders', 'Extra minutes'], ['settings', 'Settings']];

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
      {tab === 'orders' && <TopUps />}
      {tab === 'settings' && <Settings />}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const show = (text, kind = 'ok') => {
    clearTimeout(timer.current);
    setMsg({ text, kind });
    timer.current = setTimeout(() => setMsg(null), kind === 'ok' ? 3000 : 6000);
  };
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
        <div className="muted small">ElevenLabs වියදම ≈ ${(s.minutesUsedThisMonth / 60 * 0.20).toFixed(2)}</div></div>
      <div className="card stat"><div className="muted small">ගෙවන්න තියෙන Extra minutes orders</div><div className={`big ${s.pendingOrders ? 'accent' : ''}`}>{s.pendingOrders ?? 0}</div></div>
      {s.engine && (
        <div className="card stat">
          <div className="muted small">Server setup</div>
          <div className="setup">
            <div>{s.engine.mock ? '🧪 Test mode ON (ඇත්ත ElevenLabs නෑ — Settings tab එකෙන් off කරන්න)' : s.engine.elevenlabsKey ? '✅ ElevenLabs key' : '❌ ElevenLabs key නෑ'}</div>
            <div>{s.engine.storage ? '✅ Video storage (R2)' : '❌ R2 storage නෑ'}</div>
            <div>{s.engine.encryptionSecret ? '✅ Encryption secret' : '❌ KEY_ENCRYPTION_SECRET නෑ'}</div>
          </div>
        </div>
      )}
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
    const { id, sort_order, engine, render_mode, ...body } = f;
    try { await api(`/admin/plans/${plan.id}`, { method: 'PUT', body }); show('Save වුණා'); onSaved(); }
    catch (err) { show(err.message, 'err'); }
  };
  return (
    <form className="card plan-edit" onSubmit={save}>
      <h3>{plan.id}</h3>
      {toast}
      <label>නම<input value={f.name} onChange={set('name')} /></label>
      <label>විස්තරය<input value={f.description} onChange={set('description')} /></label>
      <label>Transcription — මාසික විනාඩි <span className="muted">({fmtHM(f.monthly_minutes)})</span><input type="number" min="0" step="1" value={f.monthly_minutes} onChange={set('monthly_minutes', true)} /></label>
      <label className="check"><input type="checkbox" checked={f.unlimited} onChange={set('unlimited')} /> Minutes limit නෑ (unlimited)</label>
      <label>උපරිම video දිග (තත්පර)<input type="number" min="1" value={f.max_video_seconds} onChange={set('max_video_seconds', true)} /></label>
      <label>Export quality
        <select value={f.export_quality} onChange={set('export_quality')}>
          <option>720p</option><option>1080p</option><option>4k</option>
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={f.watermark} onChange={set('watermark')} /> Watermark</label>
      <label>උපරිම projects<input type="number" min="0" value={f.max_projects} onChange={set('max_projects', true)} /></label>
      <div className="grid2 tight">
        <label>මිල LKR / මාසෙට<input type="number" min="0" value={f.price_lkr} onChange={set('price_lkr', true)} /></label>
        <label>මිල USD / මාසෙට<input type="number" min="0" step="0.01" value={f.price_usd} onChange={set('price_usd', true)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Website එකේ පෙන්වන්න</label>
      <button className="btn full">Save</button>
    </form>
  );
}

// ---------------- Extra minutes: packs + orders ----------------
const ORDER_STATUS = { pending: '⏳ Pending', paid: '✅ Paid', cancelled: '✕ Cancelled' };

function TopUps() {
  return (
    <div>
      <OrdersList />
      <PacksEditor />
    </div>
  );
}

function OrdersList() {
  const [status, setStatus] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [toast, show] = useToast();
  const load = useCallback(() => api(`/admin/topup/orders${status ? `?status=${status}` : ''}`).then(d => setOrders(d.orders)).catch(e => show(e.message, 'err')), [status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  const paid = async o => {
    const note = prompt(`${o.email} — ${fmtHM(o.minutes)} (${fmtPrice(o.amount, o.currency)})\nගෙවීම ලැබුණාද? සටහනක් (උදා: bank ref):`, '');
    if (note === null) return;
    try { await api(`/admin/topup/orders/${o.id}/paid`, { method: 'POST', body: { note } }); show(`✅ ${fmtHM(o.minutes)} ${o.email} ට එකතු කළා`); load(); }
    catch (e) { show(e.message, 'err'); }
  };
  const cancel = async o => {
    if (!confirm(`${o.id} cancel කරන්නද?`)) return;
    try { await api(`/admin/topup/orders/${o.id}/cancel`, { method: 'POST' }); load(); } catch (e) { show(e.message, 'err'); }
  };
  return (
    <div className="card">
      <div className="row between">
        <h3 style={{ margin: 0 }}>🧾 Extra minutes orders</h3>
        <select style={{ width: 'auto', margin: 0 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="pending">Pending</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option><option value="">ඔක්කොම</option>
        </select>
      </div>
      {toast}
      <p className="small muted">Card payment (PayHere / Stripe) දානකන් users order එකක් හදලා ඔයාට ගෙවනවා. සල්ලි ලැබුණාම "Paid" ඔබන්න — විනාඩි auto එකතු වෙනවා.</p>
      {orders === null ? <p className="muted">Loading...</p> : (
        <table className="table">
          <thead><tr><th>දිනය</th><th>User</th><th>Order</th><th>විනාඩි</th><th>මිල</th><th>තත්වය</th><th /></tr></thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} className="muted">Orders නෑ</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td>{fmtDate(o.created_at)}</td>
                <td>{o.email}</td>
                <td><code className="small">{o.id}</code>{o.note && <div className="muted small">{o.note}</div>}</td>
                <td>{fmtHM(o.minutes)}</td>
                <td>{fmtPrice(o.amount, o.currency)}</td>
                <td>{ORDER_STATUS[o.status] || o.status}{o.paid_at && <div className="muted small">{fmtDate(o.paid_at)}</div>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{o.status === 'pending' && <>
                  <button className="btn xs" onClick={() => paid(o)}>✓ Paid</button>{' '}
                  <button className="btn ghost xs" onClick={() => cancel(o)}>Cancel</button>
                </>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PacksEditor() {
  const [packs, setPacks] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => { api('/admin/topup/packs').then(d => setPacks(d.packs)).catch(e => show(e.message, 'err')); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!packs) return <div className="card muted">Loading...</div>;
  const set = (i, k) => e => setPacks(ps => ps.map((p, j) => (j === i ? { ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value } : p)));
  const move = (i, d) => setPacks(ps => { const a = [...ps]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const save = async () => {
    try { const r = await api('/admin/topup/packs', { method: 'PUT', body: { packs } }); setPacks(r.packs); show('Save වුණා'); }
    catch (e) { show(e.message, 'err'); }
  };
  return (
    <div className="card">
      <h3>📦 Extra minutes packs</h3>
      {toast}
      <p className="small muted">Users ලට පේන packs. ElevenLabs වියදම පැයකට ~$0.20යි — ඒකට ලාභයක් එකතු කරලා මිල දාන්න.</p>
      <table className="table packs-edit">
        <thead><tr><th>විනාඩි</th><th>LKR</th><th>USD</th><th>පෙන්වන්න</th><th /></tr></thead>
        <tbody>
          {packs.map((p, i) => (
            <tr key={p.id || i}>
              <td><input type="number" min="1" value={p.minutes} onChange={set(i, 'minutes')} /><div className="muted small">{fmtHM(p.minutes)}</div></td>
              <td><input type="number" min="0" value={p.price_lkr} onChange={set(i, 'price_lkr')} /></td>
              <td><input type="number" min="0" step="0.01" value={p.price_usd} onChange={set(i, 'price_usd')} /></td>
              <td><input type="checkbox" checked={p.active !== false} onChange={set(i, 'active')} /></td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn ghost xs" onClick={() => move(i, -1)}>↑</button>{' '}
                <button className="btn ghost xs" onClick={() => move(i, 1)}>↓</button>{' '}
                <button className="btn ghost xs danger" onClick={() => setPacks(ps => ps.filter((_, j) => j !== i))}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <button className="btn ghost sm" onClick={() => setPacks(ps => [...ps, { minutes: 120, price_lkr: 0, price_usd: 0, active: true }])}>➕ Pack එකක්</button>
        <button className="btn sm" onClick={save}>Save</button>
      </div>
    </div>
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
    <div className="narrow">
    <ElevenLabsSettings />
    <form className="card" onSubmit={save}>
      <h3>👥 Sign up</h3>
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
    </div>
  );
}

function ElevenLabsSettings() {
  const [d, setD] = useState(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState('');
  const [toast, show] = useToast();
  const load = () => api('/admin/elevenlabs').then(setD).catch(e => show(e.message, 'err'));
  useEffect(() => { load(); }, []);
  if (!d) return <div className="card muted">Loading...</div>;
  const run = async (what, fn) => {
    setBusy(what);
    try { await fn(); } catch (e) { show(e.message, 'err'); } finally { setBusy(''); }
  };
  const saveKey = e => { e.preventDefault(); run('save', async () => {
    const r = await api('/admin/elevenlabs/key', { method: 'PUT', body: { key } });
    setKey(''); show(`Save වුණා. ${r.test.message}`); load();
  }); };
  const test = () => run('test', async () => { const r = await api('/admin/elevenlabs/test', { method: 'POST' }); show(r.message, r.ok ? 'ok' : 'err'); });
  const remove = () => { if (confirm('Admin panel එකේ key එක අයින් කරන්නද?')) run('del', async () => { await api('/admin/elevenlabs/key', { method: 'DELETE' }); show('අයින් කළා'); load(); }); };
  const setMock = on => run('mock', async () => { await api('/admin/elevenlabs/mock', { method: 'PUT', body: { mock: on } }); load(); show(on ? 'Test mode ON' : 'Test mode OFF — දැන් ඇත්ත ElevenLabs'); });
  const src = { admin: 'Admin panel එකෙන්', env: '.dev.vars / Cloudflare secret එකෙන්', none: '' }[d.key.source];
  return (
    <div className="card el-settings">
      <h3>🎙 ElevenLabs (Basic / Standard plans වලට)</h3>
      {toast}
      <div className={`mode-switch ${d.mock ? 'is-mock' : 'is-live'}`}>
        <div>
          <b>{d.mock ? '🧪 Test mode — ON' : '🟢 Live — ඇත්ත ElevenLabs'}</b>
          <div className="small muted">{d.mock ? 'Subtitles බොරු වචන (ElevenLabs එකට යන්නේ නෑ, credits වැය වෙන්නේ නෑ)' : 'Videos ඇත්තටම ElevenLabs එකෙන් කියවනවා'}</div>
        </div>
        <button type="button" className={`switch ${d.mock ? '' : 'on'}`} disabled={busy === 'mock'} onClick={() => setMock(!d.mock)} aria-label="Test mode">
          <span />
        </button>
      </div>

      <div className="key-status">
        {d.key.source === 'none'
          ? <span className="neg">❌ Key එකක් නෑ</span>
          : <span>🔑 <code>••••{d.key.last4}</code> <span className="muted small">({src})</span></span>}
        {d.key.source !== 'none' && <button type="button" className="btn ghost xs" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Check කරනවා...' : '✓ Test කරන්න'}</button>}
        {d.key.source === 'admin' && <button type="button" className="btn ghost xs danger" disabled={!!busy} onClick={remove}>අයින් කරන්න</button>}
      </div>
      <form onSubmit={saveKey}>
        <label>{d.key.source === 'admin' ? 'Key එක මාරු කරන්න' : 'API key එක දාන්න'}
          <div className="row" style={{ margin: '5px 0 0' }}>
            <input type="password" autoComplete="off" placeholder="sk_..." value={key} onChange={e => setKey(e.target.value)} />
            <button className="btn sm" disabled={!key.trim() || !!busy}>{busy === 'save' ? 'Check කරනවා...' : 'Save'}</button>
          </div>
        </label>
        <p className="small muted">Key එක save කරන්න කලින් ElevenLabs එකෙන් check කරනවා. Database එකේ encrypt කරලා තියෙන්නේ — ආයේ පේන්නේ අන්තිම අකුරු 4 විතරයි.</p>
      </form>
    </div>
  );
}
