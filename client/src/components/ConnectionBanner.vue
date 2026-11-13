<template>
  <Transition name="connection-banner">
    <aside v-if="connectionStore.showBanner" class="connection-banner" role="status" aria-live="assertive">
      <span class="connection-banner__spinner" aria-hidden="true" />
      <span class="connection-banner__copy">
        <strong>{{ title }}</strong>
        <span>{{ detail }}</span>
        <small v-if="connectionStore.attempts > 0">
          Intento de reconexión {{ connectionStore.attempts }}
        </small>
      </span>
      <button type="button" class="connection-banner__retry" @click="retryNow">
        Reintentar
      </button>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import { connectSocket } from '@/services/socket'

const connectionStore = useConnectionStore()
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

const title = computed(() => {
  if (!online.value) return 'Sin conexión a internet'
  if (connectionStore.blocked) return 'Conexión cerrada'
  if (connectionStore.attempts > 0) return 'Reconectando…'
  return 'Conexión perdida'
})

const detail = computed(() => {
  if (!online.value) {
    return 'Revisa tu red. La partida se recuperará cuando vuelva la conexión.'
  }
  if (connectionStore.blocked) {
    return 'La sesión puede estar abierta en otra pestaña. Pulsa Reintentar para usar esta.'
  }
  return 'La sala o el torneo se recuperarán automáticamente.'
})

function updateOnline() {
  online.value = navigator.onLine
}

function retryNow() {
  connectionStore.clearBlocked()
  connectionStore.setReconnecting()
  connectSocket()
}

onMounted(() => {
  window.addEventListener('online', updateOnline)
  window.addEventListener('offline', updateOnline)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnline)
  window.removeEventListener('offline', updateOnline)
})
</script>

<style scoped>
.connection-banner {
  position: fixed;
  z-index: 500;
  top: calc(74px + env(safe-area-inset-top, 0px));
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(560px, calc(100vw - 24px));
  padding: 10px 10px 10px 16px;
  border: 1px solid color-mix(in srgb, var(--accent-secondary) 60%, transparent);
  border-radius: var(--radius-m);
  background: var(--surface-raised);
  box-shadow: var(--shadow-card), var(--shadow-glow);
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.4;
  transform: translateX(-50%);
}

.connection-banner__copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.connection-banner strong {
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
}

.connection-banner small {
  color: var(--accent-secondary);
  font-size: 12px;
  font-weight: 700;
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

.connection-banner__retry {
  flex: 0 0 auto;
  min-height: 40px;
  padding: 6px 16px;
  border: 0;
  border-radius: 999px;
  background: var(--gradient-primary);
  color: var(--text-on-accent);
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.connection-banner__retry:hover { filter: brightness(1.06); }

@keyframes connection-spin {
  to { transform: rotate(360deg); }
}

.connection-banner-enter-active,
.connection-banner-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.connection-banner-enter-from,
.connection-banner-leave-to { opacity: 0; transform: translate(-50%, -8px); }

@media (max-width: 480px) {
  .connection-banner { align-items: flex-start; flex-wrap: wrap; }
  .connection-banner__copy { min-width: calc(100% - 28px); }
  .connection-banner__retry { margin-left: 28px; }
}
</style>
