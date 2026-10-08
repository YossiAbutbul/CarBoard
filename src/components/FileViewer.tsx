import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Data } from '../types'
import { useApp } from '../data/AppData'
import { fmtDate } from '../lib/i18n'
import { Icon } from './Icon'
import { drawPage, isCancelled, openPdf } from '../lib/pdf'
import { useBackLayer } from '../lib/back'
import { ask } from './Dialog'

export interface AppFile {
  ref: string
  title: string // what the file belongs to
  sub: string // e.g. a date
  source: 'doc' | 'receipt'
}

/** Every uploaded file of a car: document photos and service receipts, newest first. */
export function carFiles(data: Data, carId: string): AppFile[] {
  const docs = data.documents
    .filter(d => d.car_id === carId)
    .flatMap(d => d.files.map(ref => ({ ref, title: d.title, sub: d.expiry ? `בתוקף עד ${fmtDate(d.expiry)}` : d.provider ?? '', source: 'doc' as const, date: d.expiry ?? '' })))
  const receipts = data.services
    .filter(s => s.car_id === carId && s.receipt)
    .map(s => ({ ref: s.receipt!, title: s.title, sub: `קבלה · ${fmtDate(s.date)}`, source: 'receipt' as const, date: s.date }))
  return [...docs, ...receipts].sort((a, b) => (a.date < b.date ? 1 : -1))
}

const extOf = (type: string) => ({ 'application/pdf': 'pdf', 'image/webp': 'webp', 'image/png': 'png' })[type] ?? 'jpg'

/** Resolves a file ref to a URL and tells whether it is a PDF. */
export function useFile(ref: string | null) {
  const { actions } = useApp()
  const [state, setState] = useState<{ url: string; pdf: boolean } | null>(null)
  useEffect(() => {
    let live = true
    setState(null)
    if (!ref) return
    ;(async () => {
      const url = await actions.fileUrl(ref)
      if (!url) return
      let pdf = /\.pdf($|\?)/i.test(ref) || /\.pdf($|\?)/i.test(url)
      if (!pdf && url.startsWith('blob:')) pdf = (await (await fetch(url)).blob()).type === 'application/pdf'
      if (live) setState({ url, pdf })
    })().catch(() => {})
    return () => {
      live = false
    }
  }, [ref, actions])
  return state
}

/** Drag with the mouse to move around a zoomed photo or PDF (touch screens already pan by finger). */
function useDragPan<T extends HTMLElement>(enabled: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let start: { x: number; y: number; left: number; top: number } | null = null
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
      el.setPointerCapture(e.pointerId)
      el.classList.add('dragging')
      e.preventDefault()
    }
    const move = (e: PointerEvent) => {
      if (!start) return
      el.scrollLeft = start.left - (e.clientX - start.x)
      el.scrollTop = start.top - (e.clientY - start.y)
    }
    const up = () => {
      start = null
      el.classList.remove('dragging')
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [enabled])
  return ref
}

/** The first page of a PDF, small, with a PDF badge. */
export function PdfThumb({ url, width = 120 }: { url: string; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (ref.current) drawPage(url, 1, ref.current, width).catch(e => !isCancelled(e) && setFailed(true))
  }, [url, width])
  return (
    <span className="pdf-thumb">
      {failed ? <Icon name="other" /> : <canvas ref={ref} />}
      <b>PDF</b>
    </span>
  )
}

/** Every page of a PDF, as wide as its container. */
function PdfPages({ url, zoom }: { url: string; zoom: number }) {
  const box = useDragPan<HTMLDivElement>(zoom > 1)
  const [pages, setPages] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setPages(0)
    openPdf(url)
      .then(d => live && setPages(d.numPages))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [url])
  // redraw at the new size, so a zoomed page is sharp, not stretched; wait for a pause between taps
  useEffect(() => {
    const el = box.current
    if (!el || !pages) return
    const t = setTimeout(() => {
      const width = Math.round(Math.min(el.clientWidth - 8, 900) * zoom)
      el.querySelectorAll('canvas').forEach((c, i) => drawPage(url, i + 1, c, width).catch(() => {}))
    }, 120)
    return () => clearTimeout(t)
  }, [url, pages, zoom])
  if (failed) return <div className="pdf-failed">אי אפשר להציג את הקובץ. אפשר להוריד אותו מלמעלה.</div>
  return (
    <div className={`pdf-pages ${zoom > 1 ? 'pannable' : ''}`} ref={box}>
      {!pages && <span className="spin" />}
      {Array.from({ length: pages }, (_, i) => (
        <canvas key={i} />
      ))}
    </div>
  )
}

