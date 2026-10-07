import type { DocKind, ItemKind } from '../types'

export const KIND: Record<ItemKind, { label: string; icon: string }> = {
  service: { label: 'טיפול תקופתי', icon: '🔧' },
  oil: { label: 'שמן ומסננים', icon: '🛢️' },
  tyres: { label: 'צמיגים', icon: '🛞' },
  brakes: { label: 'בלמים', icon: '🛑' },
  battery: { label: 'מצבר', icon: '🔋' },
  test: { label: 'טסט (רישיון רכב)', icon: '🪪' },
  insurance: { label: 'ביטוח', icon: '🛡️' },
  custom: { label: 'אחר', icon: '🧰' },
}

export const SERVICE_KINDS: ItemKind[] = ['service', 'oil', 'tyres', 'brakes', 'battery', 'test', 'custom']

export const DOC_KIND: Record<DocKind, { label: string; icon: string }> = {
  licence: { label: 'רישיון רכב', icon: '🪪' },
  insurance: { label: 'ביטוח', icon: '🛡️' },
  driver: { label: 'רישיון נהיגה', icon: '📄' },
  other: { label: 'מסמך אחר', icon: '📎' },
}

export const STATUS_TEXT = {
  ok: 'תקין',
  soon: 'בקרוב',
  due: 'לטפל עכשיו',
  overdue: 'עבר המועד',
  unset: 'לא הוגדר',
} as const
