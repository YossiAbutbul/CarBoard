import {
  ArrowLeft,
  ArrowRight,
  Battery,
  BellPlus,
  Calendar,
  Camera,
  Car,
  Check,
  ClipboardCheck,
  Clock,
  Cloud,
  Contact,
  Download,
  Droplet,
  File,
  Files,
  Gauge,
  House,
  IdCard,
  List,
  Pencil,
  Receipt,
  Plus,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wrench,
  X,
  Users,
  Link2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Fuel,
  ScanLine,
  Menu,
  Shrink,
  Toolbox,
  Snowflake,
  Lightbulb,
  Sparkles,
  KeyRound,
  TriangleAlert,
  Tag,
  createLucideIcon,
  type LucideIcon,
} from 'lucide-react'
import type { DocKind, ItemKind } from '../types'

/*
 * Car parts Lucide has no icon for, drawn the same way (24×24, 2px strokes, round ends): a tyre with
 * its tread, a brake disc with its caliper, and a windscreen with a wiper.
 */
// a wheel: the tyre (two rings) around a five-spoke rim
const Tyre = createLucideIcon('tyre', [
  ['circle', { cx: '12', cy: '12', r: '10', key: 'o' }],
  ['circle', { cx: '12', cy: '12', r: '6.5', key: 'r' }],
  ['circle', { cx: '12', cy: '12', r: '1.8', key: 'h' }],
  ['path', { d: 'M12 10.2V5.5M13.7 11.4l4.5-1.4M13.1 13.5l2.7 3.8M10.9 13.5l-2.7 3.8M10.3 11.4 5.8 10', key: 's' }],
])
const Brake = createLucideIcon('brake', [
  ['circle', { cx: '11', cy: '13', r: '8', key: 'd' }],
  ['circle', { cx: '11', cy: '13', r: '2.5', key: 'h' }],
  ['path', { d: 'M15.5 3.2a10.5 10.5 0 0 1 5.3 5.3', key: 'c' }],
  ['path', { d: 'M14 2.5h1.5a6 6 0 0 1 6 6V10', key: 'k' }],
])
// the dashboard wiper symbol: a windscreen, the wiper arm across it, washer drops above
const Wiper = createLucideIcon('wiper', [
  ['path', { d: 'M3 20 5.2 11.2A2 2 0 0 1 7.1 9.7h9.8a2 2 0 0 1 1.9 1.5L21 20Z', key: 'w' }],
  ['path', { d: 'M12 20 7.4 12.2', key: 'a' }],
  ['path', { d: 'M8 5.5h.01M12 4.5h.01M16 5.5h.01M10 3h.01M14 3h.01', key: 'd' }],
])

/** App icon names mapped to Lucide icons (https://lucide.dev). */
const ICONS = {
  // reminder kinds
  service: Wrench,
  oil: Droplet,
  tyres: Tyre,
  brakes: Brake,
  battery: Battery,
  test: ClipboardCheck,
  insurance: ShieldCheck,
  custom: Toolbox,
  // what a custom service is about, read from its title
  wipers: Wiper,
  aircon: Snowflake,
  lights: Lightbulb,
  wash: Sparkles,
  key: KeyRound,
  // document kinds
  licence: IdCard,
  driver: Contact,
  other: File,
  // ui
  home: House,
  list: List,
  docs: Files,
  price: Tag,
  settings: Settings,
  camera: Camera,
  gauge: Gauge,
  plus: Plus,
  close: X,
  edit: Pencil,
  trash: Trash2,
  calendar: Calendar,
  clock: Clock,
  warn: TriangleAlert,
  cloud: Cloud,
  device: Smartphone,
  check: Check,
  swap: Menu, // opens the cars list
  search: Search,
  car: Car,
  reminder: BellPlus,
  receipt: Receipt,
  share: Share2,
  download: Download,
  forward: ArrowLeft, // RTL: "next" points left
  back: ArrowRight,
  zoomIn: ZoomIn,
  refresh: RefreshCw,
  fuel: Fuel,
  scan: ScanLine,
  reset: Shrink, // back to the normal size (arrows in, not a circle: that would read as "rotate")
  family: Users,
  link: Link2,
  zoomOut: ZoomOut,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const L = ICONS[name]
  return <L className={`i ${className ?? ''}`} strokeWidth={1.6} aria-hidden="true" />
}

export const kindIcon = (k: ItemKind): IconName => k

/** A service's icon: its kind's, or for a custom one, a guess from its title ("החלפת מגבים" → wipers). */
export function serviceIcon(s: { type: ItemKind; title: string }): IconName {
  if (s.type !== 'custom') return s.type
  const t = s.title
  if (/מגב/.test(t)) return 'wipers'
  if (/מיזוג|מזגן|גז/.test(t)) return 'aircon'
  if (/נור|פנס|תאור/.test(t)) return 'lights'
  if (/שטיפ|ניקוי|פוליש|ווקס/.test(t)) return 'wash'
  if (/מפתח|שלט/.test(t)) return 'key'
  if (/צמיג|פנצ׳?ר|איזון|כיוון/.test(t)) return 'tyres'
  if (/בלמ|רפיד|דיסק/.test(t)) return 'brakes'
  if (/מצבר/.test(t)) return 'battery'
  if (/שמן|מסנן/.test(t)) return 'oil'
  return 'custom'
}
export const docIcon = (k: DocKind): IconName => (k === 'insurance' ? 'insurance' : k)
