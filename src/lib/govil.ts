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

/** Manufacturer names come with a country suffix: "קיה ד. קוריאה" → "קיה". */
const cleanMake = (s: string) => s.split(/\s+/).filter(w => !w.includes('.') && !/יפן|קוריאה|גרמניה|צרפת|ארה"ב|סין|צ'כיה|ספרד|אנגליה|איטליה|טורקיה|הודו|תאילנד|רומניה|שוודיה|מכסיקו|סלובקיה|הונגריה|פולין|בלגיה|הולנד|אוסטריה|פורטוגל|דרום|אפריקה/.test(w)).join(' ') || s

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
