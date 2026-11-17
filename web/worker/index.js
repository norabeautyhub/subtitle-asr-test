// Novi Subtitles — API (Cloudflare Worker + Hono)
import { Hono } from 'hono';
import { cleanKey, companyKeyInfo, deleteCompanyKey, getCompanyKey, getMockMode, saveCompanyKey, setMockMode, testElevenLabsKey } from './platform.js';
import {
  createSession, destroySession, hashPassword, isAdminEmail, loadUser,
  requireAdmin, requireUser, validateCredentials, verifyPassword,
} from './auth.js';
import { addCredits, getBalance, getPlan, getSetting } from './credits.js';
import projects from './projects.js';
import { encryptSecret } from './secrets.js';
import { HttpError, newId, now, round1 } from './util.js';

const app = new Hono().basePath('/api');

// ---------------- Errors + CSRF ----------------
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Server error එකක් ආවා' }, 500);
});
app.notFound(c => c.json({ error: 'Not found' }, 404));

// වෙනත් websites වලින් එන form submit (CSRF) නවත්වන්න:
// POST/PUT/PATCH/DELETE වලට JSON, නැත්නම් (video/audio upload) අපේ "X-Requested-With: novi" header එක ඕනේ.
// වෙන website එකකට මේ දෙකම CORS preflight නැතුව යවන්න බෑ.
app.use('*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const isJson = (c.req.header('content-type') || '').includes('application/json');
    const isOurs = c.req.header('x-requested-with') === 'novi';
    if (!isJson && !isOurs) throw new HttpError(415, 'JSON request එකක් ඕනේ');
  }
  await next();
});

const body = async c => {
  try { return await c.req.json(); } catch { throw new HttpError(400, 'JSON එක වැරදියි'); }
};

const publicUser = u => ({
  id: u.id, email: u.email, name: u.name, role: u.role, plan_id: u.plan_id, status: u.status,
  created_at: u.created_at, last_login_at: u.last_login_at,
});

const publicPlan = p => ({
  id: p.id, name: p.name, description: p.description, engine: p.engine,
  monthly_minutes: p.monthly_minutes, unlimited: !!p.unlimited, max_video_seconds: p.max_video_seconds,
  export_quality: p.export_quality, watermark: !!p.watermark, max_projects: p.max_projects,
  render_mode: p.render_mode, price_lkr: p.price_lkr, sort_order: p.sort_order, active: !!p.active,
});

// ---------------- Public ----------------
app.get('/health', c => c.json({ ok: true, app: c.env.APP_NAME }));

app.get('/plans', async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM plans WHERE active = 1 ORDER BY sort_order').all();
  return c.json({ plans: results.map(publicPlan) });
});

// ---------------- Auth ----------------
app.post('/auth/register', async c => {
  const db = c.env.DB;
  const { email: rawEmail, password, name = '' } = await body(c);
  const email = validateCredentials(rawEmail, password);
  if (await getSetting(db, 'signups_enabled', '1') !== '1') throw new HttpError(403, 'දැනට අලුත් accounts හදන්න බෑ');
  if (await db.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) {
    throw new HttpError(409, 'මේ email එකෙන් account එකක් දැනටමත් තියෙනවා');
  }
  const id = newId('usr_');
  const role = (await isAdminEmail(c.env, email, db)) ? 'admin' : 'user';
  await db.prepare(
    'INSERT INTO users (id, email, name, password_hash, role, plan_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, email, String(name).trim().slice(0, 100), await hashPassword(password, c.env), role, 'basic', now()).run();

  const bonus = parseFloat(await getSetting(db, 'signup_bonus_minutes', '0')) || 0;
  if (bonus > 0) await addCredits(db, id, bonus, 'signup_bonus', 'Sign up bonus');

  await createSession(c, id);
  return c.json({ ok: true }, 201);
});

app.post('/auth/login', async c => {
  const db = c.env.DB;
  const { email: rawEmail, password } = await body(c);
  const email = String(rawEmail || '').trim().toLowerCase();
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // User නැති වුණත් එකම message එක (email තියෙනවද කියලා හොයන්න බැරි වෙන්න)
  if (!user || !(await verifyPassword(String(password || ''), user.password_hash))) {
    throw new HttpError(401, 'Email එක හරි password එක හරි වැරදියි');
  }
  if (user.status !== 'active') throw new HttpError(403, 'මේ account එක block කරලා');
  await db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now(), user.id).run();
  await createSession(c, user.id);
  return c.json({ ok: true });
});

