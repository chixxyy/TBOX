<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MarketCard from './MarketCard.vue'

const events = ref<any[]>([])
const isLoading = ref(true)

const categories = ['All', 'Politics', 'Crypto', 'Finance', 'Geopolitics', 'Earnings', 'Tech', 'Culture', 'World']
const activeCategory = ref('All')

async function fetchMarkets() {
  isLoading.value = true
  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?closed=false&limit=18')
    const data = await res.json()
    // Polymarket returns an array directly
    events.value = data || []
  } catch (error) {
    console.error('Failed to fetch markets:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchMarkets()
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden">
    
    <!-- Filter Bar -->
    <div class="h-12 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 bg-[#0a0f1c]">
      <div class="flex space-x-6 text-[13px] font-medium h-full items-center">
        <button 
          v-for="cat in categories" 
          :key="cat"
          @click="activeCategory = cat"
          class="h-full px-1 border-b-2 transition-colors relative"
          :class="activeCategory === cat ? 'border-blue-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ cat }}
          <!-- Active Tab Glow -->
          <div v-if="activeCategory === cat" class="absolute bottom-0 left-0 right-0 h-px bg-blue-400 shadow-[0_0_8px_#3b82f6]"></div>
        </button>
      </div>

      <div class="flex items-center space-x-4 text-[12px]">
        <div class="flex items-center bg-[#111827] border border-slate-700 rounded px-2 py-1 space-x-2 text-slate-400 cursor-pointer hover:bg-slate-800">
          <span>排序:</span>
          <span class="text-white">Volume ⬇</span>
        </div>
        <div class="text-slate-500 hover:text-slate-300 cursor-pointer">Liquidity</div>
        <div class="text-slate-500 hover:text-slate-300 cursor-pointer">Newest</div>
        
        <div class="w-px h-4 bg-slate-700 mx-2"></div>
        
        <button class="flex items-center space-x-1.5 border border-slate-700 bg-[#111827] hover:bg-slate-800 px-3 py-1 rounded text-slate-300 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span>Filters</span>
        </button>
      </div>
    </div>

    <!-- Probability Legend -->
    <div class="px-6 py-2 flex justify-end items-center space-x-3 text-[10px] text-slate-500 shrink-0 bg-[#05080f]">
      <span>Probability:</span>
      <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span>≥70%</span></div>
      <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span>≥40%</span></div>
      <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span><span>≥15%</span></div>
      <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span><15%</span></div>
    </div>

    <!-- Markets Grid -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-dark">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MarketCard 
          v-for="event in events" 
          :key="event.id" 
          :event-data="event" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-dark::-webkit-scrollbar {
  width: 6px;
}
.scrollbar-dark::-webkit-scrollbar-track {
  background: #05080f;
}
.scrollbar-dark::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
.scrollbar-dark::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>
