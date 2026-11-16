// Login / sessions. Passwords PBKDF2-SHA256 (100,000 rounds) වලින් hash කරනවා.
// Session token එක cookie එකේ විතරයි; database එකේ තියෙන්නේ ඒකේ SHA-256 hash එක.
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HttpError, newId, now } from './util.js';

// Cloudflare Workers වල PBKDF2 උපරිමය 100,000. wrangler.jsonc එකේ PASSWORD_ITERATIONS එකෙන් වෙනස් කරන්න පුළුවන්.
const DEFAULT_ITERATIONS = 100_000;
const SESSION_DAYS = 30;
const COOKIE = 'sid';

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password, env = {}) {
  const n = parseInt(env.PASSWORD_ITERATIONS, 10);
  const iterations = n >= 10_000 && n <= 100_000 ? n : DEFAULT_ITERATIONS;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  // Iterations ගණන hash එකේම save වෙන නිසා පස්සේ වෙනස් කළත් පරණ passwords වැඩ කරනවා
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [alg, iter, salt, hash] = String(stored).split('$');
  if (alg !== 'pbkdf2') return false;
  const got = new Uint8Array(await pbkdf2(password, unb64(salt), +iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]; // constant-time compare
  return diff === 0;
}

async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

export async function createSession(c, userId) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const expires = now() + SESSION_DAYS * 86400_000;
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, now(), expires, (c.req.header('user-agent') || '').slice(0, 200)).run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession(c) {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  deleteCookie(c, COOKIE, { path: '/' });
}

/** Cookie එකෙන් user ව හොයනවා. නැත්නම් null. */
export async function loadUser(c) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`,
  ).bind(await sha256(token), now()).first();
  if (!row || row.status !== 'active') return null;
  return row;
}

// ---------------- Middleware ----------------

export const requireUser = async (c, next) => {
  const user = await loadUser(c);
  if (!user) throw new HttpError(401, 'Login වෙන්න ඕනේ');
  c.set('user', user);
  await next();
};

export const requireAdmin = async (c, next) => {
  const user = await loadUser(c);
  if (!user) throw new HttpError(401, 'Login වෙන්න ඕනේ');
  if (user.role !== 'admin') throw new HttpError(403, 'Admin අවසර නෑ');
  c.set('user', user);
  await next();
};

// ---------------- Register / login ----------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email, password) {
  email = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) throw new HttpError(400, 'Email එක වැරදියි');
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Password එකට අවම අකුරු 8ක් ඕනේ');
  if (password.length > 200) throw new HttpError(400, 'Password එක දිග වැඩියි');
  return email;
}

export async function isAdminEmail(env, email, db) {
  const list = String(env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  // ADMIN_EMAILS දාලා තියෙනවා නම් ඒ emails විතරයි admin වෙන්නේ (ආරක්ෂිතම ක්‍රමය)
  if (list.length) return list.includes(email);
  // ADMIN_EMAILS හිස් නම් විතරක්: පළවෙනි user එක auto admin (local testing ලේසි කරන්න)
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM users').first();
  return n === 0;
}

export { newId };
