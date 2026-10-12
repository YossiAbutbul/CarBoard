// Real screenshots of the app for the ad: a fresh browser, filled with example data (three cars, a year of
// km, services, fuel and documents), then the phone screens the ad shows. Needs the dev server
// running (npm run dev in the app, port 5174, or set APP_URL).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const URL = process.env.APP_URL ?? 'http://localhost:5174/'
const OUT = new globalThis.URL('./public/shots/', import.meta.url)
mkdirSync(OUT, { recursive: true })
const out = name => new globalThis.URL(name, OUT).pathname.replace(/^\/([A-Z]:)/, '$1')

// ── example data ──
function exampleData() {
  const iso = d => d.toISOString().slice(0, 10)
  const T = new Date()
  const ago = days => iso(new Date(T - days * 864e5))
  const fwd = days => iso(new Date(+T + days * 864e5))
  const cars = [
    { id: 'c1', name: 'יונדאי i10', plate: '51-866-101', make: 'יונדאי', model: 'i10', year: 2019, color: 'כסוף', fuel: 'בנזין', tyres: null, image_url: null, yearly_km: 15000 },
    { id: 'c2', name: 'קיה פיקנטו', plate: '12-345-67', make: 'קיה', model: 'פיקנטו', year: 2021, color: 'אדום', fuel: 'בנזין', tyres: null, image_url: null },
    { id: 'c3', name: 'טויוטה קורולה', plate: '123-45-678', make: 'טויוטה', model: 'קורולה', year: 2023, color: 'לבן', fuel: 'היברידי', tyres: null, image_url: null },
  ]
  let n = 0
  const id = p => p + ++n
  const readings = [], items = [], services = [], documents = [], fuel = []
  const km0 = { c1: 108400, c2: 64200, c3: 23800 }, perDay = { c1: 38, c2: 30, c3: 45 }
  for (const c of cars) for (let d = 360; d >= 0; d -= 30) readings.push({ id: id('r'), car_id: c.id, km: Math.round(km0[c.id] - perDay[c.id] * d), date: ago(d), source: d === 360 ? 'start' : 'manual' })
  const it = (car, kind, label, every_km, every_months, due_km, due_date) => items.push({ id: id('i'), car_id: car, kind, label, every_km, every_months, due_km, due_date })
  it('c1', 'test', 'טסט (רישיון רכב)', null, 12, null, fwd(228))
  it('c1', 'insurance', 'ביטוח', null, 12, null, fwd(19))
  it('c1', 'service', 'טיפול תקופתי', 15000, 12, km0.c1 + 9000, fwd(240))
  it('c1', 'oil', 'החלפת שמן', 10000, null, km0.c1 + 800, null)
  it('c2', 'test', 'טסט (רישיון רכב)', null, 12, null, fwd(95))
  it('c2', 'insurance', 'ביטוח', null, 12, null, fwd(150))
  it('c2', 'service', 'טיפול תקופתי', 15000, 12, null, fwd(12))
  it('c3', 'test', 'טסט (רישיון רכב)', null, 12, null, fwd(300))
  it('c3', 'insurance', 'ביטוח', null, 12, null, fwd(210))
  const sv = (car, type, title, d, km, price, garage) => services.push({ id: id('s'), car_id: car, type, title, date: ago(d), km, price, garage, notes: null, receipt: null })
  sv('c1', 'service', 'טיפול 105,000', 120, 103800, 1450, 'מוסך אבי, חולון')
  sv('c1', 'oil', 'החלפת שמן', 120, 103800, 320, 'מוסך אבי, חולון')
  sv('c1', 'tyres', '2 צמיגים קדמיים', 210, 100300, 780, 'צמיגי השרון')
  sv('c1', 'battery', 'מצבר חדש', 300, 97000, 540, 'מוסך אבי, חולון')
  sv('c1', 'brakes', 'רפידות בלמים', 400, 93500, 460, 'מוסך אבי, חולון')
  const doc = (car, kind, title, provider, number, expiry) => documents.push({ id: id('d'), car_id: car, kind, title, provider, number, expiry, files: [] })
  doc('c1', 'licence', 'רישיון רכב', null, '51866101', fwd(228))
  doc('c1', 'insurance', 'ביטוח חובה ומקיף', 'הראל', 'POL-883421', fwd(19))
  doc('c1', 'driver', 'רישיון נהיגה', null, '7712093', fwd(1400))
  const stations = ['פז, חולון', 'דלק, ראשון לציון', 'סונול, בת ים', 'Ten, אזור']
  for (const c of cars) {
    let k = km0[c.id] - perDay[c.id] * 180
    for (let d = 180; d >= 2; d -= 9) {
      const l = 28 + (d % 7)
      const p = 7.2 + ((d % 5) - 2) * 0.08
      k += perDay[c.id] * 9
      fuel.push({ id: id('f'), car_id: c.id, date: ago(d), time: `${8 + (d % 11)}:${String((d * 7) % 60).padStart(2, '0')}`, liters: l, price: Math.round(l * p * 100) / 100, km: Math.round(k), station: stations[d % 4], full: true })
    }
  }
  return { cars, readings, items, services, documents, fuel }
}

const prevMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}
const week = Math.floor(Date.now() / (7 * 86_400_000))

async function seeded(browser, viewport, scale) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, locale: 'he-IL', isMobile: viewport.width < 768, hasTouch: viewport.width < 768 })
  await ctx.addInitScript(
    ({ month, week }) => {
      localStorage.setItem('car-records:guest', '1')
      localStorage.setItem('car-records:onboarded', '1')
      localStorage.setItem('car-records:name', 'יוסי')
      localStorage.setItem('car-records:summary-seen', month)
      localStorage.setItem('car-records:install-later', String(Date.now()))
      for (const c of ['c1', 'c2', 'c3']) localStorage.setItem(`car-records:confirm:${c}:${week}`, '1')
    },
    { month: prevMonth(), week },
  )
  const page = await ctx.newPage()
  await page.goto(URL)
  await page.waitForTimeout(1500)
  // the app's own store (idb-keyval): one database, one table, the data under one key
  await page.evaluate(async data => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('keyval-store')
      r.onupgradeneeded = () => r.result.createObjectStore('keyval')
      r.onsuccess = () => res(r.result)
      r.onerror = rej
    })
    await new Promise(res => {
      const t = db.transaction('keyval', 'readwrite')
      t.objectStore('keyval').put(data, 'car-records:data')
      t.oncomplete = res
    })
  }, exampleData())
  await page.reload()
  await page.waitForTimeout(2600) // splash, then the numbers count up
  return { ctx, page }
}

const tab = async (page, label, sel = '.nav button') => {
  await page.locator(sel, { hasText: label }).first().click()
  await page.waitForTimeout(1600)
}

const browser = await chromium.launch()

// the three phone screens the ad shows
{
  const { ctx, page } = await seeded(browser, { width: 390, height: 844 }, 3)
  await page.screenshot({ path: out('phone-home.png') })
  await tab(page, 'דלק')
  await page.screenshot({ path: out('phone-fuel.png') })
  await tab(page, 'מסמכים')
  await page.screenshot({ path: out('phone-docs.png') })
  await ctx.close()
}

await browser.close()
console.log('shots saved')
