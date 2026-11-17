import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './d1-shim.js';
import { getBalance } from '../worker/credits.js';
import { cancelOrder, createOrder, listOrders, listPacks, markOrderPaid, savePacks } from '../worker/topups.js';

function makeUser(db, plan_id = 'free', id = 'u' + Math.random()) {
  db.raw.prepare('INSERT INTO users (id, email, password_hash, plan_id, created_at) VALUES (?, ?, ?, ?, ?)').run(id, id + '@x.com', 'x', plan_id, Date.now());
  return { id, plan_id };
}

test('Default packs', async () => {
  const db = createTestDb();
  const p = await listPacks(db);
  assert.deepEqual(p.map(x => x.minutes), [60, 300, 600]);
});

test('Order → admin paid → minutes added once', async () => {
  const db = createTestDb();
  const u = makeUser(db);
  const before = await getBalance(db, u);
  const o = await createOrder(db, u, { packId: 'pk_300', currency: 'LKR' });
  assert.equal(o.amount, 1200); assert.equal(o.status, 'pending');
  assert.equal((await getBalance(db, u)).credits, before.credits, 'pending → no minutes');
  await markOrderPaid(db, o.id, { paidBy: 'admin1' });
  const after = await getBalance(db, u);
  assert.equal(after.credits, before.credits + 300);
  assert.equal(after.available, before.available + 300);
  await assert.rejects(markOrderPaid(db, o.id), e => e.status === 409, 'double pay blocked');
  assert.equal((await getBalance(db, u)).credits, before.credits + 300);
  await assert.rejects(cancelOrder(db, o.id), e => e.status === 409, 'cannot cancel paid');
  const [row] = await listOrders(db, { userId: u.id });
  assert.equal(row.status, 'paid'); assert.equal(row.method, 'manual');
});

test('Order validation + cancel', async () => {
  const db = createTestDb();
  const u = makeUser(db), other = makeUser(db);
  await assert.rejects(createOrder(db, u, { packId: 'pk_60', currency: 'EUR' }), e => e.status === 400);
  await assert.rejects(createOrder(db, u, { packId: 'nope', currency: 'USD' }), e => e.status === 404);
  const o = await createOrder(db, u, { packId: 'pk_60', currency: 'USD' });
  assert.equal(o.amount, 1);
  await assert.rejects(cancelOrder(db, o.id, { userId: other.id }), e => e.status === 409, 'other user cannot cancel');
  await cancelOrder(db, o.id, { userId: u.id });
  await assert.rejects(markOrderPaid(db, o.id), e => e.status === 409, 'cancelled cannot be paid');
  for (let i = 0; i < 5; i++) await createOrder(db, u, { packId: 'pk_60', currency: 'LKR' });
  await assert.rejects(createOrder(db, u, { packId: 'pk_60', currency: 'LKR' }), e => e.status === 429);
});

test('Admin saves packs', async () => {
  const db = createTestDb();
  const packs = await savePacks(db, [{ minutes: 30, price_lkr: 150, price_usd: 0.5 }, { id: 'pk_300', minutes: 300, price_lkr: 1000, price_usd: 3.5, active: false }]);
  assert.equal(packs.length, 2); assert.equal(packs[1].active, false);
  assert.equal((await listPacks(db)).length, 1, 'inactive hidden from users');
  await assert.rejects(savePacks(db, [{ minutes: 0, price_lkr: 1, price_usd: 1 }]), e => e.status === 400);
  const u = makeUser(db);
  await assert.rejects(createOrder(db, u, { packId: 'pk_300', currency: 'LKR' }), e => e.status === 404, 'inactive pack');
});
