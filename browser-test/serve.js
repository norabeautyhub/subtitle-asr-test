#!/usr/bin/env node
// Browser test page එක open කරන්න පොඩි local server එකක් (dependencies නෑ).
// WebGPU වැඩ කරන්න page එක http://localhost එකෙන් open වෙන්න ඕනේ.
//
// පාවිච්චිය:  npm run browser-test   (නැත්නම්: node browser-test/serve.js)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 5173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.srt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') { res.writeHead(302, { Location: '/browser-test/' }); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.resolve(ROOT, '.' + p);
  // Project folder එකෙන් පිටත files දෙන්නේ නෑ, .env එකත් දෙන්නේ නෑ
  if (!file.startsWith(ROOT + path.sep) || path.basename(file).startsWith('.env')) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/browser-test/`;
  console.log(`\n✔ Browser test page එක run වෙනවා: ${url}`);
  console.log('  (නවත්වන්න: Ctrl + C)\n');
  const opener = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  if (!process.env.NO_OPEN) exec(opener, () => {});
});
