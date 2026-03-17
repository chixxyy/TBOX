<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const newsItems = ref<any[]>([])
const isLoading = ref(true)
const totalFetched = ref(0)
// 初始化 24 小時制時間
const lastUpdateTime = ref(new Date().toLocaleTimeString('zh-TW', { hour12: false }))
let refreshInterval: ReturnType<typeof setInterval>

// 分類選單配置
const filterTabs = [
  { label: '全部', tag: '' },
  { label: '加密', tag: 'crypto' },
  { label: '財經', tag: 'general' },
  { label: 'Forex', tag: 'forex' },
  { label: '監管', tag: 'regulation' },
  { label: '市場', tag: 'markets' },
  { label: 'DeFi', tag: 'defi' },
  { label: 'ETF', tag: 'etf' },
]
const severityFilters = ['Critical', 'High', 'Low']
const activeFilter = ref({ label: '全部', tag: '' })
const activeSeverity = ref<string[]>([])
const searchQuery = ref('')

// 時間處理函數
function getRelativeTime(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function getAccentColor(cat: string, isCritical: boolean) {
  if (isCritical) return 'bg-red-500'
  if (cat === 'crypto') return 'bg-blue-500'
  if (cat === 'general') return 'bg-emerald-500'
  if (cat === 'forex') return 'bg-amber-500'
  return 'bg-slate-500'
}

function getSeverity(headline: string): 'critical' | 'high' | 'low' {
  const h = headline.toLowerCase()
  if (h.includes('hack') || h.includes('crash') || h.includes('ban') || h.includes('collapse')) return 'critical'
  if (h.includes('surge') || h.includes('drop') || h.includes('fed') || h.includes('sec') || h.includes('war')) return 'high'
  return 'low'
}

// API 抓取邏輯
async function fetchFinnhub(): Promise<any[]> {
  const categories = ['crypto', 'general', 'forex']
  const promises = categories.map(cat =>
    fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`)
      .then(res => res.json())
      .catch(() => [])
  )
  const results = await Promise.all(promises)
  return results.flat().map((item: any, i: number) => ({
    _uid: `finnhub-${item.id || i}`,
    source: item.source,
    cat: (item.category || 'general').toLowerCase(),
    timestamp: item.datetime * 1000,
    headline: item.headline,
    summary: item.summary || '',
    image: item.image || '',
    url: item.url || '#',
    provider: 'finnhub',
  }))
}

async function fetchCryptoCompare(): Promise<any[]> {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=100&sortOrder=latest')
  const data = await res.json()
  return (data.Data || []).map((item: any) => {
    const categories = (item.categories || '').toUpperCase()
    const tags: string[] = []
    if (categories.includes('CRYPTO')) tags.push('crypto')
    if (categories.includes('REGULAT')) tags.push('regulation')
    if (categories.includes('DEFI')) tags.push('defi')
    if (categories.includes('MARKET')) tags.push('markets')
    if (categories.includes('ETF')) tags.push('etf')
    if (tags.length === 0) tags.push('crypto')
    
    return {
      _uid: `cc-${item.id}`,
      source: item.source_info?.name || item.source,
      tags,
      cat: tags[0],
      timestamp: item.published_on * 1000,
      headline: item.title,
      summary: item.body?.slice(0, 300) || '',
      image: item.imageurl || '',
      url: item.url || '#',
      provider: 'cryptocompare',
    }
  })
}

async function fetchNews() {
  try {
    const [finnhubItems, ccItems] = await Promise.allSettled([
      fetchFinnhub(),
      fetchCryptoCompare(),
    ])

    const allRaw = [
      ...(finnhubItems.status === 'fulfilled' ? finnhubItems.value : []),
      ...(ccItems.status === 'fulfilled' ? ccItems.value : []),
    ]

    const unique = new Map<string, any>()
    allRaw.forEach(item => unique.set(item._uid, item))
    const sorted = Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp)
    totalFetched.value = sorted.length

    // 更新最後抓取時間 (24 小時制)
    lastUpdateTime.value = new Date().toLocaleTimeString('zh-TW', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })

    const providerColors: Record<string, string> = { finnhub: '1d4ed8', cryptocompare: '7c3aed' }

    newsItems.value = sorted.slice(0, 150).map(item => {
      const isCritical = getSeverity(item.headline) === 'critical'
      const severity = getSeverity(item.headline)
      const bg = providerColors[item.provider] || '1d4ed8'
      return {
        ...item,
        id: item._uid,
        tags: item.tags || [item.cat],
        severity,
        time: getRelativeTime(item.timestamp),
        accentColor: getAccentColor(item.cat, isCritical),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.source)}&background=${bg}&color=fff&rounded=true&font-size=0.4&bold=true`
      }
    })
  } catch (e) {
    console.error('Failed to fetch news', e)
  } finally {
    isLoading.value = false
  }
}

