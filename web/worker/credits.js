// Minutes credit system
//   ලැබිය හැකි විනාඩි = (plan එකේ මේ මාසේ ඉතුරු විනාඩි) + (credits ශේෂය)
//   Video එකක් process කරනකොට: reserve → (සාර්ථක නම්) commit / (fail නම්) refund
//   මාසික විනාඩි මුලින්ම පාවිච්චි වෙනවා, ඊට පස්සේ credits.
import { HttpError, currentPeriod, newId, now, round1, secondsToMinutes } from './util.js';

export async function getPlan(db, planId) {
  const plan = await db.prepare('SELECT * FROM plans WHERE id = ?').bind(planId).first();
  if (!plan) throw new HttpError(500, `Plan "${planId}" හම්බවුණේ නෑ`);
  return plan;
}

export async function getSetting(db, key, fallback = null) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
  return row ? row.value : fallback;
}

export async function getBalance(db, user, plan = null) {
  plan ||= await getPlan(db, user.plan_id);
  const period = currentPeriod();
  const used = await db.prepare(
    `SELECT COALESCE(SUM(from_allowance), 0) AS m FROM usage
     WHERE user_id = ? AND period = ? AND status IN ('reserved', 'committed')`,
  ).bind(user.id, period).first();
  const credits = await db.prepare('SELECT COALESCE(SUM(minutes), 0) AS m FROM credit_ledger WHERE user_id = ?')
    .bind(user.id).first();
  const allowanceUsed = round1(used.m);
  const allowanceLeft = round1(Math.max(0, plan.monthly_minutes - used.m));
  const creditMinutes = round1(credits.m);
  return {
    period,
    unlimited: !!plan.unlimited,
    monthlyMinutes: plan.monthly_minutes,
    allowanceUsed,
    allowanceLeft,
    credits: creditMinutes,
    available: plan.unlimited ? null : round1(allowanceLeft + Math.max(0, creditMinutes)),
  };
}

export async function addCredits(db, userId, minutes, type, note = '', createdBy = null, ref = null) {
  await db.prepare(
    'INSERT INTO credit_ledger (user_id, minutes, type, note, ref, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(userId, minutes, type, note, ref, createdBy, now()).run();
}

/**
 * Video එකක් process කරන්න කලින් විනාඩි reserve කරනවා.
 * විනාඩි මදි නම් හරි video එක plan එකට දිග වැඩි නම් HttpError එකක් throw කරනවා.
 * @returns {Promise<{usageId: string, minutes: number}>}
 */
export async function reserveMinutes(db, user, seconds, { engine = '', description = '' } = {}) {
  if (!(seconds > 0)) throw new HttpError(400, 'Video එකේ දිග වැරදියි');
  const plan = await getPlan(db, user.plan_id);
  if (seconds > plan.max_video_seconds) {
    throw new HttpError(403, `${plan.name} plan එකේ උපරිම video දිග විනාඩි ${round1(plan.max_video_seconds / 60)}යි`);
  }
  const minutes = secondsToMinutes(seconds);
  const id = newId('u_');
  const t = now();
  let fromAllowance = 0, fromCredits = 0;

  if (!plan.unlimited) {
    const bal = await getBalance(db, user, plan);
    if (bal.available < minutes) {
      throw new HttpError(402, `විනාඩි මදි: මේ video එකට විනාඩි ${minutes}ක් ඕනේ, ඔයාට තියෙන්නේ ${bal.available}යි`);
    }
    fromAllowance = round1(Math.min(minutes, bal.allowanceLeft));
    fromCredits = round1(minutes - fromAllowance);
  }

  const stmts = [
    db.prepare(
      `INSERT INTO usage (id, user_id, period, seconds, minutes, from_allowance, from_credits, status, engine, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'reserved', ?, ?, ?, ?)`,
    ).bind(id, user.id, currentPeriod(t), seconds, minutes, fromAllowance, fromCredits, engine, description.slice(0, 200), t, t),
  ];
  if (fromCredits > 0) {
    stmts.push(db.prepare(
      `INSERT INTO credit_ledger (user_id, minutes, type, note, ref, created_at) VALUES (?, ?, 'usage', ?, ?, ?)`,
    ).bind(user.id, -fromCredits, description.slice(0, 200), id, t));
  }
  await db.batch(stmts); // දෙකම එකට (transaction)
  return { usageId: id, minutes };
}

export async function commitUsage(db, usageId) {
  await db.prepare(`UPDATE usage SET status = 'committed', updated_at = ? WHERE id = ? AND status = 'reserved'`)
    .bind(now(), usageId).run();
}

/** Process එක fail වුණොත් reserve කරපු විනාඩි ආපහු දෙනවා */
export async function refundUsage(db, usageId) {
  const u = await db.prepare(`SELECT * FROM usage WHERE id = ? AND status = 'reserved'`).bind(usageId).first();
  if (!u) return false;
  const t = now();
  const stmts = [db.prepare(`UPDATE usage SET status = 'refunded', updated_at = ? WHERE id = ?`).bind(t, usageId)];
  if (u.from_credits > 0) {
    stmts.push(db.prepare(
      `INSERT INTO credit_ledger (user_id, minutes, type, note, ref, created_at) VALUES (?, ?, 'refund', ?, ?, ?)`,
    ).bind(u.user_id, u.from_credits, 'Process එක fail වුණා — ආපහු දුන්නා', usageId, t));
  }
  await db.batch(stmts);
  return true;
}
