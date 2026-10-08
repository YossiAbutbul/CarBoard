import { describe, expect, it } from 'vitest'
import { parseFuelReceipt } from './receiptScan'

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
})
