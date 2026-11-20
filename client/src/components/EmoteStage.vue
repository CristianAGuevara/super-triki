<!--
  Narrow or upright screens: the player panels are often scrolled out of
  view, so reactions show here instead, fixed near the top of the screen,
  each with its sender's name. Several at once sit side by side.
-->
<template>
  <TransitionGroup
    name="emote-stage"
    tag="div"
    class="emote-stage"
    :class="{ 'emote-stage--always': alwaysVisible }"
    aria-live="polite"
  >
    <EmoteBubble
      v-for="entry in entries"
      :key="entry.key"
      :slot="entry.slot"
      :emote="entry.emote"
      floating
    />
  </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSlot } from '@/types/socket'
import { useEmoteStore } from '@/stores/emoteStore'
import EmoteBubble from './EmoteBubble.vue'

withDefaults(defineProps<{ alwaysVisible?: boolean }>(), {
  alwaysVisible: false,
})

const store = useEmoteStore()

const entries = computed(() =>
  Object.entries(store.shown)
    .flatMap(([slot, shown]) => (shown ? [{ slot: Number(slot) as PlayerSlot, ...shown }] : []))
    // Oldest first, so a new reaction never pushes the others around.
    .sort((a, b) => a.key - b.key)
)
</script>

<style scoped>
.emote-stage {
  position: fixed;
  top: calc(96px + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  z-index: 55;
  display: none;
  justify-content: center;
  gap: 10px;
  padding: 0 12px;
  pointer-events: none;
}

@media (max-width: 760px), (orientation: portrait) {
  .emote-stage { display: flex; }
}

/* Spectator mode has no card-anchored reactions, so this layer is always
   visible. Its parent in SpectatorView places it below the header. */
.emote-stage--always {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}

.emote-stage :deep(.emote-bubble) { width: 84px; }
.emote-stage :deep(.emote-bubble__face) { width: 80px; height: 80px; padding: 7px; }
.emote-stage :deep(.emote-bubble__name) { max-width: 84px; }

.emote-stage-enter-active { animation: emote-stage-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.emote-stage-leave-active { position: absolute; animation: emote-stage-out 0.24s ease-in forwards; }
.emote-stage-move { transition: transform 0.3s ease; }

@keyframes emote-stage-in {
  0% { opacity: 0; transform: translateY(-18px) scale(0.3) rotate(-14deg); }
  100% { opacity: 1; transform: none; }
}

@keyframes emote-stage-out {
  to { opacity: 0; transform: translateY(-14px) scale(0.6); }
}
</style>
