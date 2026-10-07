import type { DocKind, ItemKind } from '../types'

export const KIND: Record<ItemKind, { label: string }> = {
  service: { label: 'טיפול תקופתי' },
  oil: { label: 'שמן ומסננים' },
  tyres: { label: 'צמיגים' },
  brakes: { label: 'בלמים' },
  battery: { label: 'מצבר' },
  test: { label: 'טסט (רישיון רכב)' },
  insurance: { label: 'ביטוח' },
  custom: { label: 'אחר' },
}

export const SERVICE_KINDS: ItemKind[] = ['service', 'oil', 'tyres', 'brakes', 'battery', 'test', 'custom']

export const DOC_KIND: Record<DocKind, { label: string }> = {
  licence: { label: 'רישיון רכב' },
  insurance: { label: 'ביטוח' },
  driver: { label: 'רישיון נהיגה' },
  other: { label: 'מסמך אחר' },
}

export const STATUS_TEXT = {
  ok: 'תקין',
  soon: 'בקרוב',
  due: 'לטפל עכשיו',
  overdue: 'עבר המועד',
  unset: 'לא הוגדר',
} as const
