import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const TURN_DURATION_MS = 90_000

export function useTurnClock() {
  const gameStore = useGameStore()
  const now = ref(Date.now())
  let timer: number | undefined

  const secondsLeft = computed(() => Math.max(
    0,
    Math.ceil((gameStore.turnStartedAt + TURN_DURATION_MS - now.value) / 1_000),
  ))

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
