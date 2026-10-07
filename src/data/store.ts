import type { Data, Table, Tables } from '../types'

export interface Store {
  mode: 'local' | 'cloud'
  loadAll(): Promise<Data>
  insert<T extends Table>(table: T, row: Tables[T]): Promise<void>
  update<T extends Table>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>
  remove(table: Table, id: string): Promise<void>
  /** Saves a file and returns a ref for fileUrl(). */
  upload(name: string, blob: Blob): Promise<string>
  fileUrl(ref: string): Promise<string>
}

export const emptyData = (): Data => ({ cars: [], readings: [], items: [], services: [], documents: [] })
