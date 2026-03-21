<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
  onRegistered(r: ServiceWorkerRegistration | undefined) {
    if (r) {
      setInterval(() => {
        r.update()
      }, 60 * 60 * 1000) // Check for updates every hour
    }
  }

})

function close() {
  offlineReady.value = false
  needRefresh.value = false
}
</script>

<template>
  <div v-if="offlineReady || needRefresh" class="fixed bottom-12 right-4 md:bottom-8 md:right-8 z-50 animate-bounce-short">
    <div class="bg-[#0f1523] border border-blue-500/50 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.2)] p-4 max-w-sm flex items-start gap-4">
      <div class="shrink-0 pt-1">
        <svg v-if="offlineReady" class="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else class="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>

      <div class="flex-1">
        <h3 class="text-white font-bold text-sm mb-1">
          {{ offlineReady ? 'App ready to work offline' : 'New Web App Available' }}
        </h3>
        <p class="text-slate-400 text-xs mb-3">
          {{ offlineReady ? 'The dashboard is cached for offline use.' : 'A new version of TradingBox is available. Update now to get the latest features' }}
        </p>

        <div class="flex items-center gap-3">
          <button v-if="needRefresh" @click="updateServiceWorker()" class="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded font-bold text-xs transition-colors">
            Reload
          </button>
          <button @click="close" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-bold text-xs transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-bounce-short {
  animation: bounce-short 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes bounce-short {
  0% { transform: translateY(20px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
</style>
