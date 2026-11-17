// Export: MP4 (subtitles burn කරලා) — browser එකේම render වෙනවා. SRT / VTT download.
import { canRenderMediaOnWeb, renderMediaOnWeb } from '@remotion/web-renderer';
import { useRef, useState } from 'react';
import { downloadText } from '../lib/subtitles.js';
import { linesToSrt, linesToVtt } from './model.js';
import SubtitleVideo, { FPS, compositionSize, durationInFrames } from './SubtitleVideo.jsx';

const QUALITY_SHORT = { '720p': 720, '1080p': 1080, '4k': 2160 };

export default function ExportPanel({ project, doc, plan, licenseKey }) {
  const [state, setState] = useState(null); // { pct, eta } | { done: url, size } | { error }
  const ctrl = useRef(null);
  const size = compositionSize(project, QUALITY_SHORT[plan.export_quality] || 1080);
  const safeName = (project.title || 'video').replace(/[\\/:*?"<>|]+/g, '_');

  const run = async () => {
    setState({ pct: 0 });
    ctrl.current = new AbortController();
    try {
      const check = await canRenderMediaOnWeb({ container: 'mp4', videoCodec: 'h264', width: size.width, height: size.height });
      if (!check.canRender) throw new Error(`මේ browser එකේ MP4 export කරන්න බෑ: ${check.issues.map(i => i.message).join(', ')} — අලුත් Chrome එකක් පාවිච්චි කරන්න.`);
      const t0 = Date.now();
      const { getBlob } = await renderMediaOnWeb({
        composition: { id: 'novi-subtitles', component: SubtitleVideo, durationInFrames: durationInFrames(project.duration), fps: FPS, width: size.width, height: size.height },
        inputProps: { src: `${location.origin}/api/projects/${project.id}/video`, lines: doc.lines, style: doc.style, watermark: !!plan.watermark },
        container: 'mp4',
        videoCodec: 'h264',
        videoBitrate: 'high',
        audioBitrate: 'high',
        signal: ctrl.current.signal,
        licenseKey: licenseKey || undefined,
        onProgress: p => {
          const elapsed = (Date.now() - t0) / 1000;
          setState({ pct: p.progress, eta: p.progress > 0.02 ? Math.round(elapsed / p.progress - elapsed) : null });
        },
      });
      const blob = await getBlob();
      setState({ done: URL.createObjectURL(blob), size: blob.size });
    } catch (e) {
      setState(ctrl.current?.signal.aborted ? null : { error: e.message || String(e) });
    }
  };

  return (
    <div className="export-panel">
      <h4>🎬 MP4 Video export</h4>
      <p className="small muted">
        Subtitles video එකට burn කරලා MP4 එකක් හදනවා — editor එකේ පේන විදිහටම.
        Quality: <b>{size.width}×{size.height}</b> ({plan.export_quality}){plan.watermark ? ' · Watermark එක්ක' : ''}
      </p>
      {plan.watermark && <p className="small muted">Watermark නැතුව / ඉහළ quality එකකින් ගන්න plan එක upgrade කරන්න.</p>}

      {!state && <button className="btn full" onClick={run}>⬇ MP4 Export කරන්න</button>}
      {state && 'pct' in state && (
        <>
          <div className="bar big-bar"><div style={{ width: `${state.pct * 100}%` }} /></div>
          <p className="small">Render වෙනවා... {Math.round(state.pct * 100)}%{state.eta != null ? ` · තව තත්පර ${state.eta}ක් විතර` : ''}</p>
          <p className="small muted">මේ tab එක open කරලා, පේන්න තියන්න (minimize කරන්න එපා).</p>
          <button className="btn ghost sm" onClick={() => ctrl.current?.abort()}>නවත්වන්න</button>
        </>
      )}
      {state?.done && (
        <div className="alert ok">
          ✅ ඉවරයි! ({(state.size / 1e6).toFixed(1)} MB){' '}
          <a className="btn sm" href={state.done} download={`${safeName}.mp4`}>⬇ Download MP4</a>{' '}
          <button className="btn ghost sm" onClick={() => setState(null)}>ආයේ export</button>
        </div>
      )}
      {state?.error && <div className="alert error">{state.error} <button className="btn ghost sm" onClick={() => setState(null)}>OK</button></div>}

      <h4>📄 Subtitle files</h4>
      <div className="row">
        <button className="btn ghost sm" onClick={() => downloadText(`${safeName}.srt`, linesToSrt(doc.lines))}>⬇ SRT</button>
        <button className="btn ghost sm" onClick={() => downloadText(`${safeName}.vtt`, linesToVtt(doc.lines), 'text/vtt')}>⬇ VTT</button>
      </div>
      <p className="muted small">SRT / VTT: YouTube, Facebook වගේ තැන්වලට subtitles වෙනම upload කරන්න (styles නෑ).</p>
    </div>
  );
}
