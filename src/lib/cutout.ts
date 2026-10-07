/** Remove the background of a car photo on the device. Returns a trimmed transparent PNG. */
export async function cutoutCar(file: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal')
  const png = await removeBackground(file, { output: { format: 'image/png' } })
  return trimTransparent(png)
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
