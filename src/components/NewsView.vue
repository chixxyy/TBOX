<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { 
  globalNews as newsItems, 
  isNewsLoading as isLoading, 
  lastNewsUpdate as lastUpdateTime,
  setScrollProgress,
  isChangingTab,
  showToast
} from '../store'

const openUrl = (url?: string) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

let rafId: number | null = null
const handleScroll = (e: Event) => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const el = e.target as HTMLElement
    const scrollMax = el.scrollHeight - el.clientHeight
    if (scrollMax <= 0) {
      setScrollProgress(0)
    } else {
      const progress = (el.scrollTop / scrollMax) * 100
      setScrollProgress(progress)
    }
  })
}

const totalFetched = computed(() => newsItems.value.length)

// 分類選單配置
const filterTabs = [
  { label: '全部', tag: '' },
  { label: '運動', tag: 'sports' },
  { label: '加密', tag: 'crypto' },
  { label: '財經', tag: 'general' },
]
const severityFilters = ['Critical', 'High', 'Low']
const activeFilter = ref({ label: '全部', tag: '' })
const activeSeverity = ref<string[]>([])
const searchQuery = ref('')

const setFilter = async (tab: any) => {
  isChangingTab.value = true
  activeFilter.value = tab
  setScrollProgress(0)
  await nextTick()
  setTimeout(() => {
    isChangingTab.value = false
  }, 50)
}

const filteredNews = computed(() => {
  return newsItems.value.filter(item => {
    if (activeFilter.value.tag && item.cat !== activeFilter.value.tag) return false
    if (activeSeverity.value.length && !activeSeverity.value.map(s => s.toLowerCase()).includes(item.severity)) return false
    if (searchQuery.value && !item.headline.toLowerCase().includes(searchQuery.value.toLowerCase())) return false
    return true
  })
})

function toggleSeverity(s: string) {
  isChangingTab.value = true
  const i = activeSeverity.value.indexOf(s)
  if (i === -1) activeSeverity.value.push(s)
  else activeSeverity.value.splice(i, 1)
  
  setScrollProgress(0)
  nextTick().then(() => {
    setTimeout(() => {
      isChangingTab.value = false
    }, 50)
  })
}

