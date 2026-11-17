import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './d1-shim.js';
import { addCredits, getBalance, reserveMinutes, commitUsage, refundUsage } from '../worker/credits.js';
import { secondsToMinutes } from '../worker/util.js';

function makeUser(db, plan_id, id = 'u' + Math.random()) {
  db.raw.prepare('INSERT INTO users (id, email, password_hash, plan_id, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, id + '@x.com', 'x', plan_id, Date.now());
  return { id, plan_id };
}

test('seconds → minutes rounding', () => {
  assert.equal(secondsToMinutes(1), 0.1);
  assert.equal(secondsToMinutes(60), 1);
  assert.equal(secondsToMinutes(61), 1.1);
  assert.equal(secondsToMinutes(146), 2.5);
  assert.equal(secondsToMinutes(12.04), 0.2, '0.5s grace');
  assert.equal(secondsToMinutes(12.6), 0.3);
});

test('Plans: 6 new plans, old ones gone', async () => {
  const db = createTestDb();
  const ids = db.raw.prepare('SELECT id, monthly_minutes FROM plans ORDER BY sort_order').all().map(r => `${r.id}:${r.monthly_minutes}`);
  assert.deepEqual(ids, ['free:12', 'starter:91', 'creator:367', 'pro:1818', 'scale:5455', 'business:18182']);
});

// credits-only plan (මාසික විනාඩි 0) — Free plan එකේ මාසික විනාඩි 0 කරලා test කරනවා
const creditsOnly = db => db.raw.exec("UPDATE plans SET monthly_minutes = 0 WHERE id = 'free'");

test('Credits only: reserve → refund', async () => {
  const db = createTestDb(); creditsOnly(db);
  const u = makeUser(db, 'free');
  await addCredits(db, u.id, 5, 'signup_bonus');
  let b = await getBalance(db, u);
  assert.equal(b.available, 5); assert.equal(b.allowanceLeft, 0);
  const r = await reserveMinutes(db, u, 120, { engine: 'elevenlabs' });
  assert.equal(r.minutes, 2);
  b = await getBalance(db, u);
  assert.equal(b.credits, 3); assert.equal(b.available, 3);
  assert.equal(await refundUsage(db, r.usageId), true);
  assert.equal(await refundUsage(db, r.usageId), false, 'double refund blocked');
  b = await getBalance(db, u);
  assert.equal(b.credits, 5);
});

test('Not enough minutes → 402', async () => {
  const db = createTestDb(); creditsOnly(db);
  const u = makeUser(db, 'free');
  await addCredits(db, u.id, 1, 'admin');
  await assert.rejects(reserveMinutes(db, u, 120), e => e.status === 402);
});

test('Free: video too long → 403', async () => {
  const db = createTestDb();
  const u = makeUser(db, 'free');
  await addCredits(db, u.id, 100, 'admin');
  await assert.rejects(reserveMinutes(db, u, 301), e => e.status === 403);
});

test('Monthly allowance first, then credits (extra minutes)', async () => {
  const db = createTestDb();
  const u = makeUser(db, 'starter');
  db.raw.exec("UPDATE plans SET max_video_seconds = 99999, monthly_minutes = 120 WHERE id = 'starter'");
  await addCredits(db, u.id, 10, 'purchase');
  const a = await reserveMinutes(db, u, 119 * 60);
  await commitUsage(db, a.usageId);
  let b = await getBalance(db, u);
  assert.equal(b.allowanceLeft, 1); assert.equal(b.credits, 10); assert.equal(b.available, 11);
  const r2 = await reserveMinutes(db, u, 180); // 3 min: 1 allowance + 2 credits
  b = await getBalance(db, u);
  assert.equal(b.allowanceLeft, 0); assert.equal(b.credits, 8);
  await refundUsage(db, r2.usageId);
  b = await getBalance(db, u);
  assert.equal(b.allowanceLeft, 1); assert.equal(b.credits, 10);
});

test('Unlimited plan (admin): nothing deducted', async () => {
  const db = createTestDb();
  db.raw.exec("UPDATE plans SET unlimited = 1, max_video_seconds = 99999 WHERE id = 'pro'");
  const u = makeUser(db, 'pro');
  const r = await reserveMinutes(db, u, 3000);
  await commitUsage(db, r.usageId);
  const b = await getBalance(db, u);
  assert.equal(b.unlimited, true); assert.equal(b.available, null); assert.equal(b.credits, 0);
});

import { hashPassword, verifyPassword, isAdminEmail } from '../worker/auth.js';

test('password hash + verify, custom iterations', async () => {
  const h = await hashPassword('secret123', { PASSWORD_ITERATIONS: '20000' });
  assert.match(h, /^pbkdf2\$20000\$/);
  assert.equal(await verifyPassword('secret123', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
  assert.match(await hashPassword('x', { PASSWORD_ITERATIONS: '5' }), /^pbkdf2\$100000\$/, 'out-of-range → default');
});

test('admin rule: ADMIN_EMAILS set → only those emails', async () => {
  const db = createTestDb();
  assert.equal(await isAdminEmail({ ADMIN_EMAILS: 'boss@x.com' }, 'first@x.com', db), false, 'first user NOT admin when list set');
  assert.equal(await isAdminEmail({ ADMIN_EMAILS: 'Boss@x.com, a@b.com' }, 'boss@x.com', db), true);
  assert.equal(await isAdminEmail({ ADMIN_EMAILS: '' }, 'first@x.com', db), true, 'empty list → first user admin');
  makeUser(db, 'free');
  assert.equal(await isAdminEmail({ ADMIN_EMAILS: '' }, 'second@x.com', db), false);
});
