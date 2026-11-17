import { useState } from 'react';
import { api, apiBinary, fmtBytes, fmtDuration, fmtMinutes, secondsToMinutes } from '../api.js';
import { useRouter, useSession } from '../App.jsx';
import { readMediaMeta } from '../lib/audio.js';
import { localFiles } from '../lib/localFiles.js';

export default function NewProject() {
  const { plan, balance } = useSession();
  const { navigate } = useRouter();
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null); // 0..1
  const [over, setOver] = useState(false);

  const pick = async f => {
    setError(''); setMeta(null); setFile(null);
    if (!f) return;
    if (!/^(video|audio)\//.test(f.type)) return setError('Video file එකක් තෝරන්න (MP4, MOV, WEBM...)');
    try {
      const m = await readMediaMeta(f);
      if (m.duration > plan.max_video_seconds) {
        return setError(`${plan.name} plan එකේ උපරිම video දිග විනාඩි ${Math.round(plan.max_video_seconds / 60)}යි. මේ video එක ${fmtDuration(m.duration)}යි.`);
      }
      setFile(f); setMeta(m);
    } catch (e) { setError(e.message); }
  };

  const upload = async () => {
    setError(''); setProgress(0);
    try {
      const r = await api('/projects', {
        method: 'POST',
        body: { filename: file.name, size: file.size, duration: meta.duration, width: meta.width, height: meta.height, contentType: file.type },
      });
      const id = r.project.id;
      const total = Math.ceil(file.size / r.partSize);
      const parts = [];
      for (let i = 0; i < total; i++) {
        const blob = file.slice(i * r.partSize, (i + 1) * r.partSize);
        let tries = 0;
        for (;;) {
          try {
            const part = await apiBinary(`/projects/${id}/parts/${i + 1}`, blob, {
              method: 'PUT', onProgress: f => setProgress((i + f) / total),
            });
            parts.push(part);
            break;
          } catch (e) {
            if (++tries >= 3 || e.status < 500) throw e; // network/server error නම් 3 පාරක් try කරනවා
            await new Promise(res => setTimeout(res, 1500 * tries));
          }
        }
      }
      await api(`/projects/${id}/complete`, { method: 'POST', body: { parts } });
      localFiles.set(id, file); // Subtitles හදනකොට ආයේ download කරන්න ඕනේ නැති වෙන්න
      navigate(`/projects/${id}`);
    } catch (e) {
      setError(e.message); setProgress(null);
    }
  };

  const need = meta ? secondsToMinutes(meta.duration) : 0;
  const enough = balance?.unlimited || (balance?.available ?? 0) >= need;

  return (
    <div className="narrow-page">
      <h1>අලුත් video එකක්</h1>
      <label className={`drop ${over ? 'over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
        <input type="file" accept="video/*,audio/*" hidden disabled={progress !== null} onChange={e => pick(e.target.files[0])} />
        <div className="drop-icon">🎬</div>
        <div>Video එක මෙතනට drag &amp; drop කරන්න, නැත්නම් click කරලා තෝරන්න</div>
        <div className="muted small">MP4, MOV, WEBM · උපරිම දිග විනාඩි {Math.round(plan.max_video_seconds / 60)} ({plan.name} plan)</div>
      </label>

      {file && meta && (
        <div className="card">
          <div className="row between">
            <div>
              <b>{file.name}</b>
              <div className="muted small">{fmtDuration(meta.duration)} · {fmtBytes(file.size)}{meta.width ? ` · ${meta.width}×${meta.height}` : ''}</div>
            </div>
            <div className="right small">
              Subtitles හදන්න: <b>විනාඩි {fmtMinutes(need)}</b>
              <div className="muted">ඔයාට තියෙන්නේ: {balance?.unlimited ? '∞' : fmtMinutes(balance?.available)}</div>
            </div>
          </div>
          {!enough && <div className="alert error">විනාඩි මදි. Upload කරන්න පුළුවන්, ඒත් subtitles හදන්න කලින් credits ඕනේ.</div>}
          {progress !== null ? (
            <>
              <div className="bar big-bar"><div style={{ width: `${progress * 100}%` }} /></div>
              <div className="muted small">Upload වෙනවා... {Math.round(progress * 100)}% — මේ page එක close කරන්න එපා</div>
            </>
          ) : (
            <button className="btn full" onClick={upload}>⬆ Upload කරන්න</button>
          )}
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
    </div>
  );
}
