export type ItemKind = 'service' | 'oil' | 'tyres' | 'brakes' | 'battery' | 'test' | 'insurance' | 'custom'
export type ReadingSource = 'start' | 'manual' | 'confirm' | 'photo' | 'service'
export type DocKind = 'licence' | 'insurance' | 'driver' | 'other'
/** 'car' | 'suv' | 'pickup' | 'van'; the others are older saved values that show as 'car'. */
export type BodyType = 'car' | 'suv' | 'van' | 'pickup' | 'small' | 'family' | 'sport'

export interface Car {
  id: string
  name: string
  plate: string
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  fuel: string | null
  tyres: string | null
  image_url: string | null
  body?: BodyType | null // avatar body type; null = guess from the model
  paint?: string | null // avatar colour (hex); null = from the registry colour
}

export interface Reading {
  id: string
  car_id: string
  km: number
  date: string // YYYY-MM-DD
  source: ReadingSource
}

export interface Item {
  id: string
  car_id: string
  kind: ItemKind
  label: string
  every_km: number | null
  every_months: number | null
  due_km: number | null
  due_date: string | null
}

export interface ServiceRecord {
  id: string
  car_id: string
  type: ItemKind
  title: string
  date: string
  km: number
  price: number | null
  garage: string | null
  notes: string | null
  receipt: string | null
}

export interface CarDocument {
  id: string
  car_id: string
  kind: DocKind
  title: string
  provider: string | null
  number: string | null
  expiry: string | null
  files: string[]
}

export interface Tables {
  cars: Car
  readings: Reading
  items: Item
  services: ServiceRecord
  documents: CarDocument
}
export type Table = keyof Tables
export type Data = { [K in Table]: Tables[K][] }
