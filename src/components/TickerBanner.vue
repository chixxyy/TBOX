<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const alerts = ref<any[]>([])
let refreshInterval: ReturnType<typeof setInterval>

function getRelativeTime(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

async function fetchTickerNews() {
  try {
    const categories = ['crypto', 'general', 'forex']
    const promises = categories.map(cat => 
      fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`).then(res => res.json())
    )
    
    const results = await Promise.all(promises)
    let allNews = results.flat()
    
    allNews.sort((a, b) => b.datetime - a.datetime)
    
    const uniqueNewsMap = new Map()
    allNews.forEach(item => uniqueNewsMap.set(item.id, item))
    allNews = Array.from(uniqueNewsMap.values())
    
    // Get top 15 news for the ticker banner
    alerts.value = allNews.slice(0, 15).map((item: any, index: number) => {
      const isCritical = item.headline.toLowerCase().includes('hack') || item.headline.toLowerCase().includes('sec')
      let typeStr = (item.category || 'INFO').toUpperCase()
      if (isCritical) {
        typeStr = 'CRITICAL'
      } else if (index < 3 && typeStr === 'CRYPTO') {
        typeStr = 'HIGH'
      }

      return {
        id: item.id || index,
        type: typeStr,
        message: item.headline,
        time: getRelativeTime(item.datetime * 1000),
        url: item.url
      }
    })
  } catch (e) {
    console.error('Failed to fetch ticker news', e)
    // Fallback if API fails
    alerts.value = [
      { id: 1, type: 'HIGH', message: 'API Rate Limit Exceeded or Network Error', time: '1m ago', url: '#' }
    ]
  }
}

onMounted(() => {
  fetchTickerNews()
  // Refresh every 3 minutes
  refreshInterval = setInterval(fetchTickerNews, 180000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})

const resetCache = () => {
  // Hard reload to clear client-side cache as requested
  window.location.reload()
}
</script>

<template>
  <div class="h-8 md:h-10 border-b border-slate-800 bg-[#070b14] flex items-center px-2 md:px-4 text-[10px] md:text-xs">
    <div class="flex items-center bg-green-900/40 border border-green-800 text-green-400 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full space-x-1 md:space-x-1.5 mr-2 md:mr-4 shadow-[0_0_8px_rgba(16,185,129,0.3)] z-10 shrink-0">
      <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
      <span class="font-bold tracking-wide">即時</span>
    </div>
    
    <!-- Ticker Scroll Container -->
    <div class="flex-1 flex overflow-hidden relative mask-edges h-full items-center">
      <div class="flex whitespace-nowrap animate-marquee hover:pause shrink-0 items-center w-max">
        
        <!-- Original Set -->
        <div class="flex space-x-8 pr-8 items-center">
          <a :href="alert.url" target="_blank" v-for="alert in alerts" :key="'orig-' + alert.id" class="flex items-center space-x-2 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors font-mono">
            <span class="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
              :class="{
                'bg-orange-500 shadow-[0_0_5px_#f97316]': alert.type === 'HIGH',
                'bg-red-500 shadow-[0_0_5px_#ef4444]': alert.type === 'CRITICAL',
                'bg-blue-500 shadow-[0_0_5px_#3b82f6]': alert.type === 'INFO'
              }"></span>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 tracking-wider"
              :class="{
                'bg-orange-950/40 text-orange-400 border-orange-900/60': alert.type === 'HIGH',
                'bg-red-950/40 text-red-400 border-red-900/60': alert.type === 'CRITICAL',
                'bg-blue-950/40 text-blue-400 border-blue-900/60': alert.type === 'INFO'
              }">{{ alert.type }}</span>
            <span class="truncate max-w-[400px] text-[11px] text-slate-300">{{ alert.message }}</span>
            <span class="text-blue-500 text-[10px] font-bold shrink-0 ml-1">{{ alert.time }}</span>
            <span class="w-1 h-1 rounded-full bg-slate-700 ml-2"></span>
          </a>
        </div>

        <!-- Duplicated Set for Seamless Loop -->
        <div class="flex space-x-8 pr-8 items-center" aria-hidden="true">
          <a :href="alert.url" target="_blank" v-for="alert in alerts" :key="'dup-' + alert.id" class="flex items-center space-x-2 text-slate-400 cursor-pointer hover:text-slate-300 transition-colors font-mono">
            <span class="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" 
              :class="{
                'bg-orange-500 shadow-[0_0_5px_#f97316]': alert.type === 'HIGH',
                'bg-red-500 shadow-[0_0_5px_#ef4444]': alert.type === 'CRITICAL',
                'bg-blue-500 shadow-[0_0_5px_#3b82f6]': alert.type === 'INFO'
              }"></span>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 tracking-wider"
              :class="{
                'bg-orange-950/40 text-orange-400 border-orange-900/60': alert.type === 'HIGH',
                'bg-red-950/40 text-red-400 border-red-900/60': alert.type === 'CRITICAL',
                'bg-blue-950/40 text-blue-400 border-blue-900/60': alert.type === 'INFO'
              }">{{ alert.type }}</span>
            <span class="truncate max-w-[400px] text-[11px] text-slate-300">{{ alert.message }}</span>
            <span class="text-blue-500 text-[10px] font-bold shrink-0 ml-1">{{ alert.time }}</span>
            <span class="w-1 h-1 rounded-full bg-slate-700 ml-2"></span>
          </a>
        </div>

      </div>
    </div>

    <div class="flex items-center space-x-2 md:space-x-4 text-slate-500 text-[9px] md:text-[10px] ml-2 md:ml-4 font-mono z-10 shrink-0 bg-[#070b14] pl-1 md:pl-2">
      <div class="text-right hidden sm:block">
        <div class="text-white font-bold text-[10px] md:text-xs">{{ alerts.length }}</div>
        <div class="tracking-widest opacity-60">活躍訊號</div>
      </div>
      <div class="text-right">
        <div class="text-white font-bold text-[10px] md:text-xs">剛剛</div>
        <div class="tracking-widest opacity-60">最後更新</div>
      </div>
      <button @click="resetCache" class="p-1 md:p-1.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded text-slate-400 transition-colors cursor-pointer z-20 relative">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-3.5 md:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mask-edges {
  mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
}

.animate-marquee {
  /* 調慢速度：秒數大 = 慢（例如 240s），秒數小 = 快（例如 80s） */
  animation: marquee 600s linear infinite;
}

.animate-marquee:hover {
  animation-play-state: paused;
}

@keyframes marquee {
  0% { transform: translateX(0); }
  /* At 100%, we have translated exactly half the width of the container. 
     Because the container has two identical halves, it will look like frame 0. */
  100% { transform: translateX(-50%); }
}
</style>
