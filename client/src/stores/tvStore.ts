import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'st_tv_mode'

const TV_USER_AGENT = /smart-?tv|smarttv|googletv|google tv|android tv|firetv|fire tv|hbbtv|netcast|web0s|webos|tizen|bravia|viera|opera tv|roku|crkey|aft[0-9a-z]+/i

export function isTvUserAgent(userAgent: string): boolean {
  return TV_USER_AGENT.test(userAgent)
}

function storedPreference(): boolean | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value === '1') return true
    if (value === '0') return false
  } catch {
    // Storage can be unavailable in some TV browsers.
  }
  return null
}

function queryPreference(): boolean | null {
  try {
    const value = new URLSearchParams(window.location.search).get('tv')
    if (value === '1' || value === '0') {
      const enabled = value === '1'
      window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
      return enabled
    }
  } catch {
    // Ignore malformed URLs.
  }
  return null
}

function isLargeCoarsePointerScreen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const finePointer = window.matchMedia('(any-pointer: fine)').matches
  const coarsePointer = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  return !finePointer && coarsePointer && window.innerWidth >= 1_200
}

export function detectTvMode(): boolean {
  if (typeof window === 'undefined') return false
  const query = queryPreference()
  if (query !== null) return query

  const stored = storedPreference()
  if (stored !== null) return stored

  return isTvUserAgent(window.navigator.userAgent) || isLargeCoarsePointerScreen()
}

function applyTvMode(enabled: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('tv-mode', enabled)
  document.documentElement.dataset.tvMode = enabled ? 'true' : 'false'
}

export const useTvModeStore = defineStore('tvMode', () => {
  const enabled = ref(detectTvMode())
  const hintVisible = ref(false)
  let hintTimer: ReturnType<typeof setTimeout> | null = null

  applyTvMode(enabled.value)

  function setEnabled(value: boolean) {
    enabled.value = value
    applyTvMode(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
    } catch {
      // Keep the in-memory preference.
    }
    if (!value) hideHint()
  }

  function showHint(duration = 5_500) {
    if (!enabled.value) return
    hintVisible.value = true
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = setTimeout(() => {
      hintVisible.value = false
      hintTimer = null
    }, duration)
  }

  function hideHint() {
    if (hintTimer) clearTimeout(hintTimer)
    hintTimer = null
    hintVisible.value = false
  }

  return {
    enabled,
    hintVisible,
    setEnabled,
    showHint,
    hideHint,
  }
})
