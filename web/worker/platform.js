// Company ElevenLabs key එක + Test (mock) mode — Admin panel එකෙන් වෙනස් කරන්න පුළුවන්.
// පිළිවෙළ: Admin panel එකේ දාපු එක → නැත්නම් .dev.vars / Cloudflare secret (ELEVENLABS_API_KEY, ELEVENLABS_MOCK)
import { decryptSecret, encryptSecret } from './secrets.js';
import { HttpError } from './util.js';

const KEY = 'elevenlabs_key';
const MOCK = 'mock_mode';

async function getSetting(db, k) {
  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(k).first();
  return r ? r.value : null;
}
async function setSetting(db, k, v) {
  if (v === null) return db.prepare('DELETE FROM settings WHERE key = ?').bind(k).run();
  return db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(k, v).run();
}

/** Test mode on ද? Admin panel එකේ තෝරලා නම් ඒක, නැත්නම් ELEVENLABS_MOCK */
export async function getMockMode(env) {
  const v = await getSetting(env.DB, MOCK);
  if (v === '1' || v === '0') return { mock: v === '1', source: 'admin' };
  return { mock: env.ELEVENLABS_MOCK === '1', source: 'env' };
}
export const setMockMode = (env, on) => setSetting(env.DB, MOCK, on === null ? null : on ? '1' : '0');

/** Basic / Standard plans වලට පාවිච්චි වෙන company key එක */
export async function getCompanyKey(env) {
  const raw = await getSetting(env.DB, KEY);
  if (raw) {
    const k = JSON.parse(raw);
    return { key: await decryptSecret(env, k.ciphertext, k.iv), source: 'admin', last4: k.last4 };
  }
  if (env.ELEVENLABS_API_KEY) return { key: env.ELEVENLABS_API_KEY, source: 'env', last4: env.ELEVENLABS_API_KEY.slice(-4) };
  return { key: null, source: 'none', last4: null };
}

export async function companyKeyInfo(env) {
  const raw = await getSetting(env.DB, KEY);
  if (raw) {
    const k = JSON.parse(raw);
    return { source: 'admin', last4: k.last4, savedAt: k.savedAt || null };
  }
  return env.ELEVENLABS_API_KEY ? { source: 'env', last4: env.ELEVENLABS_API_KEY.slice(-4) } : { source: 'none', last4: null };
}

export async function saveCompanyKey(env, key) {
  const enc = await encryptSecret(env, key);
  await setSetting(env.DB, KEY, JSON.stringify({ ...enc, last4: key.slice(-4), savedAt: Date.now() }));
}
export const deleteCompanyKey = env => setSetting(env.DB, KEY, null);

/** Key එක ElevenLabs එකේ වැඩද? (credits වැය වෙන්නේ නෑ) */
export async function testElevenLabsKey(key, fetchImpl = fetch) {
  if (!key) return { ok: false, message: 'Key එකක් නෑ' };
  let r;
  try {
    r = await fetchImpl('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
  } catch {
    return { ok: false, message: 'ElevenLabs එකට connect වෙන්න බැරි වුණා (internet?)' };
  }
  if (r.ok) {
    const d = await r.json().catch(() => ({}));
    return { ok: true, message: `✓ Key එක වැඩ. Plan: ${d.tier || '?'}`, tier: d.tier || null };
  }
  const body = await r.text().catch(() => '');
  // Speech-to-Text විතරක් දීපු (restricted) keys වලට subscription බලන්න අවසර නෑ — ඒත් key එක හරි
  if (r.status === 401 && /missing_permissions/i.test(body)) {
    return { ok: true, message: '✓ Key එක හරි (restricted key — Speech to Text permission එක තියෙනවා නම් වැඩ)' };
  }
  if (r.status === 401) return { ok: false, message: 'Key එක වැරදියි' };
  return { ok: false, message: `ElevenLabs error (HTTP ${r.status})` };
}

export function cleanKey(k) {
  k = String(k || '').trim();
  if (k.length < 20 || k.length > 200 || /\s/.test(k)) throw new HttpError(400, 'API key එක වැරදියි — ElevenLabs එකෙන් copy කරපු key එකම paste කරන්න');
  return k;
}