app.post('/auth/logout', async c => {
  await destroySession(c);
  return c.json({ ok: true });
});

// ---------------- Logged-in user ----------------
app.get('/me', async c => {
  const user = await loadUser(c);
  if (!user) return c.json({ user: null });
  const plan = await getPlan(c.env.DB, user.plan_id);
  return c.json({
    user: publicUser(user), plan: publicPlan(plan), balance: await getBalance(c.env.DB, user, plan),
    config: { remotionLicenseKey: c.env.REMOTION_LICENSE_KEY || 'free-license', mockMode: (await getMockMode(c.env)).mock },
  });
});

app.get('/me/history', requireUser, async c => {
  const user = c.get('user');
  const db = c.env.DB;
  const ledger = await db.prepare(
    'SELECT minutes, type, note, created_at FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 50',
  ).bind(user.id).all();
  const usage = await db.prepare(
    'SELECT id, period, seconds, minutes, from_allowance, from_credits, status, engine, description, created_at FROM usage WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(user.id).all();
  return c.json({ ledger: ledger.results, usage: usage.results });
});

app.post('/me/password', requireUser, async c => {
  const user = c.get('user');
  const { current, next } = await body(c);
  if (!(await verifyPassword(String(current || ''), user.password_hash))) throw new HttpError(400, 'දැනට තියෙන password එක වැරදියි');
  validateCredentials(user.email, next);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next, c.env), user.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id), // අනිත් devices logout
  ]);
  await createSession(c, user.id);
  return c.json({ ok: true });
});

// ---------------- Premium: user ගේ ElevenLabs API key ----------------
app.get('/me/keys', requireUser, async c => {
  const k = await c.env.DB.prepare(`SELECT provider, last4, created_at FROM user_api_keys WHERE user_id = ?`).bind(c.get('user').id).all();
  return c.json({ keys: k.results });
});

app.put('/me/keys/elevenlabs', requireUser, async c => {
  const { key } = await body(c);
  const k = String(key || '').trim();
  if (k.length < 20 || k.length > 200 || /\s/.test(k)) throw new HttpError(400, 'API key එක වැරදියි — ElevenLabs එකෙන් copy කරපු key එක (sk_...) paste කරන්න');
  const { ciphertext, iv } = await encryptSecret(c.env, k);
  await c.env.DB.prepare(
    `INSERT INTO user_api_keys (user_id, provider, ciphertext, iv, last4, created_at) VALUES (?, 'elevenlabs', ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) DO UPDATE SET ciphertext = excluded.ciphertext, iv = excluded.iv, last4 = excluded.last4, created_at = excluded.created_at`,
  ).bind(c.get('user').id, ciphertext, iv, k.slice(-4), now()).run();
  return c.json({ ok: true, last4: k.slice(-4) });
});

app.delete('/me/keys/elevenlabs', requireUser, async c => {
  await c.env.DB.prepare(`DELETE FROM user_api_keys WHERE user_id = ? AND provider = 'elevenlabs'`).bind(c.get('user').id).run();
  return c.json({ ok: true });
});

app.route('/projects', projects);

// ---------------- Admin ----------------
const admin = new Hono();
admin.use('*', requireAdmin);

