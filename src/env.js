// .env file එක auto update කරනවා: .env.example එකේ තියෙන, .env එකේ නැති settings එකතු කරනවා.
// දැනට තියෙන keys/values කිසිවක් වෙනස් කරන්නේ නෑ, මකන්නේත් නෑ.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function ensureEnv() {
  const examplePath = path.join(ROOT, '.env.example');
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(examplePath)) return;
  const example = fs.readFileSync(examplePath, 'utf8');

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, example, 'utf8');
    console.log('ℹ️  .env file එක හැදුවා — `notepad .env` එකෙන් open කරලා API keys දාන්න.\n');
    return;
  }

  const env = fs.readFileSync(envPath, 'utf8');
  const have = new Set([...env.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map(m => m[1]));

  // Example එක කොටස් විදිහට කියවනවා: comments + KEY= line එක
  const lines = example.split(/\r?\n/);
  const add = [];
  let comments = [];
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m) {
      if (!have.has(m[1])) add.push(...comments, line);
      comments = [];
    } else if (line.trim().startsWith('#')) {
      comments.push(line);
    } else {
      comments = [];
    }
  }
  if (!add.length) return;

  const keys = add.filter(l => !l.trim().startsWith('#')).map(l => l.split('=')[0].trim());
  const sep = env.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(envPath, `${env}${sep}\n# ---- අලුතින් auto එකතු වුණු settings ----\n${add.join('\n')}\n`, 'utf8');
  console.log(`ℹ️  .env එකට අලුත් settings එකතු කළා: ${keys.join(', ')}`);
  console.log('   ඒවාට keys දාන්න ඕනේ නම්: notepad .env\n');
}
