import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useConnectionStore = defineStore('connection', () => {
  const connected = ref(false)
  const disconnected = ref(false)
  const attempts = ref(0)
  const lastError = ref<string | null>(null)
  const blocked = ref(false)
  const rotating = ref(false)

  const showBanner = computed(() =>
    disconnected.value && !connected.value && !rotating.value
  )

  function setConnected(value: boolean) {
    connected.value = value
    if (value) {
      disconnected.value = false
      rotating.value = false
      attempts.value = 0
      lastError.value = null
      blocked.value = false
    }
  }

  function setDisconnected(message: string | null = null, shouldBlock = false) {
    connected.value = false
    disconnected.value = true
    rotating.value = false
    blocked.value = shouldBlock
    if (message) lastError.value = message
  }

  function setRotating(value: boolean) {
    rotating.value = value
    if (value) disconnected.value = false
  }

  function setAttempts(value: number) {
    attempts.value = value
  }

  function clearBlocked() {
    blocked.value = false
  }

  function setReconnecting(attempt = attempts.value + 1) {
    connected.value = false
    rotating.value = false
    disconnected.value = true
    attempts.value = attempt
  }

  function setError(message: string | null) {
    lastError.value = message
  }

  function reset() {
    connected.value = false
    disconnected.value = false
    attempts.value = 0
    lastError.value = null
    blocked.value = false
    rotating.value = false
  }

  return {
    connected,
    disconnected,
    attempts,
    lastError,
    blocked,
    rotating,
    showBanner,
    setConnected,
    setDisconnected,
    setRotating,
    setAttempts,
    setReconnecting,
    clearBlocked,
    setError,
    reset,
  }
})