admin.get('/stats', async c => {
  const db = c.env.DB;
  const users = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
  const byPlan = await db.prepare('SELECT plan_id, COUNT(*) AS n FROM users GROUP BY plan_id').all();
  const { period } = await getBalance(db, c.get('user'));
  const used = await db.prepare(
    `SELECT COALESCE(SUM(minutes), 0) AS m, COUNT(*) AS n FROM usage WHERE period = ? AND status = 'committed'`,
  ).bind(period).first();
  return c.json({
    users: users.n,
    byPlan: Object.fromEntries(byPlan.results.map(r => [r.plan_id, r.n])),
    period,
    minutesUsedThisMonth: round1(used.m),
    jobsThisMonth: used.n,
    engine: {
      elevenlabsKey: (await companyKeyInfo(c.env)).source !== 'none',
      mock: (await getMockMode(c.env)).mock,
      encryptionSecret: !!c.env.KEY_ENCRYPTION_SECRET,
      storage: !!c.env.VIDEOS,
    },
  });
});

admin.get('/users', async c => {
  const q = `%${(c.req.query('q') || '').trim().toLowerCase()}%`;
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = 25;
  const { results } = await c.env.DB.prepare(
    `SELECT u.*, COALESCE((SELECT SUM(minutes) FROM credit_ledger l WHERE l.user_id = u.id), 0) AS credits
     FROM users u WHERE lower(u.email) LIKE ? OR lower(u.name) LIKE ?
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
  ).bind(q, q, limit + 1, (page - 1) * limit).all();
  return c.json({
    users: results.slice(0, limit).map(u => ({ ...publicUser(u), credits: round1(u.credits) })),
    hasMore: results.length > limit,
    page,
  });
});

admin.get('/users/:id', async c => {
  const db = c.env.DB;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('id')).first();
  if (!user) throw new HttpError(404, 'User හම්බවුණේ නෑ');
  const ledger = await db.prepare('SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 100').bind(user.id).all();
  return c.json({ user: publicUser(user), balance: await getBalance(db, user), ledger: ledger.results });
});

admin.patch('/users/:id', async c => {
  const db = c.env.DB;
  const me = c.get('user');
  const id = c.req.param('id');
  const { plan_id, role, status } = await body(c);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!user) throw new HttpError(404, 'User හම්බවුණේ නෑ');
  if (id === me.id && (role === 'user' || status === 'blocked')) throw new HttpError(400, 'ඔයාගේම admin අවසර අයින් කරන්න බෑ');
  if (plan_id !== undefined) await getPlan(db, plan_id); // plan එක තියෙනවද check
  if (role !== undefined && !['user', 'admin'].includes(role)) throw new HttpError(400, 'Role එක වැරදියි');
  if (status !== undefined && !['active', 'blocked'].includes(status)) throw new HttpError(400, 'Status එක වැරදියි');
  const stmts = [db.prepare(
    'UPDATE users SET plan_id = COALESCE(?, plan_id), role = COALESCE(?, role), status = COALESCE(?, status) WHERE id = ?',
  ).bind(plan_id ?? null, role ?? null, status ?? null, id)];
  if (status === 'blocked') stmts.push(db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  await db.batch(stmts);
  return c.json({ ok: true });
});

admin.post('/users/:id/credits', async c => {
  const db = c.env.DB;
  const { minutes, note = '' } = await body(c);
  const m = Number(minutes);
  if (!Number.isFinite(m) || m === 0 || Math.abs(m) > 100000) throw new HttpError(400, 'විනාඩි ගණන වැරදියි');
  const user = await db.prepare('SELECT id FROM users WHERE id = ?').bind(c.req.param('id')).first();
  if (!user) throw new HttpError(404, 'User හම්බවුණේ නෑ');
  await addCredits(db, user.id, round1(m), 'admin', String(note).slice(0, 200), c.get('user').id);
  return c.json({ ok: true });
});

admin.get('/plans', async c => {
  const { results } = await c.env.DB.prepare('SELECT * FROM plans ORDER BY sort_order').all();
  return c.json({ plans: results.map(publicPlan) });
});

const PLAN_FIELDS = {
  name: v => String(v).trim().slice(0, 50) || null,
  description: v => String(v).slice(0, 200),
  engine: v => (['elevenlabs', 'elevenlabs_byok'].includes(v) ? v : null),
  monthly_minutes: v => (Number(v) >= 0 ? Number(v) : null),
  unlimited: v => (v ? 1 : 0),
  max_video_seconds: v => (Number(v) > 0 ? Math.round(Number(v)) : null),
  export_quality: v => (['720p', '1080p', '4k'].includes(v) ? v : null),
  watermark: v => (v ? 1 : 0),
  max_projects: v => (Number(v) >= 0 ? Math.round(Number(v)) : null),
  render_mode: v => (['browser', 'server'].includes(v) ? v : null),
  price_lkr: v => (Number(v) >= 0 ? Math.round(Number(v)) : null),
  active: v => (v ? 1 : 0),
};

admin.put('/plans/:id', async c => {
  const db = c.env.DB;
  await getPlan(db, c.req.param('id'));
  const input = await body(c);
  const sets = [], vals = [];
  for (const [k, clean] of Object.entries(PLAN_FIELDS)) {
    if (input[k] === undefined) continue;
    const v = clean(input[k]);
    if (v === null) throw new HttpError(400, `"${k}" අගය වැරදියි`);
    sets.push(`${k} = ?`); vals.push(v);
  }
  if (!sets.length) throw new HttpError(400, 'වෙනස් කරන්න දෙයක් නෑ');
  await db.prepare(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`).bind(...vals, c.req.param('id')).run();
  return c.json({ ok: true });
});

