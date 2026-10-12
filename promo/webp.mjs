// The README's moving picture, made from the rendered video: an animated WebP (full colour, smooth, plays
// and loops by itself on GitHub, where a video would need a click). 900px wide, 24 frames a second, no
// sound. Needs ffmpeg on the PATH.
import { execFileSync } from 'node:child_process'

execFileSync(
  'ffmpeg',
  ['-y', '-i', 'out/carboard-promo.mp4', '-an', '-vf', 'fps=24,scale=900:-1:flags=lanczos', '-c:v', 'libwebp', '-lossless', '0', '-quality', '62', '-compression_level', '6', '-loop', '0', '-preset', 'picture', '../docs/carboard.webp'],
  { stdio: 'inherit' },
)
console.log('saved ../docs/carboard.webp')
