// data.gov.il – public registry of private vehicles (no key, CORS open)
const RESOURCE = '053cea08-09bc-40ec-8f7a-156f0677aff3'

export interface PlateInfo {
  plate: string
  make: string
  model: string
  year: number | null
  color: string | null
  fuel: string | null
  tyres: string | null
  licenceUntil: string | null
  lastTest: string | null
}

export const plateDigits = (plate: string) => plate.replace(/\D/g, '')

export function formatPlate(plate: string) {
  const d = plateDigits(plate)
  if (d.length === 7) return `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}`
  if (d.length === 8) return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
  return d
}

/**
 * The plate as it is typed: 7 digits read xx-xxx-xx, and the 8th switches to xxx-xx-xxx.
 * A dash appears only once a digit follows it, so deleting stays natural.
 */
export function typingPlate(s: string) {
  const d = plateDigits(s).slice(0, 8)
  const sizes = d.length === 8 ? [3, 2, 3] : [2, 3, 2]
  const out: string[] = []
  let i = 0
  for (const n of sizes) {
    if (i >= d.length) break
    out.push(d.slice(i, i + n))
    i += n
  }
  return out.join('-')
}

/** Manufacturer names come with a country suffix: "קיה ד. קוריאה" → "קיה". */
const cleanMake = (s: string) => s.split(/\s+/).filter(w => !w.includes('.') && !/יפן|קורי(אה)?|גרמניה|צרפת|ארה"ב|סין|צ'כיה|ספרד|אנגליה|איטליה|טורקיה|הודו|תאילנד|רומניה|שוודיה|מ[כק]סיקו|סלובקיה|הונגריה|פולין|בלגיה|הולנד|אוסטריה|פורטוגל|דרום|אפריקה/.test(w)).join(' ') || s

export async function lookupPlate(plate: string): Promise<PlateInfo | null> {
  const digits = plateDigits(plate)
  if (digits.length < 5) return null
  const q = new URLSearchParams({
    resource_id: RESOURCE,
    filters: JSON.stringify({ mispar_rechev: Number(digits) }),
    limit: '1',
  })
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?${q}`)
  if (!res.ok) throw new Error(`data.gov.il ${res.status}`)
  const r = (await res.json())?.result?.records?.[0]
  if (!r) return null
  return {
    plate: formatPlate(digits),
    make: cleanMake(String(r.tozeret_nm ?? '').trim()),
    model: String(r.kinuy_mishari ?? r.degem_nm ?? '').trim(),
    year: r.shnat_yitzur ? Number(r.shnat_yitzur) : null,
    color: r.tzeva_rechev ?? null,
    fuel: r.sug_delek_nm ?? null,
    tyres: r.zmig_kidmi ?? null,
    licenceUntil: r.tokef_dt ? String(r.tokef_dt).slice(0, 10) : null,
    lastTest: r.mivchan_acharon_dt ? String(r.mivchan_acharon_dt).slice(0, 10) : null,
  }
}

// the registry's history of each car, and its changes of ownership (also data.gov.il, no key)
const HISTORY = '56063a99-8a3e-4ff4-912e-5966c0279bad'
const OWNERS = 'bb2355dc-9ec7-4f06-9c3f-3344672171da'
// the importers' official price of each model when new, by year (Ministry of Transport, also open data)
const NEW_PRICES = '39f455bf-6db0-4926-859d-017f34eacbcb'

/** What a buyer (or a price list) asks about a car: its trim, its past owners, its km at the last test. */
export interface CarProfile extends PlateInfo {
  trim: string | null
  onRoad: string | null // YYYY-MM
  ownership: string | null // now: פרטי, ליסינג, השכרה...
  firstRegistered: string | null // YYYY-MM-DD
  origin: string | null // how it started: פרטי, החכר (leasing)...
  testKm: number | null // the odometer at its last yearly test
  changes: string[] // structural change, LPG, colour, tyres
  owners: { date: string; type: string }[] // each change of ownership, oldest first (YYYY-MM)
  newPrice: { price: number; year: number; importer: string | null } | null // its list price when new
}

async function records(resource: string, digits: string, limit = 1) {
  return search(resource, { mispar_rechev: Number(digits) }, limit)
}
async function search(resource: string, filters: Record<string, unknown>, limit: number) {
  const q = new URLSearchParams({ resource_id: resource, filters: JSON.stringify(filters), limit: String(limit) })
  const res = await fetch(`https://data.gov.il/api/3/action/datastore_search?${q}`)
  if (!res.ok) throw new Error(`data.gov.il ${res.status}`)
  return ((await res.json())?.result?.records ?? []) as Record<string, unknown>[]
}

/** Everything the public registry knows about a car, by its plate (null: no such private car). */
export async function lookupProfile(plate: string): Promise<CarProfile | null> {
  const digits = plateDigits(plate)
  if (digits.length < 5) return null
  const [main, history, owners] = await Promise.all([records(RESOURCE, digits), records(HISTORY, digits), records(OWNERS, digits, 50)])
  const r = main[0]
  if (!r) return null
  // the same model's price list, by the registry's own codes: its year, or the nearest one listed
  const year = r.shnat_yitzur ? Number(r.shnat_yitzur) : null
  const prices = r.tozeret_cd != null && r.degem_cd != null ? await search(NEW_PRICES, { tozeret_cd: r.tozeret_cd, degem_cd: r.degem_cd }, 100).catch(() => []) : []
  const listed = prices
    .filter(x => typeof x.mehir === 'number' && (x.mehir as number) > 0)
    .sort((a, b) => Math.abs(Number(a.shnat_yitzur) - (year ?? 0)) - Math.abs(Number(b.shnat_yitzur) - (year ?? 0)))[0]
  const h = history[0] ?? {}
  const str = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  // a month as YYYY-MM, from 202410, "2021-8" or "2021-08-01"
  const ym = (v: unknown) => {
    const s = String(v ?? '')
    const m = /^(\d{4})-?(\d{1,2})/.exec(s)
    return m ? `${m[1]}-${m[2].padStart(2, '0')}` : ''
  }
  // the registry's words for how a car is owned, as people say them
  const owned = (v: unknown) => {
    const s = str(v)
    return s === 'החכר' ? 'ליסינג' : s
  }
  const changes = [
    h.shinui_mivne_ind === 1 && 'שינוי מבנה',
    h.gapam_ind === 1 && 'הסבה לגפ״מ',
    h.shnui_zeva_ind === 1 && 'שינוי צבע',
    h.shinui_zmig_ind === 1 && 'שינוי מידת צמיגים',
  ].filter((x): x is string => Boolean(x))
  return {
    plate: formatPlate(digits),
    make: cleanMake(String(r.tozeret_nm ?? '').trim()),
    model: String(r.kinuy_mishari ?? r.degem_nm ?? '').trim(),
    year: r.shnat_yitzur ? Number(r.shnat_yitzur) : null,
    color: str(r.tzeva_rechev),
    fuel: str(r.sug_delek_nm),
    tyres: str(r.zmig_kidmi),
    licenceUntil: r.tokef_dt ? String(r.tokef_dt).slice(0, 10) : null,
    lastTest: r.mivchan_acharon_dt ? String(r.mivchan_acharon_dt).slice(0, 10) : null,
    trim: str(r.ramat_gimur),
    onRoad: str(r.moed_aliya_lakvish) ? ym(r.moed_aliya_lakvish) : null,
    ownership: owned(r.baalut),
    firstRegistered: h.rishum_rishon_dt ? String(h.rishum_rishon_dt).slice(0, 10) : null,
    origin: owned(h.mkoriut_nm),
    testKm: typeof h.kilometer_test_aharon === 'number' && h.kilometer_test_aharon > 0 ? h.kilometer_test_aharon : null,
    changes,
    owners: owners
      .map(o => ({ date: ym(o.baalut_dt), type: owned(o.baalut) ?? '' }))
      .filter(o => o.date)
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
    newPrice: listed ? { price: listed.mehir as number, year: Number(listed.shnat_yitzur), importer: str(listed.shem_yevuan) } : null,
  }
}
