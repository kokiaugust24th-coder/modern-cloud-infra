import { describe, expect, it } from 'vitest'
import { formatDisplayName } from '../format'

describe('formatDisplayName', () => {
  it('trims and collapses whitespace', () => {
    expect(formatDisplayName('  Koki   August  ')).toBe('Koki August')
  })

  it('leaves an already-clean string unchanged', () => {
    expect(formatDisplayName('Koki August')).toBe('Koki August')
  })
})
