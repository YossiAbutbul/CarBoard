import type { DocKind, ItemKind } from '../types'

/** Hand-drawn 24px line icons. Stroke follows currentColor. */
const PATHS = {
  // kinds
  service: 'M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.6-.4-.4-2.6 2.4-2.4Z',
  oil: 'M12 3.5s5.5 6.2 5.5 10a5.5 5.5 0 0 1-11 0c0-3.8 5.5-10 5.5-10Z M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5',
  tyres: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M12 3v5.5 M12 15.5V21 M3 12h5.5 M15.5 12H21',
  brakes: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z M19.5 7.5c1.2 1.3 1.8 2.8 1.8 4.5s-.6 3.2-1.8 4.5',
  battery: 'M4 8h16v11H4z M7.5 8V5.5h2V8 M14.5 8V5.5h2V8 M7 13.5h3 M14 13.5h3 M15.5 12v3',
  test: 'M7 4h10l2 2v14H5V6l2-2Z M9 4v2.5h6V4 M8.5 13l2.3 2.3L15.5 11',
  insurance: 'M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z M9 12l2 2 4-4',
  custom: 'M6 12h.01 M12 12h.01 M18 12h.01',
  // doc kinds
  licence: 'M3.5 6h17v12h-17z M7 10h4 M7 13h6 M15.5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
  driver: 'M3.5 6h17v12h-17z M9 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M5.8 15c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4 M14.5 10h3 M14.5 13h3',
  other: 'M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8L14 3.5Z M14 3.5V8h4.5',
  // ui
  home: 'M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z',
  list: 'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
  docs: 'M8 3.5h8l3.5 3.5v13.5H8z M16 3.5V7h3.5 M4.5 7v13.5H15',
  settings: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  camera: 'M4 8h3.5L9 5.5h6L16.5 8H20v11H4z M12 10.5a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z',
  gauge: 'M4.5 16.5a8 8 0 1 1 15 0 M12 14l3.5-4.5 M12 14h.01',
  plus: 'M12 5v14 M5 12h14',
  close: 'M6 6l12 12 M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z M13.5 6.5l4 4',
  trash: 'M5 7h14 M10 7V4.5h4V7 M7 7l1 13h8l1-13',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3.5v4 M16 3.5v4',
  cloud: 'M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.4 1.5A3.75 3.75 0 0 1 17.5 18.5z',
  device: 'M7.5 3h9v18h-9z M11 18h2',
  check: 'M5 12.5 10 17.5 19 7',
  swap: 'M7 7h12l-3-3 M17 17H5l3 3',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z M20 20l-4.8-4.8',
  car: 'M3.5 14.5v-3l2-4.5h13l2 4.5v3 M3.5 14.5h17V18h-17z M7 18v1.5 M17 18v1.5 M7 11h10',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={`i ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name].split(' M').map((d, i) => (
        <path key={i} d={i ? 'M' + d : d} />
      ))}
    </svg>
  )
}

export const kindIcon = (k: ItemKind): IconName => k
export const docIcon = (k: DocKind): IconName => (k === 'insurance' ? 'insurance' : k)
