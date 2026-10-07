const KEY = 'car-records:name'

export function getLocalName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function storeLocalName(name: string) {
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: the name lasts for this visit only
  }
}