const filteredNews = computed(() => {
  return newsItems.value.filter(item => {
    if (activeFilter.value.tag && !item.tags?.includes(activeFilter.value.tag)) return false
    if (activeSeverity.value.length && !activeSeverity.value.map(s => s.toLowerCase()).includes(item.severity)) return false
    if (searchQuery.value && !item.headline.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

function toggleSeverity(s: string) {
  const i = activeSeverity.value.indexOf(s)
  if (i === -1) activeSeverity.value.push(s)
  else activeSeverity.value.splice(i, 1)
}

// 翻譯功能相關邏輯...
const translationCache = new Map<string | number, { headline: string; summary: string }>()
const translatingIds = ref<Set<string | number>>(new Set())
const translatedIds = ref<Set<string | number>>(new Set())

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    const data = await res.json()
    return data.responseData?.translatedText || text
  } catch { return text }
}

async function toggleTranslate(item: any) {
  if (translatedIds.value.has(item.id)) {
    translatedIds.value.delete(item.id)
    return
  }
  if (translationCache.has(item.id)) {
    translatedIds.value.add(item.id)
    return
  }
  translatingIds.value.add(item.id)
  try {
    const [headline, summary] = await Promise.all([
      translateText(item.headline),
      item.summary ? translateText(item.summary.slice(0, 400)) : Promise.resolve('')
    ])
    translationCache.set(item.id, { headline, summary })
    translatedIds.value.add(item.id)
  } finally {
    translatingIds.value.delete(item.id)
  }
}

function getDisplayItem(item: any) {
  if (translatedIds.value.has(item.id) && translationCache.has(item.id)) {
    const t = translationCache.get(item.id)!
    return { ...item, headline: t.headline, summary: t.summary, isTranslated: true }
  }
  return { ...item, isTranslated: false }
}

onMounted(() => {
  fetchNews()
  refreshInterval = setInterval(fetchNews, 30_000)
})
onUnmounted(() => clearInterval(refreshInterval))
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden font-sans">
    
    <div class="h-20 border-b border-slate-800 flex items-center px-6 space-x-6 shrink-0 bg-[#0a0f1c]">
      <div class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[150px]">
        <div class="w-9 h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">今日訊號</div>
          <div class="text-white font-bold text-lg leading-none">{{ totalFetched }}</div>
        </div>
      </div>

      <div class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[150px]">
        <div class="w-9 h-9 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" /></svg>
        </div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">載入新聞</div>
          <div class="text-white font-bold text-lg leading-none">{{ filteredNews.length }}</div>
        </div>
      </div>

      <a :href="filteredNews[0]?.url || '#'" target="_blank" class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[280px] cursor-pointer hover:bg-slate-800/50 transition-all group">
        <div class="w-9 h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-400 group-hover:bg-red-900/50">⚡</div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">最新頭條</div>
          <div class="text-white font-bold text-sm leading-snug truncate max-w-[200px] group-hover:text-blue-400 transition-colors">{{ filteredNews[0]?.headline || '暫無即時新聞' }}</div>
        </div>
      </a>

      <div class="ml-auto flex flex-col items-end">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">Live News Stream</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">
          最後更新: {{ lastUpdateTime }}
        </span>
      </div>
    </div>

    <div class="h-12 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 bg-[#0a0f1c]">
      <div class="flex space-x-1 h-full items-center">
        <button v-for="tab in filterTabs" :key="tab.tag" @click="activeFilter = tab" class="h-full px-4 border-b-2 transition-all text-[13px] font-medium" :class="activeFilter.tag === tab.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'">{{ tab.label }}</button>
      </div>
      <div class="flex items-center space-x-2 ml-auto pr-4 border-r border-slate-800">
        <button v-for="s in severityFilters" :key="s" @click="toggleSeverity(s)" class="text-[10px] font-bold px-3 py-1 rounded-md border transition-all" :class="activeSeverity.includes(s) ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'border-slate-800 text-slate-600 hover:border-slate-700'">{{ s.toUpperCase() }}</button>
      </div>
      <div class="flex items-center bg-[#05080f] border border-slate-700 rounded-md px-3 py-1.5 w-64 ml-4 focus-within:border-blue-500 transition-all">
        <input v-model="searchQuery" type="text" placeholder="搜尋全站新聞..." class="bg-transparent outline-none text-xs text-slate-300 w-full" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-dark p-6">
      <div v-if="isLoading" class="flex items-center justify-center h-full"><div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
      <div v-else class="max-w-5xl mx-auto space-y-3">
        <div v-for="item in filteredNews" :key="item.id" class="flex items-start space-x-4 bg-[#0f1523] border border-[#1e293b] rounded-lg p-5 hover:border-slate-500 hover:shadow-[0_0_15px_rgba(59,130,246,0.05)] transition-all group relative overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" :class="item.accentColor"></div>
          <div class="relative shrink-0">
            <img :src="item.avatar" class="w-10 h-10 rounded-full border border-slate-700" alt="" />
            <div v-if="item.severity === 'critical'" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0f1523] animate-ping"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-2">
              <span class="text-white font-bold text-sm group-hover:text-blue-400 transition-colors">{{ item.source }}</span>
              <span class="text-slate-600 text-xs">· {{ item.time }}</span>
              <div class="flex items-center space-x-2 ml-4">
                <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 uppercase">{{ item.cat }}</span>
              </div>
              <button @click.stop="toggleTranslate(item)" class="ml-auto flex items-center space-x-1.5 text-[10px] font-bold px-2.5 py-1 rounded border transition-all" :class="translatedIds.has(item.id) ? 'bg-blue-600 text-white border-blue-500' : 'border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400'">
                <span v-if="translatingIds.has(item.id)" class="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin"></span>
                <span v-else>{{ translatedIds.has(item.id) ? 'SHOW ORIGINAL' : '翻譯' }}</span>
              </button>
            </div>
            <a :href="item.url" target="_blank" class="block group">
              <h4 class="text-slate-100 font-semibold text-[15px] leading-snug mb-2 transition-colors">{{ getDisplayItem(item).headline }}</h4>
              <div class="flex items-start space-x-4">
                <p v-if="item.summary" class="text-slate-500 text-xs leading-relaxed line-clamp-2 flex-1">{{ getDisplayItem(item).summary }}</p>
                <img v-if="item.image" :src="item.image" class="w-24 h-16 rounded object-cover border border-slate-800 opacity-80 group-hover:opacity-100 transition-all" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-dark::-webkit-scrollbar { width: 6px; }
.scrollbar-dark::-webkit-scrollbar-track { background: #05080f; }
.scrollbar-dark::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
.scrollbar-dark::-webkit-scrollbar-thumb:hover { background: #334155; }

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>