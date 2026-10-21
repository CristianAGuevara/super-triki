<template>
  <section class="color-picker" aria-labelledby="player-color-title">
    <div class="color-picker__heading">
      <span id="player-color-title" class="color-picker__title">Tu color</span>
      <span class="color-picker__current" role="status">{{ currentLabel }}</span>
    </div>

    <div class="color-picker__grid" role="group" aria-label="Colores disponibles">
      <button
        v-for="color in PLAYER_COLORS"
        :key="color.id"
        class="color-picker__option"
        :class="{
          'color-picker__option--active': color.id === modelValue,
          'color-picker__option--taken': isTaken(color.id),
        }"
        :style="{ '--swatch-color': `var(${color.cssVar})` }"
        type="button"
        :disabled="disabled || isTaken(color.id)"
        :aria-pressed="color.id === modelValue"
        :aria-label="`${color.label}${isTaken(color.id) ? ' (ocupado)' : ''}`"
        :title="isTaken(color.id) ? `${color.label} (ocupado)` : color.label"
        @click="emit('select', color.id)"
      >
        <span class="color-picker__swatch" aria-hidden="true">
          <span v-if="color.id === modelValue" class="color-picker__check">✓</span>
        </span>
        <span class="color-picker__label">{{ color.label }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PLAYER_COLORS, type PlayerColorId } from '@/types/game'

const props = defineProps<{
  modelValue: PlayerColorId
  taken: PlayerColorId[]
  disabled?: boolean
}>()

const emit = defineEmits<{ select: [PlayerColorId] }>()

const currentLabel = computed(() =>
  PLAYER_COLORS.find(color => color.id === props.modelValue)?.label ?? ''
)

function isTaken(color: PlayerColorId): boolean {
  return props.taken.includes(color)
}
</script>

<style scoped>
.color-picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  width: min(100%, 430px);
}

.color-picker__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.color-picker__title {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.color-picker__current {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.color-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.color-picker__option {
  display: flex;
  min-height: 62px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 4px;
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s, transform 0.18s;
}

.color-picker__option:hover:not(:disabled) {
  border-color: var(--swatch-color);
  background: var(--control-hover);
  transform: translateY(-1px);
}

.color-picker__option:focus-visible {
  outline: 2px solid var(--swatch-color);
  outline-offset: 2px;
}

.color-picker__option--active {
  border-color: var(--swatch-color);
  background: color-mix(in srgb, var(--swatch-color) 13%, var(--surface-muted));
  box-shadow: 0 0 0 1px var(--swatch-color), 0 0 18px color-mix(in srgb, var(--swatch-color) 24%, transparent);
  color: var(--text-primary);
}

.color-picker__option:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.color-picker__option--taken {
  opacity: 0.32;
}

.color-picker__swatch {
  position: relative;
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: var(--swatch-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--swatch-color) 45%, transparent);
  color: #fff;
  font-size: 14px;
  font-weight: 900;
  line-height: 1;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
}

.color-picker__option--taken .color-picker__swatch::after {
  content: '';
  position: absolute;
  width: 2px;
  height: 34px;
  border-radius: 2px;
  background: var(--surface);
  transform: rotate(45deg);
}

.color-picker__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 380px) {
  .color-picker__grid { gap: 6px; }
  .color-picker__option { min-height: 58px; }
  .color-picker__label { font-size: 10px; }
}
</style>
