const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>(res => canvas.toBlob(res, type, quality))

/**
 * Scale an image down so its long side is at most `max` px and save it small:
 * WebP where the browser can write it (about a third smaller than JPEG), JPEG otherwise.
 * A photo that is already smaller than the result is kept as it is.
 */
export async function compressImage(file: Blob, max = 1400, quality = 0.72): Promise<Blob> {
  let bmp: ImageBitmap
  try {
    bmp = await createImageBitmap(file)
  } catch {
    return file // a format this browser cannot read (e.g. HEIC): upload it as it is
  }
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  // Safari before 17 cannot write WebP and quietly returns a PNG: check the type
  let out = await toBlob(canvas, 'image/webp', quality)
  if (!out || out.type !== 'image/webp') out = await toBlob(canvas, 'image/jpeg', quality + 0.06)
  if (!out) throw new Error('compress failed')
  return out.size < file.size ? out : file
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1])
    r.onerror = () => rej(r.error)
    r.readAsDataURL(blob)
  })
}
