import { describe, expect, it } from 'vitest'
import { isTvUserAgent } from '@/stores/tvStore'

describe('TV detection', () => {
  it('recognizes common smart TV platforms', () => {
    expect(isTvUserAgent('Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36')).toBe(true)
    expect(isTvUserAgent('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36')).toBe(true)
    expect(isTvUserAgent('Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36')).toBe(true)
    expect(isTvUserAgent('Mozilla/5.0 (Linux; Android 11; BRAVIA 4K GB ATV3) AppleWebKit/537.36')).toBe(true)
  })

  it('does not mark normal desktop browsers as TV', () => {
    expect(isTvUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36')).toBe(false)
    expect(isTvUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15')).toBe(false)
  })
})
