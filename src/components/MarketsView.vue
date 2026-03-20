<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MarketCard from './MarketCard.vue'

type Category = { label: string; tag: string }

const categories: Category[] = [
  { label: '全部', tag: '' },
  { label: '加密貨幣', tag: 'crypto' },
  { label: '政治', tag: 'politics' },
  { label: '金融', tag: 'economics' },
  { label: '科技', tag: 'science' },
  { label: '國際', tag: 'world' },
]

const allEvents = ref<any[]>([])
const isLoading = ref(true)
const activeCategory = ref<Category>(categories[0] as Category)
const knownEventIds = ref<Set<string>>(new Set())

// 初始化時間即採用 24 小時制
const get24hTime = () => new Date().toLocaleTimeString('zh-TW', { 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
})
const lastUpdateTime = ref(get24hTime())

let refreshInterval: ReturnType<typeof setInterval> | null = null

// --- 計算屬性：統計數據 ---
const totalVolumeFormatted = computed(() => {
  const total = allEvents.value.reduce((sum, ev) => sum + (Number(ev.volumeNum) || 0), 0)
  if (total >= 1000000000) return `$${(total / 1000000000).toFixed(2)}B`
  if (total >= 1000000) return `$${(total / 1000000).toFixed(1)}M`
  return `$${total.toLocaleString()}`
})

// --- 過濾邏輯 ---
const events = computed(() => {
  if (!activeCategory.value.tag) return allEvents.value
  const target = activeCategory.value.tag.toLowerCase()
  
  return allEvents.value.filter(ev => {
    const question = (ev.question || "").toLowerCase()
    const groupTitle = (ev.groupItemTitle || "").toLowerCase()
    const category = (ev.category || "").toLowerCase()
    const tagsText = Array.isArray(ev.tags) ? ev.tags.map((t: any) => (t.label || "").toLowerCase()).join(" ") : ""
    const fullText = `${question} ${groupTitle} ${category} ${tagsText}`

    if (target === 'crypto' && (fullText.includes('crypto') || fullText.includes('bitcoin') || fullText.includes('eth'))) return true
    if (target === 'politics' && (fullText.includes('election') || fullText.includes('trump') || fullText.includes('biden'))) return true
    if (target === 'economics' && (fullText.includes('fed') || fullText.includes('rate') || fullText.includes('inflation'))) return true
    if (target === 'science' && (fullText.includes('tech') || fullText.includes('ai') || fullText.includes('nvidia'))) return true
    
    return fullText.includes(target)
  })
})

function playNewDataSound() {
  try {
    const ctx = new window.AudioContext()
    const notes = [880, 1320, 1760]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.13)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.13)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + i * 0.13 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.4)
      osc.start(ctx.currentTime + i * 0.13)
      osc.stop(ctx.currentTime + i * 0.13 + 0.5)
    })
  } catch (e) {}
}

async function fetchMarkets() {
  if (allEvents.value.length === 0) isLoading.value = true
  
  try {
    const res = await fetch('/polymarket/markets?active=true&closed=false&limit=100&order=volumeNum&ascending=false')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    let formattedData = Array.isArray(data) ? data : []

    const seenTitles = new Set()
    const uniqueData = formattedData.filter(market => {
      const title = market.question || market.groupItemTitle
      if (!title || seenTitles.has(title)) return false
      seenTitles.add(title)
      return true
    })

    const isFirstLoad = knownEventIds.value.size === 0
    const newIds = uniqueData.map((ev: any) => String(ev.id))
    const hasNew = newIds.some(id => !knownEventIds.value.has(id))

    // 只有在非首次載入且有新資料時才播放音效
    if (!isFirstLoad && hasNew) {
      playNewDataSound()
    }

    // 更新時間 (24小時制)
    lastUpdateTime.value = get24hTime()

    allEvents.value = uniqueData
    
    // 首次載入立即標記所有 ID 為已知，避免全場閃爍
    if (isFirstLoad) {
      knownEventIds.value = new Set(newIds)
    } else if (hasNew) {
      // 延遲更新已知 ID 讓卡片動畫能跑完
      setTimeout(() => {
        knownEventIds.value = new Set(newIds)
      }, 5000)
    }

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
  refreshInterval = setInterval(fetchMarkets, 60_000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden">
    
    <div class="h-16 md:h-20 border-b border-slate-800 flex items-center px-2 md:px-6 space-x-2 md:space-x-4 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      <!-- Signal Box 1 -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">今日訊號</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ allEvents.length }}</div>
        </div>
      </div>

      <!-- Signal Box 2 -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-purple-900/30 border border-purple-800/50 flex items-center justify-center text-purple-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">{{ activeCategory.label }}訊號</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ events.length }}</div>
        </div>
      </div>

      <!-- Signal Box 3 -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center text-green-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">總體量</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ totalVolumeFormatted }}</div>
        </div>
      </div>

      <!-- Signal Box 4 (Current Focus) -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0 cursor-pointer hover:bg-slate-800/50 transition-all group overflow-hidden">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-400 shrink-0">⚡</div>
        <div class="min-w-0 flex-1">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">當前焦點</div>
          <div class="text-white font-bold text-[10px] md:text-sm leading-none truncate group-hover:text-blue-400 transition-colors">
            {{ events[0]?.question || '暫無資料' }}
          </div>
        </div>
      </div>

      <!-- Update Info -->
      <div class="hidden lg:flex flex-col items-end shrink-0 ml-auto">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">Polymarket Live</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">最後更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <div class="min-h-11 md:h-12 border-b border-slate-800 flex items-center px-1.5 md:px-6 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      <div class="flex w-full items-center">
        <button 
          v-for="cat in categories" 
          :key="cat.tag"
          @click="selectCategory(cat)"
          class="flex-1 h-11 md:h-12 px-1 md:px-4 border-b-2 transition-colors relative text-[10px] md:text-[13px] font-bold whitespace-nowrap text-center"
          :class="activeCategory.tag === cat.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ cat.label }}
        </button>
      </div>
      <div class="hidden sm:flex items-center space-x-3 text-[10px] text-slate-500 ml-4 shrink-0">
        <span>Probability:</span>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span>≥70%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span><span>≥40%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-yellow-500"></span><span>≥15%</span></div>
        <div class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>&lt;15%</span></div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 scrollbar-dark">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      <div v-else-if="events.length === 0" class="flex items-center justify-center h-full text-slate-500 text-sm">
        No active markets found in this category
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <MarketCard 
          v-for="event in events" 
          :key="event.id" 
          :event-data="event"
          :is-new="knownEventIds.size > 0 && !knownEventIds.has(event.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-dark::-webkit-scrollbar { width: 4px; }
.scrollbar-dark::-webkit-scrollbar-track { background: #05080f; }
.scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
.scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }
</style>