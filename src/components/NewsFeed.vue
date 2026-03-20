<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const newsItems = ref<any[]>([])
const isLoading = ref(true)
let refreshInterval: ReturnType<typeof setInterval>
const knownIds = new Set<string>()

function getRelativeTime(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function playChime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1320, 1760].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.13)
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.13)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + i * 0.13 + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.13 + 0.4)
      osc.start(ctx.currentTime + i * 0.13)
      osc.stop(ctx.currentTime + i * 0.13 + 0.5)
    })
  } catch {}
}

async function fetchFinnhub(): Promise<any[]> {
  const cats = ['crypto', 'general', 'forex']
  const results = await Promise.all(
    cats.map(c => fetch(`https://finnhub.io/api/v1/news?category=${c}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`).then(r => r.json()).catch(() => []))
  )
  return results.flat().map((item: any, i: number) => ({
    uid: `fh-${item.id || i}`,
    source: item.source,
    cat: (item.category || 'general').toLowerCase(),
    ts: item.datetime * 1000,
    headline: item.headline,
    summary: item.summary || '',
    image: item.image || '',
    url: item.url || '#',
    avatarBg: item.category === 'crypto' ? '3b82f6' : item.category === 'forex' ? 'f59e0b' : '10b981',
    isCritical: item.headline?.toLowerCase().includes('hack') || item.headline?.toLowerCase().includes('sec'),
  }))
}

async function fetchCC(): Promise<any[]> {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=50&sortOrder=latest')
  const data = await res.json()
  return (data.Data || []).map((item: any) => ({
    uid: `cc-${item.id}`,
    source: item.source_info?.name || item.source,
    cat: 'crypto',
    ts: item.published_on * 1000,
    headline: item.title,
    summary: item.body?.slice(0, 200) || '',
    image: item.imageurl || '',
    url: item.url || '#',
    avatarBg: '7c3aed',
    isCritical: false,
  }))
}

async function fetchNews() {
  try {
    const [fh, cc] = await Promise.allSettled([fetchFinnhub(), fetchCC()])
    const all = [
      ...(fh.status === 'fulfilled' ? fh.value : []),
      ...(cc.status === 'fulfilled' ? cc.value : []),
    ]
    const unique = new Map<string, any>()
    all.forEach(item => unique.set(item.uid, item))
    const sorted = Array.from(unique.values()).sort((a, b) => b.ts - a.ts)

    // Detect new items (skip on first load)
    const isFirstLoad = knownIds.size === 0
    let hasNew = false
    sorted.forEach(item => {
      if (!knownIds.has(item.uid)) {
        if (!isFirstLoad) hasNew = true
        knownIds.add(item.uid)
      }
    })
    if (hasNew) playChime()

    newsItems.value = sorted.slice(0, 60).map(item => {
      const categoryLabel = item.cat.toUpperCase()
      return {
        id: item.uid,
        source: item.source,
        handle: `@${item.source.replace(/\s+/g, '')}`,
        isOfficial: true,
        time: getRelativeTime(item.ts),
        tags: [
          item.isCritical
            ? { type: 'critical', label: 'CRITICAL', icon: '⚠️' }
            : { type: 'news', label: categoryLabel, icon: '📰' }
        ],
        headline: item.headline,
        content: item.summary,
        image: item.image,
        url: item.url,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.source)}&background=${item.avatarBg}&color=fff&rounded=true&font-size=0.4&bold=true`
      }
    })
  } catch (e) {
    console.error('Failed to fetch news', e)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchNews()
  refreshInterval = setInterval(fetchNews, 30_000)
})

onUnmounted(() => clearInterval(refreshInterval))

// Translation
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
</script>

<template>
  <div class="flex flex-col h-full bg-[#0a0f1c] text-xs">


    <!-- Feed Content -->
    <div class="flex-1 overflow-y-auto p-3 space-y-4">
      <div v-for="item in newsItems" :key="item.id" class="bg-[#111827] border border-slate-800 rounded-lg p-4 relative overflow-hidden group">
        <!-- Left accent line -->
        <div class="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>

        <div class="flex space-x-3 overflow-hidden">
          <img :src="item.avatar" class="w-10 h-10 rounded-full flex-shrink-0" alt="" />
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2 text-[11px] mb-2 font-mono">
              <span class="font-bold text-white text-sm truncate">{{ item.source }}</span>
              <span class="text-slate-500 truncate">{{ item.handle }}</span>
              <span v-if="item.isOfficial" class="text-green-500 font-bold bg-green-500/10 px-1 rounded whitespace-nowrap">OFFICIAL</span>
              <span class="text-slate-600">·</span>
              <span class="text-slate-500 whitespace-nowrap">{{ item.time }}</span>
            </div>

            <div class="flex flex-wrap gap-2 mb-3">
              <span v-for="tag in item.tags" :key="tag.label" 
                class="px-2 py-0.5 rounded border text-[9px] font-bold tracking-wider font-mono flex items-center whitespace-nowrap"
                :class="{
                  'border-yellow-600/50 text-yellow-500': tag.type === 'quote',
                  'border-red-600/50 text-red-500 bg-red-950/30': tag.type === 'critical',
                  'border-red-600/50 text-red-400': tag.type === 'politics',
                }">
                <span v-if="tag.type === 'quote'" class="mr-1">💬</span>
                <span v-if="tag.icon" class="mr-1">{{ tag.icon }}</span>
                {{ tag.label }}
              </span>
            </div>

            <a :href="item.url" target="_blank" class="block group/link mb-4">
              <div class="flex items-start justify-between gap-2 mb-1">
                <h4 class="text-blue-400 font-bold text-sm group-hover/link:underline break-words flex-1" v-if="item.headline">
                  {{ disp(item).headline }}
                  <span v-if="disp(item).txd" class="text-[9px] text-violet-400 font-mono">[譯]</span>
                </h4>
                <!-- Translate button -->
                <button
                  @click.prevent.stop="toggleTx(item)"
                  class="shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border transition-colors"
                  :class="txed.has(item.id) ? 'bg-violet-900/30 border-violet-700 text-violet-400' : 'border-slate-700 text-slate-500 hover:border-violet-700 hover:text-violet-400'"
                >
                  <span v-if="txing.has(item.id)" class="w-2 h-2 border border-violet-400 border-t-transparent rounded-full animate-spin"></span>
                  <span v-else>譯</span>
                </button>
              </div>
              <p class="text-slate-300 text-sm leading-relaxed font-mono break-words" v-html="disp(item).content"></p>
            </a>

            <img v-if="item.image" :src="item.image" class="rounded-md border border-slate-700 w-full object-cover max-h-48 mb-4 brightness-75 group-hover:brightness-100 transition-all opacity-80" alt="News Image" />

            <a :href="item.url" target="_blank" class="block w-full text-center py-2 bg-blue-900/10 border border-blue-900/50 rounded text-blue-500 font-bold tracking-widest text-[10px] hover:bg-blue-900/30 hover:text-blue-400 transition-colors font-mono cursor-pointer">
              READ FULL ARTICLE
            </a>
          </div>
        </div>
      </div>
      
      <!-- Placeholder for more items -->
      <div v-if="isLoading" class="bg-[#111827] border border-slate-800 rounded-lg p-4 opacity-50 flex items-center justify-center h-24">
        <div class="w-4 h-4 border-2 border-slate-600 border-t-slate-400 rounded-full animate-spin"></div>
      </div>
    </div>
  </div>
</template>
