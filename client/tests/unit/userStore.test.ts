import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUserStore } from '@/stores/userStore'

beforeEach(() => {
  window.localStorage.clear()
})

describe('browser user id', () => {
  it('creates a persistent id shared by future stores', () => {
    setActivePinia(createPinia())
    const first = useUserStore()
    const id = first.userId

    expect(id.length).toBeGreaterThan(5)
    expect(window.localStorage.getItem('st_user_id')).toBe(id)

    setActivePinia(createPinia())
    const second = useUserStore()
    expect(second.userId).toBe(id)
  })
})
