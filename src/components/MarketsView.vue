<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import MarketCard from './MarketCard.vue'

type Category = { label: string; tag: string }

const categories: Category[] = [
  { label: '全部', tag: '' },
  { label: '加密貨幣', tag: 'Crypto' },   // 改為大寫開頭
  { label: '政治', tag: 'Politics' },   // 改為大寫開頭
  { label: '金融', tag: 'Economics' }, // 金融類通常標籤是 Economics
  { label: '科技', tag: 'Science' },   // 科技類常被歸在 Science 或 Tech
  { label: '國際', tag: 'World' },
]

const allEvents = ref<any[]>([])
const isLoading = ref(true)
const activeCategory = ref<Category>({ label: '全部', tag: '' })
const knownEventIds = ref<Set<string>>(new Set())

// 修改為可為 null 的型別，防止 SSR 或未初始化錯誤
let refreshInterval: ReturnType<typeof setInterval> | null = null

const events = computed(() => {
  if (!activeCategory.value.tag) return allEvents.value
  
  const target = activeCategory.value.tag.toLowerCase()
  
  return allEvents.value.filter(ev => {
    // 取得所有可能的文字內容來比對
    const question = (ev.question || "").toLowerCase()
    const groupTitle = (ev.groupItemTitle || "").toLowerCase()
    const category = (ev.category || "").toLowerCase()
    const tagsText = Array.isArray(ev.tags) 
      ? ev.tags.map((t: any) => (t.label || t.name || "").toLowerCase()).join(" ") 
      : ""

    // 擴充匹配邏輯：如果題目或分類包含關鍵字，就顯示
    const fullText = `${question} ${groupTitle} ${category} ${tagsText}`

    // 針對各個分類的關鍵字補充
    if (target === 'crypto' && (fullText.includes('crypto') || fullText.includes('bitcoin') || fullText.includes('eth') || fullText.includes('coin'))) return true
    if (target === 'politics' && (fullText.includes('election') || fullText.includes('president') || fullText.includes('trump') || fullText.includes('biden') || fullText.includes('politics'))) return true
    if (target === 'economics' && (fullText.includes('fed') || fullText.includes('rate') || fullText.includes('inflation') || fullText.includes('economy'))) return true
    if (target === 'science' && (fullText.includes('tech') || fullText.includes('ai') || fullText.includes('space') || fullText.includes('apple') || fullText.includes('nvidia'))) return true

    // 預設的標籤匹配
    return fullText.includes(target)
  })
})

function playNewDataSound() {
  try {
    const ctx = new window.AudioContext()
    const notes = [880, 1046]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.25)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.3)
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

    // --- 關鍵：資料去重邏輯 ---
    const seenTitles = new Set()
    const uniqueData = formattedData.filter(market => {
      // 使用 question 或 groupItemTitle 作為唯一標記
      // 如果這個題目已經出現過了，就過濾掉
      const title = market.question || market.groupItemTitle
      if (!title || seenTitles.has(title)) {
        return false
      }
      seenTitles.add(title)
      return true
    })

    const isFirstLoad = knownEventIds.value.size === 0
    const newIds = uniqueData.map((ev: any) => String(ev.id || ev.marketMakerAddress))
    const hasNew = newIds.some(id => !knownEventIds.value.has(id))

    if (!isFirstLoad && hasNew) {
      playNewDataSound()
    }

    knownEventIds.value = new Set(newIds)
    allEvents.value = uniqueData
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

      <div class="flex items-center space-x-3 text-[10px] text-slate-500 ml-4">
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
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes flash-new {
  0% { 
    background-color: rgba(59, 130, 246, 0.5); 
    border-color: #3b82f6; 
    transform: scale(1.02);
  }
  100% { 
    background-color: #0f1523; 
    border-color: #1e293b; 
    transform: scale(1);
  }
}

.animate-flash {
  animation: flash-new 2s cubic-bezier(0.4, 0, 0.2, 1);
}

.scrollbar-dark::-webkit-scrollbar { width: 4px; }
.scrollbar-dark::-webkit-scrollbar-track { background: #05080f; }
.scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
.scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 1000ms;
}
</style>