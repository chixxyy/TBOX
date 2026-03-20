<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Sparkline from './Sparkline.vue'

// ---------- Inline Translation (mymemory API) ----------
interface CardTranslation {
  title: string
  news: string
}
const translationCache = new Map<number, CardTranslation>()
const translatingIds = ref<Set<number>>(new Set())
const translatedIds = ref<Set<number>>(new Set())

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    const data = await res.json()
    return data.responseData?.translatedText || text
  } catch { return text }
}

async function toggleTranslateMover(item: Mover) {
  if (translatedIds.value.has(item.id)) {
    translatedIds.value.delete(item.id)
    translatedIds.value = new Set(translatedIds.value) // trigger reactivity
    return
  }
  if (translationCache.has(item.id)) {
    translatedIds.value = new Set([...translatedIds.value, item.id])
    return
  }
  translatingIds.value = new Set([...translatingIds.value, item.id])
  try {
    // Translate both title and news in parallel
    const [tTitle, tNews] = await Promise.all([
      translateText(item.title),
      item.news ? translateText(item.news) : Promise.resolve('')
    ])
    translationCache.set(item.id, { title: tTitle, news: tNews })
    translatedIds.value = new Set([...translatedIds.value, item.id])
  } finally {
    translatingIds.value.delete(item.id)
    translatingIds.value = new Set(translatingIds.value)
  }
}

function getDisplayTitle(item: Mover): string {
  const trans = translationCache.get(item.id)
  if (translatedIds.value.has(item.id) && trans) {
    return trans.title
  }
  return item.title
}

function getDisplayNews(item: Mover): string {
  const trans = translationCache.get(item.id)
  if (translatedIds.value.has(item.id) && trans) {
    return trans.news
  }
  return item.news
}

const UI_LABELS = {
  en: {
    detected: 'Detected',
    peak: 'Peak',
    now: 'Now',
    change: 'Change',
    volume: 'Volume',
    yes: 'YES moved',
    no: 'NO moved',
    newsPrefix: '*',
    durationPrefix: 'Market movement started ',
    durationSuffix: ' after detection'
  },
  zh: {
    detected: '偵測到時',
    peak: '峰值',
    now: '目前',
    change: '變動幅度',
    volume: '成交量',
    yes: '【激增】信號觸發',
    no: '【盤整】信號觸發',
    newsPrefix: '𝕏 新聞: ',
    durationPrefix: '偵測到後約於 ',
    durationSuffix: ' 開始異動'
  }
}

function getLabel(key: keyof typeof UI_LABELS.en, isTranslated: boolean): string {
  return isTranslated ? UI_LABELS.zh[key] : UI_LABELS.en[key]
}

interface Mover {
  id: number
  title: string
  slug: string
  image: string
  detectedPrice: number
  peakPrice: number
  currentPrice: number
  changePercent: number
  isUp: boolean
  detectedTimeStr: string
  peakTimeStr: string
  detectionDurationStr: string
  volumeStr: string
  news: string
  newsTimeStr: string
  sparklineData: number[]
}

const movers = ref<Mover[]>([])
const isLoading = ref(true)

// ---------- Filtering & Stats ----------
const filterTabs = [
  { label: '全部異動', tag: 'all' },
  { label: '快速上漲', tag: 'gainers' },
  { label: '極速下跌', tag: 'losers' },
  { label: '高壓波動', tag: 'high_vol' },
]
const activeFilter = ref('all')

const filteredMovers = computed(() => {
  if (activeFilter.value === 'all') return movers.value
  if (activeFilter.value === 'gainers') return movers.value.filter(m => m.isUp)
  if (activeFilter.value === 'losers') return movers.value.filter(m => !m.isUp)
  if (activeFilter.value === 'high_vol') return movers.value.filter(m => m.changePercent > 15)
  return movers.value
})

const stats = computed(() => {
  const up = movers.value.filter(m => m.isUp).length
  const down = movers.value.length - up
  const maxMove = movers.value.length > 0 ? Math.max(...movers.value.map(m => m.changePercent)) : 0
  
  return {
    total: movers.value.length,
    up,
    down,
    maxMove: maxMove.toFixed(1) + '%'
  }
})

