// Video projects: upload (R2 multipart), video stream, subtitles generate, save
import { Hono } from 'hono';
import { requireUser } from './auth.js';
import { commitUsage, getPlan, refundUsage, reserveMinutes } from './credits.js';
import { getEngine } from './engines/index.js';
import { decryptSecret } from './secrets.js';
import { HttpError, newId, now, round1 } from './util.js';
import { parseWav } from './wav.js';

export const PART_SIZE = 10 * 1024 * 1024; // 10MB කෑලි
const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const MAX_CHUNK_SECONDS = 600; // Audio කෑල්ලක් උපරිම විනාඩි 10
const MAX_WORDS = 30000;

const p = new Hono();
p.use('*', requireUser);

const json = async c => { try { return await c.req.json(); } catch { throw new HttpError(400, 'JSON එක වැරදියි'); } };

async function ownProject(c) {
  const row = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id).first();
  if (!row) throw new HttpError(404, 'Project එක හම්බවුණේ නෑ');
  return row;
}

const publicProject = r => ({
  id: r.id, title: r.title, content_type: r.content_type, size_bytes: r.size_bytes, duration: r.duration,
  width: r.width, height: r.height, status: r.status, created_at: r.created_at, updated_at: r.updated_at,
});

// ---------------- List / get / delete ----------------
p.get('/', async c => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.*, (SELECT COUNT(*) FROM transcripts t WHERE t.project_id = p.id) AS has_subs
     FROM projects p WHERE user_id = ? AND status != 'uploading' ORDER BY created_at DESC LIMIT 200`,
  ).bind(c.get('user').id).all();
  return c.json({ projects: results.map(r => ({ ...publicProject(r), has_subtitles: !!r.has_subs })) });
});

p.get('/:id', async c => {
  const proj = await ownProject(c);
  const t = await c.env.DB.prepare('SELECT * FROM transcripts WHERE project_id = ?').bind(proj.id).first();
  let editor = null;
  try { editor = proj.editor_json ? JSON.parse(proj.editor_json) : null; } catch { editor = null; }
  return c.json({
    project: publicProject(proj),
    transcript: t ? { language: t.language, engine: t.engine, words: JSON.parse(t.words_json), text: t.text, updated_at: t.updated_at } : null,
    editor,
  });
});

p.delete('/:id', async c => {
  const proj = await ownProject(c);
  if (proj.upload_id) {
    try { await c.env.VIDEOS.resumeMultipartUpload(proj.video_key, proj.upload_id).abort(); } catch { /* ignore */ }
  }
  await c.env.VIDEOS.delete(proj.video_key);
  await c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(proj.id).run();
  return c.json({ ok: true });
});

p.patch('/:id', async c => {
  const proj = await ownProject(c);
  const { title } = await json(c);
  if (typeof title !== 'string' || !title.trim()) throw new HttpError(400, 'නම හිස්');
  await c.env.DB.prepare('UPDATE projects SET title = ?, updated_at = ? WHERE id = ?').bind(title.trim().slice(0, 150), now(), proj.id).run();
  return c.json({ ok: true });
});

// ---------------- Upload (R2 multipart) ----------------
p.post('/', async c => {
  const db = c.env.DB;
  const user = c.get('user');
  const plan = await getPlan(db, user.plan_id);
  const { title = '', filename = '', size, duration, width = 0, height = 0, contentType = 'video/mp4' } = await json(c);

  if (!(size > 0) || size > MAX_FILE_BYTES) throw new HttpError(400, 'File එකේ size එක වැරදියි (උපරිම 2GB)');
  if (!(duration > 0)) throw new HttpError(400, 'Video එකේ දිග කියවන්න බැරි වුණා');
  if (!/^(video|audio)\//.test(contentType)) throw new HttpError(400, 'Video file එකක් නෙවෙයි');
  if (duration > plan.max_video_seconds) {
    throw new HttpError(403, `${plan.name} plan එකේ උපරිම video දිග විනාඩි ${round1(plan.max_video_seconds / 60)}යි`);
  }
  const { n } = await db.prepare(`SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND status != 'uploading'`).bind(user.id).first();
  if (n >= plan.max_projects) throw new HttpError(403, `${plan.name} plan එකේ උපරිම projects ${plan.max_projects}යි — පරණ ඒවා delete කරන්න`);

  // අතරමග නැවතුණු පරණ uploads අස් කරනවා
  await db.prepare(`DELETE FROM projects WHERE user_id = ? AND status = 'uploading' AND created_at < ?`).bind(user.id, now() - 86400_000).run();

  const id = newId('prj_');
  const ext = (String(filename).match(/\.([a-z0-9]{2,5})$/i)?.[1] || 'mp4').toLowerCase();
  const key = `videos/${user.id}/${id}.${ext}`;
  const upload = await c.env.VIDEOS.createMultipartUpload(key, { httpMetadata: { contentType } });
  const t = now();
  const name = String(title || filename).replace(/\.[a-z0-9]{2,5}$/i, '').trim().slice(0, 150) || 'Video';
  await db.prepare(
    `INSERT INTO projects (id, user_id, title, video_key, upload_id, content_type, size_bytes, duration, width, height, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', ?, ?)`,
  ).bind(id, user.id, name, key, upload.uploadId, contentType, Math.round(size), duration, Math.round(width) || 0, Math.round(height) || 0, t, t).run();
  return c.json({ project: { id }, uploadId: upload.uploadId, partSize: PART_SIZE }, 201);
});

