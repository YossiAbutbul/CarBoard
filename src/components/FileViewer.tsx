import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Data } from '../types'
import { useApp } from '../data/AppData'
import { fmtDate } from '../lib/i18n'
import { Icon } from './Icon'

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

function Thumb({ fileRef }: { fileRef: string }) {
  const f = useFile(fileRef)
  if (!f) return <span className="spin" style={{ width: 16, height: 16 }} />
  if (f.pdf) return <Icon name="other" />
  return <img src={f.url} alt="" loading="lazy" />
}

/** Full-screen viewer with next/previous, a thumbnail strip, download and share. */
export function FileViewer({ files, start = 0, onClose }: { files: AppFile[]; start?: number; onClose(): void }) {
  const [i, setI] = useState(start)
  const file = files[i]
  const f = useFile(file?.ref ?? null)
  const go = (d: number) => setI(x => (x + d + files.length) % files.length)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') go(1)
      if (e.key === 'ArrowRight') go(-1)
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
      const name = `${file.title}.${f.pdf ? 'pdf' : 'jpg'}`
      const asFile = new File([blob], name, { type: blob.type })
      if (navigator.canShare?.({ files: [asFile] })) await navigator.share({ files: [asFile], title: file.title })
      else download()
    } catch {
      // the user closed the share sheet
    }
  }
  function download() {
    if (!f) return
    const a = document.createElement('a')
    a.href = f.url
    a.download = `${file.title}.${f.pdf ? 'pdf' : 'jpg'}`
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
      </div>
      <div className="viewer-stage" onClick={e => e.target === e.currentTarget && onClose()}>
        {!f ? <span className="spin" /> : f.pdf ? <iframe src={f.url} title={file.title} /> : <img key={f.url} src={f.url} alt={file.title} />}
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
      {open !== null && <FileViewer files={shown} start={open} onClose={() => setOpen(null)} />}
    </>
  )
}
