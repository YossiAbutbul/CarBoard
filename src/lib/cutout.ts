/**
 * Turns an uploaded car image into a trimmed transparent PNG.
 * An image that is already transparent (e.g. an AI studio render) is only trimmed;
 * anything else gets its background removed on the device.
 */
export async function prepareCarImage(file: Blob): Promise<{ png: Blob; removedBackground: boolean }> {
  if (await hasTransparency(file)) return { png: await trimTransparent(file), removedBackground: false }
  const { removeBackground } = await import('@imgly/background-removal')
  const png = await removeBackground(file, { output: { format: 'image/png' } })
  return { png: await trimTransparent(png), removedBackground: true }
}

/** True when at least 2% of the pixels are see-through. JPEGs never are. */
async function hasTransparency(file: Blob): Promise<boolean> {
  if (!/png|webp|gif|avif/.test(file.type)) return false
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 200 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(bmp.width * scale))
  c.height = Math.max(1, Math.round(bmp.height * scale))
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 200) clear++
  return clear / (data.length / 4) > 0.02
}

async function trimTransparent(png: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(png)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(bmp, 0, 0)
  const { data } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (data[(y * c.width + x) * 4 + 3] > 12) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 <= x0 || y1 <= y0) return png
  const out = document.createElement('canvas')
  const scale = Math.min(1, 1200 / (x1 - x0))
  out.width = Math.round((x1 - x0 + 1) * scale)
  out.height = Math.round((y1 - y0 + 1) * scale)
  out.getContext('2d')!.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, out.width, out.height)
  return new Promise((res, rej) => out.toBlob(b => (b ? res(b) : rej(new Error('trim failed'))), 'image/png'))
}
