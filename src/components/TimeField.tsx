import { useState } from 'react'
import Picker from 'react-mobile-picker'
import { Sheet } from './ui'
import { Icon } from './Icon'

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/**
 * A time, HH:MM in 24 hours, in a field built like the date field (DateField). Tapping it opens two
 * wheels, hours and minutes (react-mobile-picker), the way a phone's own clock picks a time.
 */
export function TimeField({ value, onChange, label = 'שעה' }: { value: string; onChange(t: string): void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [h, m] = value.split(':')
  // the wheels move freely; the field changes only on "אישור"
  const [pick, setPick] = useState({ h: h ?? '09', m: MINUTES.includes(m) ? m : '00' })
  return (
    <>
      <button type="button" className="in date-field time-field" onClick={() => (setPick({ h: h ?? '09', m: MINUTES.includes(m) ? m : '00' }), setOpen(true))} aria-label={`${label}: ${value}`}>
        <span className="tv">{value}</span>
        <span className="slot" aria-hidden="true">
          <Icon name="clock" />
        </span>
      </button>
      {open && (
        <Sheet title={label} onClose={() => setOpen(false)}>
          <div className="time-wheels" dir="ltr">
            <Picker value={pick} onChange={v => setPick(v as { h: string; m: string })} height={200} itemHeight={44} wheelMode="natural">
              <Picker.Column name="h">
                {HOURS.map(x => (
                  <Picker.Item key={x} value={x}>
                    {({ selected }) => <span className={selected ? 'on' : ''}>{x}</span>}
                  </Picker.Item>
                ))}
              </Picker.Column>
              <Picker.Column name="m">
                {MINUTES.map(x => (
                  <Picker.Item key={x} value={x}>
                    {({ selected }) => <span className={selected ? 'on' : ''}>{x}</span>}
                  </Picker.Item>
                ))}
              </Picker.Column>
            </Picker>
            <span className="colon" aria-hidden="true">
              :
            </span>
          </div>
          <button
            className="btn pri"
            style={{ marginTop: 14 }}
            onClick={() => {
              onChange(`${pick.h}:${pick.m}`)
              setOpen(false)
            }}
          >
            אישור · {pick.h}:{pick.m}
          </button>
        </Sheet>
      )}
    </>
  )
}
