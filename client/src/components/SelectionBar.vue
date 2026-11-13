<template>
  <Transition name="selection-bar">
    <div
      v-if="selectedPiece"
      class="selection-bar"
      :class="{ 'selection-bar--warn': store.selectionHint }"
      role="status"
      aria-live="polite"
      :style="{ '--piece-tone': playerColor, '--piece-color': playerColor }"
    >
      <span class="selection-bar__well" aria-hidden="true">
        <span
          :key="selectedPiece.size"
          class="selection-bar__piece st-ring"
          :class="[`st-ring--${selectedPiece.size}`, `selection-bar__piece--${selectedPiece.size}`]"
        />
      </span>
      <span class="selection-bar__copy">
        <strong>{{ sizeLabel }}</strong>
        <small :class="{ 'selection-bar__warning': store.selectionHint }">
          {{ store.selectionHint ?? 'Toca una casilla iluminada para colocarla.' }}
        </small>
      </span>
      <button class="selection-bar__cancel" type="button" @click="store.clearSelection">
        <kbd v-if="hasKeyboard" class="st-kbd">Esc</kbd>
        Cancelar
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()
const hasKeyboard = typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)

const selectedPiece = computed(() => store.selectedPiece)
const playerColor = computed(() =>
  selectedPiece.value ? store.playerMeta[selectedPiece.value.player]?.color ?? 'var(--accent-primary)' : ''
)
const sizeLabel = computed(() => {
  const labels = { large: 'Ficha grande', medium: 'Ficha mediana', small: 'Ficha pequeña' }
  return selectedPiece.value ? labels[selectedPiece.value.size] : ''
})
</script>

<style scoped>
.selection-bar {
  position: fixed;
  z-index: 220;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(440px, calc(100vw - 24px));
  padding: 8px 8px 8px 8px;
  border: 1px solid color-mix(in srgb, var(--piece-tone) 50%, var(--line-soft));
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-raised) 88%, transparent);
  backdrop-filter: blur(14px);
  box-shadow: var(--shadow-card), 0 0 40px -12px var(--piece-tone);
  transform: translateX(-50%);
}

.selection-bar--warn {
  border-color: var(--accent-danger);
  animation: st-shake 0.4s ease;
}

.selection-bar__well {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--cell-bg);
  box-shadow: inset 0 2px 5px var(--groove);
}

.selection-bar__piece {
  animation: bar-piece-in 0.35s var(--ease-snap);
}

.selection-bar__piece--large { width: 38px; height: 38px; }
.selection-bar__piece--medium { width: 27px; height: 27px; }
.selection-bar__piece--small { width: 14px; height: 14px; }

@keyframes bar-piece-in {
  from { opacity: 0; transform: scale(0.5) rotate(-40deg); }
}

.selection-bar__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
  color: var(--text-secondary);
  line-height: 1.25;
}

.selection-bar__copy strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
}

.selection-bar__copy small { font-size: 12px; }
.selection-bar__warning { color: var(--accent-danger); font-weight: 700; }

.selection-bar__cancel {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--line-strong);
  border-radius: 999px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: background 0.15s ease;
}

.selection-bar__cancel:hover,
.selection-bar__cancel:active { background: var(--control-hover); }

.selection-bar-enter-active,
.selection-bar-leave-active { transition: opacity 0.22s ease, transform 0.3s var(--ease-spring); }
.selection-bar-enter-from,
.selection-bar-leave-to { opacity: 0; transform: translate(-50%, 24px) scale(0.95); }

@media (max-width: 420px) {
  .selection-bar { gap: 9px; }
  .selection-bar__copy small:not(.selection-bar__warning) { display: none; }
}
</style>
