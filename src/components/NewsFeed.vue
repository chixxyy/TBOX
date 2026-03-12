<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// ... tabs, categories, filters remain the same ...


const newsItems = ref<any[]>([])
const isLoading = ref(true)
let refreshInterval: ReturnType<typeof setInterval>

function getRelativeTime(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

async function fetchNews() {
  try {
    const categories = ['crypto', 'general', 'forex']
    const promises = categories.map(cat => 
      fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`).then(res => res.json())
    )
    
    const results = await Promise.all(promises)
    let allNews = results.flat()
    
    // Sort by newest first
    allNews.sort((a, b) => b.datetime - a.datetime)
    
    // Remove duplicates just in case
    const uniqueNewsMap = new Map()
    allNews.forEach(item => uniqueNewsMap.set(item.id, item))
    allNews = Array.from(uniqueNewsMap.values())
    
    newsItems.value = allNews.slice(0, 50).map((item: any, index: number) => {
      const isCritical = item.headline.toLowerCase().includes('hack') || item.headline.toLowerCase().includes('sec');
      const categoryLabel = (item.category || 'NEWS').toUpperCase()
      const cat = item.category ? item.category.toLowerCase() : ''
      
      let avatarBg = '1d4ed8' // blue-700 default
      if (isCritical) {
        avatarBg = 'ef4444' // red-500
      } else if (cat === 'crypto') {
        avatarBg = '3b82f6' // blue-500
      } else if (cat === 'general') {
        avatarBg = '10b981' // emerald-500
      } else if (cat === 'forex') {
        avatarBg = 'f59e0b' // amber-500
      }
      
      return {
        id: item.id || index,
        source: item.source,
        handle: `@${item.source.replace(/\s+/g, '')}`,
        isOfficial: true,
        time: getRelativeTime(item.datetime * 1000),
        tags: [
          isCritical ? { type: 'critical', label: 'CRITICAL', icon: '⚠️' } : { type: 'politics', label: categoryLabel, icon: '📰' }
        ],
        headline: item.headline,
        content: item.summary,
        image: item.image || '',
        url: item.url,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.source)}&background=${avatarBg}&color=fff&rounded=true&font-size=0.4&bold=true`
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
  // Refresh news every 60 seconds
  refreshInterval = setInterval(fetchNews, 60000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
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
              <h4 class="text-blue-400 font-bold text-sm mb-1 group-hover/link:underline break-words" v-if="item.headline">{{ item.headline }}</h4>
              <p class="text-slate-300 text-sm leading-relaxed font-mono break-words" v-html="item.content"></p>
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
