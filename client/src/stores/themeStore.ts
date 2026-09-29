import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type ThemeId = 'neon' | 'sunset'

export const THEMES: Array<{ id: ThemeId; label: string; icon: string }> = [
  { id: 'neon', label: 'Neon Arcade', icon: '✦' },
  { id: 'sunset', label: 'Sunset Pop', icon: '◒' },
]

const STORAGE_KEY = 'st_theme'

function getInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'neon'
  return window.localStorage.getItem(STORAGE_KEY) === 'sunset' ? 'sunset' : 'neon'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeId>(getInitialTheme())

  function applyTheme(value: ThemeId) {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = value
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  }

  function setTheme(value: ThemeId) {
    theme.value = value
  }

  applyTheme(theme.value)
  watch(theme, applyTheme)

  return { theme, themes: THEMES, setTheme }
})
