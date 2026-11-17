// Server API එකට calls
export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Requested-With': 'novi' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  return handle(res);
}

/** Binary data (video කෑලි / audio) යවනවා. onProgress(0..1) */
export function apiBinary(path, data, { method = 'POST', contentType = 'application/octet-stream', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `/api${path}`);
    xhr.setRequestHeader('X-Requested-With', 'novi');
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.withCredentials = true;
    if (onProgress) xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let d = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* empty */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(d);
      else { const err = new Error(d.error || `Error ${xhr.status}`); err.status = xhr.status; reject(err); }
    };
    xhr.onerror = () => reject(new Error('Internet connection error — ආයේ try කරන්න'));
    xhr.send(data);
  });
}

async function handle(res) {
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fmtMinutes = m => (m === null || m === undefined ? '∞' : `${Number(m).toLocaleString('en-US', { maximumFractionDigits: 1 })}`);
/** 91 → "1h 31m", 12 → "12 min" */
export const fmtHM = m => {
  m = Math.round(Number(m) || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h.toLocaleString('en-US')}h ${r}m` : `${h.toLocaleString('en-US')}h`;
};
/** මිල: LKR → "Rs. 1,800", USD → "$6" */
export const fmtPrice = (v, cur) => (cur === 'USD'
  ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  : `Rs. ${Number(v).toLocaleString('en-US')}`);
export const fmtDate = ts => (ts ? new Date(ts).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDuration = s => {
  s = Math.round(s || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const fmtBytes = b => (b > 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
/** Server එකේ ගණනයට සමානයි (worker/util.js) */
export const secondsToMinutes = s => Math.max(0.1, Math.ceil(((Math.max(0, s - 0.5) / 60) * 10) - 1e-9) / 10);