function Thumb({ fileRef }: { fileRef: string }) {
  const f = useFile(fileRef)
  if (!f) return <span className="spin" style={{ width: 16, height: 16 }} />
  if (f.pdf) return <PdfThumb url={f.url} width={90} />
  return <img src={f.url} alt="" loading="lazy" />
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

/** Full-screen viewer with zoom, next/previous, a thumbnail strip, download and share. */
export function FileViewer({
  files,
  start = 0,
  onClose,
  onDelete,
  permanent = false,
}: {
  files: AppFile[]
  start?: number
  onClose(): void
  onDelete?: (ref: string) => boolean | Promise<boolean> // removes the file; false for files this place cannot remove
  permanent?: boolean // deletes it for good (the files tab) rather than taking it off an unsaved form
}) {
  const [i, setI] = useState(start)
  const file = files[Math.min(i, files.length - 1)]
  const f = useFile(file?.ref ?? null)
  const go = (d: number) => setI(x => (x + d + files.length) % files.length)
  useBackLayer(true, onClose)
  const [zoom, setZoom] = useState(1)
  const [fitWidth, setFitWidth] = useState(0) // the photo's width at 100%
  const pan = useDragPan<HTMLDivElement>(zoom > 1)
  useEffect(() => setZoom(1), [i])
  const zoomBy = (d: number) => setZoom(z => ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + d))])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(1)
      if (e.key === 'ArrowRight') go(-1)
      if (e.key === '+' || e.key === '=') zoomBy(1)
      if (e.key === '-') zoomBy(-1)
      if (e.key === '0') setZoom(1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  async function share() {
    if (!f) return
    try {
      const blob = await (await fetch(f.url)).blob()
      const name = `${file.title}.${extOf(blob.type)}`
      const asFile = new File([blob], name, { type: blob.type })
      if (navigator.canShare?.({ files: [asFile] })) await navigator.share({ files: [asFile], title: file.title })
      else download()
    } catch {
      // the user closed the share sheet
    }
  }
  async function download() {
    if (!f) return
    const type = f.pdf ? 'application/pdf' : (await (await fetch(f.url)).blob()).type
    const a = document.createElement('a')
    a.href = f.url
    a.download = `${file.title}.${extOf(type)}`
    a.click()
  }

  if (!file) return null
  // Rendered into <body>, so it covers the bottom bar even when opened inside an animated page.
  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={file.title}>
      <div className="viewer-head">
        <button onClick={onClose} aria-label="סגירה">
          <Icon name="close" />
        </button>
        <div className="t">
          <b>{file.title}</b>
          <small>
            {file.sub}
            {files.length > 1 && ` · ${i + 1} מתוך ${files.length}`}
          </small>
        </div>
        <button onClick={share} aria-label="שיתוף">
          <Icon name="share" />
        </button>
        <button onClick={download} aria-label="הורדה">
          <Icon name="download" />
        </button>
        {onDelete && (
          <button
            className="viewer-del"
            aria-label="הסרת הקובץ"
            onClick={async () => {
              const q = permanent ? { title: 'למחוק את הקובץ?', text: `${file.title} · הקובץ יימחק לצמיתות.`, confirm: 'מחיקה' } : { title: 'להסיר את הקובץ?', text: file.title, confirm: 'הסרה' }
              if (!(await ask({ ...q, danger: true }))) return
              if ((await onDelete(file.ref)) === false) return
              if (files.length <= 1) onClose()
              else setI(x => Math.max(0, Math.min(x, files.length - 2)))
            }}
          >
            <Icon name="trash" />
          </button>
        )}
      </div>
      <div className="viewer-stage" onClick={e => e.target === e.currentTarget && onClose()}>
        {!f ? (
          <span className="spin" />
        ) : f.pdf ? (
          <PdfPages key={f.url} url={f.url} zoom={zoom} />
        ) : (
          <div ref={pan} className={`viewer-zoom ${zoom > 1 ? 'zoomed pannable' : ''}`} onClick={e => e.target === e.currentTarget && zoom === 1 && onClose()}>
            <img
              key={f.url}
              src={f.url}
              alt={file.title}
              onLoad={e => setFitWidth(e.currentTarget.getBoundingClientRect().width)}
              draggable={false}
              onDoubleClick={() => setZoom(z => (z === 1 ? 2 : 1))}
              style={zoom !== 1 && fitWidth ? { width: fitWidth * zoom, maxWidth: 'none', maxHeight: 'none' } : undefined}
            />
          </div>
        )}
        {f && (
          <div className="zoom-bar" dir="ltr">
            <button onClick={() => zoomBy(-1)} disabled={zoom === ZOOMS[0]} aria-label="הקטנה">
              <Icon name="zoomOut" />
            </button>
            <button className="zoom-level" onClick={() => setZoom(1)} aria-label="גודל רגיל">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={() => zoomBy(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="הגדלה">
              <Icon name="zoomIn" />
            </button>
          </div>
        )}
        {files.length > 1 && (
          <>
            <button className="viewer-nav prev" onClick={() => go(-1)} aria-label="הקודם">
              ›
            </button>
            <button className="viewer-nav next" onClick={() => go(1)} aria-label="הבא">
              ‹
            </button>
          </>
        )}
      </div>
      {files.length > 1 && (
        <div className="viewer-strip">
          {files.map((x, n) => (
            <button key={x.ref} className={n === i ? 'on' : ''} onClick={() => setI(n)} aria-label={x.title}>
              <Thumb fileRef={x.ref} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

/** A grid of all the car's files with a filter; tapping one opens the viewer. */
export function FilesGallery({ files }: { files: AppFile[] }) {
  const { actions } = useApp()
  const [filter, setFilter] = useState<'all' | 'doc' | 'receipt'>('all')
  const [open, setOpen] = useState<number | null>(null)
  const shown = files.filter(f => filter === 'all' || f.source === filter)
  return (
    <>
      <div className="files-filter">
        {(
          [
            ['all', `הכל · ${files.length}`],
            ['doc', `מסמכים · ${files.filter(f => f.source === 'doc').length}`],
            ['receipt', `קבלות · ${files.filter(f => f.source === 'receipt').length}`],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="hint" style={{ padding: '6px 2px' }}>אין קבצים כאן עדיין.</div>
      ) : (
        <div className="files-grid">
          {shown.map((f, n) => (
            <button key={f.ref} onClick={() => setOpen(n)} aria-label={`${f.title}, ${f.sub}`} style={{ animationDelay: `${Math.min(n, 8) * 40}ms` }}>
              <Thumb fileRef={f.ref} />
              <span className="tag-src">{f.title}</span>
            </button>
          ))}
        </div>
      )}
      {open !== null && (
        <FileViewer
          files={shown}
          start={open}
          onClose={() => setOpen(null)}
          permanent
          onDelete={async ref => {
            await actions.deleteFile(ref)
            return true
          }}
        />
      )}
    </>
  )
}
