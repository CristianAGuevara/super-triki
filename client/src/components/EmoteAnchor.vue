<!-- Shows one player's current reaction, popping out of its parent. -->
<template>
  <Transition name="emote-pop">
    <EmoteBubble v-if="shown" :key="shown.key" :slot="slot" :emote="shown.emote" />
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PlayerSlot } from '@/types/socket'
import { useEmoteStore } from '@/stores/emoteStore'
import EmoteBubble from './EmoteBubble.vue'

const props = defineProps<{ slot: PlayerSlot }>()
const store = useEmoteStore()
const shown = computed(() => store.shown[props.slot] ?? null)
</script>

<style scoped>
.emote-pop-enter-active { animation: emote-pop-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1); }
.emote-pop-leave-active { animation: emote-pop-out 0.24s ease-in forwards; }

@keyframes emote-pop-in {
  0% { opacity: 0; transform: translateY(16px) scale(0.3) rotate(-18deg); }
  100% { opacity: 1; transform: none; }
}

@keyframes emote-pop-out {
  to { opacity: 0; transform: translateY(-12px) scale(0.6); }
}
</style>
