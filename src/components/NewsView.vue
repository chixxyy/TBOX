<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const newsItems = ref<any[]>([])
const isLoading = ref(true)
const totalFetched = ref(0)
let refreshInterval: ReturnType<typeof setInterval>

// tag -> display label mapping for filter bar
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

async function fetchFinnhub(): Promise<any[]> {
  const categories = ['crypto', 'general', 'forex']
  const promises = categories.map(cat =>
    fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`)
      .then(res => res.json())
      .catch(() => [])
  )
  const results = await Promise.all(promises)
  const items = results.flat()
  return items.map((item: any, i: number) => ({
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

// Derive tags from CryptoCompare categories string e.g. "EXCHANGE|CRYPTOCURRENCY|DEFI"
function ccCatToTags(categories: string): string[] {
  const tags: string[] = []
  const c = (categories || '').toUpperCase()
  if (c.includes('CRYPTO') || c.includes('COIN') || c.includes('BTC') || c.includes('ETH') || c.includes('TOKEN') || c.includes('ALTCOIN') || c.includes('EXCHANGE')) tags.push('crypto')
  if (c.includes('REGULAT') || c.includes('SEC') || c.includes('LAW') || c.includes('LEGAL') || c.includes('GOV') || c.includes('POLICY')) tags.push('regulation')
  if (c.includes('DEFI') || c.includes('DEX') || c.includes('YIELD') || c.includes('PROTOCOL') || c.includes('SMART_CONTRACT')) tags.push('defi')
  if (c.includes('MARKET') || c.includes('PRICE') || c.includes('TRADING') || c.includes('ANALYSIS')) tags.push('markets')
  if (c.includes('NFT') || c.includes('ART') || c.includes('METAVERSE') || c.includes('GAME')) tags.push('nft')
  if (c.includes('MINING') || c.includes('MINER') || c.includes('HASH')) tags.push('mining')
  if (c.includes('BUSINESS') || c.includes('FINANCE') || c.includes('FUND') || c.includes('VC') || c.includes('INVEST')) tags.push('general')
  if (c.includes('ETF') || c.includes('INDEX')) tags.push('etf')
  if (tags.length === 0) tags.push('crypto') // fallback
  return tags
}

async function fetchCryptoCompare(): Promise<any[]> {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=100&sortOrder=latest')
  if (!res.ok) throw new Error('CryptoCompare failed')
  const data = await res.json()
  return (data.Data || []).map((item: any) => ({
    _uid: `cc-${item.id}`,
    source: item.source_info?.name || item.source,
    tags: ccCatToTags(item.categories || ''),
    cat: ccCatToTags(item.categories || '')[0], // primary
    timestamp: item.published_on * 1000,
    headline: item.title,
    summary: item.body?.slice(0, 300) || '',
    image: item.imageurl || '',
    url: item.url || '#',
    provider: 'cryptocompare',
  }))
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

    // Deduplicate by uid, sort by newest first
    const unique = new Map<string, any>()
    allRaw.forEach(item => unique.set(item._uid, item))
    const sorted = Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp)
    totalFetched.value = sorted.length

    const providerColors: Record<string, string> = {
      finnhub: '1d4ed8',
      cryptocompare: '7c3aed',
    }

    newsItems.value = sorted.slice(0, 150).map(item => {
      const isCritical = item.headline.toLowerCase().includes('hack') || item.headline.toLowerCase().includes('collapse')
      const severity = getSeverity(item.headline)
      const bg = providerColors[item.provider] || '1d4ed8'
      // Ensure tags exists (Finnhub items come without it)
      const tags: string[] = item.tags || [item.cat]
      return {
        id: item._uid,
        source: item.source,
        cat: item.cat,
        tags,
        severity,
        time: getRelativeTime(item.timestamp),
        headline: item.headline,
        summary: item.summary,
        image: item.image,
        url: item.url,
        provider: item.provider,
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
    // Category filter: match against tags array
    if (activeFilter.value.tag && !item.tags?.includes(activeFilter.value.tag)) return false
    // Severity filter
    if (activeSeverity.value.length && !activeSeverity.value.map((s: string) => s.toLowerCase()).includes(item.severity)) return false
    // Search
    if (searchQuery.value && !item.headline.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

function toggleSeverity(s: string) {
  const i = activeSeverity.value.indexOf(s)
  if (i === -1) activeSeverity.value.push(s)
  else activeSeverity.value.splice(i, 1)
}

// Translation
const translationCache = new Map<string | number, { headline: string; summary: string }>()
const translatingIds = ref<Set<string | number>>(new Set())
const translatedIds = ref<Set<string | number>>(new Set())

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
  const data = await res.json()
  return data.responseData?.translatedText || text
}

async function toggleTranslate(item: any) {
  if (translatedIds.value.has(item.id)) {
    // Toggle back to original
    translatedIds.value.delete(item.id)
    return
  }
  if (translationCache.has(item.id)) {
    translatedIds.value.add(item.id)
    return
  }
  // Fetch translation
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
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden">

    <!-- Stats Header -->
    <div class="h-16 border-b border-slate-800 flex items-center px-6 space-x-6 shrink-0 bg-[#0a0f1c]">
      <div class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[160px]">
        <div class="w-9 h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">今日訊號</div>
          <div class="text-white font-bold text-lg leading-none">{{ totalFetched }}</div>
        </div>
      </div>

      <div class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[160px]">
        <div class="w-9 h-9 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">已載入新聞</div>
          <div class="text-white font-bold text-lg leading-none">{{ filteredNews.length }}</div>
        </div>
      </div>

      <a 
        :href="filteredNews[0]?.url || '#'" 
        target="_blank" 
        rel="noopener noreferrer"
        class="flex items-center space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-4 py-2.5 min-w-[220px] cursor-pointer hover:bg-slate-800/80 transition-colors group"
      >
        <div class="w-9 h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-400 group-hover:bg-red-900/50 transition-colors">
          ⚡
        </div>
        <div>
          <div class="text-[10px] text-slate-500 font-mono tracking-widest uppercase">最新頭條</div>
          <div class="text-white font-bold text-sm leading-snug truncate max-w-[160px] group-hover:text-blue-400 transition-colors">
            {{ filteredNews[0]?.title || filteredNews[0]?.source || '暫無新聞' }}
          </div>
        </div>
      </a>

      <!-- Recent Activity -->
      <div class="ml-auto flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-2">
        <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
        <span class="text-green-400 font-bold text-[11px] tracking-wide">即時數據更新中</span>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="h-12 border-b border-slate-800 flex items-center px-6 space-x-6 shrink-0 bg-[#05080f]">
      <!-- Category tabs -->
      <div class="flex items-center h-full space-x-1 overflow-x-auto">
        <button
          v-for="tab in filterTabs"
          :key="tab.tag"
          @click="activeFilter = tab"
          class="h-full px-3 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap shrink-0"
          :class="activeFilter.tag === tab.tag ? 'border-blue-400 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >{{ tab.label }}</button>
      </div>

      <div class="w-px h-5 bg-slate-800"></div>

      <!-- Severity chips -->
      <div class="flex items-center space-x-2">
        <button
          v-for="s in severityFilters"
          :key="s"
          @click="toggleSeverity(s)"
          class="text-[11px] font-bold px-3 py-1 rounded-full border transition-colors"
          :class="{
            'bg-red-950/60 border-red-700 text-red-400': s === 'Critical' && activeSeverity.includes(s),
            'bg-orange-950/60 border-orange-700 text-orange-400': s === 'High' && activeSeverity.includes(s),
            'bg-slate-800/60 border-slate-600 text-slate-400': s === 'Low' && activeSeverity.includes(s),
            'border-slate-700 text-slate-600 hover:text-slate-400': !activeSeverity.includes(s)
          }"
        >{{ s }}</button>
      </div>

      <!-- Search -->
      <div class="ml-auto flex items-center bg-[#111827] border border-slate-700 rounded-md px-3 py-1.5 w-52 focus-within:border-blue-500 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="searchQuery" type="text" placeholder="搜尋新聞..." class="bg-transparent outline-none text-xs text-slate-300 placeholder-slate-600 w-full" />
      </div>
    </div>

    <!-- News Feed -->
    <div class="flex-1 overflow-y-auto scrollbar-dark">
      <div v-if="isLoading" class="flex items-center justify-center h-32">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>

      <div v-else class="max-w-4xl mx-auto py-4 px-6 space-y-3">
        <div
          v-for="item in filteredNews"
          :key="item.id"
          class="flex items-start space-x-4 bg-[#0f1523] border border-[#1e293b] rounded-lg p-4 hover:border-slate-600 transition-all group relative overflow-hidden"
        >
          <!-- Left accent bar -->
          <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" :class="item.accentColor"></div>

          <!-- Avatar -->
          <img :src="item.avatar" class="w-9 h-9 rounded-full shrink-0 mt-0.5 ml-1" alt="" />

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-2 mb-1.5 flex-wrap gap-y-1">
              <span class="text-white font-bold text-sm">{{ item.source }}</span>
              <span
                class="text-[9px] font-bold px-2 py-0.5 rounded border tracking-wider"
                :class="{
                  'bg-red-950/50 border-red-800 text-red-400': item.severity === 'critical',
                  'bg-orange-950/50 border-orange-800 text-orange-400': item.severity === 'high',
                  'bg-slate-800/50 border-slate-700 text-slate-400': item.severity === 'low',
                }"
              >{{ item.severity.toUpperCase() }}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950/40 border border-blue-900/50 text-blue-400 font-mono tracking-wider">{{ item.cat.toUpperCase() }}</span>
              <span class="text-slate-600 text-[11px]">· {{ item.time }}</span>
              <!-- Provider badge -->
              <span v-if="item.provider === 'cryptocompare'" class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-violet-950/40 border border-violet-900/50 text-violet-400 tracking-wider">CC</span>
              <!-- Translate button -->
              <button
                @click.stop="toggleTranslate(item)"
                class="ml-auto flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded border transition-colors"
                :class="translatedIds.has(item.id)
                  ? 'bg-blue-900/30 border-blue-700 text-blue-400'
                  : 'border-slate-700 text-slate-500 hover:border-blue-700 hover:text-blue-400'"
              >
                <span v-if="translatingIds.has(item.id)" class="w-2.5 h-2.5 border border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                <span v-else>譯</span>
                <span>{{ translatedIds.has(item.id) ? '原文' : '繁中' }}</span>
              </button>
            </div>

            <a :href="item.url" target="_blank" class="block">
              <h4 class="text-slate-200 font-semibold text-sm leading-snug mb-1.5 hover:text-blue-400 transition-colors">
                {{ getDisplayItem(item).headline }}
                <span v-if="getDisplayItem(item).isTranslated" class="text-[9px] text-blue-500 font-mono ml-1">[譯]</span>
              </h4>

              <div class="flex items-start space-x-4">
                <p v-if="item.summary" class="text-slate-500 text-[12px] leading-relaxed line-clamp-2 flex-1">{{ getDisplayItem(item).summary }}</p>
                <img v-if="item.image" :src="item.image" class="w-20 h-14 rounded object-cover border border-slate-700 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" alt="" />
              </div>
            </a>
          </div>
        </div>

        <div v-if="filteredNews.length === 0" class="text-center text-slate-600 py-12 text-sm">沒有符合條件的新聞</div>
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
  line-clamp: 2;
  overflow: hidden;
}
</style>
