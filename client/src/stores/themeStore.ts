import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAudioStore } from '@/stores/audioStore'

export type ThemeId = 'neon' | 'pixel' | 'chalk'

export interface ThemeOption {
  id: ThemeId
  label: string
  description: string
  /** Three swatches shown in the picker: page, accent, second accent. */
  swatches: [string, string, string]
}

export const THEMES: ThemeOption[] = [
  {
    id: 'neon',
    label: 'Neón',
    description: 'Tubos de luz en una sala a oscuras',
    swatches: ['#0d0b1d', '#22e8ff', '#ff2e97'],
  },
  {
    id: 'pixel',
    label: 'Pixel',
    description: '8 bits: bordes duros y sonido chiptune',
    swatches: ['#262b44', '#feae34', '#2ce8f5'],
  },
  {
    id: 'chalk',
    label: 'Pizarra',
    description: 'Tiza de colores sobre un tablero verde',
    swatches: ['#283b35', '#ffe58a', '#ff9a9a'],
  },
]

const STORAGE_KEY = 'st_theme'

function getInitialTheme(): ThemeId {
  if (typeof window === 'undefined') return 'neon'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return THEMES.some(theme => theme.id === stored) ? (stored as ThemeId) : 'neon'
  } catch {
    return 'neon'
  }
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<ThemeId>(getInitialTheme())
  const audioStore = useAudioStore()

  function applyTheme(value: ThemeId) {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = value
    }
    audioStore.setStyle(value === 'pixel' ? 'chip' : 'soft')
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // Storage may be unavailable; the theme still applies for this visit.
    }
  }

  function setTheme(value: ThemeId) {
    theme.value = value
  }

  applyTheme(theme.value)
  watch(theme, applyTheme)

  return { theme, themes: THEMES, setTheme }
})
