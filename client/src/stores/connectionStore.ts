import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useConnectionStore = defineStore('connection', () => {
  const connected = ref(false)
  const disconnected = ref(false)
  const attempts = ref(0)
  const lastError = ref<string | null>(null)
  const blocked = ref(false)

  const showBanner = computed(() => disconnected.value && !connected.value)

  function setConnected(value: boolean) {
    connected.value = value
    if (value) {
      disconnected.value = false
      attempts.value = 0
      lastError.value = null
      blocked.value = false
    }
  }

  function setDisconnected(message: string | null = null, shouldBlock = false) {
    connected.value = false
    disconnected.value = true
    blocked.value = shouldBlock
    if (message) lastError.value = message
  }

  function clearBlocked() {
    blocked.value = false
  }

  function setReconnecting(attempt = attempts.value + 1) {
    connected.value = false
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
  }

  return {
    connected,
    disconnected,
    attempts,
    lastError,
    blocked,
    showBanner,
    setConnected,
    setDisconnected,
    setReconnecting,
    clearBlocked,
    setError,
    reset,
  }
})
