// The voice-over, from ElevenLabs: one recording per line of src/lines.json, saved to public/voice/, and
// their lengths written to src/voice.json (each scene of the ad lasts as long as its line).
//
// Needs an ElevenLabs API key in promo/.env (git-ignored):   ELEVENLABS_API_KEY=...
// Optional in the same file:  ELEVENLABS_VOICE_ID=...   (default: Jessica, bright and friendly)
//
// Made the recordings yourself (on the ElevenLabs site, or anywhere)? Save them as public/voice/<id>.mp3,
// one per line, and run   npm run voice -- --measure   : no key needed, it only measures them.
//
// Or one recording of the whole script, read in one go (it flows better): save it as
// public/voice/full.mp3, with a clear pause between the lines, and run   npm run voice -- --split
// It finds the pauses, cuts the file into the six lines in the middle of each, and measures them.
// If the voice paused as long inside a line as between lines, give the five cut points yourself (seconds):
//   npm run voice -- --split --cuts 5.71,7.78,13.82,17.35,22.04
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  (existsSync('.env') ? readFileSync('.env', 'utf8') : '')
    .split(/\r?\n/)
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]),
)
const lines = JSON.parse(readFileSync('src/lines.json', 'utf8'))
const lengthOf = file => Math.round(Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim()) * 100) / 100

// the whole script in one file: cut it into the lines at the longest pauses between them
if (process.argv.includes('--split')) {
  const full = 'public/voice/full.mp3'
  if (!existsSync(full)) {
    console.error(`missing ${full}`)
    process.exit(1)
  }
  const total = lengthOf(full)
  // ffmpeg lists the quiet stretches (its report goes to stderr)
  const stderr = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', full, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8' }).stderr
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]))
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]))
  // pauses inside the recording (not the silence at its very start or end), longest first
  const pauses = starts
    .map((st, i) => ({ st, en: ends[i] ?? total }))
    .filter(p => p.st > 0.2 && p.en < total - 0.2)
    .sort((a, b) => b.en - b.st - (a.en - a.st))
    .slice(0, lines.length - 1)
    .sort((a, b) => a.st - b.st)
  if (!process.argv.includes('--cuts') && pauses.length < lines.length - 1) {
    console.error(`found ${pauses.length} pauses, need ${lines.length - 1}: leave a clear pause (about a second) between the lines`)
    process.exit(1)
  }
  const given = process.argv.includes('--cuts') ? process.argv[process.argv.indexOf('--cuts') + 1].split(',').map(Number) : null
  if (given && (given.length !== lines.length - 1 || given.some(c => !(c > 0 && c < total)))) {
    console.error(`--cuts needs ${lines.length - 1} times between 0 and ${total}`)
    process.exit(1)
  }
  const cuts = [0, ...(given ?? pauses.map(p => (p.st + p.en) / 2)), total]
  lines.forEach((line, i) => {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', full, '-ss', String(cuts[i]), '-to', String(cuts[i + 1]), '-c:a', 'libmp3lame', '-q:a', '2', `public/voice/${line.id}.mp3`])
  })
  console.log('cut at', cuts.slice(1, -1).map(c => c.toFixed(2) + 's').join(', '))
}

if (process.argv.includes('--measure') || process.argv.includes('--split')) {
  const out = {}
  for (const line of lines) {
    const file = `public/voice/${line.id}.mp3`
    if (!existsSync(file)) {
      console.error(`missing ${file}`)
      process.exit(1)
    }
    out[line.id] = { file: `voice/${line.id}.mp3`, seconds: lengthOf(file) }
    console.log(`${line.id}: ${out[line.id].seconds}s`)
  }
  writeFileSync('src/voice.json', JSON.stringify(out, null, 2) + '\n')
  console.log('voice measured')
  process.exit(0)
}

const key = process.env.ELEVENLABS_API_KEY ?? env.ELEVENLABS_API_KEY
if (!key) {
  console.error('No ElevenLabs key: add ELEVENLABS_API_KEY=... to promo/.env')
  process.exit(1)
}
const voice = process.env.ELEVENLABS_VOICE_ID ?? env.ELEVENLABS_VOICE_ID ?? 'cgSgspJ2msm6clMCkdW9'

mkdirSync('public/voice', { recursive: true })
const out = {}
for (const line of lines) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text: line.say, model_id: 'eleven_v3', language_code: 'he' }),
  })
  if (!res.ok) {
    console.error(`ElevenLabs refused "${line.id}": ${res.status} ${(await res.text()).slice(0, 300)}`)
    process.exit(1)
  }
  const file = `public/voice/${line.id}.mp3`
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  out[line.id] = { file: `voice/${line.id}.mp3`, seconds: lengthOf(file) }
  console.log(`${line.id}: ${out[line.id].seconds}s`)
}
writeFileSync('src/voice.json', JSON.stringify(out, null, 2) + '\n')
console.log('voice saved')
