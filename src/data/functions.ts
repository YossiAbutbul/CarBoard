import { supabase } from './supabase'
import { blobToBase64, compressImage } from '../lib/image'

/** Sends a dashboard photo to the read-odometer function. The photo is not stored. */
export async function readOdometer(photo: Blob): Promise<number> {
  if (!supabase) throw new Error('קריאת ק״מ מתמונה זמינה רק במצב ענן')
  const small = await compressImage(photo, 1280, 0.85)
  const image = await blobToBase64(small)
  const { data, error } = await supabase.functions.invoke<{ km: number | null; error?: string }>('read-odometer', {
    body: { image, mediaType: 'image/jpeg' },
  })
  if (error) throw new Error('השרת לא הצליח לקרוא את התמונה')
  if (!data || data.km == null) throw new Error(data?.error ?? 'לא זוהה מספר ק״מ. נסה צילום קרוב וחד יותר')
  return data.km
}
