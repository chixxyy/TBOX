<script setup lang="ts">
import { ref } from 'vue'
import { 
  globalNews as newsItems, 
  isNewsLoading as isLoading 
} from '../store'

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
      tx(item.content?.slice(0, 400) || '')
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
    return { ...item, headline: t.headline, content: t.content, txd: true }
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
  <div class="flex flex-col h-full bg-[#0a0f1c] text-xs">


    <!-- Feed Content -->
    <div class="flex-1 overflow-y-auto p-3 pb-24 md:pb-6 space-y-4">
      <div v-for="item in newsItems" :key="item.id" class="news-card bg-[#111827] border border-slate-800 rounded-lg p-4 relative overflow-hidden group">
        <!-- Left accent line -->
        <div class="absolute left-0 top-0 bottom-0 w-1" :class="item.accentColor || 'bg-slate-700/50'"></div>

        <div class="flex flex-col gap-3 overflow-hidden">
          
          <!-- Avatar + Meta Area -->
          <div class="flex items-center space-x-3">
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

          <div class="flex flex-wrap gap-1.5">
            <span v-for="tag in item.tags" :key="tag.label" 
              class="px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wider font-mono flex items-center whitespace-nowrap transition-colors"
              :class="getTagColor(tag)">
              <span v-if="tag.icon" class="mr-1 scale-90">{{ tag.icon }}</span>
              {{ tag.label }}
            </span>
          </div>

          <a :href="item.url" target="_blank" class="block group/link">
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <h4 class="text-blue-400 font-bold text-sm leading-snug group-hover/link:underline break-words flex-1" v-if="item.headline">
                {{ disp(item).headline }}
                <span v-if="disp(item).txd" class="text-[9px] text-violet-400 font-mono">[譯]</span>
              </h4>
              <button
                @click.prevent.stop="toggleTx(item)"
                class="shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-700 text-slate-500 hover:border-violet-700 hover:text-violet-400 transition-colors bg-black/20"
              >
                <span v-if="txing.has(item.id)" class="w-2 h-2 border border-violet-400 border-t-transparent rounded-full animate-spin"></span>
                <span v-else>譯</span>
              </button>
            </div>
            <p class="text-slate-400 text-[11px] leading-relaxed font-mono line-clamp-3 break-words mb-3" v-html="disp(item).content"></p>
            
            <!-- Featured Image 100% -->
            <img v-if="item.image" :src="item.image" class="rounded border border-slate-700/50 w-full aspect-video object-cover brightness-90 group-hover:brightness-100 transition-all mb-3" alt="News" />
          </a>
        </div>

        <a :href="item.url" target="_blank" class="block w-full text-center py-2 mt-1 bg-blue-900/10 border border-blue-900/30 rounded text-blue-500 font-bold tracking-widest text-[9px] hover:bg-blue-900/20 hover:text-blue-400 transition-colors font-mono cursor-pointer">
          VIEW SOURCE
        </a>
      </div>
      
      <!-- Placeholder for more items -->
      <div v-if="isLoading" class="bg-[#111827] border border-slate-800 rounded-lg p-4 opacity-50 flex items-center justify-center h-24">
        <div class="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div>
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
