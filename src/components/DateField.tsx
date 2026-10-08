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
  return (
    <>
      <button type="button" className={`in date-field ${value ? '' : 'is-empty'}`} onClick={() => setOpen(true)} aria-label={label ?? placeholder}>
        <span>{value ? fmtDate(value) : placeholder}</span>
        <Icon name="calendar" />
      </button>
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
          startMonth={new Date(now.getFullYear() - 15, 0)}
          endMonth={maxDate ?? new Date(now.getFullYear() + 10, 11)}
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
