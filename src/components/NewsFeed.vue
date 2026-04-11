<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import {
  globalNews,
  isNewsLoading as isLoading,
  setScrollProgress,
  isChangingTab
} from '../stores'

const scrollContainer = ref<HTMLElement | null>(null)

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

const activeFilter = ref('All')
const setFilter = async (f: string) => {
  isChangingTab.value = true
  activeFilter.value = f
  visibleCount.value = 5
  setScrollProgress(0)
  await nextTick()
  setTimeout(() => {
    isChangingTab.value = false
  }, 50)
}
const filters = ['All', 'Critical', 'High', 'Low']
const visibleCount = ref(5)

const getSeverity = (item: any) => {
  const h = (item.headline || '').toLowerCase()
  const s = (item.summary || '').toLowerCase()
  const text = h + ' ' + s
  
  if (text.includes('urgent') || text.includes('alert') || text.includes('sec') || text.includes('crash') || text.includes('hack')) return 'Critical'
  if (text.includes('surge') || text.includes('plunge') || text.includes('breakthrough') || text.includes('etf')) return 'High'
  return 'Low'
}

const severityColors: Record<string, string> = {
  'Critical': 'text-red-400 bg-red-900/20 border-red-500/30',
  'High': 'text-orange-400 bg-orange-900/20 border-orange-500/30',
  'Low': 'text-emerald-400 bg-emerald-900/20 border-emerald-500/30',
  'All': 'text-slate-400 bg-slate-800/40 border-slate-700'
}

const filteredAll = computed(() => {
  let items = globalNews.value
  if (activeFilter.value !== 'All') {
    items = items.filter(item => getSeverity(item) === activeFilter.value)
  }
  return items
})

const visibleNews = computed(() => {
  return filteredAll.value.slice(0, visibleCount.value).map(item => ({
    ...item,
    severity: getSeverity(item)
  })).map(item => disp(item))
})

const loadMore = async () => {
  visibleCount.value += 5
  await nextTick()
  // Small delay to ensure browser layout is stable
  setTimeout(() => {
    if (scrollContainer.value) {
      const el = scrollContainer.value
      const progress = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100
      setScrollProgress(progress)
    }
  }, 50)
}

const txCache = new Map<string, { headline: string; content: string }>()
const txing = ref(new Set<string>())
const txed = ref(new Set<string>())

