import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav, splitAtSilence, RATE } from '../src/lib/audio.js';
import { parseWav } from '../worker/wav.js';
import { groupLines, toSrt } from '../src/lib/subtitles.js';
import { encryptSecret, decryptSecret } from '../worker/secrets.js';
import { transcribe as mockTranscribe } from '../worker/engines/mock.js';

test('encodeWav → parseWav round trip (server ගණනය කරන දිග)', () => {
  const samples = new Float32Array(RATE * 12.5).fill(0.1);
  const { seconds } = parseWav(encodeWav(samples));
  assert.equal(seconds, 12.5);
});

test('parseWav rejects wrong formats', () => {
  assert.throws(() => parseWav(new ArrayBuffer(10)), e => e.status === 400);
  const wav = encodeWav(new Float32Array(100));
  new DataView(wav).setUint32(24, 44100, true); // wrong sample rate
  assert.throws(() => parseWav(wav), e => e.status === 400);
});

test('splitAtSilence cuts at the quietest point, chunks cover everything', () => {
  const sec = 700;
  const s = new Float32Array(RATE * sec);
  for (let i = 0; i < s.length; i++) s[i] = Math.sin(i / 7) * 0.5; // "speech"
  const quiet = 285; // seconds — silence here
  s.fill(0, quiet * RATE, (quiet + 0.4) * RATE);
  const chunks = splitAtSilence(s, 300, 30);
  assert.ok(Math.abs(chunks[1].start - (quiet + 0.2)) < 0.15, `cut near silence, got ${chunks[1].start}`);
  assert.equal(chunks.reduce((a, c) => a + c.samples.length, 0), s.length);
  assert.ok(chunks.every(c => c.samples.length <= 300 * RATE));
  assert.equal(splitAtSilence(new Float32Array(RATE * 10)).length, 1);
});

test('SRT export', () => {
  const words = [{ text: 'ආයුබෝවන්', start: 0.5, end: 1 }, { text: 'ලංකාව', start: 1.1, end: 1.6 }, { text: 'පසුව', start: 5, end: 5.5 }];
  assert.equal(groupLines(words).length, 2, 'gap > 0.6s → new line');
  assert.match(toSrt(words), /^1\n00:00:00,500 --> 00:00:01,600\nආයුබෝවන් ලංකාව\n/);
});

test('API key encryption', async () => {
  const env = { KEY_ENCRYPTION_SECRET: 'a-very-long-test-secret-123456' };
  const { ciphertext, iv } = await encryptSecret(env, 'sk_secret_key_123');
  assert.ok(!ciphertext.includes('sk_'));
  assert.equal(await decryptSecret(env, ciphertext, iv), 'sk_secret_key_123');
  await assert.rejects(decryptSecret({ KEY_ENCRYPTION_SECRET: 'another-secret-xxxxxxxxxx' }, ciphertext, iv), e => e.status === 500);
  await assert.rejects(encryptSecret({}, 'x'), e => e.status === 500, 'missing secret');
});

test('mock engine returns timed words within audio length', async () => {
  const r = await mockTranscribe({}, { audio: encodeWav(new Float32Array(RATE * 5)), language: 'si' });
  assert.ok(r.words.length > 5 && r.words.at(-1).end <= 5);
});
