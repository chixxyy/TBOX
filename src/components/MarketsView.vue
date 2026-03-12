<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MarketCard from './MarketCard.vue'

type Category = { label: string; tag: string }

// '' means show all
const categories: Category[] = [
  { label: '全部', tag: '' },
  { label: '加密貨幣', tag: 'crypto' },
  { label: '政治', tag: 'politics' },
  { label: '金融', tag: 'finance' },
  { label: '地緣政治', tag: 'geopolitics' },
  { label: '科技', tag: 'tech' },
  { label: '國際', tag: 'world' },
]

const allEvents = ref<any[]>([])
const isLoading = ref(true)
const activeCategory = ref<Category>({ label: 'All', tag: '' })
let refreshInterval: ReturnType<typeof setInterval>

// Client-side filtering by tag slug
const events = computed(() => {
  if (!activeCategory.value.tag) return allEvents.value
  return allEvents.value.filter(ev =>
    Array.isArray(ev.tags) && ev.tags.some((t: any) => t.slug === activeCategory.value.tag)
  )
})

async function fetchMarkets() {
  isLoading.value = true
  try {
    // Fetch 50 events so we have enough for all categories to filter from
    const res = await fetch('/polymarket/events?closed=false&limit=50')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    allEvents.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to fetch markets:', error)
  } finally {
    isLoading.value = false
  }
}

function selectCategory(cat: Category) {
  activeCategory.value = cat
}

onMounted(() => {
  fetchMarkets()
  // Auto-refresh every 2 minutes
  refreshInterval = setInterval(fetchMarkets, 120_000)
})

onUnmounted(() => {
  clearInterval(refreshInterval)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden">
    
    <!-- Filter Bar -->
    <div class="h-12 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 bg-[#0a0f1c]">
      <div class="flex space-x-1 h-full items-center">
        <button 
          v-for="cat in categories" 
          :key="cat.tag"
          @click="selectCategory(cat)"
          class="h-full px-3 border-b-2 transition-colors relative text-[13px] font-medium"
          :class="activeCategory.tag === cat.tag ? 'border-blue-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Probability Legend -->
      <div class="flex items-center space-x-3 text-[10px] text-slate-500 ml-4">
        <span>Probability:</span>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span>≥70%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span>≥40%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span><span>≥15%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>&lt;15%</span></div>
      </div>
    </div>

    <!-- Markets Grid -->
    <div class="flex-1 overflow-y-auto p-6 scrollbar-dark">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div v-else-if="events.length === 0" class="flex items-center justify-center h-full text-slate-500 text-sm">
        No events found
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
.scrollbar-dark::-webkit-scrollbar { width: 6px; }
.scrollbar-dark::-webkit-scrollbar-track { background: #05080f; }
.scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
.scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }
</style>