async function tx(text: string): Promise<string> {
  if (!text) return ''
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=en|zh-TW`)
  const d = await res.json()
  return d.responseData?.translatedText || text
}

async function toggleTx(item: any) {
  if (txed.value.has(item.id)) { txed.value.delete(item.id); return }
  if (txCache.has(item.id)) { txed.value.add(item.id); return }
  txing.value.add(item.id)
  try {
    const [h, c] = await Promise.all([
      tx(item.headline),
      tx(item.summary?.slice(0, 400) || '')
    ])
    txCache.set(item.id, { headline: h, content: c })
    txed.value.add(item.id)
  } finally {
    txing.value.delete(item.id)
  }
}

function disp(item: any) {
  if (txed.value.has(item.id) && txCache.has(item.id)) {
    const t = txCache.get(item.id)!
    return { ...item, headline: t.headline, summary: t.content, txd: true }
  }
  return { ...item, txd: false }
}

const getTagColor = (tag: any) => {
  if (tag.type === 'critical') return 'border-red-600/50 text-red-500 bg-red-950/30'
  const label = (tag.label || '').toUpperCase()
  if (label === 'CRYPTO' || label === 'BTC' || label === 'ETH') return 'border-blue-600/50 text-blue-400 bg-blue-950/10'
  if (label === 'MARKETS' || label === 'GENERAL' || label === 'FINANCE') return 'border-emerald-600/50 text-emerald-400 bg-emerald-950/10'
  if (label === 'FOREX') return 'border-amber-600/50 text-amber-400 bg-amber-950/10'
  if (label === 'REGULATION') return 'border-purple-600/50 text-purple-400 bg-purple-950/10'
  if (label === 'DEFI' || label === 'ETF') return 'border-indigo-600/50 text-indigo-400 bg-indigo-950/10'
  return 'border-slate-700 text-slate-500 bg-slate-800/20'
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-[#0a0f1c] text-slate-300">
    <!-- Severity Filters -->
    <div class="grid grid-cols-4 gap-2 p-3 border-b border-slate-800 bg-[#070b14]">
      <button 
        v-for="f in filters" 
        :key="f"
        @click="setFilter(f)"
        class="w-full py-1.5 rounded text-[10px] font-bold border transition-all"
        :class="activeFilter === f 
          ? (severityColors[f] || '').replace('bg-', 'bg-opacity-40 bg-') + ' border-opacity-100 shadow-[0_0_10px_rgba(0,0,0,0.3)]'
          : 'bg-[#111827] text-slate-500 border-slate-800 hover:text-slate-300'"
      >
        {{ f }}
      </button>
    </div>

    <!-- Feed Content -->
    <div ref="scrollContainer" @scroll="handleScroll" class="flex-1 overflow-y-auto p-3 space-y-4">
      <div v-for="item in visibleNews" :key="item.id" class="news-card bg-[#111827] border border-slate-800 rounded-lg p-4 relative overflow-hidden group">
        <!-- Left accent line -->
        <div class="absolute left-0 top-0 bottom-0 w-1 transition-colors duration-500" :class="item.accentColor"></div>

        <!-- Severity Badge -->
        <div class="absolute top-3 right-3 flex items-center space-x-2">
          <div v-if="item.severity" :class="severityColors[item.severity]" class="text-[8px] px-1.5 py-0.5 rounded border border-opacity-30 uppercase font-black tracking-tighter shadow-sm">
            {{ item.severity }}
          </div>
          <button @click="toggleTx(item)" class="p-1 hover:bg-slate-800 rounded bg-[#070b14]/50 border border-slate-800/50 text-slate-500 transition-colors">
            <span v-if="txing.has(item.id)" class="block w-2 h-2 border border-violet-400 border-t-transparent rounded-full animate-spin"></span>
            <span v-else class="text-[9px] font-bold">譯</span>
          </button>
        </div>
          
        <!-- Avatar + Meta Area -->
        <div class="flex items-center space-x-3 mb-3">
          <img :src="item.avatar" class="w-8 h-8 rounded-full flex-shrink-0" alt="" />
          <div class="flex-1 min-w-0 flex flex-col">
            <div class="flex items-center gap-1.5 text-[11px] font-mono leading-none">
              <span class="font-bold text-white truncate text-xs">{{ item.source }}</span>
              <span v-if="item.isOfficial" class="text-green-500 font-bold bg-green-500/10 px-1 rounded text-[8px] scale-90 origin-left">OFFICIAL</span>
              <span class="text-slate-600">·</span>
              <span class="text-slate-500 whitespace-nowrap">{{ item.time }}</span>
            </div>
            <span class="text-slate-600 text-[10px] truncate leading-tight">{{ item.handle }}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 mb-3">
          <span v-for="tag in item.tags" :key="tag.label" 
            class="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wider font-mono flex items-center whitespace-nowrap transition-colors"
            :class="getTagColor(tag)">
            <span v-if="tag.icon" class="mr-1 scale-90">{{ tag.icon }}</span>
            {{ tag.label }}
          </span>
        </div>

        <a :href="item.url" target="_blank" class="block group/link">
          <h4 class="text-blue-400 font-bold text-sm leading-snug group-hover/link:underline break-words mb-2">
            {{ item.headline }}
            <span v-if="item.txd" class="text-[9px] text-violet-400 font-mono">[譯]</span>
          </h4>
          <p class="text-slate-400 text-[11px] leading-relaxed font-mono line-clamp-3 break-words mb-3" v-html="item.summary"></p>
          
          <!-- Featured Image -->
          <img v-if="item.image" :src="item.image" class="rounded border border-slate-700/50 w-full aspect-video object-cover brightness-90 group-hover:brightness-100 transition-all mb-3" alt="News" />
        </a>

        <a :href="item.url" target="_blank" class="block w-full text-center py-2 mt-2 bg-blue-900/10 border border-blue-900/30 rounded text-blue-500 font-bold tracking-widest text-[9px] hover:bg-blue-900/20 hover:text-blue-400 transition-colors font-mono cursor-pointer">
          VIEW SOURCE
        </a>
      </div>
      
      <!-- Placeholder for more items -->
      <div v-if="isLoading" class="bg-[#111827] border border-slate-800 rounded-lg p-4 opacity-50 flex items-center justify-center h-24">
        <div class="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div>
      </div>

      <!-- Load More Button -->
      <div v-if="filteredAll.length > visibleCount" class="pt-2 pb-24 md:pb-6 flex justify-center">
        <button 
          @click="loadMore"
          class="px-6 py-2 bg-[#111827] hover:bg-slate-800 border border-slate-800 rounded text-[10px] font-bold text-slate-400 transition-all font-mono shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        >
          LOAD MORE ({{ Math.min(visibleCount, filteredAll.length) }} / {{ filteredAll.length }})
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  line-clamp: 3;
  overflow: hidden;
}
</style>