p.put('/:id/parts/:n', async c => {
  const proj = await ownProject(c);
  if (proj.status !== 'uploading' || !proj.upload_id) throw new HttpError(400, 'Upload එක දැනටමත් ඉවරයි');
  const n = parseInt(c.req.param('n'), 10);
  if (!(n >= 1 && n <= 10000)) throw new HttpError(400, 'Part number එක වැරදියි');
  const body = await c.req.arrayBuffer();
  if (!body.byteLength || body.byteLength > PART_SIZE) throw new HttpError(400, 'Part size එක වැරදියි');
  const part = await c.env.VIDEOS.resumeMultipartUpload(proj.video_key, proj.upload_id).uploadPart(n, body);
  return c.json({ partNumber: part.partNumber, etag: part.etag });
});

p.post('/:id/complete', async c => {
  const proj = await ownProject(c);
  if (proj.status !== 'uploading' || !proj.upload_id) throw new HttpError(400, 'Upload එක දැනටමත් ඉවරයි');
  const { parts } = await json(c);
  if (!Array.isArray(parts) || !parts.length) throw new HttpError(400, 'Parts නෑ');
  const clean = parts.map(x => ({ partNumber: +x.partNumber, etag: String(x.etag) })).sort((a, b) => a.partNumber - b.partNumber);
  const obj = await c.env.VIDEOS.resumeMultipartUpload(proj.video_key, proj.upload_id).complete(clean);
  await c.env.DB.prepare(`UPDATE projects SET status = 'uploaded', upload_id = NULL, size_bytes = ?, updated_at = ? WHERE id = ?`)
    .bind(obj.size, now(), proj.id).run();
  return c.json({ ok: true });
});

// ---------------- Video stream (seek කරන්න Range support) ----------------
p.get('/:id/video', async c => {
  const proj = await ownProject(c);
  if (proj.status === 'uploading') throw new HttpError(404, 'Upload එක තාම ඉවර නෑ');
  const range = c.req.header('range');
  let opts = {};
  const m = range && range.match(/bytes=(\d*)-(\d*)/);
  if (m && (m[1] || m[2])) {
    opts = m[1] ? { range: { offset: +m[1], ...(m[2] ? { length: +m[2] - +m[1] + 1 } : {}) } } : { range: { suffix: +m[2] } };
  }
  const obj = await c.env.VIDEOS.get(proj.video_key, opts);
  if (!obj) throw new HttpError(404, 'Video file එක හම්බවුණේ නෑ');
  const headers = new Headers({
    'Content-Type': proj.content_type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', ETag: obj.httpEtag,
  });
  if (opts.range && obj.range) {
    const start = obj.range.offset ?? (obj.size - obj.range.suffix);
    const len = obj.range.length ?? (obj.size - start);
    headers.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    headers.set('Content-Length', String(len));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { headers });
});

