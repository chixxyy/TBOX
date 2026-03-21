<script setup lang="ts">
import { ref, onMounted } from 'vue'

const uptime = ref('00:00:00')
const startTime = Date.now()

const updateUptime = () => {
  const diff = Date.now() - startTime
  const h = Math.floor(diff / 3600000).toString().padStart(2, '0')
  const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')
  const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')
  uptime.value = `${h}:${m}:${s}`
}

onMounted(() => {
  setInterval(updateUptime, 1000)
})
</script>

<template>
  <footer class="h-6 md:h-7 bg-[#0a0f1c] border-t border-slate-800 flex items-center px-3 md:px-4 shrink-0 overflow-hidden font-mono z-50">
    <div class="flex items-center space-x-4 w-full">
      <!-- Status Indicator -->
      <div class="flex items-center space-x-1.5 shrink-0">
        <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
        <span class="text-[9px] md:text-[10px] text-slate-500 font-bold tracking-tighter uppercase whitespace-nowrap">System Operational</span>
      </div>

      <!-- Divider -->
      <div class="h-3 w-px bg-slate-800 hidden sm:block"></div>

      <!-- Latency (Simulated) -->
      <div class="hidden sm:flex items-center space-x-1 shrink-0">
        <span class="text-[9px] md:text-[10px] text-slate-500">LATENCY:</span>
        <span class="text-[9px] md:text-[10px] text-blue-400 font-bold tracking-widest uppercase">24ms</span>
      </div>

      <!-- Uptime -->
      <div class="flex-1 text-center md:text-left">
        <span class="text-[9px] md:text-[10px] text-slate-600 hidden md:inline ml-4">UPTIME:</span>
        <span class="text-[9px] md:text-[10px] text-slate-400 font-bold ml-1">{{ uptime }}</span>
      </div>

      <!-- Version / Rights -->
      <div class="flex items-center space-x-3 shrink-0 ml-auto">
        <span class="text-[8px] md:text-[10px] text-slate-600 tracking-tighter hidden xs:inline">TRADINGBOX v4.0.2</span>
        <span class="text-[8px] md:text-[10px] text-slate-700 font-bold">© {{ new Date().getFullYear() }}</span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
@keyframes pulse-soft {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
