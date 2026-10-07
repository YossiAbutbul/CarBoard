import type { Car } from '../types'

const MAKES: [string, string][] = [
  ['טויוטה', 'toyota'], ['יונדאי', 'hyundai'], ['קיה', 'kia'], ['מאזדה', 'mazda'], ['סקודה', 'skoda'],
  ['מיצובישי', 'mitsubishi'], ['ניסאן', 'nissan'], ['סוזוקי', 'suzuki'], ['שברולט', 'chevrolet'],
  ['פולקסווגן', 'volkswagen'], ['רנו', 'renault'], ["פיג'ו", 'peugeot'], ['פיגו', 'peugeot'],
  ['סיטרואן', 'citroen'], ['הונדה', 'honda'], ['סובארו', 'subaru'], ['פורד', 'ford'],
  ['ב.מ.וו', 'bmw'], ['במוו', 'bmw'], ['מרצדס', 'mercedes-benz'], ['אאודי', 'audi'], ['טסלה', 'tesla'],
  ['סיאט', 'seat'], ['אופל', 'opel'], ['דאצ', 'dacia'], ["ג'יפ", 'jeep'], ['לקסוס', 'lexus'],
  ['וולוו', 'volvo'], ['מ.ג', 'mg'], ['אם.ג', 'mg'], ['ביי.די', 'byd'], ['גילי', 'geely'], ["צ'רי", 'chery'],
  ['פיאט', 'fiat'], ['מיני', 'mini'], ['קופרה', 'cupra'], ['לנד רובר', 'land-rover'], ['פורשה', 'porsche'],
]

export function makeToEn(make: string | null) {
  if (!make) return null
  if (/^[a-z\s-]+$/i.test(make)) return make.toLowerCase()
  const hit = MAKES.find(([he]) => make.includes(he))
  return hit ? hit[1] : null
}

const COLORS: [string, string][] = [
  ['לבן', '#f4f4f2'], ['שחור', '#1d1f24'], ['כסוף', '#b8bec8'], ['אפור', '#7d838d'], ['אדום', '#c4122f'],
  ['כחול', '#1f4f9c'], ['ירוק', '#2e7d4f'], ['צהוב', '#f2c230'], ['כתום', '#e8742c'], ['חום', '#6b4a33'],
  ['בז', '#cdb894'], ['זהב', '#c9a54a'], ['בורדו', '#6d1a2a'], ['טורקיז', '#2aa5a0'], ['סגול', '#5b3a8c'],
]

export function colorHex(color: string | null) {
  if (!color) return '#b8bec8'
  const hit = COLORS.find(([he]) => color.includes(he))
  let hex = hit ? hit[1] : '#b8bec8'
  if (color.includes('כהה')) hex = shade(hex, -0.35)
  if (color.includes('בהיר')) hex = shade(hex, 0.3)
  return hex
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('')
}

/** imagin.studio renders a transparent PNG per make/model/year. Needs VITE_IMAGIN_KEY. */
export function modelImageUrl(c: Pick<Car, 'make' | 'model' | 'year'>, angle = '01') {
  const key = import.meta.env.VITE_IMAGIN_KEY
  const make = makeToEn(c.make)
  if (!key || !make || !c.model) return null
  const q = new URLSearchParams({
    customer: key,
    make,
    modelFamily: c.model.toLowerCase().split(' ')[0],
    modelYear: String(c.year ?? ''),
    angle,
    zoomType: 'fullscreen',
  })
  return `https://cdn.imagin.studio/getImage?${q}`
}

export const hasModelImages = () => Boolean(import.meta.env.VITE_IMAGIN_KEY)
