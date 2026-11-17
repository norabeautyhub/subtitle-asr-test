// Extra minutes: මාසික transcription කාලය ඉවර වුණාම විනාඩි packs මිලදී ගන්න.
// Card payment (PayHere / Stripe) පස්සේ — දැනට order එක හැදිලා admin "Paid" කළාම විනාඩි එකතු වෙනවා.
import { useCallback, useEffect, useState } from 'react';
import { api, fmtDate, fmtHM, fmtMinutes, fmtPrice } from '../api.js';
import { Link, useSession } from '../App.jsx';
import { CurrencyToggle, saveCurrency, savedCurrency } from '../components/PlanCard.jsx';

const STATUS = { pending: ['⏳ ගෙවන්න තියෙනවා', ''], paid: ['✅ ගෙව්වා', 'ok'], cancelled: ['✕ Cancel කළා', 'muted-pill'] };

export default function BuyMinutes() {
  const { plan, balance, refresh } = useSession();
  const [packs, setPacks] = useState(null);
  const [orders, setOrders] = useState([]);
  const [cur, setCur] = useState(savedCurrency);
  const [busy, setBusy] = useState('');
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');

  const loadOrders = useCallback(() => api('/topup/orders').then(d => setOrders(d.orders)).catch(() => {}), []);
  useEffect(() => {
    refresh();
    api('/topup/packs').then(d => setPacks(d.packs)).catch(e => setError(e.message));
    loadOrders();
  }, [refresh, loadOrders]);

  const pickCur = c => { setCur(c); saveCurrency(c); };
  const buy = async pack => {
    setBusy(pack.id); setError(''); setCreated(null);
    try {
      const r = await api('/topup/orders', { method: 'POST', body: { packId: pack.id, currency: cur } });
      setCreated(r.order);
      loadOrders();
    } catch (e) { setError(e.message); } finally { setBusy(''); }
  };
  const cancel = async id => {
    if (!confirm('මේ order එක cancel කරන්නද?')) return;
    try { await api(`/topup/orders/${id}/cancel`, { method: 'POST' }); loadOrders(); if (created?.id === id) setCreated(null); }
    catch (e) { setError(e.message); }
  };

  if (!plan || !balance) return null;
  const used = balance.allowanceUsed, total = plan.monthly_minutes;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const price = p => (cur === 'USD' ? p.price_usd : p.price_lkr);
  const perHour = p => (price(p) / p.minutes) * 60;
  const bestPerHour = packs?.length ? Math.min(...packs.filter(p => price(p) > 0).map(perHour)) : 0;

  return (
    <div className="buy-page">
      <Link to="/dashboard" className="muted small">← Dashboard</Link>
      <h1 style={{ marginTop: 4 }}>⏱ Extra minutes</h1>
      <p className="muted">මාසික transcription කාලය ඉවර වුණාම මෙතනින් අමතර විනාඩි ගන්න. ගත්ත විනාඩි ඉවර වෙනකන් තියෙනවා (මාසෙන් මාසේ මැකෙන්නේ නෑ).</p>

      <div className="card usage-card">
        <div className="usage-row">
          <div>
            <div className="muted small">{plan.name} plan · මේ මාසේ transcription</div>
            <div className="big-num">{fmtHM(used)} <span className="muted">/ {fmtHM(total)}</span></div>
          </div>
          <div className="usage-extra">
            <div className="muted small">Extra minutes ශේෂය</div>
            <div className="big-num accent">{fmtMinutes(balance.credits)} <span className="muted small">විනාඩි</span></div>
          </div>
        </div>
        <div className={`bar big-bar ${pct >= 90 ? 'warn' : ''}`}><div style={{ width: `${pct}%` }} /></div>
        <div className="muted small">දැන් පාවිච්චි කරන්න පුළුවන්: <b>{fmtMinutes(balance.available)}</b> විනාඩි</div>
      </div>

      <div className="row between">
        <h2 style={{ margin: '8px 0' }}>Packs</h2>
        <CurrencyToggle value={cur} onChange={pickCur} />
      </div>
      {error && <div className="alert error">{error}</div>}
      {created && (
        <div className="alert ok order-made">
          <b>✅ Order එක හැදුවා — {fmtHM(created.minutes)} · {fmtPrice(created.amount, created.currency)}</b>
          <div>💳 Card payment එක ළඟදීම එනවා. දැනට ගෙවන්න admin ට කතා කරලා මේ order අංකය කියන්න: <code>{created.id}</code></div>
          <div className="small">ගෙවීම confirm වුණාම විනාඩි ඔයාගේ account එකට auto එකතු වෙනවා.</div>
        </div>
      )}
      <div className="packs">
        {packs === null && <p className="muted">Loading...</p>}
        {packs?.length === 0 && <p className="muted">දැනට packs නෑ.</p>}
        {packs?.map(p => (
          <div key={p.id} className="card pack">
            {price(p) > 0 && Math.abs(perHour(p) - bestPerHour) < 0.001 && packs.length > 1 && <span className="badge">හොඳම වටිනාකම</span>}
            <div className="pack-time">{fmtHM(p.minutes)}</div>
            <div className="pack-price">{price(p) > 0 ? fmtPrice(price(p), cur) : '—'}</div>
            <div className="muted small">{price(p) > 0 ? `පැයකට ${fmtPrice(Math.round(perHour(p) * 100) / 100, cur)}` : `${cur} මිලක් නෑ`}</div>
            <button className="btn full" disabled={!!busy || !(price(p) > 0)} onClick={() => buy(p)}>
              {busy === p.id ? '...' : 'මිලදී ගන්න'}
            </button>
          </div>
        ))}
      </div>
      <p className="small muted">💳 Card payment (Visa / Master) ළඟදීම. දැනට order එකක් හදලා admin ට ගෙවන්න පුළුවන්.</p>

      {orders.length > 0 && (
        <div className="card">
          <h3>මගේ orders</h3>
          <table className="table">
            <thead><tr><th>දිනය</th><th>Order</th><th>විනාඩි</th><th>මිල</th><th>තත්වය</th><th /></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td>{fmtDate(o.created_at)}</td>
                  <td><code className="small">{o.id}</code></td>
                  <td>{fmtHM(o.minutes)}</td>
                  <td>{fmtPrice(o.amount, o.currency)}</td>
                  <td><span className={`pill ${STATUS[o.status]?.[1] || ''}`}>{STATUS[o.status]?.[0] || o.status}</span></td>
                  <td>{o.status === 'pending' && <button className="btn ghost xs" onClick={() => cancel(o.id)}>Cancel</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
