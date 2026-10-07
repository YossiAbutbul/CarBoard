import { ConfirmButton } from '../components/ConfirmButton'
import { useState } from 'react'
import type { CarDocument, DocKind } from '../types'
import { FileThumb, Lightbox, Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { DOC_KIND } from '../domain/labels'
import { compressImage } from '../lib/image'
import { Icon, docIcon } from '../components/Icon'
import { uid } from '../lib/uid'

export function DocumentSheet({ doc, onClose }: { doc?: CarDocument; onClose(): void }) {
  const { car, actions } = useApp()
  const [kind, setKind] = useState<DocKind>(doc?.kind ?? 'insurance')
  const [title, setTitle] = useState(doc?.title ?? '')
  const [provider, setProvider] = useState(doc?.provider ?? '')
  const [number, setNumber] = useState(doc?.number ?? '')
  const [expiry, setExpiry] = useState(doc?.expiry ?? '')
  const [files, setFiles] = useState<string[]>(doc?.files ?? [])
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  if (!car) return null

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    try {
      const refs: string[] = []
      for (const f of Array.from(list)) {
        const blob = f.type.startsWith('image/') ? await compressImage(f) : f
        refs.push(await actions.upload('doc', blob))
      }
      setFiles(fs => [...fs, ...refs])
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    try {
      await actions.saveDocument({
        id: doc?.id ?? uid(),
        car_id: car!.id,
        kind,
        title: title.trim() || DOC_KIND[kind].label,
        provider: provider.trim() || null,
        number: number.trim() || null,
        expiry: expiry || null,
        files,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  async function remove() {
    if (!doc) return
    await actions.deleteDocument(doc.id)
    onClose()
  }

  return (
    <Sheet title={doc ? doc.title : 'מסמך חדש'} onClose={onClose}>
      <div className="card">
        <div className="chips">
          {(Object.keys(DOC_KIND) as DocKind[]).map(k => (
            <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
              <Icon name={docIcon(k)} /> {DOC_KIND[k].label}
            </button>
          ))}
        </div>
        <label className="lbl">כותרת</label>
        <input className="in" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'insurance' ? 'ביטוח חובה / מקיף' : DOC_KIND[kind].label} />
        {kind === 'insurance' && (
          <div className="row2">
            <div>
              <label className="lbl">חברה</label>
              <input className="in" value={provider} onChange={e => setProvider(e.target.value)} placeholder="הראל, מגדל…" />
            </div>
            <div>
              <label className="lbl">מספר פוליסה</label>
              <input className="in" value={number} onChange={e => setNumber(e.target.value)} />
            </div>
          </div>
        )}
        <label className="lbl">בתוקף עד</label>
        <input className="in" type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
        {(kind === 'licence' || kind === 'insurance') && <div className="hint" style={{ marginTop: 6 }}>התאריך יעדכן גם את התזכורת.</div>}
        <label className="lbl">צילומים</label>
        {files.length > 0 && (
          <div className="thumbs" style={{ flexWrap: 'wrap', marginBottom: 8 }}>
            {files.map(f => (
              <FileThumb key={f} fileRef={f} onOpen={setView} />
            ))}
          </div>
        )}
        <label className="file-btn">
          {uploading ? (
            <span className="spin" />
          ) : (
            <>
              <Icon name="camera" /> הוספת צילום
            </>
          )}
          <input type="file" accept="image/*,application/pdf" multiple onChange={e => addFiles(e.target.files)} />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={uploading} onClick={save}>
          שמירה
        </button>
        {doc && (
          <ConfirmButton className="btn danger" style={{ marginTop: 8 }} onConfirm={remove}>
            מחיקה
          </ConfirmButton>
        )}
      </div>
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </Sheet>
  )
}