// ---------------- Subtitles generate (audio කෑල්ලෙන් කෑල්ල) ----------------
// Browser එක audio එක 16kHz WAV කෑලි (≤ විනාඩි 10) කරලා එකින් එක එවනවා.
// හැම කෑල්ලකටම: විනාඩි reserve → engine → සාර්ථක නම් commit, fail නම් refund
p.post('/:id/transcribe-chunk', async c => {
  const db = c.env.DB;
  const user = c.get('user');
  const proj = await ownProject(c);
  if (proj.status === 'uploading') throw new HttpError(400, 'Video upload එක තාම ඉවර නෑ');
  const language = ['si', 'en', 'auto'].includes(c.req.query('lang')) ? c.req.query('lang') : 'si';
  const offset = Math.max(0, parseFloat(c.req.query('offset') || '0') || 0);
  const index = parseInt(c.req.query('index') || '0', 10) || 0;

  const audio = await c.req.arrayBuffer();
  const { seconds } = parseWav(audio);
  if (seconds > MAX_CHUNK_SECONDS + 1) throw new HttpError(400, 'Audio කෑල්ල දිග වැඩියි');
  if (offset + seconds > proj.duration + 5) throw new HttpError(400, 'Audio එක video එකට වඩා දිගයි');

  const plan = await getPlan(db, user.plan_id);
  const engine = getEngine(c.env, plan.engine);
  let apiKey;
  if (engine.byok) {
    const k = await db.prepare(`SELECT * FROM user_api_keys WHERE user_id = ? AND provider = 'elevenlabs'`).bind(user.id).first();
    if (!k) throw new HttpError(400, 'Premium plan එකට ඔයාගේ ElevenLabs API key එක Settings වල දාන්න');
    apiKey = await decryptSecret(c.env, k.ciphertext, k.iv);
  }

  const { usageId, minutes } = await reserveMinutes(db, user, seconds, {
    engine: plan.engine, description: `${proj.title}${index ? ` (කොටස ${index + 1})` : ''}`,
  });
  let res;
  try {
    res = await engine.impl.transcribe(c.env, { audio, language, apiKey });
  } catch (e) {
    await refundUsage(db, usageId);
    throw e;
  }
  await commitUsage(db, usageId);
  const words = res.words.map(w => ({ text: w.text, start: +(w.start + offset).toFixed(3), end: +(w.end + offset).toFixed(3) }));
  return c.json({ words, text: res.text, model: res.model, minutes });
});

// ---------------- Editor save (lines + style) — auto save ----------------
const MAX_EDITOR_BYTES = 1_500_000;
p.put('/:id/editor', async c => {
  const proj = await ownProject(c);
  const raw = await c.req.text();
  if (raw.length > MAX_EDITOR_BYTES) throw new HttpError(413, 'Editor data එක ලොකු වැඩියි');
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'JSON එක වැරදියි'); }
  const doc = body?.doc;
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.lines) || typeof doc.style !== 'object') throw new HttpError(400, 'Editor data වැරදියි');
  if (doc.lines.length > 10000) throw new HttpError(400, 'Lines වැඩියි');
  for (const l of doc.lines) {
    if (!Array.isArray(l.words)) throw new HttpError(400, 'Line එකක් වැරදියි');
    for (const w of l.words) {
      if (typeof w.text !== 'string' || !Number.isFinite(w.start) || !Number.isFinite(w.end)) throw new HttpError(400, 'වචනයක් වැරදියි');
    }
  }
  await c.env.DB.prepare('UPDATE projects SET editor_json = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(doc), now(), proj.id).run();
  return c.json({ ok: true, saved_at: now() });
});

// ---------------- Subtitles save (generate කළාට පස්සේ / editor එකෙන්) ----------------
p.put('/:id/transcript', async c => {
  const proj = await ownProject(c);
  const { language = 'si', engine = '', words } = await json(c);
  if (!Array.isArray(words) || words.length > MAX_WORDS) throw new HttpError(400, 'Words list එක වැරදියි');
  const clean = words.map(w => {
    const text = String(w.text ?? '').slice(0, 100);
    const start = Number(w.start), end = Number(w.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) throw new HttpError(400, 'වචනයක timing එක වැරදියි');
    return { text, start: +start.toFixed(3), end: +end.toFixed(3) };
  });
  const text = clean.map(w => w.text).join(' ');
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO transcripts (project_id, language, engine, words_json, text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET language = excluded.language, engine = excluded.engine, words_json = excluded.words_json, text = excluded.text, updated_at = excluded.updated_at`,
    ).bind(proj.id, String(language).slice(0, 10), String(engine).slice(0, 40), JSON.stringify(clean), text, t, t),
    c.env.DB.prepare(`UPDATE projects SET status = 'ready', updated_at = ? WHERE id = ?`).bind(t, proj.id),
  ]);
  return c.json({ ok: true });
});

export default p;
