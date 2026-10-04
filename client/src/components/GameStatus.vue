<template>
  <Transition name="overlay">
    <div v-if="store.isGameOver" class="overlay">
      <div class="overlay__card">
        <div class="overlay__topline">
          <span class="overlay__eyebrow">Resultado de la ronda</span>
          <span class="overlay__spark" aria-hidden="true">✦</span>
        </div>

        <div v-if="store.winResult" class="overlay__winner">
          <div class="overlay__winner-mark" :style="{ '--wc': winnerColor }" aria-hidden="true">
            <span>★</span>
          </div>
          <p class="overlay__kicker">Victoria para</p>
          <div class="overlay__badge">{{ winnerName }}</div>
          <h2 class="overlay__title">¡Gana!</h2>
          <p class="overlay__condition">{{ conditionLabel }}</p>
        </div>

        <div v-else class="overlay__draw">
          <div class="overlay__draw-mark" aria-hidden="true">=</div>
          <p class="overlay__kicker">Partida completada</p>
          <h2 class="overlay__title">Empate</h2>
          <p class="overlay__condition">No quedan movimientos posibles</p>
        </div>

        <div class="overlay__divider" />
        <button v-if="canRematch" class="overlay__btn" @click="emit('rematch')">
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
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'

const store     = useGameStore()
const roomStore = useRoomStore()
const emit = defineEmits<{ rematch: [] }>()

const canRematch = computed(() => !roomStore.roomId || roomStore.mySlot === roomStore.hostSlot)

const hostName = computed(() =>
  roomStore.players.find(player => player.slot === 1)?.username ?? 'el creador'
)

const winnerColor = computed(() => {
  if (!store.winResult) return ''
  return store.playerMeta[store.winResult.winner]?.color ?? '#fff'
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
  }
  return store.winResult ? labels[store.winResult.condition] : ''
})

</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  backdrop-filter: blur(6px);
}

.overlay__card {
  position: relative;
  overflow: hidden;
  background: var(--cell-bg);
  border: 1px solid var(--cell-border);
  border-radius: 26px;
  padding: 26px 34px 28px;
  text-align: center;
  box-shadow: var(--shadow-card), var(--shadow-glow);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: min(390px, calc(100vw - 32px));
}

.overlay__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 3px;
  border-radius: 0 0 10px 10px;
  background: var(--gradient-brand);
}

.overlay__topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 12px;
}

.overlay__eyebrow,
.overlay__kicker {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1.8px;
  text-transform: uppercase;
}

.overlay__spark {
  color: var(--accent-secondary);
  font-size: 22px;
  line-height: 1;
}

.overlay__winner {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.overlay__winner-mark {
  display: grid;
  place-items: center;
  width: 78px;
  height: 78px;
  margin: 2px auto 14px;
  border: 1px solid var(--wc);
  border-radius: 22px;
  background: linear-gradient(135deg, var(--wc), var(--accent-secondary));
  box-shadow: 0 0 26px color-mix(in srgb, var(--wc) 42%, transparent);
  color: var(--text-on-accent);
  transform: rotate(-6deg);
}

.overlay__winner-mark span {
  font-size: 34px;
  line-height: 1;
  transform: rotate(6deg);
}

.overlay__badge {
  display: inline-block;
  max-width: 290px;
  margin-top: 5px;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overlay__title {
  margin: 0;
  font-size: 42px;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1.05;
  letter-spacing: -1px;
}

.overlay__condition {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.overlay__draw h2 {
  font-size: 42px;
  font-weight: 900;
  color: var(--text-primary);
  margin: 0;
}

.overlay__draw {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.overlay__draw-mark {
  display: grid;
  place-items: center;
  width: 78px;
  height: 78px;
  margin: 2px auto 14px;
  border: 1px solid var(--accent-secondary);
  border-radius: 22px;
  background: var(--surface-raised);
  color: var(--accent-secondary);
  font-size: 34px;
  font-weight: 900;
  box-shadow: var(--shadow-glow);
  transform: rotate(6deg);
}

.overlay__divider {
  width: 100%;
  height: 1px;
  margin: 16px 0 8px;
  background: var(--line-soft);
}

.overlay__btn {
  margin-top: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 30px;
  background: var(--gradient-brand);
  color: var(--text-on-accent);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
}
.overlay__btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  filter: brightness(1.08);
}

.overlay__btn span { font-size: 20px; line-height: 0.8; }

.overlay__waiting {
  width: 100%;
  margin: 8px 0 0;
  padding: 12px 14px;
  border: 1px dashed var(--cell-border);
  border-radius: 12px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.overlay__waiting strong { color: var(--accent-primary); }

@media (max-width: 420px) {
  .overlay__card { padding: 24px 22px; }
  .overlay__title, .overlay__draw h2 { font-size: 36px; }
}

.overlay-enter-active, .overlay-leave-active { transition: opacity 0.25s ease; }
.overlay-enter-from,  .overlay-leave-to      { opacity: 0; }
</style>