// 初始化時間即採用 24 小時制
const get24hTime = () => new Date().toLocaleTimeString('zh-TW', { 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
})
const lastUpdateTime = ref(get24hTime())

// Generate realistic mock history for a given real price
function generateSparklineData(start: number, end: number, points: number = 24): number[] {
  const data = [start]
  let current = start
  const trend = (end - start) / points
  const volatility = Math.abs(end - start) * 0.2 || 5
  
  for (let i = 1; i < points - 1; i++) {
    current += trend + (Math.random() - 0.5) * volatility
    current = Math.max(0.5, Math.min(99.5, current))
    data.push(current)
  }
  data.push(end)
  return data
}

// Map real Polymarket event to our Mover interface
function mapEventToMover(ev: any, index: number): Mover {
  const market = ev.markets && ev.markets[0]
  if (!market) return null as any

  let currentPrice = 50
  try {
    const prices = JSON.parse(market.outcomePrices)
    currentPrice = Math.round(parseFloat(prices[0]) * 100)
  } catch (e) {
    if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
      currentPrice = Math.round(parseFloat(market.outcomePrices[0]) * 100)
    }
  }

  // Synthesize history based on a real current price (to simulate the "Detected" feature)
  const isUp = Math.random() > 0.4
  let detected, peak
  if (isUp) {
    detected = Math.max(1, currentPrice - Math.floor(Math.random() * 30 + 10))
    peak = Math.min(99, currentPrice + Math.floor(Math.random() * 15))
  } else {
    detected = Math.min(99, currentPrice + Math.floor(Math.random() * 30 + 10))
    peak = detected
  }

  const changePercent = ((currentPrice - detected) / detected) * 100
  const vol = parseFloat(ev.volume) || 0

  return {
    id: index + 1, // original ID, used for tracking
    title: ev.title,
    slug: ev.slug || '',
    image: ev.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(ev.title.substring(0,2))}&background=random`,
    detectedPrice: detected,
    peakPrice: peak,
    currentPrice: currentPrice,
    changePercent: Math.abs(changePercent),
    isUp: changePercent >= 0,
    detectedTimeStr: `${Math.floor(Math.random() * 20 + 2)}h ${Math.floor(Math.random() * 50 + 1)}m ago`,
    peakTimeStr: `${Math.floor(Math.random() * 5 + 1)}h ${Math.floor(Math.random() * 50 + 1)}m ago`,
    detectionDurationStr: `${Math.floor(Math.random() * 5 + 1)}m ${Math.floor(Math.random() * 50 + 1)}s`,
    volumeStr: vol > 1000000 ? `$${(vol/1000000).toFixed(2)}M` : `$${(vol/1000).toFixed(1)}K`,
    news: Math.random() > 0.7 ? "REUTERS: BREAKING NEWS DEVELOPMENT REPORTED" : "",
    newsTimeStr: `${Math.floor(Math.random() * 20 + 2)}h ${Math.floor(Math.random() * 50 + 1)}m ago`,
    sparklineData: generateSparklineData(detected, currentPrice)
  }
}

let updateInterval: any = null

function playMoversChime() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    // Two-note rising chime in sequence
    const notes = [
      { freq: 880, delay: 0 },
      { freq: 1320, delay: 0.13 },
      { freq: 1760, delay: 0.26 }
    ]
    notes.forEach(({ freq, delay }) => {
      const osc = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay)
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime + delay)
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + delay + 0.03)
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + 0.4)
      osc.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      osc.start(audioCtx.currentTime + delay)
      osc.stop(audioCtx.currentTime + delay + 0.5)
    })
  } catch (e) {
    // Ignore audio errors
  }
}

async function loadRealData() {
  try {
    const res = await fetch('/polymarket/events?closed=false&limit=50&active=true')
    const raw = await res.json()
    const validEvents = raw.filter((ev: any) => ev.markets && ev.markets.length > 0)
    
    let parsed = validEvents.map(mapEventToMover).filter((m: Mover) => m !== null)
    
    // Sort by absolute change to simulate "Movers"
    parsed.sort((a: Mover, b: Mover) => b.changePercent - a.changePercent)
    parsed.forEach((m: Mover, i: number) => m.id = i + 1)
    
    movers.value = parsed
    lastUpdateTime.value = get24hTime()
  } catch(e) {
    console.error("Failed to fetch Polymarket events", e)
  } finally {
    isLoading.value = false
  }
}

// Poll for price updates to drive the sparklines live
async function pollUpdates() {
  if (movers.value.length === 0) return
  try {
    const res = await fetch('/polymarket/events?closed=false&limit=50&active=true')
    const raw = await res.json()
    const validEvents = raw.filter((ev: any) => ev.markets && ev.markets.length > 0)
    
    // Process new data
    let newDataProcessed = validEvents.map(mapEventToMover).filter((m: Mover) => m !== null)
    
    let hasSignificantRankChange = false

    newDataProcessed.forEach((newItem: Mover) => {
      // Re-use historical sparkline data if the item already existed
      const existing = movers.value.find(m => m.title === newItem.title)
      if (existing) {
        newItem.detectedPrice = existing.detectedPrice // Preserve original detected price
        newItem.peakPrice = Math.max(existing.peakPrice, newItem.currentPrice)
        newItem.sparklineData = [...existing.sparklineData]
        
        // Push to sparkline if price changed
        if (newItem.currentPrice !== existing.currentPrice) {
          newItem.sparklineData.push(newItem.currentPrice)
          if (newItem.sparklineData.length > 30) {
            newItem.sparklineData.shift()
          }
        }
        
        // Recalculate Change Percent based on preserved detected price
        const changePercent = ((newItem.currentPrice - newItem.detectedPrice) / newItem.detectedPrice) * 100
        newItem.changePercent = Math.abs(changePercent)
        newItem.isUp = changePercent >= 0
      } else {
        // Completely new item entering the top events
        hasSignificantRankChange = true
      }
    })

    // Sort by absolute change
    newDataProcessed.sort((a: Mover, b: Mover) => b.changePercent - a.changePercent)
    
    // Assign numerical ranking ids
    newDataProcessed.forEach((m: Mover, i: number) => {
      m.id = i + 1
    })

    // Check if the top 3 items changed from previous
    const oldTop3Ids = movers.value.slice(0, 3).map((m: Mover) => m.title).join(',')
    const newTop3Ids = newDataProcessed.slice(0, 3).map((m: Mover) => m.title).join(',')
    if (oldTop3Ids !== newTop3Ids) {
      hasSignificantRankChange = true
    }

    if (hasSignificantRankChange) {
      playMoversChime()
    }

    movers.value = newDataProcessed
    lastUpdateTime.value = get24hTime()
  } catch(e) {}
}

onMounted(() => {
  loadRealData()
  // Poll every 10 seconds for live updates
  updateInterval = setInterval(pollUpdates, 10000)
})

onUnmounted(() => {
  if (updateInterval) clearInterval(updateInterval)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300">

    <!-- Stats Header (Markets Style) -->
    <div class="h-16 md:h-20 border-b border-slate-800 flex items-center px-4 md:px-6 space-x-2 md:space-x-4 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      <!-- Total Movers -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="min-w-0 font-mono">
          <div class="text-[8px] md:text-[10px] text-slate-500 tracking-widest uppercase truncate">監控中異動</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ stats.total }}</div>
        </div>
      </div>

      <!-- Gainers Count -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center text-green-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </div>
        <div class="min-w-0 font-mono">
          <div class="text-[8px] md:text-[10px] text-slate-500 tracking-widest uppercase truncate">上漲信號</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ stats.up }}</div>
        </div>
      </div>

      <!-- Peak Move -->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-500 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div class="min-w-0 font-mono">
          <div class="text-[8px] md:text-[10px] text-slate-500 tracking-widest uppercase truncate">峰值波動</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ stats.maxMove }}</div>
        </div>
      </div>

      <!-- Update Info -->
      <div class="hidden lg:flex flex-col items-end shrink-0 ml-auto">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">Movers Live</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">最後更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="min-h-10 md:h-12 border-b border-slate-800 flex items-center px-4 md:px-6 shrink-0 bg-[#0a0f1c] overflow-x-auto scrollbar-hide">
      <div class="flex space-x-1 h-full items-center">
        <button 
          v-for="tab in filterTabs" 
          :key="tab.tag"
          @click="activeFilter = tab.tag"
          class="h-8 md:h-12 px-3 md:px-4 border-b-2 transition-colors relative text-[12px] md:text-[13px] font-medium whitespace-nowrap"
          :class="activeFilter === tab.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Content List -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
      
      <div v-if="isLoading" class="flex justify-center items-center h-full">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-5xl mx-auto space-y-4">
        
        <!-- Mover Card -->
        <div 
          v-for="item in filteredMovers" 
          :key="item.id"
          class="bg-[#111827] border border-slate-800/80 rounded-xl p-3 md:p-5 hover:border-slate-700 transition-colors flex flex-col"
        >
          <!-- Top Row: Icon, Title, Badge -->
          <div class="flex items-start justify-between mb-4 md:mb-6">
            <div class="flex items-start space-x-3 md:space-x-4">
              <!-- Rank Circle -->
              <div 
                class="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center font-black text-[11px] md:text-sm shrink-0 font-mono mt-0.5 relative"
                :class="{
                  'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-yellow-900 shadow-[0_0_14px_3px_rgba(234,179,8,0.55)] animate-medal-pulse': item.id === 1,
                  'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-700 shadow-[0_0_10px_2px_rgba(148,163,184,0.45)] animate-medal-pulse': item.id === 2,
                  'bg-gradient-to-br from-orange-600 via-amber-700 to-orange-800 text-orange-100 shadow-[0_0_10px_2px_rgba(180,83,9,0.4)] animate-medal-pulse': item.id === 3,
                  'bg-slate-800/80 border border-slate-700 text-slate-400': item.id > 3
                }"
              >
                <span v-if="item.id === 1">1</span>
                <span v-else-if="item.id === 2">2</span>
                <span v-else-if="item.id === 3">3</span>
                <span v-else>{{ item.id }}</span>
              </div>
              
              <!-- Image -->
              <img :src="item.image" class="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover border border-slate-700 shrink-0 mt-0.5" alt="Market" />
              
              <!-- Title -->
              <div>
                <h3 class="text-white font-bold text-[11px] md:text-sm leading-tight mb-1 max-w-2xl transition-all duration-200">{{ getDisplayTitle(item) }}</h3>
                <div class="flex items-center text-[9px] md:text-xs text-slate-500 space-x-2">
                  <span class="truncate max-w-[120px] md:max-w-sm">{{ getDisplayTitle(item) }}</span>
                  <a v-if="item.slug" :href="`https://polymarket.com/event/${item.slug}`" target="_blank" rel="noopener" class="text-blue-500 hover:text-blue-400 flex items-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-3.5 md:w-3.5 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" />
                    </svg>
                    Polymarket
                  </a>
                  <!-- Translate button (inline, matches NewsView style) -->
                  <button
                    @click.prevent="toggleTranslateMover(item)"
                    class="ml-auto flex items-center space-x-1.5 text-[10px] font-bold px-2.5 py-1 rounded border transition-all"
                    :class="translatedIds.has(item.id)
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-900/20'
                      : 'border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400'"
                  >
                    <svg v-if="translatingIds.has(item.id)" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                    </svg>
                    <span>{{ translatedIds.has(item.id) ? 'SHOW ORIGINAL' : '翻譯' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- Main Change Badge -->
            <div 
              class="px-2 md:px-3 py-1 md:py-1.5 rounded font-mono font-black text-[10px] md:text-sm shrink-0 flex items-center shadow-lg ml-2"
              :class="item.isUp ? 'bg-green-500/90 text-white shadow-green-500/20' : 'bg-red-500/90 text-white shadow-red-500/20'"
            >
              <svg v-if="item.isUp" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 mr-0.5 md:mr-1 transform rotate-180 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              {{ item.changePercent.toFixed(2) }}%
            </div>
          </div>

          <!-- Middle Block: Stats & Sparkline -->
          <div class="bg-[#0a0f1c] rounded-lg p-3 md:p-4 border border-slate-800/50 mb-4 font-mono w-full relative overflow-hidden group">
            
            <!-- Absolute Sparkline spanning right half -->
            <div class="absolute right-0 top-0 bottom-0 w-1/2 opacity-60 z-0 pointer-events-none flex items-center">
              <Sparkline :data="item.sparklineData" />
            </div>

            <div class="relative z-10">
              <div class="text-[10px] md:text-xs font-bold mb-3 md:mb-4 tracking-wider" :class="item.isUp ? 'text-green-500' : 'text-red-500'">
                {{ getLabel(item.isUp ? 'yes' : 'no', translatedIds.has(item.id)) }}
              </div>
              
              <div class="flex flex-row items-center justify-between">
                <!-- Stats Columns -->
                <div class="flex space-x-4 md:space-x-12 shrink-0">
                  <!-- Detected -->
                  <div class="flex flex-col">
                    <span class="text-slate-600 text-[9px] md:text-[10px] mb-1 font-bold">{{ getLabel('detected', translatedIds.has(item.id)) }}</span>
                    <span class="text-white text-base md:text-xl font-black">{{ item.detectedPrice }}¢</span>
                    <span class="text-slate-600 text-[9px] md:text-[10px] mt-1">{{ item.detectedTimeStr }}</span>
                  </div>
                  <!-- Peak -->
                  <div class="flex flex-col">
                    <span class="text-slate-600 text-[9px] md:text-[10px] mb-1 font-bold">→ {{ getLabel('peak', translatedIds.has(item.id)) }}</span>
                    <span class="text-green-400 text-base md:text-xl font-black">{{ item.peakPrice }}¢</span>
                    <span class="text-slate-600 text-[9px] md:text-[10px] mt-1 hidden sm:block">{{ item.peakTimeStr }}</span>
                  </div>
                  <!-- Now -->
                  <div class="flex flex-col">
                    <span class="text-slate-600 text-[9px] md:text-[10px] mb-1 font-bold">→ {{ getLabel('now', translatedIds.has(item.id)) }}</span>
                    <span class="text-slate-200 text-base md:text-xl font-black">{{ item.currentPrice }}¢</span>
                  </div>
                </div>

                <!-- Change (Huge text on far right, overlapping sparkline) -->
                <div class="flex flex-col text-right justify-center pr-1 md:pr-2">
                  <span class="text-slate-500 text-[9px] md:text-[10px] mb-1 font-bold tracking-widest uppercase text-shadow-sm">{{ getLabel('change', translatedIds.has(item.id)) }}</span>
                  <span class="text-xl md:text-3xl font-black tracking-tight" style="text-shadow: 0 4px 12px rgba(0,0,0,0.8);" :class="item.isUp ? 'text-green-400' : 'text-red-400'">
                    {{ item.isUp ? '+' : '-' }}{{ item.changePercent.toFixed(2) }}%
                  </span>
                </div>
              </div>
            </div>

            <!-- Detection Duration string -->
            <div class="mt-4 flex items-center text-[10px] text-slate-500">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ getLabel('durationPrefix', translatedIds.has(item.id)) }} <span class="text-yellow-600 font-bold mx-1">{{ item.detectionDurationStr }}</span> {{ getLabel('durationSuffix', translatedIds.has(item.id)) }}
            </div>
          </div>

          <!-- Bottom Row: Volume & News -->
          <div class="flex flex-col space-y-3 font-mono text-[11px]">
            <div class="flex items-center text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {{ getLabel('volume', translatedIds.has(item.id)) }}: <span class="text-white font-bold ml-1">{{ item.volumeStr }}</span>
            </div>

            <div v-if="item.news" class="flex items-center justify-between text-slate-500 pt-2 border-t border-slate-800/50">
              <div class="flex items-center truncate pr-4">
                <span class="mr-2 text-lg">𝕏</span>
                <span class="truncate uppercase">{{ getLabel('newsPrefix', translatedIds.has(item.id)) + getDisplayNews(item) }}</span>
              </div>
              <div class="flex items-center shrink-0">
                <span>{{ item.newsTimeStr }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes medal-pulse {
  0%, 100% { box-shadow: 0 0 8px 2px var(--medal-color, rgba(234,179,8,0.5)); transform: scale(1); }
  50%       { box-shadow: 0 0 18px 6px var(--medal-color, rgba(234,179,8,0.8)); transform: scale(1.07); }
}

.animate-medal-pulse {
  animation: medal-pulse 2.4s ease-in-out infinite;
}
</style>
