// පොදු උපකාරක functions

export const now = () => Date.now();

/** "2026-11" වගේ මාසය (Asia/Colombo time zone එකට) */
export function currentPeriod(ts = Date.now()) {
  const d = new Date(ts + 5.5 * 3600 * 1000); // UTC+05:30
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function newId(prefix = '') {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return prefix + [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

export const round1 = n => Math.round(n * 10) / 10;

/** තත්පර → විනාඩි (0.1 විනාඩියට උඩට round කරනවා, අවම 0.1) */
export const secondsToMinutes = s => Math.max(0.1, Math.ceil((s / 60) * 10) / 10);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
