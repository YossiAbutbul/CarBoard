import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

/*
 * PDF pages drawn to canvas with pdf.js (Mozilla), loaded only when a PDF is shown.
 * Phones cannot show a PDF inside the page, so we draw it ourselves.
 */

let lib: Promise<typeof import('pdfjs-dist')> | null = null
function pdfjs() {
  lib ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([m, worker]) => {
    m.GlobalWorkerOptions.workerSrc = worker.default
    return m
  })
  return lib
}

const docs = new Map<string, Promise<PDFDocumentProxy>>()
export async function openPdf(url: string) {
  if (!docs.has(url)) {
    const open = pdfjs().then(
      m =>
        m.getDocument({
          url,
          // fonts and character maps for PDFs that do not embed their fonts (common with Hebrew)
          cMapUrl: '/pdfjs/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
          wasmUrl: '/pdfjs/wasm/',
          iccUrl: '/pdfjs/iccs/',
        }).promise,
    )
    docs.set(url, open)
  }
  return docs.get(url)!
}

const drawing = new WeakMap<HTMLCanvasElement, RenderTask>()

/** True for the error pdf.js throws when a newer draw replaced this one. */
export const isCancelled = (e: unknown) => (e as { name?: string })?.name === 'RenderingCancelledException'

/**
 * Draws page `n` (1-based) `width` CSS pixels wide, sharp on high-density screens.
 * A canvas takes one draw at a time, so a newer draw cancels the one still running.
 */
export async function drawPage(url: string, n: number, canvas: HTMLCanvasElement, width: number) {
  drawing.get(canvas)?.cancel()
  const doc = await openPdf(url)
  const page = await doc.getPage(n)
  const base = page.getViewport({ scale: 1 })
  // at least 2x, so text stays crisp on ordinary screens and when zoomed by the browser
  const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3)
  const viewport = page.getViewport({ scale: (width / base.width) * dpr })
  // pdf.js places every glyph itself; an inherited right-to-left direction would shift each one
  canvas.dir = 'ltr'
  canvas.style.direction = 'ltr'
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${width}px`
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`
  drawing.get(canvas)?.cancel()
  const task = page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport })
  drawing.set(canvas, task)
  await task.promise
}
