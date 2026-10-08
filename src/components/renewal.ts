import type { CarDocument } from '../types'
import { ask } from './Dialog'

/*
 * Renewing a document (a new insurance policy, a renewed licence) should not leave the old one
 * behind. The app asks, rather than deleting on its own: a document can rightly have several files.
 */

/**
 * Saving `doc` with new files and a later expiry (or another policy number) looks like a renewal:
 * offer to drop the files it had before. Returns the files to keep.
 */
export async function keepAfterRenewal(doc: CarDocument | undefined, files: string[], expiry: string | null, number: string | null): Promise<string[]> {
  if (!doc) return files
  const old = files.filter(f => doc.files.includes(f))
  const added = files.filter(f => !doc.files.includes(f))
  const later = Boolean(expiry && (!doc.expiry || expiry > doc.expiry))
  const otherNumber = Boolean(number && doc.number && number !== doc.number)
  if (!old.length || !added.length || !(later || otherNumber)) return files
  const yes = await ask({
    title: 'חידוש? למחוק את הקבצים הקודמים?',
    text: `נוסף קובץ חדש ${later ? 'והתאריך עודכן' : 'ומספר הפוליסה השתנה'}. ${old.length === 1 ? 'הקובץ הקודם יימחק' : `${old.length} הקבצים הקודמים יימחקו`} לצמיתות.`,
    confirm: 'כן, למחוק את הקודמים',
    cancel: 'לא, לשמור הכל',
    danger: true,
  })
  return yes ? added : files
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A new document with the same type and name as one the car already has: ask whether it replaces it. */
export async function documentToReplace(all: CarDocument[], carId: string, kind: CarDocument['kind'], title: string): Promise<CarDocument | null> {
  const same = all.find(d => d.car_id === carId && d.kind === kind && norm(d.title) === norm(title))
  if (!same) return null
  const yes = await ask({
    title: `יש כבר "${same.title}". להחליף אותו?`,
    text: `${same.files.length ? 'המסמך הקודם והקבצים שלו יימחקו' : 'המסמך הקודם יימחק'}, והחדש יישמר במקומו.`,
    confirm: 'כן, להחליף',
    cancel: 'לא, לשמור את שניהם',
    danger: true,
  })
  return yes ? same : null
}