// 翻譯功能相關邏輯
const translationCache = new Map<string | number, { headline: string; summary: string }>()
const translatingIds = ref<Set<string | number>>(new Set())
const translatedIds = ref<Set<string | number>>(new Set())

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)
    const data = await res.json()
    if (data.responseStatus !== 200) {
      console.warn('[NEWS_TRANSLATE] API returned non-200 status:', data)
      return text
    }
    return data.responseData?.translatedText || text
  } catch (err) { 
    console.error('[NEWS_TRANSLATE] Error fetching translation:', err)
    return text 
  }
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
    
    if (headline === item.headline && (!item.summary || summary === item.summary)) {
      showToast('翻譯未生效', 'API 目前暫時無法回應（可能已達每日限額）。')
      return
    }

    translationCache.set(item.id, { headline, summary })
    translatedIds.value.add(item.id)
  } catch (err) {
    console.error('[NEWS_TRANSLATE] Toggle error:', err)
    showToast('翻譯錯誤', '無法連接到翻譯伺服器')
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

const getSentiment = (item: any) => {
  const text = (item.headline + (item.summary || '')).toLowerCase()
  if (/\b(bull|surge|rally|gain|record|high|growth|buy|positive|up|top)\b/.test(text)) return { label: 'BULLISH', color: 'border-green-900/40 bg-green-950/20 text-green-500' }
  if (/\b(bear|crash|plunge|drop|loss|inflation|hike|sell|negative|down)\b/.test(text)) return { label: 'BEARISH', color: 'border-red-900/40 bg-red-950/20 text-red-500' }
  return { label: 'NEUTRAL', color: 'border-slate-800 bg-slate-800/20 text-slate-500' }
}

const getReadTime = (item: any) => {
  const content = item.headline + (item.summary || '')
  const mins = Math.max(1, Math.ceil(content.length / 500))
  return `${mins} MIN READ`
}

const getTagColor = (item: any) => {
  if (item.severity === 'critical') return 'bg-red-950/30 text-red-400 border-red-900/50 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
  const c = (item.cat || '').toLowerCase()
  if (c === 'crypto' || c === 'bitcoin' || c === 'eth') return 'bg-blue-950/30 text-blue-400 border-blue-900/50'
  if (c === 'markets' || c === 'general' || c === 'finance') return 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50'
  if (c === 'forex') return 'bg-amber-950/30 text-amber-400 border-amber-900/50'
  if (c === 'regulation') return 'bg-purple-950/30 text-purple-400 border-purple-900/50'
  if (c === 'defi' || c === 'etf') return 'bg-indigo-950/30 text-indigo-400 border-indigo-900/50'
  return 'bg-slate-800/80 text-slate-500 border-slate-700/50'
}

onMounted(() => {
  // Data handled by BackgroundMonitor.vue
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300 overflow-hidden font-sans">
    <div class="h-16 md:h-20 border-b border-slate-800 flex items-center px-2 md:px-6 space-x-2 md:space-x-4 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      <!--今日訊號-->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">今日訊號</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ totalFetched }}</div>
        </div>
      </div>

      <!--載入新聞-->
      <div class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-emerald-900/30 border border-emerald-800/50 flex items-center justify-center text-emerald-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">載入新聞</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ filteredNews.length }}</div>
        </div>
      </div>

      <!--最新頭條-->
      <div 
        @click="openUrl(filteredNews[0]?.url)"
        class="flex-1 flex items-center space-x-2 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0 cursor-pointer hover:bg-slate-800/50 transition-all group overflow-hidden"
      >
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-amber-900/30 border border-amber-800/50 flex items-center justify-center text-amber-400 shrink-0">⚡</div>
        <div class="min-w-0 flex-1">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">最新頭條</div>
          <div class="text-white font-bold text-[10px] md:text-sm leading-none truncate group-hover:text-blue-400 transition-colors">
            {{ filteredNews[0]?.headline || '暫無資料' }}
          </div>
        </div>
      </div>

      <div class="hidden lg:flex flex-col items-end shrink-0 ml-auto">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">News Live Stream</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">最後更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <div class="sticky top-0 z-20 bg-[#0a0f1c]/95 backdrop-blur-md border-b border-slate-800/80 px-1.5 md:px-6 py-0 flex flex-col md:flex-row md:items-center gap-0 md:gap-3">
      <div class="flex items-center w-full md:w-auto flex-1 h-full">
        <button 
          v-for="tab in filterTabs" 
          :key="tab.tag" 
          @click="setFilter(tab)" 
          class="flex-1 h-11 md:h-12 px-1 md:px-4 border-b-2 transition-all text-[10px] md:text-[13px] font-bold whitespace-nowrap text-center" 
          :class="activeFilter.tag === tab.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          {{ tab.label }}
        </button>
      </div>
      
      <div class="flex items-center justify-between md:justify-end gap-1.5 md:ml-auto shrink-0 w-full md:w-auto pb-1 md:pb-0">
          <div class="flex items-center gap-1 md:gap-2 flex-1 md:flex-none">
            <button
              v-for="s in severityFilters" :key="s"
              @click="toggleSeverity(s)"
              class="flex-1 md:flex-none px-2 md:px-5 py-1 md:py-1.5 rounded-lg border text-[9px] md:text-[11px] font-bold tracking-tighter md:tracking-widest transition-all text-center whitespace-nowrap"
              :class="[
                activeSeverity.includes(s)
                  ? (s === 'Critical' ? 'bg-red-950/20 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                     s === 'High' ? 'bg-amber-950/20 border-amber-500 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]' :
                     'bg-blue-900/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]')
                  : 'border-slate-800 text-slate-500 hover:border-slate-600 bg-slate-900/40'
              ]"
            >
              {{ s.toUpperCase() }}
            </button>
          </div>
      </div>
      <div class="flex items-center bg-[#05080f] border border-slate-700 rounded-md px-3 py-1.5 w-full md:w-64 md:ml-4 focus-within:border-blue-500 transition-all shrink-0">
        <input v-model="searchQuery" type="text" placeholder="搜尋全站新聞..." class="bg-transparent outline-none text-[11px] md:text-xs text-slate-300 w-full" />
      </div>
    </div>

    <!-- Scrollable Content -->
    <div @scroll="handleScroll" class="flex-1 overflow-y-auto scrollbar-hide p-6 pb-24 md:pb-6">
      <div v-if="isLoading" class="flex items-center justify-center h-full">
        <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
      <div v-else-if="filteredNews.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
        <span class="text-sm font-medium tracking-wide">此分類目前各級別暫無即時新聞內容</span>
      </div>
      <div v-else class="max-w-5xl mx-auto space-y-3">
        <div v-for="item in filteredNews" :key="item.id" class="news-card bg-[#0f1523] border border-[#1e293b] rounded-lg p-3 md:p-4 hover:border-slate-600 hover:shadow-[0_0_15px_rgba(59,130,246,0.06)] transition-all group relative overflow-hidden flex items-start gap-4">
          <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" :class="item.accentColor"></div>
          
          <div class="relative shrink-0 mt-1">
            <img :src="item.avatar" class="w-8 h-8 rounded-full border border-slate-700" alt="" />
            <div v-if="item.severity === 'critical'" class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f1523] animate-ping"></div>
          </div>

          <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2">
                <span class="text-white font-bold text-[13px] group-hover:text-sky-400 transition-colors uppercase tracking-tight">{{ item.source }}</span>
                <span class="text-slate-600 text-[11px] font-mono">· {{ item.time }}</span>
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase transition-all duration-300" :class="getTagColor(item)">{{ item.cat }}</span>
                <button @click.stop="toggleTranslate(item)" class="flex items-center shrink-0 whitespace-nowrap space-x-1.5 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-700/50 text-slate-500 hover:border-blue-500 hover:text-blue-400 transition-all bg-black/20">
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

            <a :href="item.url" target="_blank" class="flex items-start gap-5 py-1">
              <div class="flex-1 min-w-0 flex flex-col min-h-[112px]">
                <h4 class="text-slate-100 font-bold text-[15px] leading-snug mb-2 group-hover:text-sky-400 transition-colors line-clamp-2 max-w-[800px]">{{ getDisplayItem(item).headline }}</h4>
                <p v-if="getDisplayItem(item).summary" class="text-slate-500 text-[11px] leading-relaxed font-mono line-clamp-2 mb-3">{{ getDisplayItem(item).summary }}</p>
                
                <div class="mt-auto flex items-center gap-4 text-[9px] font-bold tracking-wider font-mono opacity-90 pt-2 border-t border-slate-800/20">
                  <span class="flex items-center gap-1.5 text-slate-500 bg-slate-800/30 px-2 py-0.5 rounded shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {{ getReadTime(item) }}
                  </span>
                  <span class="px-2 py-0.5 rounded border shadow-sm transition-colors" :class="getSentiment(item).color">{{ getSentiment(item).label }}</span>
                  <span class="text-blue-500/80 hover:text-blue-400 font-bold transition-colors ml-auto flex items-center gap-1">SOURCE ↗</span>
                </div>
              </div>

              <div v-if="item.image" class="shrink-0 self-start">
                <img :src="item.image" class="w-44 h-28 rounded border border-slate-700/50 object-cover brightness-90 group-hover:brightness-100 group-hover:border-slate-500 transition-all opacity-95 shadow-md" alt="Thumb" />
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