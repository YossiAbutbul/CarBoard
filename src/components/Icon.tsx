import {
  ArrowLeft,
  ArrowRight,
  Battery,
  BellPlus,
  Calendar,
  Camera,
  Car,
  CarFront,
  Check,
  ClipboardCheck,
  Cloud,
  Contact,
  Disc,
  Download,
  Droplet,
  Ellipsis,
  File,
  Files,
  Gauge,
  House,
  IdCard,
  LifeBuoy,
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
  type LucideIcon,
} from 'lucide-react'
import type { DocKind, ItemKind } from '../types'

/** App icon names mapped to Lucide icons (https://lucide.dev). */
const ICONS = {
  // reminder kinds
  service: Wrench,
  oil: Droplet,
  tyres: LifeBuoy,
  brakes: Disc,
  battery: Battery,
  test: ClipboardCheck,
  insurance: ShieldCheck,
  custom: Ellipsis,
  // document kinds
  licence: IdCard,
  driver: Contact,
  other: File,
  // ui
  home: House,
  list: List,
  docs: Files,
  settings: Settings,
  camera: Camera,
  gauge: Gauge,
  plus: Plus,
  close: X,
  edit: Pencil,
  trash: Trash2,
  calendar: Calendar,
  cloud: Cloud,
  device: Smartphone,
  check: Check,
  swap: CarFront,
  search: Search,
  car: Car,
  reminder: BellPlus,
  receipt: Receipt,
  share: Share2,
  download: Download,
  forward: ArrowLeft, // RTL: "next" points left
  back: ArrowRight,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICONS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const L = ICONS[name]
  return <L className={`i ${className ?? ''}`} strokeWidth={1.6} aria-hidden="true" />
}

export const kindIcon = (k: ItemKind): IconName => k
export const docIcon = (k: DocKind): IconName => (k === 'insurance' ? 'insurance' : k)
