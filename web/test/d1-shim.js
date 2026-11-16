// Tests වලට: Cloudflare D1 API එක Node එකේ SQLite එකෙන් අනුකරණය කරනවා
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export function createTestDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = path.join(import.meta.dirname, '..', 'migrations');
  for (const f of fs.readdirSync(dir).sort()) sqlite.exec(fs.readFileSync(path.join(dir, f), 'utf8'));
  const prepare = sql => {
    let args = [];
    const s = {
      bind: (...a) => { args = a; return s; },
      first: async () => sqlite.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
      run: async () => { sqlite.prepare(sql).run(...args); return { success: true }; },
      _run: () => sqlite.prepare(sql).run(...args),
    };
    return s;
  };
  return {
    prepare,
    batch: async stmts => {
      sqlite.exec('BEGIN');
      try { stmts.forEach(s => s._run()); sqlite.exec('COMMIT'); } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
      return stmts.map(() => ({ success: true }));
    },
    raw: sqlite,
  };
}
