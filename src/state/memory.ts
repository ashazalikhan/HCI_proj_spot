import type { KeyValueStore } from './storage'

export function createMemoryStorage(options?: {
  initial?: Record<string, string>
  throwOnGet?: boolean
  throwOnSet?: boolean
}): KeyValueStore & { snapshot: () => Record<string, string>; setCount: () => number } {
  const map = new Map(Object.entries(options?.initial ?? {}))
  let writes = 0
  return {
    get length() {
      return map.size
    },
    key(index: number) {
      return [...map.keys()][index] ?? null
    },
    getItem(key: string) {
      if (options?.throwOnGet) throw new Error('blocked')
      return map.has(key) ? (map.get(key) ?? null) : null
    },
    setItem(key: string, value: string) {
      if (options?.throwOnSet) throw new Error('quota')
      writes += 1
      map.set(key, value)
    },
    removeItem(key: string) {
      map.delete(key)
    },
    snapshot: () => Object.fromEntries(map),
    setCount: () => writes,
  }
}
