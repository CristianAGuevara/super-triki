<template>
  <div
    ref="pieceElement"
    v-draggable="dragPayload"
    class="piece st-ring"
    :class="[
      `piece--${piece.size}`,
      `st-ring--${piece.size}`,
      `piece--player${piece.player}`,
      {
        'piece--inventory': inInventory,
        'piece--entry-hidden': entryAnimating,
        'piece--last-move-pulse': lastMoveActive,
        'piece--last': highlightLastMove && !entryAnimating,
      },
    ]"
    :style="pieceStyle"
    :title="`${sizeName} (J${piece.player})`"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Piece, PieceEntrySource, DragPayload } from '@/types/game'
import { useGameStore } from '@/stores/gameStore'
import { vDraggable } from '@/directives/vDraggable'

const props = defineProps<{
  piece: Piece
  inInventory?: boolean
  animateEntry?: boolean
  entryFrom?: PieceEntrySource | null
  highlightLastMove?: boolean
}>()

const store = useGameStore()
const pieceElement = ref<HTMLElement | null>(null)
const entryAnimating = ref(props.animateEntry === true && props.entryFrom !== null && props.entryFrom !== undefined)
const lastMoveActive = ref(false)
const pieceStyle = computed(() => ({
  '--piece-color': store.playerMeta[props.piece.player]?.color ?? 'var(--accent-primary)',
}))

const dragPayload = computed<DragPayload>(() => ({
  pieceId: props.piece.id,
  player: props.piece.player,
  size: props.piece.size,
  source: props.inInventory === false ? 'board' : 'inventory',
}))

const sizeName = computed(() => {
  const names = { large: 'Grande', medium: 'Mediana', small: 'Pequeña' }
  return names[props.piece.size]
})

onMounted(() => {
  if (entryAnimating.value) animateFromInventory()
  else if (props.highlightLastMove) lastMoveActive.value = true
})

function animateFromInventory() {
  const target = pieceElement.value
  const source = props.entryFrom
  if (!target || !source) {
    entryAnimating.value = false
    lastMoveActive.value = true
    return
  }

  const targetRect = target.getBoundingClientRect()
  const ghost = target.cloneNode(true) as HTMLElement
  ghost.classList.remove('piece--entry-hidden', 'piece--last-move')
  ghost.classList.add('piece--flight')
  ghost.style.left = `${source.left + source.width / 2}px`
  ghost.style.top = `${source.top + source.height / 2}px`
  ghost.style.width = `${source.width}px`
  ghost.style.height = `${source.height}px`
  ghost.style.willChange = 'left, top, transform, opacity'
  document.body.appendChild(ghost)

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    ghost.remove()
    entryAnimating.value = false
    lastMoveActive.value = true
  }

  // Force the initial position to be painted before starting the flight.
  void ghost.offsetWidth
  const from = {
    left: `${source.left + source.width / 2}px`,
    top: `${source.top + source.height / 2}px`,
    transform: 'translate(-50%, -50%) scale(0.72) rotate(-30deg)',
  }
  const mid = {
    left: `${(source.left + source.width / 2 + targetRect.left + targetRect.width / 2) / 2}px`,
    top: `${Math.min(source.top, targetRect.top) - 60}px`,
    transform: 'translate(-50%, -50%) scale(1.25) rotate(-8deg)',
    offset: 0.55,
  }
  const to = {
    left: `${targetRect.left + targetRect.width / 2}px`,
    top: `${targetRect.top + targetRect.height / 2}px`,
    transform: 'translate(-50%, -50%) scale(1) rotate(0)',
  }

  if (typeof ghost.animate === 'function') {
    const animation = ghost.animate([from, mid, to], {
      duration: 620,
      easing: 'cubic-bezier(0.45, 0, 0.25, 1)',
      fill: 'forwards',
    })
    animation.addEventListener('finish', finish, { once: true })
  } else {
    ghost.addEventListener('transitionend', finish, { once: true })
    requestAnimationFrame(() => {
      ghost.style.left = to.left
      ghost.style.top = to.top
      ghost.style.transform = to.transform
    })
  }
  window.setTimeout(finish, 820)
}
</script>

<style scoped>
.piece {
  cursor: grab;
  flex-shrink: 0;
  transition: transform 0.2s var(--ease-spring);
}

.piece.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.piece--entry-hidden {
  opacity: 0 !important;
}

/* Sizes are relative to the slot in Cell.vue, so the board can scale. */
.piece--large  { width: 90%; height: 90%; }
.piece--medium { width: 86%; height: 86%; }
.piece--small  { width: 78%; height: 78%; }

.piece--last {
  outline: 1.5px solid color-mix(in srgb, var(--ring-color) 55%, transparent);
  outline-offset: 2px;
}

.piece--last-move-pulse {
  animation: piece-land 0.55s var(--ease-snap) both;
}

.piece--last-move-pulse::after {
  content: '';
  position: absolute;
  inset: -2px;
  border: 2px solid var(--ring-color);
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
  animation: piece-ripple 0.7s 0.12s var(--ease-out);
}

@keyframes piece-land {
  0% { opacity: 0; transform: scale(1.45) translateY(-6%); }
  55% { opacity: 1; transform: scale(0.92); }
  100% { opacity: 1; transform: scale(1); }
}

@keyframes piece-ripple {
  0% { opacity: 0.85; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.6); }
}

.piece--flight {
  position: fixed !important;
  z-index: 500;
  pointer-events: none !important;
  margin: 0;
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(0.72) rotate(-30deg);
  transition: left 0.6s var(--ease-out), top 0.6s var(--ease-out), transform 0.6s var(--ease-out);
}

/* Fallbacks when no room color is available (solo games or previews). */
.piece--player1 { --piece-color: var(--player-1-color); }
.piece--player2 { --piece-color: var(--player-2-color); }
.piece--player3 { --piece-color: var(--player-3-color); }
.piece--player4 { --piece-color: var(--player-4-color); }
</style>
