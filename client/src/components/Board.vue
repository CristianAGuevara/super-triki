<template>
  <div class="board">
    <template v-for="(row, r) in store.board" :key="r">
      <Cell v-for="(_, c) in row" :key="c" :row="r" :col="c" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '@/stores/gameStore'
import Cell from './Cell.vue'

const store = useGameStore()
</script>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 16px;
  background: var(--board-bg);
  border-radius: 16px;
  box-shadow: var(--shadow-card), var(--shadow-glow);
}
</style>
