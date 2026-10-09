<template>
  <div
    ref="pieceElement"
    v-draggable="dragPayload"
    class="piece"
    :class="[
      `piece--${piece.size}`,
      `piece--player${piece.player}`,
      {
        'piece--inventory': inInventory,
        'piece--entry-hidden': entryAnimating,
        'piece--last-move-pulse': lastMoveActive,
      },
    ]"
    :title="`${sizeName} (J${piece.player})`"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Piece, PieceEntrySource, DragPayload } from '@/types/game'
import { vDraggable } from '@/directives/vDraggable'

const props = defineProps<{
  piece: Piece
  inInventory?: boolean
  animateEntry?: boolean
  entryFrom?: PieceEntrySource | null
  highlightLastMove?: boolean
}>()

const pieceElement = ref<HTMLElement | null>(null)
const entryAnimating = ref(props.animateEntry === true && props.entryFrom !== null && props.entryFrom !== undefined)
const lastMoveActive = ref(false)

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
    transform: 'translate(-50%, -50%) scale(0.72) rotate(-10deg)',
  }
  const to = {
    left: `${targetRect.left + targetRect.width / 2}px`,
    top: `${targetRect.top + targetRect.height / 2}px`,
    transform: 'translate(-50%, -50%) scale(1) rotate(0)',
  }

  if (typeof ghost.animate === 'function') {
    const animation = ghost.animate([from, to], {
      duration: 550,
      easing: 'cubic-bezier(0.2, 0.85, 0.3, 1.2)',
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
  window.setTimeout(finish, 750)
}
</script>

<style scoped>
.piece {
  position: relative;
  border-radius: 50%;
  border-style: solid;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  flex-shrink: 0;
  box-sizing: border-box;
}

.piece:hover {
  transform: scale(1.1);
}

.piece.dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.piece--entry-hidden {
  opacity: 0 !important;
}

.piece--last-move-pulse {
  animation: last-move-pulse 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}

@keyframes last-move-pulse {
  0% { opacity: 0.45; transform: scale(0.84); }
  60% { opacity: 1; transform: scale(1.14); }
  100% { opacity: 1; transform: scale(1); }
}

.piece--flight {
  position: fixed !important;
  z-index: 500;
  pointer-events: none !important;
  margin: 0;
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(0.72) rotate(-10deg);
  transition: left 0.55s cubic-bezier(0.2, 0.85, 0.3, 1.2),
    top 0.55s cubic-bezier(0.2, 0.85, 0.3, 1.2),
    transform 0.55s cubic-bezier(0.2, 0.85, 0.3, 1.2);
}

/* Sizes — hollow ring style. Border widths scale with size */
.piece--large  { --light-inset: -2.5px; width: var(--size-large);  height: var(--size-large);  border-width: 5px; }
.piece--medium { --light-inset: -1.5px; width: var(--size-medium); height: var(--size-medium); border-width: 3px; }
.piece--small  { width: var(--size-small);  height: var(--size-small);  border-width: 0; }

/* Player colors */
.piece--player1 { border-color: var(--player-1-color); box-shadow: 0 0 6px var(--player-1-color); }
.piece--player2 { border-color: var(--player-2-color); box-shadow: 0 0 6px var(--player-2-color); }
.piece--player3 { border-color: var(--player-3-color); box-shadow: 0 0 6px var(--player-3-color); }
.piece--player4 { border-color: var(--player-4-color); box-shadow: 0 0 6px var(--player-4-color); }

.piece--small.piece--player1 { background: var(--player-1-color); }
.piece--small.piece--player2 { background: var(--player-2-color); }
.piece--small.piece--player3 { background: var(--player-3-color); }
.piece--small.piece--player4 { background: var(--player-4-color); }

.piece--large::after,
.piece--medium::after {
  content: '';
  position: absolute;
  inset: var(--light-inset);
  border: 2.5px solid color-mix(in srgb, var(--piece-color) 72%, white);
  border-radius: inherit;
  box-shadow:
    0 0 4px 2px color-mix(in srgb, var(--piece-color) 62%, white),
    0 0 11px 4px color-mix(in srgb, var(--piece-color) 52%, transparent);
  filter: blur(0.7px);
  pointer-events: none;
}

.piece--player1 { --piece-color: var(--player-1-color); }
.piece--player2 { --piece-color: var(--player-2-color); }
.piece--player3 { --piece-color: var(--player-3-color); }
.piece--player4 { --piece-color: var(--player-4-color); }
</style>
