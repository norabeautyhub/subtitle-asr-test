// Premium users ලගේ API keys AES-GCM වලින් encrypt කරනවා.
// Encryption key එක: Cloudflare secret `KEY_ENCRYPTION_SECRET` (database එකේ නෑ).
import { HttpError } from './util.js';

const enc = new TextEncoder();
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function aesKey(env) {
  const secret = env.KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) throw new HttpError(500, 'KEY_ENCRYPTION_SECRET set කරලා නෑ (server setup)');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(env, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(env), enc.encode(plain));
  return { ciphertext: b64(ct), iv: b64(iv) };
}

export async function decryptSecret(env, ciphertext, iv) {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, await aesKey(env), unb64(ciphertext));
    return new TextDecoder().decode(pt);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(500, 'Save කරපු API key එක කියවන්න බැරි වුණා — ආයේ save කරන්න');
  }
}
