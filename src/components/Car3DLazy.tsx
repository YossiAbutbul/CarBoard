import { useEffect, useState } from 'react'
import { get, set } from 'idb-keyval'
import type { Car } from '../types'
import { carPaint } from './CarAvatar'

const KEY = (paint: string) => `car-records:shot:v1:${paint}`
const memory = new Map<string, Promise<string>>()

/** The still for a paint: from memory, else from this device, else rendered once (3D code loads only then). */
function shotFor(paint: string): Promise<string> {
  if (!memory.has(paint))
    memory.set(
      paint,
      (async () => {
        try {
          const saved = (await get(KEY(paint))) as string | undefined
          if (saved) return saved
        } catch {
          // storage blocked: render without saving
        }
        const { renderCar } = await import('./Car3D')
        const url = await renderCar(paint)
        set(KEY(paint), url).catch(() => {})
        return url
      })(),
    )
  return memory.get(paint)!
}

/** A realistic studio image of the car in `paint`. */
export function CarShot({ paint, className }: { paint: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    setUrl(null)
    setFailed(false)
    shotFor(paint)
      .then(u => live && setUrl(u))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [paint])
  if (failed) return <span className={`car-shot failed ${className ?? ''}`} />
  return url ? <img className={`car-shot ${className ?? ''}`} src={url} alt="" /> : <span className={`car-shot loading ${className ?? ''}`} />
}

export function CarShotOf({ car, className }: { car: Pick<Car, 'paint' | 'color'>; className?: string }) {
  return <CarShot paint={carPaint(car)} className={className} />
}
