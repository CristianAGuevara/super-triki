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
}>()

const pieceElement = ref<HTMLElement | null>(null)
const entryAnimating = ref(props.animateEntry === true && props.entryFrom !== null && props.entryFrom !== undefined)

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
})

function animateFromInventory() {
  const target = pieceElement.value
  const source = props.entryFrom
  if (!target || !source) {
    entryAnimating.value = false
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
  document.body.appendChild(ghost)

  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    ghost.remove()
    entryAnimating.value = false
  }

  ghost.addEventListener('transitionend', finish, { once: true })
  window.setTimeout(finish, 700)
  requestAnimationFrame(() => {
    ghost.style.left = `${targetRect.left + targetRect.width / 2}px`
    ghost.style.top = `${targetRect.top + targetRect.height / 2}px`
    ghost.style.transform = 'translate(-50%, -50%) scale(1) rotate(0)'
  })
}
</script>

<style scoped>
.piece {
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

.piece--last-move {
  animation: none;
}

.piece--entry-hidden {
  opacity: 0 !important;
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
.piece--large  { width: var(--size-large);  height: var(--size-large);  border-width: 7px; }
.piece--medium { width: var(--size-medium); height: var(--size-medium); border-width: 5px; }
.piece--small  { width: var(--size-small);  height: var(--size-small);  border-width: 4px; }

/* Player colors */
.piece--player1 { border-color: var(--player-1-color); box-shadow: 0 0 6px var(--player-1-color); }
.piece--player2 { border-color: var(--player-2-color); box-shadow: 0 0 6px var(--player-2-color); }
.piece--player3 { border-color: var(--player-3-color); box-shadow: 0 0 6px var(--player-3-color); }
.piece--player4 { border-color: var(--player-4-color); box-shadow: 0 0 6px var(--player-4-color); }
</style>
