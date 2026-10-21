<template>
  <Transition name="connection-banner">
    <aside v-if="show" class="connection-banner" role="status" aria-live="polite">
      <span class="connection-banner__spinner" aria-hidden="true" />
      <span>
        <strong>Reconectando…</strong>
        La partida se recuperará automáticamente.
      </span>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoomStore } from '@/stores/roomStore'

const roomStore = useRoomStore()
const show = computed(() => Boolean(roomStore.roomId) && !roomStore.connected)
</script>

<style scoped>
.connection-banner {
  position: fixed;
  z-index: 280;
  top: 70px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(420px, calc(100vw - 24px));
  padding: 10px 14px;
  border: 1px solid var(--accent-secondary);
  border-radius: 12px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-card), var(--shadow-glow);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.35;
  transform: translateX(-50%);
}

.connection-banner strong {
  display: block;
  color: var(--text-primary);
  font-size: 13px;
}

.connection-banner__spinner {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border: 2px solid var(--line-soft);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: connection-spin 0.8s linear infinite;
}

@keyframes connection-spin {
  to { transform: rotate(360deg); }
}

.connection-banner-enter-active,
.connection-banner-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.connection-banner-enter-from,
.connection-banner-leave-to { opacity: 0; transform: translate(-50%, -8px); }
</style>
