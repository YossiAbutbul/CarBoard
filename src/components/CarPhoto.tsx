import { useState } from 'react'
import { useApp } from '../data/AppData'
import { prepareCarImage } from '../lib/cutout'
import { Icon } from './Icon'

/** Prepares an uploaded car image (background removal unless already transparent) and stores it. */
export function useCarPhotoUpload() {
  const { actions } = useApp()
  const [busy, setBusy] = useState<null | 'reading' | 'removing'>(null)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File | undefined): Promise<string | null> {
    if (!file) return null
    setError(null)
    setBusy(/png|webp/.test(file.type) ? 'reading' : 'removing')
    try {
      const { png } = await prepareCarImage(file)
      return await actions.upload('car', png)
    } catch {
      setError('לא הצלחנו לעבד את התמונה. נסו תמונה אחרת.')
      return null
    } finally {
      setBusy(null)
    }
  }

  return { upload, busy, error }
}

/** The empty spot where the car stands: tap to upload an image. */
export function CarDrop({ onFile, busy, error, dark }: { onFile(f: File | undefined): void; busy: string | null; error: string | null; dark?: boolean }) {
  return (
    <label className={`car-drop ${dark ? 'dark' : ''}`}>
      <input type="file" accept="image/*" disabled={Boolean(busy)} onChange={e => onFile(e.target.files?.[0])} />
      {busy ? (
        <>
          <span className="spin" />
          <span>{busy === 'removing' ? 'מסיר את הרקע… בפעם הראשונה זה לוקח רגע' : 'מכין את התמונה…'}</span>
        </>
      ) : (
        <>
          <span className="drop-ic">
            <Icon name="camera" />
          </span>
          <b>הוספת תמונה של הרכב</b>
          <span className="drop-hint">PNG עם רקע שקוף נראה הכי טוב. תמונה רגילה? נסיר את הרקע.</span>
        </>
      )}
      {error && <span className="drop-err">{error}</span>}
    </label>
  )
}
