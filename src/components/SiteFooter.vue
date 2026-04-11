<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { scrollProgress, isChangingTab } from '../stores'

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
  <footer class="relative h-6 md:h-7 bg-[#0a0f1c] border-t border-slate-800 flex items-center px-3 md:px-4 shrink-0 overflow-hidden font-mono z-50">
    <!-- Mobile Scroll Progress Bar -->
    <div class="md:hidden absolute top-0 left-0 w-full h-[1px] bg-slate-900 z-10">
      <div 
        class="h-full bg-blue-500 ease-[cubic-bezier(0.4,0,0.2,1)] shadow-[0_0_8px_rgba(59,130,246,0.7)]"
        :class="isChangingTab ? 'transition-none' : 'transition-all duration-500'"
        :style="{ width: `${scrollProgress}%` }"
      ></div>
    </div>
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

      <!-- Version / Rights / Link -->
      <div class="flex items-center space-x-2 md:space-x-4 shrink-0 ml-auto">
        <a href="https://github.com/chixxyy" target="_blank" class="flex items-center space-x-1 hover:text-blue-400 transition-all group opacity-80 hover:opacity-100">
          <svg class="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-500 group-hover:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.041-1.416-4.041-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span class="text-[8px] md:text-[9.5px] text-slate-500 group-hover:text-blue-400 font-bold uppercase tracking-widest pt-0.5 whitespace-nowrap">chixxyy</span>
        </a>
        <div class="h-3 w-px bg-slate-800 hidden xs:block"></div>
        <span class="text-[8px] md:text-[10px] text-slate-600 tracking-tighter hidden xs:inline">v4.0.2</span>
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
