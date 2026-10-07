import { useState } from 'react'
import { useApp } from '../data/AppData'
import { prepareCarImage, type CutoutStage } from '../lib/cutout'
import { Icon } from './Icon'

export interface CarPhotoProgress {
  preview: string // the original photo, shown while it is processed
  stage: CutoutStage | { stage: 'start' }
}

/** Prepares an uploaded car image (background removal unless already transparent) and stores it. */
export function useCarPhotoUpload() {
  const { actions } = useApp()
  const [progress, setProgress] = useState<CarPhotoProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File | undefined): Promise<string | null> {
    if (!file) return null
    setError(null)
    const preview = URL.createObjectURL(file)
    setProgress({ preview, stage: { stage: 'start' } })
    try {
      const { png } = await prepareCarImage(file, stage => setProgress({ preview, stage }))
      return await actions.upload('car', png)
    } catch {
      setError('לא הצלחנו לעבד את התמונה. נסו תמונה אחרת.')
      return null
    } finally {
      setProgress(null)
      URL.revokeObjectURL(preview)
    }
  }

  return { upload, progress, busy: Boolean(progress), error }
}

const MESSAGES = {
  start: 'מכין את התמונה…',
  download: 'מוריד את מנוע ה-AI',
  detect: 'מזהה את הרכב…',
  windows: 'משחזר חלונות ופרטים…',
  finish: 'מסדר את התמונה…',
} as const

const STEPS = ['detect', 'windows', 'finish'] as const

/** The photo being processed: a light sweeps across it while a message shows the stage. */
export function CarProcessing({ progress, dark }: { progress: CarPhotoProgress; dark?: boolean }) {
  const s = progress.stage
  const step = STEPS.indexOf(s.stage as (typeof STEPS)[number])
  return (
    <div className={`car-processing ${dark ? 'dark' : ''}`} role="status" aria-live="polite">
      <div className="cp-photo">
        <img src={progress.preview} alt="" />
        <span className="cp-sweep" />
      </div>
      <div className="cp-msg" key={s.stage}>
        <span className="spin" />
        <span>
          {MESSAGES[s.stage]}
          {s.stage === 'download' && <b> · {s.percent}%</b>}
        </span>
      </div>
      {s.stage === 'download' ? (
        <div className="cp-bar">
          <i style={{ width: `${s.percent}%` }} />
          <small>פעם ראשונה בלבד</small>
        </div>
      ) : (
        <div className="cp-steps">
          {STEPS.map((k, i) => (
            <i key={k} className={i < step ? 'done' : i === step ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The empty spot where the car stands: tap to upload an image. */
export function CarDrop({
  onFile,
  progress,
  error,
  dark,
}: {
  onFile(f: File | undefined): void
  progress: CarPhotoProgress | null
  error: string | null
  dark?: boolean
}) {
  if (progress) return <CarProcessing progress={progress} dark={dark} />
  return (
    <label className={`car-drop ${dark ? 'dark' : ''}`}>
      <input type="file" accept="image/*" onChange={e => onFile(e.target.files?.[0])} />
      <span className="drop-ic">
        <Icon name="camera" />
      </span>
      <b>הוספת תמונה של הרכב</b>
      <span className="drop-hint">צילום מהצד או מהפינה הקדמית. נסיר את הרקע ונשאיר את החלונות.</span>
      {error && <span className="drop-err">{error}</span>}
    </label>
  )
}
