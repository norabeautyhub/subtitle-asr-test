import { useEffect, useState } from 'react';
import { api, fmtDate } from '../api.js';
import { useSession } from '../App.jsx';

export default function Settings() {
  const { plan } = useSession();
  return (
    <div className="narrow-page">
      <h1>Settings</h1>
      <ElevenLabsKey premium={plan?.engine === 'elevenlabs_byok'} />
      <PasswordForm />
    </div>
  );
}

function ElevenLabsKey({ premium }) {
  const [key, setKey] = useState(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState(null);
  const load = () => api('/me/keys').then(d => setKey(d.keys.find(k => k.provider === 'elevenlabs') || null));
  useEffect(() => { load(); }, []);

  const save = async e => {
    e.preventDefault(); setMsg(null);
    try { await api('/me/keys/elevenlabs', { method: 'PUT', body: { key: input } }); setInput(''); setMsg({ ok: true, t: 'Save වුණා ✅' }); load(); }
    catch (err) { setMsg({ ok: false, t: err.message }); }
  };
  const remove = async () => {
    if (!confirm('API key එක delete කරන්නද?')) return;
    await api('/me/keys/elevenlabs', { method: 'DELETE' }); load();
  };

  return (
    <form className="card" onSubmit={save}>
      <h3>🔑 ඔයාගේ ElevenLabs API key එක {premium ? '' : <span className="muted small">(Premium plan එකට විතරයි)</span>}</h3>
      <p className="muted small">
        Premium plan එකේ subtitles හැදෙන්නේ ඔයාගේම ElevenLabs account එකෙන් — limit නෑ, ඔයාගේ ElevenLabs credits තියෙනකම්.
        Key එක encrypt කරලා save වෙනවා; කාටවත් (admin ටවත්) බලන්න බෑ.
      </p>
      {key ? (
        <div className="row between keybox">
          <span>Save කරලා තියෙනවා: <code>sk_••••••••{key.last4}</code> <span className="muted small">({fmtDate(key.created_at)})</span></span>
          <button type="button" className="btn ghost sm danger" onClick={remove}>Delete</button>
        </div>
      ) : <p className="small">තාම key එකක් නෑ.</p>}
      <label>{key ? 'අලුත් key එකක් දාන්න' : 'API key එක'}
        <input type="password" placeholder="sk_..." value={input} onChange={e => setInput(e.target.value)} autoComplete="off" />
      </label>
      <p className="muted small">ElevenLabs → Developers → API Keys → Create Key → <b>Speech to Text</b> permission on කරන්න.</p>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.t}</div>}
      <button className="btn" disabled={!input.trim()}>Save</button>
    </form>
  );
}

function PasswordForm() {
  const [f, setF] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState(null);
  const save = async e => {
    e.preventDefault(); setMsg(null);
    try { await api('/me/password', { method: 'POST', body: f }); setF({ current: '', next: '' }); setMsg({ ok: true, t: 'Password එක වෙනස් වුණා ✅' }); }
    catch (err) { setMsg({ ok: false, t: err.message }); }
  };
  return (
    <form className="card" onSubmit={save}>
      <h3>🔒 Password එක වෙනස් කරන්න</h3>
      <label>දැනට තියෙන password එක<input type="password" required value={f.current} onChange={e => setF({ ...f, current: e.target.value })} autoComplete="current-password" /></label>
      <label>අලුත් password එක (අවම අකුරු 8)<input type="password" required minLength={8} value={f.next} onChange={e => setF({ ...f, next: e.target.value })} autoComplete="new-password" /></label>
      {msg && <div className={`alert ${msg.ok ? 'ok' : 'error'}`}>{msg.t}</div>}
      <button className="btn">Password එක වෙනස් කරන්න</button>
    </form>
  );
}
