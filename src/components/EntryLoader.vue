<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { isEntryLoading, chatSession, goToLogin, globalNews } from '../stores'
import Globe from 'globe.gl'

const globeEl = ref<HTMLElement | null>(null)
let globe: any = null

const isReady = ref(false)
const entryType = computed(() => chatSession.value ? 'ACCESS' : 'LOGIN')

const selectedNews = ref<any>(null)
const translatedTitle = ref('')
const translatedSummary = ref('')
const isTranslating = ref(false)

const CITIES = [
  { lat: 40.7128, lng: -74.0060, name: 'New York' },
  { lat: 51.5074, lng: -0.1278, name: 'London' },
  { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
  { lat: 25.0330, lng: 121.5654, name: 'Taipei' },
  { lat: 48.8566, lng: 2.3522, name: 'Paris' },
  { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
  { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
  { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
  { lat: 50.1109, lng: 8.6821, name: 'Frankfurt' },
  { lat: 25.2048, lng: 55.2708, name: 'Dubai' }
]

const globeData = computed(() => {
  if (!globalNews.value || globalNews.value.length === 0) return []
  
  // Guarantee that ALL critical news are displayed (up to 50), filling the rest with normal news
  const criticalNews = globalNews.value.filter((n: any) => n.severity === 'critical')
  const normalNews = globalNews.value.filter((n: any) => n.severity !== 'critical')
  const selectedNews = [...criticalNews, ...normalNews].slice(0, 50)
  
  // Track how many items are assigned to each city to create a neat spiral offset
  const cityCounts: Record<string, number> = {}
  
  return selectedNews.map((news: any, index: number) => {
    const city = CITIES[index % CITIES.length]!
    
    // Golden angle spiral distribution
    const count = cityCounts[city.name] || 0
    cityCounts[city.name] = count + 1
    
    let lat = city.lat
    let lng = city.lng
    
    if (count > 0) {
      const radius = count * 1.5 // Expand outward by 1.5 degrees per item
      const angle = count * 137.5 * (Math.PI / 180) // Golden angle in radians
      lat += radius * Math.sin(angle)
      lng += radius * Math.cos(angle)
    }

    return {
      ...news,
      lat,
      lng,
      size: Math.random() * 0.5 + 0.5,
      isBreaking: news.severity === 'critical'
    }
  })
})

const translateText = async (text: string) => {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    const data = await res.json()
    if (data && data.responseData && data.responseData.translatedText) {
      return data.responseData.translatedText
    }
  } catch (e) {
    console.error('Translation error:', e)
  }
  return text
}

const handleTranslate = async () => {
  if (!selectedNews.value) return
  isTranslating.value = true
  
  try {
    const [title, summary] = await Promise.all([
      translateText(selectedNews.value.headline),
      translateText(selectedNews.value.summary || '無詳細內容')
    ])
    translatedTitle.value = title
    translatedSummary.value = summary
  } finally {
    isTranslating.value = false
  }
}

const selectNews = (news: any) => {
  selectedNews.value = news
  translatedTitle.value = ''
  translatedSummary.value = ''
  
  if (globe) {
    globe.pointOfView({ lat: news.lat, lng: news.lng, altitude: 1.5 }, 1000)
  }
}

const closeNews = () => {
  selectedNews.value = null
  if (globe) {
    globe.pointOfView({ altitude: 2.5 }, 1000)
  }
}

const enterTerminal = () => {
  if (entryType.value === 'LOGIN') {
    goToLogin()
  }
  isEntryLoading.value = false
}

const handleResize = () => {
  if (globe && globeEl.value) {
    globe.width(window.innerWidth).height(window.innerHeight)
  }
}

onMounted(() => {
  setTimeout(() => {
    isReady.value = true
  }, 2000)

  if (globeEl.value) {
    globe = (Globe as any)()(globeEl.value)
      .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
      .pointOfView({ lat: 23.5, lng: 121, altitude: 2.5 })
      
    globe.controls().autoRotate = true
    globe.controls().autoRotateSpeed = 0.5
    globe.controls().enableZoom = false

    window.addEventListener('resize', handleResize)
    
    // Draw HTML elements over the globe for news markers
    globe.htmlElementsData(globeData.value)
      .htmlElement((d: any) => {
        const el = document.createElement('div');
        
        if (d.isBreaking) {
          el.innerHTML = `
            <div class="relative group cursor-pointer">
              <div class="absolute -inset-2 rounded-full blur-sm opacity-75 animate-ping" style="background-color: #ef4444"></div>
              <div class="relative w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,1)] transition-transform group-hover:scale-125" style="background-color: #ef4444">
                 <span class="absolute text-[8px] -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 px-1 py-0.5 rounded backdrop-blur-sm pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.8)]">
                   BREAKING
                 </span>
              </div>
            </div>
          `;
        } else {
          el.innerHTML = `
            <div class="relative group cursor-pointer animate-pulse-slow">
              <div class="absolute -inset-2 rounded-full blur-sm opacity-50 transition-opacity group-hover:opacity-100" style="background-color: #${d.avatarBg || '10b981'}"></div>
              <div class="relative w-4 h-4 rounded-full border-2 border-white/50 flex items-center justify-center shadow-lg transition-transform group-hover:scale-125" style="background-color: #${d.avatarBg || '10b981'}">
                 <span class="absolute text-[8px] -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-1 py-0.5 rounded backdrop-blur-sm pointer-events-none">
                   ${d.cat.toUpperCase()}
                 </span>
              </div>
            </div>
          `;
        }
        
        el.style.pointerEvents = 'auto';
        el.onclick = () => selectNews(d);
        return el;
      })
  }
})

watch(globeData, (newData) => {
  if (globe) {
    globe.htmlElementsData(newData)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (globe) {
    globe._destructor()
  }
})
</script>

<template>
  <div class="fixed inset-0 z-[9999] bg-[#070b14] overflow-hidden font-mono">
    
    <!-- 3D Globe Container -->
    <div ref="globeEl" class="absolute inset-0 z-0"></div>

    <!-- UI Overlay: Glassmorphism Header -->
    <div class="absolute top-0 inset-x-0 z-10 p-4 md:p-6 flex justify-between items-start pointer-events-none">
      <div class="pointer-events-auto">
        <h1 class="text-3xl md:text-5xl font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-focus-in">
          TBOX
        </h1>
        <p class="text-[10px] text-emerald-400/80 tracking-widest uppercase mt-1 animate-pulse font-bold">
          Global Intelligence
        </p>
      </div>
    </div>

    <!-- Interactive News Modal -->
    <transition name="modal">
      <div v-if="selectedNews" class="absolute right-6 top-24 bottom-24 w-80 md:w-96 bg-[#0c1220]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl flex flex-col z-20 overflow-hidden">
        <!-- Close Button -->
        <button @click="closeNews" class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/50 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
        
        <div class="flex items-center gap-3 mb-4 mt-2">
          <div class="px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider" :style="{ backgroundColor: '#' + (selectedNews.avatarBg || '10b981') }">
            {{ selectedNews.cat }}
          </div>
          <span class="text-xs text-slate-400">{{ selectedNews.time || 'Just now' }}</span>
        </div>

        <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
          <h3 class="text-lg md:text-xl font-bold text-white leading-snug">
            {{ translatedTitle || selectedNews.headline }}
          </h3>
          <p class="text-sm text-slate-300 leading-relaxed opacity-80">
            {{ translatedSummary || selectedNews.summary || 'No detailed content available.' }}
          </p>
          
          <a v-if="selectedNews.url && selectedNews.url !== '#'" :href="selectedNews.url" target="_blank" class="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
            閱讀原文
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        </div>

        <!-- Translation & Action Buttons -->
        <div class="mt-4 pt-4 border-t border-slate-700/50 flex gap-3">
          <button 
            @click="handleTranslate" 
            :disabled="isTranslating || !!translatedTitle"
            class="flex-1 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2"
            :class="translatedTitle ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'"
          >
            <svg v-if="isTranslating" class="animate-spin h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else-if="translatedTitle" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" clip-rule="evenodd" />
            </svg>
            {{ isTranslating ? '翻譯中...' : (translatedTitle ? '已翻譯' : '翻譯中文') }}
          </button>
        </div>
      </div>
    </transition>

    <!-- Bottom Right Entry UI -->
    <div class="absolute bottom-0 right-0 z-10 p-6 pointer-events-none">
      <transition name="fade-quick">
        <div v-if="isReady" class="pointer-events-auto">
          <button 
            @click="enterTerminal"
            class="group relative px-8 py-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl overflow-hidden hover:bg-emerald-500/20 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.15)] backdrop-blur-md"
          >
            <div class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-emerald-400/20 via-transparent to-cyan-400/20 animate-pulse-slow"></div>
            <span class="relative text-sm font-black text-emerald-400 tracking-[0.4em] uppercase group-hover:text-emerald-300 transition-colors">
              {{ entryType === 'ACCESS' ? '進入系統' : '前往登入' }}
            </span>
          </button>
        </div>
      </transition>
    </div>

  </div>
</template>

<style scoped>
.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.modal-enter-active, .modal-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.95);
}

.fade-quick-enter-active,
.fade-quick-leave-active {
  transition: opacity 0.8s ease;
}
.fade-quick-enter-from,
.fade-quick-leave-to {
  opacity: 0;
}

.animate-focus-in {
  animation: focusIn 1.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
}

@keyframes focusIn {
  0% {
    filter: blur(10px);
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    filter: blur(0px);
    opacity: 1;
    transform: translateY(0);
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(52, 211, 153, 0.3);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(52, 211, 153, 0.5);
}
</style>
