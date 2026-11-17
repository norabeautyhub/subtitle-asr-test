import { useEffect, useMemo, useRef, useState } from 'react';
import { groupLines } from '../lib/subtitles.js';

/** Video player + subtitles overlay (කියවෙන වචනය කහ පාටින්). Full editor එක එන්නේ ඊළඟ කොටසේ. */
export default function VideoWithCaptions({ src, words, videoRef }) {
  const local = useRef(null);
  const ref = videoRef || local;
  const [t, setT] = useState(0);
  const lines = useMemo(() => groupLines(words || []), [words]);

  useEffect(() => {
    let raf, last = -1;
    const loop = () => {
      const now = ref.current?.currentTime ?? 0;
      if (Math.abs(now - last) > 0.02) { last = now; setT(now); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ref]);

  const line = lines.find(l => t >= l[0].start && t <= l.at(-1).end + 0.15);
  let k = -1;
  line?.forEach((w, i) => { if (t >= w.start) k = i; });

  return (
    <div className="vwrap">
      <video ref={ref} src={src} controls playsInline preload="metadata" />
      {line && (
        <div className="cap">
          {line.map((w, i) => <span key={i} className={i === k ? 'on' : ''}>{w.text} </span>)}
        </div>
      )}
    </div>
  );
}
