// Extra minutes (top-up): මාසික විනාඩි ඉවර වුණාම users ලට විනාඩි packs මිලදී ගන්න.
// Payment gateway එක (PayHere / Stripe) පස්සේ. දැනට order එක 'pending' විදිහට හැදෙනවා,
// admin "Paid" කළාම (නැත්නම් පස්සේ gateway webhook එකෙන්) markOrderPaid → credits එකතු වෙනවා.
import { addCredits } from './credits.js';
import { HttpError, newId, now } from './util.js';

export const CURRENCIES = ['LKR', 'USD'];

const packOut = p => ({ id: p.id, minutes: p.minutes, price_lkr: p.price_lkr, price_usd: p.price_usd, active: !!p.active, sort_order: p.sort_order });

export async function listPacks(db, { all = false } = {}) {
  const { results } = await db.prepare(`SELECT * FROM topup_packs ${all ? '' : 'WHERE active = 1'} ORDER BY sort_order, minutes`).all();
  return results.map(packOut);
}

/** Admin: packs ලැයිස්තුවම replace කරනවා */
export async function savePacks(db, packs) {
  if (!Array.isArray(packs) || packs.length > 20) throw new HttpError(400, 'Packs ලැයිස්තුව වැරදියි');
  const clean = packs.map((p, i) => {
    const minutes = Number(p.minutes), lkr = Number(p.price_lkr), usd = Number(p.price_usd);
    if (!(minutes > 0 && minutes <= 100000)) throw new HttpError(400, `Pack ${i + 1}: විනාඩි ගණන වැරදියි`);
    if (!(lkr >= 0) || !(usd >= 0)) throw new HttpError(400, `Pack ${i + 1}: මිල වැරදියි`);
    const id = /^pk_[\w-]{1,30}$/.test(p.id || '') ? p.id : newId('pk_');
    return { id, minutes, lkr: Math.round(lkr), usd: Math.round(usd * 100) / 100, active: p.active === false ? 0 : 1, sort: i + 1 };
  });
  const ids = new Set();
  for (const p of clean) { if (ids.has(p.id)) throw new HttpError(400, 'එකම pack එක දෙපාරක්'); ids.add(p.id); }
  await db.batch([
    db.prepare('DELETE FROM topup_packs'),
    ...clean.map(p => db.prepare('INSERT INTO topup_packs (id, minutes, price_lkr, price_usd, active, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(p.id, p.minutes, p.lkr, p.usd, p.active, p.sort)),
  ]);
  return listPacks(db, { all: true });
}

export async function createOrder(db, user, { packId, currency }) {
  if (!CURRENCIES.includes(currency)) throw new HttpError(400, 'Currency එක වැරදියි');
  const pack = await db.prepare('SELECT * FROM topup_packs WHERE id = ? AND active = 1').bind(String(packId || '')).first();
  if (!pack) throw new HttpError(404, 'මේ pack එක දැන් නෑ');
  const amount = currency === 'LKR' ? pack.price_lkr : pack.price_usd;
  if (!(amount > 0)) throw new HttpError(400, `මේ pack එකට ${currency} මිලක් දාලා නෑ`);
  // එක user කෙනෙක්ට pending orders ගොඩක් හදන්න බෑ (spam)
  const pending = await db.prepare(`SELECT COUNT(*) AS n FROM topup_orders WHERE user_id = ? AND status = 'pending'`).bind(user.id).first();
  if (pending.n >= 5) throw new HttpError(429, 'ගෙවන්න තියෙන orders 5ක් තියෙනවා — ඒවා ඉවර කරන්න හරි cancel කරන්න');
  const order = {
    id: newId('ord_'), user_id: user.id, pack_id: pack.id, minutes: pack.minutes, currency, amount,
    status: 'pending', method: '', created_at: now(),
  };
  await db.prepare(
    `INSERT INTO topup_orders (id, user_id, pack_id, minutes, currency, amount, status, method, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?)`,
  ).bind(order.id, order.user_id, order.pack_id, order.minutes, order.currency, order.amount, order.created_at).run();
  return order;
}

/**
 * Order එක ගෙවලා ඉවර — credits එකතු කරනවා. එකම order එකට දෙපාරක් credits එන්නේ නෑ.
 * පස්සේ PayHere / Stripe webhook එකත් මේකම call කරනවා.
 */
export async function markOrderPaid(db, orderId, { method = 'manual', paymentRef = null, paidBy = null, note = '' } = {}) {
  const t = now();
  const res = await db.prepare(
    `UPDATE topup_orders SET status = 'paid', method = ?, payment_ref = ?, paid_at = ?, paid_by = ?, note = ? WHERE id = ? AND status = 'pending'`,
  ).bind(method, paymentRef, t, paidBy, String(note).slice(0, 200), orderId).run();
  const order = await db.prepare('SELECT * FROM topup_orders WHERE id = ?').bind(orderId).first();
  if (!order) throw new HttpError(404, 'Order එක හම්බවුණේ නෑ');
  const changed = res?.meta?.changes ?? 0;
  if (!changed) throw new HttpError(409, order.status === 'paid' ? 'මේ order එක දැනටමත් paid' : 'මේ order එක cancel කරලා');
  await addCredits(db, order.user_id, order.minutes, 'purchase', `Extra minutes — ${order.currency} ${order.amount}`, paidBy, order.id);
  return order;
}

export async function cancelOrder(db, orderId, { userId = null } = {}) {
  const sql = userId
    ? `UPDATE topup_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending' AND user_id = ?`
    : `UPDATE topup_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'`;
  await db.prepare(sql).bind(...(userId ? [orderId, userId] : [orderId])).run();
  const o = await db.prepare('SELECT status FROM topup_orders WHERE id = ?').bind(orderId).first();
  if (!o) throw new HttpError(404, 'Order එක හම්බවුණේ නෑ');
  if (o.status !== 'cancelled') throw new HttpError(409, 'Paid order එකක් cancel කරන්න බෑ');
  return true;
}

export async function listOrders(db, { userId = null, status = null, limit = 100 } = {}) {
  const where = [], vals = [];
  if (userId) { where.push('o.user_id = ?'); vals.push(userId); }
  if (status) { where.push('o.status = ?'); vals.push(status); }
  const { results } = await db.prepare(
    `SELECT o.*, u.email FROM topup_orders o JOIN users u ON u.id = o.user_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY o.created_at DESC LIMIT ?`,
  ).bind(...vals, limit).all();
  return results;
}
