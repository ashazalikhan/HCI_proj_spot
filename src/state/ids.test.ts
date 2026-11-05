import { afterEach, describe, expect, it, vi } from 'vitest'
import { createId } from './ids'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createId', () => {
  it('uses randomUUID when it exists', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-from-crypto' })
    expect(createId()).toBe('uuid-from-crypto')
  })

  it('falls back when randomUUID is missing', () => {
    vi.stubGlobal('crypto', {})
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
