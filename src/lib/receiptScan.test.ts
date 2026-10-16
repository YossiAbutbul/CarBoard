import { describe, expect, it } from 'vitest'
import { parseFuelReceipt, readFuel } from './receiptScan'

// what Tesseract read from a real Sonol receipt (a PDF from the station's app), OCR slips included
const SONOL = `מסמך ממוחשב
סונול
ספר'נט מוטורס בע"מ
צומת אליקים
טלפו|: .
ח"פ: 511375032
משמרת: 0915-1 סנ'ף: 195
חשבונית מס/קבלה:
195652556
09:19:50 16/09/26
מועדו|: 408
מספר : 2)08ס**ל*ל לא א א א א
בתוקף עד: 31/02
מספר רכב: 51866101
מחיר לליטר: 7.75
מס מתדלק: 98 0915-1
מס פיה : 03
מוצר ‎NInd‏ סהכ
גולד 95 30.849 239.08
סהכ ללא מעמ: 202.61
סהכ מעמ 18.00: 36.47
סהכ בשח: 239.08
מספר שובר: 54020963`

describe('fuel receipt', () => {
  it('reads liters, price per liter, total, date and station from a real receipt', () => {
    expect(parseFuelReceipt(SONOL)).toEqual({ liters: 30.849, perLiter: 7.75, total: 239.08, date: '2026-09-16', time: '09:19', station: 'סונול' })
  })

  it('finds the numbers by liters × price = total, whatever the lines are called', () => {
    const r = parseFuelReceipt('PAZ\n12.03.2026\nקוד 7\n42,15 x 6,98\nלתשלום 294,21\nכרטיס 4580')
    expect(r).toMatchObject({ liters: 42.15, perLiter: 6.98, total: 294.21, date: '2026-03-12' })
  })

  it('without a match, falls back on the labels', () => {
    const r = parseFuelReceipt('מחיר לליטר: 7.10\nסה"כ: 300.00')
    expect(r.perLiter).toBe(7.1)
    expect(r.total).toBe(300)
    expect(r.liters).toBe(42.25)
  })

  // a photo of a paper receipt, half in shadow: the liters line came out garbled
  it('ignores small numbers that fit by chance, and reads "כמות" and "תעריף"', () => {
    const PHOTO = `דלק שלי אנרגיה
טלפון: 054-2229112
14/10/2026 19:00
מסוף אשראי: 1724301015
גרסת אשראי: 01.06.86
ק"מ: 000001
מוצר: בנזין 95 משאבה:03
כמות: 83-21 ליטר
תעריף: 7.530 ש"ח/ליטר 0
סכום: 250.12 ש"ח .
סה"כ: 250.12 m'"ow :
ללא מעמ: 211.97 ש"ח 4
סה"כ: 2 מ"ח .5`
    expect(parseFuelReceipt(PHOTO)).toEqual({ liters: 33.22, perLiter: 7.53, total: 250.12, date: '2026-10-14', time: '19:00', station: 'דלק שלי אנרגיה' })
  })

  it('takes the liters line when it reads well', () => {
    const r = parseFuelReceipt('כמות: 33.217 ליטר\nתעריף: 7.530\nסה"כ: 250.12')
    expect(r).toMatchObject({ liters: 33.217, perLiter: 7.53, total: 250.12 })
  })

  it('reads other stations: their own names for each line', () => {
    // Paz-style: "כמות (ליטר)", "מחיר ליח'", "סה"כ לתשלום"
    expect(parseFuelReceipt('פז\n01/08/2026 07:45\nכמות (ליטר): 41.36\nמחיר ליח\': 7.21\nסה"כ לתשלום: 298.21')).toMatchObject({ liters: 41.36, perLiter: 7.21, total: 298.21, station: 'פז', time: '07:45' })
    // English labels, the total in ₪ before the number
    expect(parseFuelReceipt('Ten\nDate 03.02.26\nQty 25.10 L\nPrice 7.40\nTotal ₪ 185.74')).toMatchObject({ liters: 25.1, perLiter: 7.4, total: 185.74, station: 'טן', date: '2026-02-03' })
  })

  it('reads numbers by their units, without labels', () => {
    expect(parseFuelReceipt('דור אלון\n33.217 ליטר\n7.530 ש"ח/ליטר\n250.12')).toMatchObject({ liters: 33.217, perLiter: 7.53, total: 250.12, station: 'דור אלון' })
  })

  it('works the total out from the VAT lines when its own line is unreadable', () => {
    const r = parseFuelReceipt('תעריף: 7.530\nסה"כ: 2?0.1?\nללא מעמ: 211.97\nמעמ % 18.0 : 38.15')
    expect(r).toMatchObject({ perLiter: 7.53, total: 250.12, liters: 33.22 })
  })

  it('knows when the numbers check out, so a photo is read again only when they do not', () => {
    expect(readFuel('כמות: 33.217\nתעריף: 7.530\nסה"כ: 250.12').sure).toBe(true)
    expect(readFuel('כמות: 83-21\nתעריף: 7.530\nסה"כ: 250.12').sure).toBe(false)
  })

  // what the phone read from the photo of the same paper receipt: a pale 3 read as 8, the 7 of the price as 0
  it('fixes look-alike digits, so liters × price = total again', () => {
    const r = parseFuelReceipt('דלק שלי אנרגיה\n14/10/2026 19:00\nכמות: 83.217 ליטר\nתעריף: 0.530 ש"ח/ליטר\nסה"כ: 250.12 ש"ח')
    expect(r).toMatchObject({ liters: 33.217, perLiter: 7.53, total: 250.12, station: 'דלק שלי אנרגיה' })
  })

  it('never shows a price no liter costs: without a readable price, liters and price are left to fill in', () => {
    const r = parseFuelReceipt('כמות: 83.217 ליטר\nסה"כ: 250.12')
    expect(r).toMatchObject({ liters: null, perLiter: null, total: 250.12 })
  })

  it('tries each total the receipt gives: a misread total line, then the VAT lines', () => {
    // the total line came out as "250-112", another "total" as 172; before VAT 211.97 + 18% = 250.12
    const r = parseFuelReceipt('כמות: 33.217 קפשר\nתעריף: 0.530 ש"ח/ליטר\nסכות: 250-112 ש"ח\nסה"כ: 172 שש"ח\nללא מעמ: 211.97 ש"ח\nnon % 18.0 : 39.15 שי\nסה"כ: 2 ₪"ח\nתודה שתדלקתם')
    expect(r).toMatchObject({ liters: 33.217, perLiter: 7.53, total: 250.12 })
  })

  it('finds the station as a word of its own, not inside "שתדלקתם"', () => {
    expect(parseFuelReceipt('ורס שסף\nסה"כ: 250.12\nתודה שתדלקתם').station).toBeNull()
  })

  // the phone's reading: the price line lost, a pale 3 read as 8, and the pump number "03" on the slip
  it('never takes the pump number for the price (83.217 × 3 ≈ 250.12 is a chance fit)', () => {
    const r = parseFuelReceipt('דלק שלי אנרגיה\n14/10/2026 19:00\nגרסת אשראי: 01.06.86\nמוצר: בנזין 95 משאבה:03\nכמות: 83.217 ליטר\nתעריף: ‏ ש"ח/ליטר\nסכום: 250.12 ש"ח\nסה"כ: 250.12 ש"ח\nללא מעמ: 211.97 ש"ח')
    expect(r.perLiter).toBeNull()
    expect(r.liters).toBeNull()
    expect(r.total).toBe(250.12)
  })
})
