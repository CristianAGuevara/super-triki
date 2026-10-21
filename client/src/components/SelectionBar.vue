<template>
  <Transition name="selection-bar">
    <div
      v-if="selectedPiece"
      class="selection-bar"
      role="status"
      aria-live="polite"
      :style="{ '--piece-tone': playerColor }"
    >
      <span
        class="selection-bar__piece"
        :class="`selection-bar__piece--${selectedPiece.size}`"
        aria-hidden="true"
      />
      <span class="selection-bar__copy">
        <strong>{{ sizeLabel }} seleccionada</strong>
        <small :class="{ 'selection-bar__warning': store.selectionHint }">
          {{ store.selectionHint ?? 'Toca una casilla resaltada para colocarla.' }}
        </small>
      </span>
      <button class="selection-bar__cancel" type="button" @click="store.clearSelection">
        Cancelar
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'

const store = useGameStore()

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
  bottom: max(14px, env(safe-area-inset-bottom));
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(460px, calc(100vw - 24px));
  padding: 10px 10px 10px 14px;
  border: 1px solid color-mix(in srgb, var(--piece-tone) 55%, var(--line-soft));
  border-radius: 16px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card), var(--shadow-glow);
  transform: translateX(-50%);
}

.selection-bar__piece {
  flex: 0 0 auto;
  border: 4px solid var(--piece-tone);
  border-radius: 50%;
  box-shadow: 0 0 10px color-mix(in srgb, var(--piece-tone) 55%, transparent);
}

.selection-bar__piece--large { width: 42px; height: 42px; border-width: 6px; }
.selection-bar__piece--medium { width: 32px; height: 32px; border-width: 5px; }
.selection-bar__piece--small { width: 24px; height: 24px; border-width: 0; background: var(--piece-tone); }

.selection-bar__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
  color: var(--text-secondary);
  line-height: 1.25;
}

.selection-bar__copy strong { color: var(--text-primary); font-size: 13px; }
.selection-bar__copy small { font-size: 11px; }
.selection-bar__warning { color: var(--accent-danger); font-weight: 700; }

.selection-bar__cancel {
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--cell-border);
  border-radius: 10px;
  background: var(--control-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.selection-bar__cancel:active { background: var(--control-hover); }

.selection-bar-enter-active,
.selection-bar-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.selection-bar-enter-from,
.selection-bar-leave-to { opacity: 0; transform: translate(-50%, 10px); }

@media (max-width: 420px) {
  .selection-bar { gap: 9px; padding-left: 10px; }
  .selection-bar__copy small:not(.selection-bar__warning) { display: none; }
}
</style>
