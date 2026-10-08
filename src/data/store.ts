import type { Data, Table, Tables } from '../types'

export interface FamilyMember {
  uid: string
  name: string
}
export interface Family {
  id: string
  owner: string // who made it
  me: string
  members: FamilyMember[]
}
/** Sharing cars with family (cloud only). */
export interface FamilyApi {
  current(): Family | null
  create(name: string): Promise<void>
  invite(name: string): Promise<string> // an invite code, valid 7 days
  peek(code: string): Promise<{ family: string; name: string } | null> // who invited, if the code is valid
  join(code: string, name: string): Promise<void>
  leave(): Promise<void>
  rename(name: string): Promise<void>
}

export interface Store {
  mode: 'local' | 'cloud'
  userId?: string
  family?: FamilyApi
  /** False for a row of another family member (it is not deleted by "reset my data"). */
  owns?(table: Table, id: string): boolean
  loadAll(): Promise<Data>
  insert<T extends Table>(table: T, row: Tables[T]): Promise<void>
  update<T extends Table>(table: T, id: string, patch: Partial<Tables[T]>): Promise<void>
  remove(table: Table, id: string): Promise<void>
  /** Saves a file and returns a ref for fileUrl(). */
  upload(name: string, blob: Blob): Promise<string>
  fileUrl(ref: string): Promise<string>
  /** Deletes one uploaded file. */
  removeFile?(ref: string): Promise<void>
  /** Deletes every uploaded file (used by the reset in settings). */
  wipeFiles?(): Promise<void>
}

export const emptyData = (): Data => ({ cars: [], readings: [], items: [], services: [], documents: [] })
