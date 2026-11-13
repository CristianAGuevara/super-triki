<template>
  <Transition name="overlay">
    <div v-if="store.isGameOver" class="overlay">
      <div class="overlay__card" :style="{ '--wc': winnerColor || 'var(--accent-secondary)', '--piece-color': winnerColor }">
        <span class="st-eyebrow">Resultado de la ronda</span>

        <div v-if="store.winResult" class="overlay__winner">
          <div class="overlay__winner-mark" aria-hidden="true">
            <span class="st-ring st-ring--large overlay__ring overlay__ring--large" />
            <span class="st-ring st-ring--medium overlay__ring overlay__ring--medium" />
            <span class="st-ring st-ring--small overlay__ring overlay__ring--small" />
          </div>
          <h2 class="overlay__title">{{ winnerName }}</h2>
          <p class="overlay__condition">{{ conditionLabel }}</p>
        </div>

        <div v-else class="overlay__winner">
          <div class="overlay__draw-mark" aria-hidden="true">=</div>
          <h2 class="overlay__title">Empate</h2>
          <p class="overlay__condition">No quedan movimientos posibles</p>
        </div>

        <button v-if="isTournament" class="st-btn overlay__btn" @click="goToTournament">
          Volver al torneo
        </button>
        <button v-else-if="canRematch" class="st-btn overlay__btn" @click="emit('rematch')">
          <span aria-hidden="true">↻</span>
          Jugar de nuevo
        </button>
        <p v-else class="overlay__waiting">
          Esperando a <strong>{{ hostName }}</strong> para iniciar otra partida…
        </p>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const store     = useGameStore()
const roomStore = useRoomStore()
const router    = useRouter()
const emit = defineEmits<{ rematch: [] }>()

const isTournament = computed(() => Boolean(roomStore.tournament))
const canRematch = computed(() =>
  !isTournament.value && (!roomStore.roomId || roomStore.mySlot === roomStore.hostSlot)
)

function goToTournament() {
  if (roomStore.tournament) void router.push(`/tournament/${roomStore.tournament.id}`)
}

const hostName = computed(() =>
  roomStore.players.find(player => player.slot === 1)?.username ?? 'el creador'
)

const winnerColor = computed(() => {
  if (!store.winResult) return ''
  return store.playerMeta[store.winResult.winner]?.color ?? 'var(--accent-primary)'
})

const winnerName = computed(() => {
  if (!store.winResult) return ''
  const slot = store.winResult.winner
  // Use actual username in multiplayer
  if (roomStore.roomId) {
    return roomStore.players.find(p => p.slot === slot)?.username
      ?? store.playerMeta[slot]?.label
  }
  return store.playerMeta[slot]?.label ?? `Jugador ${slot}`
})

const conditionLabel = computed(() => {
  const labels = {
    'same-size':        'Tres piezas del mismo tamaño en línea',
    'ordered-sequence': 'Secuencia ordenada en línea',
    'complete-cell':    '¡Casilla completa!',
    'timeout':          'Tiempo agotado',
  }
  return store.winResult ? labels[store.winResult.condition] : ''
})

</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--overlay-bg);
  backdrop-filter: blur(8px);
}

.overlay__card {
  display: flex;
  width: min(400px, calc(100vw - 32px));
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 28px 28px 26px;
  border: 1px solid color-mix(in srgb, var(--wc) 40%, var(--line-soft));
  border-radius: var(--radius-l);
  background: var(--surface);
  box-shadow: var(--shadow-card), 0 0 60px -14px var(--wc);
  text-align: center;
  animation: st-pop-in 0.45s var(--ease-spring) both;
}

.overlay__winner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.overlay__winner-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  margin-bottom: 6px;
}

.overlay__ring { position: absolute; }
.overlay__ring--large { width: 84px; height: 84px; }
.overlay__ring--medium { width: 52px; height: 52px; }
.overlay__ring--small { width: 22px; height: 22px; }

.overlay__draw-mark {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin-bottom: 6px;
  border: 2px dashed var(--line-strong);
  border-radius: 50%;
  color: var(--text-secondary);
  font-family: var(--font-display);
  font-size: 36px;
  font-weight: 800;
}

.overlay__title {
  max-width: 100%;
  color: var(--text-primary);
  font-size: clamp(30px, 8vw, 42px);
  overflow-wrap: anywhere;
}

.overlay__condition {
  color: var(--text-secondary);
  font-size: 14px;
}

.overlay__btn { width: 100%; margin-top: 6px; }

.overlay__waiting {
  width: 100%;
  margin-top: 6px;
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-s);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.45;
}

.overlay__waiting strong { color: var(--text-primary); }

.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
