import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'st_username'
const USER_ID_KEY = 'st_user_id'

function createUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function getOrCreateUserId(): string {
  try {
    const existing = localStorage.getItem(USER_ID_KEY)?.trim()
    if (existing && existing.length >= 6 && existing.length <= 128) return existing
    const created = createUserId()
    localStorage.setItem(USER_ID_KEY, created)
    return created
  } catch {
    return createUserId()
  }
}

export const useUserStore = defineStore('user', () => {
  const username = ref<string | null>(localStorage.getItem(STORAGE_KEY))
  const userId = ref(getOrCreateUserId())

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (event.key !== USER_ID_KEY || !event.newValue) return
      const synced = event.newValue.trim()
      if (synced.length >= 6 && synced.length <= 128) userId.value = synced
    })
  }

  function setUsername(name: string) {
    username.value = name.trim()
    localStorage.setItem(STORAGE_KEY, username.value)
  }

  function clearUsername() {
    username.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { username, userId, setUsername, clearUsername }
})
