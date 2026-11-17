// Remotion composition එක: video + subtitles (+ watermark). Preview (Player) සහ export දෙකටම.
import { Video } from '@remotion/media';
import { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ensureFonts } from './fonts.js';
import SubtitleLayer, { Watermark } from './SubtitleLayer.jsx';

export const FPS = 30;

export default function SubtitleVideo({ src, lines, style, watermark }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // Fonts load වෙනකම් render එක රැඳෙනවා (loadFont → delayRender)
  useMemo(() => { ensureFonts(style); }, [style.fontSi, style.fontEn, style.weight]);
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {src && <Video src={src} objectFit="contain" style={{ width: '100%', height: '100%' }} />}
      <SubtitleLayer lines={lines} style={style} time={frame / fps} width={width} height={height} />
      {watermark && <Watermark height={height} />}
    </AbsoluteFill>
  );
}

/** Video එකේ දිග/ප්‍රමාණයෙන් composition settings (h264 වලට even dimensions ඕනේ) */
export function compositionSize(project, maxShort = null) {
  let w = project.width || 1080, h = project.height || 1920;
  if (maxShort) {
    const k = Math.min(1, maxShort / Math.min(w, h)); // upscale කරන්නේ නෑ
    w *= k; h *= k;
  }
  const even = n => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(w), height: even(h) };
}

export const durationInFrames = seconds => Math.max(1, Math.ceil(seconds * FPS));
