export type CutoutStage =
  | { stage: 'download'; percent: number } // the AI model, first time only
  | { stage: 'detect' } // the model finds the car
  | { stage: 'windows' } // put back windows and other enclosed areas
  | { stage: 'finish' } // trim and save

/**
 * Turns an uploaded car image into a trimmed transparent PNG.
 * An image that is already transparent (e.g. an AI studio render) is only trimmed;
 * anything else gets its background removed on the device.
 */
export async function prepareCarImage(
  file: Blob,
  onStage: (s: CutoutStage) => void = () => {},
): Promise<{ png: Blob; removedBackground: boolean }> {
  if (await hasTransparency(file)) {
    onStage({ stage: 'finish' })
    return { png: await trimTransparent(file), removedBackground: false }
  }

  // Work at a sane size: faster removal, and the hero never shows more than ~1200px.
  const original = await toImageData(file, 1600)
  const input = await imageDataToBlob(original, 'image/png')

  const { removeBackground } = await import('@imgly/background-removal')
  // The model is usually cached: start on "detect", and switch to "download" only while files arrive.
  onStage({ stage: 'detect' })
  const files = new Map<string, [number, number]>()
  let shown = ''
  const cut = await removeBackground(input, {
    output: { format: 'image/png' },
    progress: (key, current, total) => {
      if (!key.startsWith('fetch:')) return
      files.set(key, [current, total])
      let done = 0
      let all = 0
      for (const [c, t] of files.values()) {
        done += c
        all += t
      }
      const percent = all ? Math.min(100, Math.round((done / all) * 100)) : 0
      const next = percent >= 100 ? 'detect' : `download:${percent}`
      if (next === shown) return
      shown = next
      onStage(percent >= 100 ? { stage: 'detect' } : { stage: 'download', percent })
    },
  })

  onStage({ stage: 'windows' })
  const result = await toImageData(cut, original.width, original.height)
  fillEnclosedHoles(result, original)

  onStage({ stage: 'finish' })
  return { png: await trimTransparent(await imageDataToBlob(result, 'image/png')), removedBackground: true }
}

/**
 * The model sees through glass, so it erases windows (and gaps between wheel spokes).
 * Real background always touches the photo edge; a see-through area fully surrounded
 * by the car does not. Flood-fill the transparent area from the edges, then restore
 * every transparent pixel the fill did not reach from the original photo.
 */
function fillEnclosedHoles(out: ImageData, original: ImageData) {
  const { width: w, height: h, data } = out
  const src = original.data
  const CLEAR = 200 // alpha below this counts as "see-through"
  const outside = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  const push = (i: number) => {
    if (!outside[i] && data[i * 4 + 3] < CLEAR) {
      outside[i] = 1
      queue[tail++] = i
    }
  }
  for (let x = 0; x < w; x++) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y++) {
    push(y * w)
    push(y * w + w - 1)
  }
  while (head < tail) {
    const i = queue[head++]
    const x = i % w
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (i >= w) push(i - w)
    if (i < w * (h - 1)) push(i + w)
  }

  // Ignore specks: only restore holes inside the car's bounding box.
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let i = 0; i < w * h; i++)
    if (data[i * 4 + 3] >= CLEAR) {
      const x = i % w, y = (i / w) | 0
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }

  const restore = (i: number) => {
    const p = i * 4
    data[p] = src[p]
    data[p + 1] = src[p + 1]
    data[p + 2] = src[p + 2]
    data[p + 3] = 255
  }
  // 1. the holes themselves
  const filled = new Uint8Array(w * h)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * w + x
      if (!outside[i] && data[i * 4 + 3] < CLEAR) {
        restore(i)
        filled[i] = 1
      }
    }
  // 2. the soft rim around each hole, so no see-through outline is left around the glass.
  //    The car's outer edge touches `outside`, not `filled`, so it keeps its soft edge.
  for (let pass = 0; pass < 2; pass++)
    for (let y = Math.max(1, y0); y <= Math.min(h - 2, y1); y++)
      for (let x = Math.max(1, x0); x <= Math.min(w - 2, x1); x++) {
        const i = y * w + x
        if (filled[i] || data[i * 4 + 3] === 255) continue
        if (filled[i - 1] || filled[i + 1] || filled[i - w] || filled[i + w]) {
          restore(i)
          filled[i] = 2
        }
      }
}

/** Decode to ImageData. With one size it is a max side; with two it is the exact size. */
async function toImageData(blob: Blob, maxOrWidth: number, height?: number): Promise<ImageData> {
  const bmp = await createImageBitmap(blob)
  let w: number, h: number
  if (height) [w, h] = [maxOrWidth, height]
  else {
    const scale = Math.min(1, maxOrWidth / Math.max(bmp.width, bmp.height))
    ;[w, h] = [Math.round(bmp.width * scale), Math.round(bmp.height * scale)]
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

function imageDataToBlob(img: ImageData, type: string): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  c.getContext('2d')!.putImageData(img, 0, 0)
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), type))
}

/** True when at least 2% of the pixels are see-through. JPEGs never are. */
async function hasTransparency(file: Blob): Promise<boolean> {
  if (!/png|webp|gif|avif/.test(file.type)) return false
  const { data } = await toImageData(file, 200)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) clear++
  return clear / (data.length / 4) > 0.02
}

async function trimTransparent(png: Blob): Promise<Blob> {
  const img = await toImageData(png, 4096)
  const { width: w, height: h, data } = img
  let x0 = w, y0 = h, x1 = 0, y1 = 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 <= x0 || y1 <= y0) return png
  const src = document.createElement('canvas')
  src.width = w
  src.height = h
  src.getContext('2d')!.putImageData(img, 0, 0)
  const out = document.createElement('canvas')
  const scale = Math.min(1, 1200 / (x1 - x0))
  out.width = Math.round((x1 - x0 + 1) * scale)
  out.height = Math.round((y1 - y0 + 1) * scale)
  out.getContext('2d')!.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height)
  return new Promise((res, rej) => out.toBlob(b => (b ? res(b) : rej(new Error('trim failed'))), 'image/png'))
}
