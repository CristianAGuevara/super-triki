<template>
  <div
    class="player-panel"
    :class="{
      'player-panel--active': isActive,
      'player-panel--me': isMe,
      'player-panel--idle': !isActive && !store.isGameOver,
    }"
    :style="{ '--accent': meta.color, '--piece-color': meta.color }"
  >
    <div class="player-panel__header">
      <span class="player-panel__dot st-ring st-ring--medium" aria-hidden="true" />
      <span class="player-panel__name">{{ displayName }}</span>
      <span v-if="isActive" class="player-panel__turn">
        <span class="player-panel__turn-dot" aria-hidden="true" />
        {{ isMe ? 'Tu turno' : 'Jugando' }}
      </span>
      <span v-else class="player-panel__count" :title="`${inventory.length} fichas restantes`">
        {{ inventory.length }}/9
      </span>
    </div>

    <!-- 3 stacked sets -->
    <div class="player-panel__sets">
      <div
        v-for="i in 3"
        :key="i"
        class="player-panel__stack"
        :class="{ 'player-panel__stack--empty': isStackEmpty(i) }"
      >
        <template v-for="size in SIZE_ORDER" :key="size">
          <div
            v-if="pieceOfSet(size, i)"
            v-draggable="dragPayload(pieceOfSet(size, i)!, i - 1)"
            :data-piece-id="pieceOfSet(size, i)!.id"
            class="stack-ring st-ring"
            :class="[
              `stack-ring--${size}`,
              `st-ring--${size}`,
              `stack-ring--player${player}`,
              {
                'stack-ring--locked': !canDrag,
                'stack-ring--selected': isSelected(pieceOfSet(size, i)),
              },
            ]"
            :style="pieceColorStyle"
            :title="`${SIZE_LABELS[size]} (J${player})`"
          />
          <div v-else class="stack-ring stack-ring--used" :class="`stack-ring--${size}`" />
        </template>
      </div>
    </div>

    <div v-if="isMe && canDrag && showShortcuts" class="player-panel__keys" aria-hidden="true">
      <span v-for="(size, index) in SIZE_ORDER" :key="size" :class="{ 'is-out': countOf(size) === 0 }">
        <kbd class="st-kbd">{{ index + 1 }}</kbd>
        {{ SIZE_LABELS[size] }}
        <small>×{{ countOf(size) }}</small>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player, Piece, Size, DragPayload } from '@/types/game'
import { SIZE_ORDER } from '@/types/game'
import type { PlayerSlot } from '@/types/socket'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useUserStore } from '@/stores/userStore'
import { vDraggable } from '@/directives/vDraggable'

const props = defineProps<{ player: Player; mySlot?: PlayerSlot | null }>()

const store     = useGameStore()
const roomStore = useRoomStore()
const userStore = useUserStore()

const SIZE_LABELS: Record<Size, string> = { large: 'Grande', medium: 'Mediana', small: 'Pequeña' }
const showShortcuts = typeof window !== 'undefined' &&
  Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)

const isActive  = computed(() => store.currentPlayer === props.player && !store.isGameOver)
const meta      = computed(() => store.playerMeta[props.player])
const pieceColorStyle = computed(() => ({ '--piece-color': meta.value.color }))
const isMe      = computed(() => props.mySlot === props.player)

// Can drag: must be my piece (in multiplayer) AND my turn
const canDrag = computed(() => {
  if (store.isGameOver) return false
  if (store.currentPlayer !== props.player) return false
  if (roomStore.roomId) return roomStore.mySlot === props.player
  return true
})

const displayName = computed(() => {
  if (!roomStore.roomId) return meta.value.label
  const playerInfo = roomStore.players.find(p => p.slot === props.player)
  if (playerInfo) return playerInfo.username + (isMe.value ? ' (tú)' : '')
  return isMe.value ? (userStore.username ?? meta.value.label) + ' (tú)' : meta.value.label
})

const inventory = computed(() => store.inventories[props.player] ?? [])

function countOf(size: Size): number {
  return inventory.value.filter(piece => piece.size === size).length
}

// Returns the i-th piece of a given size (1-indexed), or null if used
function pieceOfSet(size: Size, i: number): Piece | null {
  const pieces = inventory.value.filter(p => p.size === size)
  return pieces[i - 1] ?? null
}

function isStackEmpty(i: number): boolean {
  return !pieceOfSet('large', i) && !pieceOfSet('medium', i) && !pieceOfSet('small', i)
}

function isSelected(piece: Piece | null): boolean {
  return Boolean(piece && store.selectedPiece?.pieceId === piece.id)
}

