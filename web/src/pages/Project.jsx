import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiBinary, fmtBytes, fmtDate, fmtDuration, fmtMinutes, secondsToMinutes } from '../api.js';
import { Link, useRouter, useSession } from '../App.jsx';
import VideoWithCaptions from '../components/VideoWithCaptions.jsx';
import { decodeToMono16k, encodeWav, splitAtSilence } from '../lib/audio.js';
import { localFiles } from '../lib/localFiles.js';
import { downloadText, toSrt } from '../lib/subtitles.js';

const LANGS = [['si', 'සිංහල'], ['en', 'English'], ['auto', 'Auto (භාෂාව හොයාගන්න)']];

export default function Project({ id }) {
  const { balance, plan, refresh } = useSession();
  const { navigate } = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lang, setLang] = useState('si');
  const [job, setJob] = useState(null); // { step, pct }
  const videoRef = useRef(null);

  const load = useCallback(() => api(`/projects/${id}`).then(setData).catch(e => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error && !data) return <div className="center"><p className="alert error">{error}</p><Link to="/dashboard">← Dashboard</Link></div>;
  if (!data) return <p className="muted">Loading...</p>;
  const { project, transcript } = data;
  const need = secondsToMinutes(project.duration);
  const enough = balance?.unlimited || (balance?.available ?? 0) >= need;
  const isByok = plan?.engine === 'elevenlabs_byok';

  const generate = async () => {
    if (transcript && !confirm(`ආයේ subtitles හැදුවොත් විනාඩි ${fmtMinutes(need)}ක් අඩු වෙනවා, දැනට තියෙන subtitles මැකෙනවා. කරන්නද?`)) return;
    setError('');
    try {
      setJob({ step: 'Video එකෙන් audio එක වෙන් කරනවා...', pct: 0.02 });
      const src = localFiles.get(id) || await fetch(`/api/projects/${id}/video`, { credentials: 'same-origin' }).then(r => {
        if (!r.ok) throw new Error('Video එක load කරන්න බැරි වුණා');
        return r.arrayBuffer();
      });
      const samples = await decodeToMono16k(src);
      const chunks = splitAtSilence(samples, 300);
      const words = [];
      let engine = '';
      for (let i = 0; i < chunks.length; i++) {
        const label = chunks.length > 1 ? ` (කොටස ${i + 1}/${chunks.length})` : '';
        setJob({ step: `Audio එක යවනවා${label}...`, pct: 0.05 + 0.9 * (i / chunks.length) });
        const wav = encodeWav(chunks[i].samples);
        const r = await apiBinary(`/projects/${id}/transcribe-chunk?lang=${lang}&offset=${chunks[i].start.toFixed(3)}&index=${i}`, wav, {
          contentType: 'audio/wav',
          onProgress: f => {
            setJob({ step: f < 1 ? `Audio එක යවනවා${label}...` : `AI එක subtitles හදනවා${label}...`, pct: 0.05 + 0.9 * ((i + f * 0.3) / chunks.length) });
          },
        });
        words.push(...r.words);
        engine = r.model;
      }
      setJob({ step: 'Save කරනවා...', pct: 0.97 });
      await api(`/projects/${id}/transcript`, { method: 'PUT', body: { language: lang, engine, words } });
      await Promise.all([load(), refresh()]);
      setJob(null);
    } catch (e) {
      setError(e.message);
      setJob(null);
      refresh();
    }
  };

  const remove = async () => {
    if (!confirm('මේ project එක සහ video එක සම්පූර්ණයෙන්ම delete කරන්නද?')) return;
    await api(`/projects/${id}`, { method: 'DELETE' });
    localFiles.delete(id);
    navigate('/dashboard');
  };

  const seek = t => { if (videoRef.current) { videoRef.current.currentTime = t; videoRef.current.play(); } };

  return (
    <div className="project">
      <div className="row between">
        <div>
          <Link to="/dashboard" className="muted small">← Dashboard</Link>
          <h1 style={{ margin: '4px 0' }}>{project.title}</h1>
          <div className="muted small">{fmtDuration(project.duration)} · {fmtBytes(project.size_bytes)} · {fmtDate(project.created_at)}</div>
        </div>
        <button className="btn ghost sm danger" onClick={remove}>🗑 Delete</button>
      </div>

      <div className="project-grid">
        <VideoWithCaptions src={`/api/projects/${id}/video`} words={transcript?.words} videoRef={videoRef} />

        <div>
          <div className="card">
            <h3>{transcript ? '✅ Subtitles හදලා ඉවරයි' : 'Subtitles හදන්න'}</h3>
            {!job && (
              <>
                <label>Video එකේ භාෂාව
                  <select value={lang} onChange={e => setLang(e.target.value)}>
                    {LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <p className="small muted">
                  {balance?.unlimited ? 'ඔයාගේ ElevenLabs key එකෙන් — limit නෑ' : <>අඩු වෙන විනාඩි: <b>{fmtMinutes(need)}</b> · ඔයාට තියෙන්නේ: <b>{fmtMinutes(balance?.available)}</b></>}
                </p>
                {!enough && <div className="alert error">විනාඩි මදි. Credits ගන්න admin ට කතා කරන්න.</div>}
                <button className="btn full" disabled={!enough} onClick={generate}>
                  {transcript ? '🔄 ආයේ හදන්න' : '✨ Subtitles හදන්න'}
                </button>
                {isByok && <p className="small muted">Premium: ඔයාගේ ElevenLabs key එක <Link to="/settings">Settings</Link> වල දාලා තියෙන්න ඕනේ.</p>}
              </>
            )}
            {job && (
              <>
                <div className="bar big-bar"><div style={{ width: `${job.pct * 100}%` }} /></div>
                <p className="small">{job.step}</p>
                <p className="small muted">මේ page එක close කරන්න එපා.</p>
              </>
            )}
            {error && <div className="alert error">{error}</div>}
          </div>

          {transcript && (
            <div className="card">
              <div className="row between">
                <h3>Subtitles ({transcript.words.length} වචන)</h3>
                <button className="btn sm" onClick={() => downloadText(`${project.title}.srt`, toSrt(transcript.words))}>⬇ SRT</button>
              </div>
              <p className="muted small">වචනයක් click කළොත් video එක ඒ තැනට යනවා. Edit කරන්න, fonts, animations — ඊළඟ update එකේ (Editor).</p>
              <div className="words">
                {transcript.words.map((w, i) => (
                  <button key={i} className="word" onClick={() => seek(w.start)} title={`${w.start.toFixed(2)}s`}>{w.text}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
