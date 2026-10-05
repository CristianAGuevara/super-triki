<template>
  <div
    class="player-panel"
    :class="{ 'player-panel--active': isActive }"
    :style="{ '--accent': meta.color }"
  >
    <div class="player-panel__header">
      <span class="player-panel__dot" />
      <span class="player-panel__name">{{ displayName }}</span>
      <span v-if="isActive" class="player-panel__turn">{{ isMe ? 'Tu turno' : 'Su turno' }}</span>
    </div>

    <!-- 3 stacked sets -->
    <div class="player-panel__sets">
      <div
        v-for="i in 3"
        :key="i"
        class="player-panel__stack"
        :class="{ 'player-panel__stack--empty': isStackEmpty(i) }"
      >
        <!-- large ring — back -->
        <div
          v-if="pieceOfSet('large', i)"
          v-draggable="dragPayload(pieceOfSet('large', i)!)"
          :data-piece-id="pieceOfSet('large', i)!.id"
          class="stack-ring stack-ring--large"
          :class="[`stack-ring--player${player}`, { 'stack-ring--locked': !canDrag }]"
          :title="`Grande (J${player})`"
        />
        <div v-else class="stack-ring stack-ring--large stack-ring--used" />

        <!-- medium ring — middle -->
        <div
          v-if="pieceOfSet('medium', i)"
          v-draggable="dragPayload(pieceOfSet('medium', i)!)"
          :data-piece-id="pieceOfSet('medium', i)!.id"
          class="stack-ring stack-ring--medium"
          :class="[`stack-ring--player${player}`, { 'stack-ring--locked': !canDrag }]"
          :title="`Mediana (J${player})`"
        />
        <div v-else class="stack-ring stack-ring--medium stack-ring--used" />

        <!-- small ring — front -->
        <div
          v-if="pieceOfSet('small', i)"
          v-draggable="dragPayload(pieceOfSet('small', i)!)"
          :data-piece-id="pieceOfSet('small', i)!.id"
          class="stack-ring stack-ring--small"
          :class="[`stack-ring--player${player}`, { 'stack-ring--locked': !canDrag }]"
          :title="`Pequeña (J${player})`"
        />
        <div v-else class="stack-ring stack-ring--small stack-ring--used" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Player, Piece, Size, DragPayload } from '@/types/game'
import type { PlayerSlot } from '@/types/socket'
import { useGameStore } from '@/stores/gameStore'
import { useRoomStore } from '@/stores/roomStore'
import { useUserStore } from '@/stores/userStore'
import { vDraggable } from '@/directives/vDraggable'

const props = defineProps<{ player: Player; mySlot?: PlayerSlot | null }>()

const store     = useGameStore()
const roomStore = useRoomStore()
const userStore = useUserStore()

const isActive  = computed(() => store.currentPlayer === props.player && !store.isGameOver)
const meta      = computed(() => store.playerMeta[props.player])
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

// Returns the i-th piece of a given size (1-indexed), or null if used
function pieceOfSet(size: Size, i: number): Piece | null {
  const pieces = inventory.value.filter(p => p.size === size)
  return pieces[i - 1] ?? null
}

function isStackEmpty(i: number): boolean {
  return !pieceOfSet('large', i) && !pieceOfSet('medium', i) && !pieceOfSet('small', i)
}

function dragPayload(piece: Piece): DragPayload {
  return { pieceId: piece.id, player: piece.player, size: piece.size, source: 'inventory' }
}
</script>

<style scoped>
.player-panel {
  background: var(--cell-bg);
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 14px 16px;
  min-width: 140px;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.player-panel--active {
  border-color: var(--accent);
  box-shadow: 0 0 16px rgba(255, 255, 255, 0.08), 0 0 0 1px var(--accent);
}

.player-panel__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.player-panel__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--accent);
  flex-shrink: 0;
}

.player-panel__name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-panel__turn {
  margin-left: auto;
  font-size: 10px;
  color: var(--accent);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  animation: pulse 1s ease-in-out infinite alternate;
  white-space: nowrap;
}

@keyframes pulse {
  from { opacity: 0.5; }
  to   { opacity: 1; }
}

/* ── 3 stacks row ── */
.player-panel__sets {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
}

/* Each stack is a fixed square where all rings are absolutely centered */
.player-panel__stack {
  position: relative;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
  transition: opacity 0.3s;
}

.player-panel__stack--empty {
  opacity: 0.15;
}

/* ── Rings inside a stack ── */
.stack-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border-style: solid;
  box-sizing: border-box;
  cursor: grab;
  transition: transform 0.15s ease, filter 0.15s ease;
}

/* z-index: large behind, small in front so each hits the right donut area */
.stack-ring--large  { width: 76px; height: 76px; border-width: 7px; z-index: 1; }
.stack-ring--medium { width: 48px; height: 48px; border-width: 5px; z-index: 2; }
.stack-ring--small  { width: 22px; height: 22px; border-width: 4px; z-index: 3; }

/* Used (absent) rings — faint ghost */
.stack-ring--used {
  opacity: 0.08;
  border-color: var(--ghost-piece);
  pointer-events: none;
  cursor: default;
}

/* Player colors */
.stack-ring--player1 { border-color: var(--player-1-color); box-shadow: 0 0 5px var(--player-1-color); }
.stack-ring--player2 { border-color: var(--player-2-color); box-shadow: 0 0 5px var(--player-2-color); }
.stack-ring--player3 { border-color: var(--player-3-color); box-shadow: 0 0 5px var(--player-3-color); }
.stack-ring--player4 { border-color: var(--player-4-color); box-shadow: 0 0 5px var(--player-4-color); }

/* Locked: not your turn or not your pieces */
.stack-ring--locked {
  cursor: not-allowed;
  opacity: 0.45;
  filter: grayscale(0.4);
}

.stack-ring:not(.stack-ring--used):not(.stack-ring--locked):hover {
  filter: brightness(1.4);
  transform: translate(-50%, -50%) scale(1.08);
}

.stack-ring.dragging {
  opacity: 0.3;
  cursor: grabbing;
}
</style>
