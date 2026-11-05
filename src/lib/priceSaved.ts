/*
 * מחירון: the cars looked up and kept for later. A lookup is not a car in the garage — it is a car
 * being considered — so it stays on the device (localStorage), next to the name in profile.ts, and
 * never reaches the account or the family.
 */

const KEY = 'car-records:price-saved'
const MAX = 12

export interface SavedCar {
  plate: string // digits, as the registry takes them
  shown: string // the plate as it reads: 12-345-67
  name: string // "קיה נירו", or the plate when the registry has no name
  year: number | null
  value: number | null // the estimate when it was saved
  at: string // YYYY-MM-DD, the day it was saved
}

const ok = (v: unknown): v is SavedCar => Boolean(v) && typeof (v as SavedCar).plate === 'string' && /^\d{5,8}$/.test((v as SavedCar).plate)

/** The saved cars in the order they were saved: the first one first, so the row reads from its start. */
export function listSaved(): SavedCar[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter(ok).slice(-MAX) : []
  } catch {
    return [] // storage blocked, or something else wrote the key
  }
}

function write(list: SavedCar[]): SavedCar[] {
  const cut = list.slice(-MAX) // full up: the one saved longest ago drops off
  try {
    localStorage.setItem(KEY, JSON.stringify(cut))
  } catch {
    // storage blocked: the list lasts for this visit only
  }
  return cut
}

export const isSaved = (list: SavedCar[], plate: string) => list.some(c => c.plate === plate)

/**
 * Saves a car at the end of the row, after the ones saved before it; one already there keeps its
 * place and only its details are brought up to date, so the row never reshuffles under a tap.
 */
export const saveCar = (list: SavedCar[], car: SavedCar) =>
  write(list.some(c => c.plate === car.plate) ? list.map(c => (c.plate === car.plate ? car : c)) : [...list, car])

export const unsaveCar = (list: SavedCar[], plate: string) => write(list.filter(c => c.plate !== plate))
