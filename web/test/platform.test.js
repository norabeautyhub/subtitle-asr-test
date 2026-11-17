import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from './d1-shim.js';
import {
  getMockMode, setMockMode, getCompanyKey, saveCompanyKey, deleteCompanyKey, companyKeyInfo, testElevenLabsKey, cleanKey,
} from '../worker/platform.js';

const env = (extra = {}) => ({ DB: createTestDb(), KEY_ENCRYPTION_SECRET: 'x'.repeat(40), ...extra });

test('Test mode: admin setting එක .dev.vars එකට උඩින්', async () => {
  const e = env({ ELEVENLABS_MOCK: '1' });
  assert.deepEqual(await getMockMode(e), { mock: true, source: 'env' });
  await setMockMode(e, false);
  assert.deepEqual(await getMockMode(e), { mock: false, source: 'admin' });
  await setMockMode(e, true);
  assert.equal((await getMockMode(e)).mock, true);
  await setMockMode(e, null);
  assert.equal((await getMockMode(e)).source, 'env');
});

test('Company key: admin key → env key → නෑ', async () => {
  const e = env();
  assert.equal((await getCompanyKey(e)).source, 'none');
  e.ELEVENLABS_API_KEY = 'sk_env_key_1234567890abcd';
  assert.equal((await getCompanyKey(e)).key, 'sk_env_key_1234567890abcd');
  await saveCompanyKey(e, 'sk_admin_key_abcdefghijkl9876');
  const k = await getCompanyKey(e);
  assert.equal(k.key, 'sk_admin_key_abcdefghijkl9876');
  assert.equal(k.source, 'admin');
  const info = await companyKeyInfo(e);
  assert.equal(info.last4, '9876');
  assert.ok(!JSON.stringify(info).includes('sk_admin'), 'info එකේ key එක නෑ');
  const raw = await e.DB.prepare(`SELECT value FROM settings WHERE key='elevenlabs_key'`).first();
  assert.ok(!raw.value.includes('sk_admin'), 'database එකේ encrypt වෙලා');
  await deleteCompanyKey(e);
  assert.equal((await getCompanyKey(e)).source, 'env');
});

test('Key test (ElevenLabs fake)', async () => {
  const res = (status, body) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  assert.equal((await testElevenLabsKey('k', res(200, { tier: 'creator' }))).ok, true);
  assert.equal((await testElevenLabsKey('k', res(401, { detail: { status: 'missing_permissions' } }))).ok, true);
  assert.equal((await testElevenLabsKey('k', res(401, { detail: { status: 'invalid_api_key' } }))).ok, false);
  assert.equal((await testElevenLabsKey('k', async () => { throw new Error('net'); })).ok, false);
  assert.equal((await testElevenLabsKey('')).ok, false);
  assert.throws(() => cleanKey('short'));
  assert.equal(cleanKey('  sk_abcdefghijklmnopqrstuvwxyz  '), 'sk_abcdefghijklmnopqrstuvwxyz');
});
