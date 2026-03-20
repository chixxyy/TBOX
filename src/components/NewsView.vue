<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  globalNews as newsItems, 
  isNewsLoading as isLoading, 
  lastNewsUpdate as lastUpdateTime 
} from '../store'

const totalFetched = computed(() => newsItems.value.length)

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

// -- Helper functions now in BackgroundMonitor.vue --

// -- Data is now managed by BackgroundMonitor.vue via global store --


const filteredNews = computed(() => {
  return newsItems.value.filter(item => {
    if (activeFilter.value.tag && item.cat !== activeFilter.value.tag) return false
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
  // Data is now handled by BackgroundMonitor.vue
})
onUnmounted(() => {
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden font-sans">
    
    <div class="min-h-16 md:h-20 border-b border-slate-800 flex items-center px-4 md:px-6 space-x-3 md:space-x-6 shrink-0 bg-[#0a0f1c] overflow-x-auto scrollbar-hide">
      <div class="flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-3 md:px-4 py-1.5 md:py-2.5 shrink-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <div class="text-[9px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase">今日訊號</div>
          <div class="text-white font-bold text-base md:text-lg leading-none">{{ totalFetched }}</div>
        </div>
      </div>

      <div class="flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-3 md:px-4 py-1.5 md:py-2.5 shrink-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center text-green-400">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" /></svg>
        </div>
        <div>
          <div class="text-[9px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase">載入新聞</div>
          <div class="text-white font-bold text-base md:text-lg leading-none">{{ filteredNews.length }}</div>
        </div>
      </div>

      <a :href="filteredNews[0]?.url || '#'" target="_blank" class="flex items-center space-x-3 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-3 md:px-4 py-1.5 md:py-2.5 min-w-[200px] md:min-w-[280px] cursor-pointer hover:bg-slate-800/50 transition-all group shrink-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-red-900/30 border border-red-800/50 flex items-center justify-center text-red-400 group-hover:bg-red-900/50">⚡</div>
        <div>
          <div class="text-[9px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase">最新頭條</div>
          <div class="text-white font-bold text-xs md:text-sm leading-snug truncate max-w-[120px] md:max-w-[200px] group-hover:text-blue-400 transition-colors">{{ filteredNews[0]?.headline || '暫無即時新聞' }}</div>
        </div>
      </a>

      <div class="ml-auto flex flex-col items-end shrink-0 hidden sm:flex">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">Live News Stream</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">
          最後更新: {{ lastUpdateTime }}
        </span>
      </div>
    </div>

    <div class="min-h-12 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-2 md:py-0 shrink-0 bg-[#0a0f1c] space-y-2 md:space-y-0">
      <div class="flex space-x-1 h-full items-center overflow-x-auto scrollbar-hide">
        <button v-for="tab in filterTabs" :key="tab.tag" @click="activeFilter = tab" class="h-8 md:h-12 px-3 md:px-4 border-b-2 transition-all text-[12px] md:text-[13px] font-medium whitespace-nowrap" :class="activeFilter.tag === tab.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'">{{ tab.label }}</button>
      </div>
      <div class="flex items-center space-x-2 md:ml-auto pr-0 md:pr-4 md:border-r border-slate-800 overflow-x-auto scrollbar-hide shrink-0">
        <button v-for="s in severityFilters" :key="s" @click="toggleSeverity(s)" class="text-[9px] md:text-[10px] font-bold px-2 md:px-3 py-1 rounded-md border transition-all whitespace-nowrap" :class="activeSeverity.includes(s) ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'border-slate-800 text-slate-600 hover:border-slate-700'">{{ s.toUpperCase() }}</button>
      </div>
      <div class="flex items-center bg-[#05080f] border border-slate-700 rounded-md px-3 py-1.5 w-full md:w-64 md:ml-4 focus-within:border-blue-500 transition-all shrink-0">
        <input v-model="searchQuery" type="text" placeholder="搜尋全站新聞..." class="bg-transparent outline-none text-[11px] md:text-xs text-slate-300 w-full" />
      </div>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-dark p-6">
      <div v-if="isLoading" class="flex items-center justify-center h-full"><div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
      <div v-else class="max-w-5xl mx-auto space-y-3">
        <div v-for="item in filteredNews" :key="item.id" class="news-card bg-[#0f1523] border border-[#1e293b] rounded-lg p-3 md:p-4 hover:border-slate-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.06)] transition-all group relative overflow-hidden flex items-start gap-4">
          <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" :class="item.accentColor"></div>
          
          <div class="relative shrink-0 mt-1">
            <img :src="item.avatar" class="w-8 h-8 rounded-full border border-slate-700" alt="" />
            <div v-if="item.severity === 'critical'" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f1523] animate-ping"></div>
          </div>

          <div class="flex-1 min-w-0">
            <!-- Meta Row -->
            <div class="flex items-center space-x-2 mb-1">
              <span class="text-white font-bold text-[13px] group-hover:text-blue-400 transition-colors uppercase tracking-tight">{{ item.source }}</span>
              <span class="text-slate-600 text-[11px] font-mono">· {{ item.time }}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500 border border-slate-700/50 uppercase">{{ item.cat }}</span>
              
              <button @click.stop="toggleTranslate(item)" class="ml-auto flex items-center space-x-1.5 text-[9px] font-bold px-2.5 py-1 rounded border border-slate-700/50 text-slate-500 hover:border-blue-500 hover:text-blue-400 transition-all bg-black/20">
                <svg v-if="translatingIds.has(item.id)" class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                </svg>
                <span>{{ translatedIds.has(item.id) ? 'ORIGINAL' : '翻譯' }}</span>
              </button>
            </div>

            <!-- Content Area: Flex Row for text and optional image -->
            <a :href="item.url" target="_blank" class="flex items-start gap-4">
              <div class="flex-1 min-w-0">
                <h4 class="text-slate-100 font-semibold text-[14px] leading-snug mb-1 group-hover:text-sky-300 transition-colors line-clamp-1">{{ getDisplayItem(item).headline }}</h4>
                <p v-if="item.summary" class="text-slate-500 text-[11px] leading-relaxed font-mono line-clamp-2">{{ getDisplayItem(item).summary }}</p>
              </div>

              <!-- Compact Fixed Image -->
              <div v-if="item.image" class="shrink-0">
                <img :src="item.image" class="w-32 h-20 rounded border border-slate-800 object-cover brightness-75 group-hover:brightness-100 transition-all" alt="Thumb" />
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
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>