import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { DayPicker } from 'react-day-picker'
import { he } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { addDays, addMonths, parseIso, toIso, todayIso } from '../lib/dates'
import { fmtDate } from '../lib/i18n'
import { Icon } from './Icon'
import { useSwipeClose } from './ui'
import { useBackLayer } from '../lib/back'

type Kind = 'future' | 'past'

const QUICK: Record<Kind, [string, () => string][]> = {
  future: [
    ['בעוד חודש', () => addMonths(todayIso(), 1)],
    ['בעוד חצי שנה', () => addMonths(todayIso(), 6)],
    ['בעוד שנה', () => addMonths(todayIso(), 12)],
  ],
  past: [
    ['היום', () => todayIso()],
    ['אתמול', () => addDays(todayIso(), -1)],
    ['לפני שבוע', () => addDays(todayIso(), -7)],
  ],
}

/**
 * A date field that opens a Hebrew, right-to-left calendar sheet instead of the browser's picker.
 * `kind` picks the quick buttons; `max` (e.g. today for a past service) disables later days.
 */
export function DateField({
  value,
  onChange,
  placeholder = 'בחירת תאריך',
  kind = 'future',
  max,
  clearable = true,
  label,
}: {
  value: string
  onChange(iso: string): void
  placeholder?: string
  kind?: Kind
  max?: string
  clearable?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  // typed by hand as dd.mm.yyyy (the dots come by themselves); the calendar is one tap away
  const [text, setText] = useState(value ? fmtDate(value) : '')
  const [bad, setBad] = useState(false)
  useEffect(() => {
    setText(value ? fmtDate(value) : '')
    setBad(false)
  }, [value])
  const type = (raw: string) => {
    const d = raw.replace(/\D/g, '').slice(0, 8)
    setText([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.'))
    if (d.length === 0 && clearable) return onChange('')
    if (d.length < 8) return setBad(false)
    const iso = typedIso(d)
    const ok = Boolean(iso) && (!max || iso! <= max)
    setBad(!ok)
    if (ok) onChange(iso!)
  }
  return (
    <>
      <span className={`in date-field ${value ? '' : 'is-empty'} ${bad ? 'bad' : ''}`}>
        <input
          inputMode="numeric"
          dir="ltr"
          value={text}
          placeholder="dd.mm.yyyy"
          aria-label={label ?? placeholder}
          aria-invalid={bad}
          onChange={e => type(e.target.value)}
          onBlur={() => !bad && setText(value ? fmtDate(value) : '')}
        />
        <button type="button" onClick={() => setOpen(true)} aria-label="פתיחת לוח שנה">
          <Icon name="calendar" />
        </button>
      </span>
      {open && (
        <CalendarSheet
          value={value}
          kind={kind}
          max={max}
          clearable={clearable}
          title={label ?? placeholder}
          onPick={iso => {
            onChange(iso)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** "26052068" → "2068-05-26", or null for a day that does not exist. */
function typedIso(d: string) {
  const day = Number(d.slice(0, 2))
  const month = Number(d.slice(2, 4))
  const year = Number(d.slice(4, 8))
  const dt = new Date(year, month - 1, day)
  if (year < 1950 || year > 2100 || dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null
  return toIso(dt)
}

function CalendarSheet({
  value,
  kind,
  max,
  clearable,
  title,
  onPick,
  onClose,
}: {
  value: string
  kind: Kind
  max?: string
  clearable: boolean
  title: string
  onPick(iso: string): void
  onClose(): void
}) {
  const selected = value ? parseIso(value) : undefined
  const [month, setMonth] = useState<Date>(selected ?? new Date())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { sheet, handle } = useSwipeClose(onClose)
  useBackLayer(true, onClose)
  const now = new Date()
  const maxDate = max ? parseIso(max) : undefined
  return createPortal(
    <div className="cal-overlay" onClick={onClose}>
      <div className="cal-sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="drag-zone" {...handle}>
          <div className="grab" />
          <div className="cal-head">
            <b>{title}</b>
            <button onClick={onClose} aria-label="סגירה">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="chips cal-quick">
          {QUICK[kind]
            .filter(([, f]) => !max || f() <= max)
            .map(([label, f]) => (
              <button key={label} onClick={() => onPick(f())}>
                {label}
              </button>
            ))}
        </div>
        <DayPicker
          mode="single"
          locale={he}
          dir="rtl"
          animate
          selected={selected}
          onSelect={d => d && onPick(toIso(d))}
          month={month}
          onMonthChange={setMonth}
          captionLayout="dropdown"
          // long enough for a driving licence valid decades ahead
          startMonth={new Date(now.getFullYear() - 60, 0)}
          endMonth={maxDate ?? new Date(now.getFullYear() + 50, 11)}
          disabled={maxDate ? { after: maxDate } : undefined}
          showOutsideDays
          weekStartsOn={0}
          className="cal"
        />
        <div className="cal-foot">
          <button
            className="link"
            onClick={() => {
              setMonth(new Date())
              if (kind === 'past') onPick(todayIso())
            }}
          >
            היום
          </button>
          {clearable && value && (
            <button className="link danger" onClick={() => onPick('')}>
              ניקוי תאריך
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
