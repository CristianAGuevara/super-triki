import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const TURN_DURATION_MS = 90_000

export function useTurnClock(isPaused: () => boolean = () => false) {
  const gameStore = useGameStore()
  const now = ref(Date.now())
  const pausedSeconds = ref<number | null>(null)
  let timer: number | undefined

  const calculateRemaining = () => Math.max(
    0,
    Math.ceil((gameStore.turnStartedAt + TURN_DURATION_MS - now.value) / 1_000),
  )

  watch(isPaused, paused => {
    if (paused) pausedSeconds.value = calculateRemaining()
    else pausedSeconds.value = null
  }, { immediate: true, flush: 'sync' })

  watch(() => gameStore.turnStartedAt, () => {
    if (isPaused()) pausedSeconds.value = calculateRemaining()
  }, { flush: 'sync' })

  const secondsLeft = computed(() => pausedSeconds.value ?? calculateRemaining())

  const formattedTime = computed(() => {
    const minutes = Math.floor(secondsLeft.value / 60)
    const seconds = secondsLeft.value % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  })

  onMounted(() => {
    timer = window.setInterval(() => { now.value = Date.now() }, 250)
  })

  onUnmounted(() => {
    if (timer !== undefined) window.clearInterval(timer)
  })

  return { secondsLeft, formattedTime }
}