const SETTINGS = {
  signup_bonus_minutes: v => (Number(v) >= 0 && Number(v) <= 1000 ? String(Number(v)) : null),
  signups_enabled: v => (v === true || v === '1' || v === 1 ? '1' : v === false || v === '0' || v === 0 ? '0' : null),
};

admin.get('/settings', async c => {
  const { results } = await c.env.DB.prepare('SELECT key, value FROM settings').all();
  return c.json({ settings: Object.fromEntries(results.filter(r => !PRIVATE_SETTINGS.includes(r.key)).map(r => [r.key, r.value])) });
});
const PRIVATE_SETTINGS = ['elevenlabs_key', 'mock_mode'];

// ---- ElevenLabs company key + Test mode ----
admin.get('/elevenlabs', async c => {
  const [key, mode] = await Promise.all([companyKeyInfo(c.env), getMockMode(c.env)]);
  return c.json({ key, mock: mode.mock, mockSource: mode.source });
});
admin.put('/elevenlabs/key', async c => {
  const key = cleanKey((await body(c)).key);
  const test = await testElevenLabsKey(key);
  if (!test.ok) throw new HttpError(400, `Key එක save කළේ නෑ: ${test.message}`);
  await saveCompanyKey(c.env, key);
  return c.json({ ok: true, test, key: await companyKeyInfo(c.env) });
});
admin.delete('/elevenlabs/key', async c => {
  await deleteCompanyKey(c.env);
  return c.json({ ok: true, key: await companyKeyInfo(c.env) });
});
admin.post('/elevenlabs/test', async c => {
  const { key } = await getCompanyKey(c.env);
  return c.json(await testElevenLabsKey(key));
});
admin.put('/elevenlabs/mock', async c => {
  const { mock } = await body(c);
  if (typeof mock !== 'boolean') throw new HttpError(400, 'mock: true / false');
  await setMockMode(c.env, mock);
  return c.json({ ok: true, ...(await getMockMode(c.env)) });
});

admin.put('/settings', async c => {
  const input = await body(c);
  const stmts = [];
  for (const [k, clean] of Object.entries(SETTINGS)) {
    if (input[k] === undefined) continue;
    const v = clean(input[k]);
    if (v === null) throw new HttpError(400, `"${k}" අගය වැරදියි`);
    stmts.push(c.env.DB.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

app.route('/admin', admin);

export default app;