function dragPayload(piece: Piece, setIndex: number): DragPayload {
  return { pieceId: piece.id, player: piece.player, size: piece.size, source: 'inventory', setIndex }
}
</script>

<style scoped>
.player-panel {
  --stack: clamp(68px, 9.5vh, 94px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 150px;
  padding: 14px 16px 16px;
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 60%),
    var(--surface);
  box-shadow: var(--shadow-card);
  transition: border-color 0.3s ease, box-shadow 0.3s ease, opacity 0.3s ease, transform 0.35s var(--ease-spring);
}

.player-panel--idle { opacity: 0.8; }

.player-panel--active {
  border-color: color-mix(in srgb, var(--accent) 70%, transparent);
  box-shadow:
    var(--shadow-card),
    0 0 0 1px color-mix(in srgb, var(--accent) 60%, transparent),
    0 0 40px -10px color-mix(in srgb, var(--accent) 65%, transparent);
  transform: translateY(-2px);
}

.player-panel__header {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.player-panel__dot {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.player-panel__name {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-panel__turn,
.player-panel__count {
  margin-left: auto;
  flex-shrink: 0;
  white-space: nowrap;
}

.player-panel__turn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.player-panel__turn-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  animation: turn-ping 1.3s ease-out infinite;
}

@keyframes turn-ping {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 70%, transparent); }
  100% { box-shadow: 0 0 0 8px transparent; }
}

.player-panel__count {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
}

/* ── 3 stacks row ── */
.player-panel__sets {
  display: flex;
  gap: calc(var(--stack) * 0.16);
  align-items: center;
  justify-content: center;
}

/* Each stack is a fixed square where all rings are absolutely centered */
.player-panel__stack {
  position: relative;
  width: var(--stack);
  height: var(--stack);
  flex-shrink: 0;
  border-radius: 50%;
  transition: opacity 0.3s;
}

.player-panel__stack--empty { opacity: 0.45; }

/* ── Rings inside a stack ── */
.stack-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  cursor: grab;
  transition: transform 0.22s var(--ease-spring), opacity 0.2s ease, filter 0.2s ease;
}

/* z-index: large behind, small in front so each hits the right donut area */
.stack-ring--large  { width: 100%; height: 100%; z-index: 1; }
.stack-ring--medium { width: 63%;  height: 63%;  z-index: 2; }
.stack-ring--small  { width: 29%;  height: 29%;  z-index: 3; }

/* Used (absent) rings — an empty groove */
.stack-ring--used {
  border: 1px dashed var(--placeholder-border);
  box-shadow: inset 0 1px 2px var(--groove);
  pointer-events: none;
  cursor: default;
}

.stack-ring--used.stack-ring--large { width: 88%; height: 88%; }
.stack-ring--used.stack-ring--medium { width: 54%; height: 54%; }
.stack-ring--used.stack-ring--small {
  width: 22%;
  height: 22%;
  border-style: solid;
  background: color-mix(in srgb, var(--groove) 30%, transparent);
}

/* Fallbacks when no room color is available (solo games or previews). */
.stack-ring--player1 { --piece-color: var(--player-1-color); }
.stack-ring--player2 { --piece-color: var(--player-2-color); }
.stack-ring--player3 { --piece-color: var(--player-3-color); }
.stack-ring--player4 { --piece-color: var(--player-4-color); }

/* Selected by tap, click or keyboard. */
.stack-ring--selected {
  z-index: 4;
  outline: 2px solid color-mix(in srgb, var(--ring-color) 70%, white);
  outline-offset: 3px;
  transform: translate(-50%, -50%) translateY(-3px) scale(1.08);
  filter:
    drop-shadow(0 4px 0 color-mix(in srgb, var(--ring-color) 40%, #000))
    drop-shadow(0 0 14px var(--ring-color))
    brightness(1.12);
}

/* Locked: not your turn or not your pieces */
.stack-ring--locked {
  cursor: not-allowed;
  opacity: 0.78;
}

.stack-ring:not(.stack-ring--used):not(.stack-ring--locked):not(.stack-ring--selected):hover {
  transform: translate(-50%, -50%) translateY(-2px) scale(1.06);
}

.stack-ring.dragging {
  opacity: 0.3;
  cursor: grabbing;
}

.player-panel__keys {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--line-soft);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.player-panel__keys span { display: inline-flex; align-items: center; gap: 5px; }
.player-panel__keys small { color: var(--text-faint); font-family: var(--font-mono); font-size: 10px; }
.player-panel__keys .is-out { opacity: 0.35; }
</style>
