<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { isEntryLoading, chatSession, goToLogin } from '../stores'

const progress = ref(0)
const loadingText = ref('系統初始化中...')
const terminalLines = ref<string[]>([])
const isPeeking = ref(false)
const isReady = ref(false)

// Dynamic button text based on login status
const entryType = computed(() => {
  return chatSession.value ? 'ACCESS' : 'LOGIN'
})

const logs = [
  '正在建立安全加密隧道... 成功',
  '同步 Supabase 資料中心... 成功',
  '獲取 Polymarket 全球數據... 成功',
  '載入 Gemini AI 運算引擎... 成功',
  '建立即時 WebSocket 串流... 成功',
  '計算市場多空情緒指數... 成功',
  'TRADINGBOX_V2 核心系統就緒'
]

const updates = [
  { type: '公告', title: '連線優化提示', desc: '若發現報價未跳動，請點擊右上方「重置連線」或重新整理網頁。' },
  { type: '優化', title: '邊緣計算優化', desc: '推薦使用 Chrome 核心瀏覽器以獲得極致的報價更新效能。' }
]

const enterTerminal = (forceNavigate: boolean = false) => {
  if (forceNavigate && entryType.value === 'LOGIN') {
    goToLogin()
  }
  isEntryLoading.value = false
}

const handleKeyDown = () => {
  if (isReady.value) enterTerminal(false)
}

const handleScreenClick = (e: MouseEvent | TouchEvent) => {
  // Only trigger if ready and NOT clicking the alert badge or its peek window
  if (isReady.value) {
    const target = e.target as HTMLElement
    if (!target.closest('.cursor-help') && !target.closest('.group.relative.px-8.py-3')) {
        enterTerminal(false)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  
  // Progress Logic with Pause
  const progressInterval = setInterval(() => {
    if (isPeeking.value) return 
    
    progress.value += Math.random() * 4 + 1
    if (progress.value >= 100) {
      progress.value = 100
      clearInterval(progressInterval)
      
      const checkLogs = setInterval(() => {
          if (loadingText.value === 'TRADINGBOX_V2 核心系統就緒') {
              isReady.value = true
              clearInterval(checkLogs)
          }
      }, 100)
    }
  }, 80)

  // Log Logic with Pause
  let logIndex = 0
  const logInterval = setInterval(() => {
    if (isPeeking.value) return 
    
    if (logIndex < logs.length) {
      const line = logs[logIndex]
      if (line) {
        terminalLines.value.push(line)
        loadingText.value = line
      }
      logIndex++
    } else {
      clearInterval(logInterval)
    }
  }, 400)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div 
    @click="handleScreenClick"
    @touchstart="handleScreenClick"
    class="fixed inset-0 z-[9999] bg-[#070b14] flex flex-col items-center justify-center overflow-hidden font-mono transition-colors duration-700"
    :class="{ 'bg-black/90': isPeeking, 'cursor-pointer': isReady }"
  >
    
    <!-- Desktop Background: Terminal Matrix -->
    <div class="absolute inset-0 opacity-[0.03] pointer-events-none hidden md:block overflow-hidden transition-all duration-1000"
         :class="{ 'opacity-[0.01]': isPeeking }">
      <div v-for="i in 20" :key="i" 
           class="absolute text-[10px] whitespace-nowrap animate-matrix-fall"
           :style="{ left: (i * 5) + '%', animationDelay: (i * 0.5) + 's' }">
        {{ Array(50).fill('010111001101').join(' ') }}
      </div>
    </div>

    <!-- Central Logo Container -->
    <div class="relative z-10 flex flex-col items-center transition-all duration-700"
         :class="{ 'scale-95 opacity-40 blur-sm': isPeeking }">
      
      <!-- Animated Logo Section -->
      <div class="relative mb-6 md:mb-8 animate-focus-in select-none" style="animation-delay: 0.1s;">
        <div class="relative group p-4"> <!-- Added padding to prevent filter clipping -->
          <svg class="w-24 h-24 md:w-32 md:h-32 transition-all duration-700"
               :class="{ 'animate-logo-glitch text-emerald-400': isReady, 'text-blue-500': !isReady }"
               style="filter: drop-shadow(0 0 15px currentColor);"
               viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="entryBoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" :stop-color="isReady ? '#10b981' : '#3B82F6'" />
                <stop offset="100%" :stop-color="isReady ? '#34d399' : '#6366F1'" />
              </linearGradient>
              <linearGradient id="entryTGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#06B6D4" />
                <stop offset="100%" stop-color="#3B82F6" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="7" stroke="url(#entryBoxGrad)" stroke-width="2" fill="none"/>
            <rect x="8" y="15" width="3" height="9" rx="1.5" fill="#3B82F6" fill-opacity="0.8"/>
            <rect x="14" y="8" width="4" height="16" rx="2" fill="url(#entryTGrad)"/>
            <rect x="10" y="8" width="12" height="4" rx="2" fill="url(#entryTGrad)"/>
            <rect x="21" y="12" width="3" height="12" rx="1.5" fill="#6366F1" fill-opacity="0.8"/>
          </svg>
          <!-- Scanner Beam -->
          <div class="absolute inset-0 bg-gradient-to-b from-transparent via-blue-400/10 to-transparent h-1 w-full animate-scan-beam"></div>
        </div>
      </div>

      <!-- TBOX Text -->
      <h1 class="text-3xl md:text-5xl font-black tracking-[0.2em] mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)] animate-focus-in"
          style="animation-delay: 0.3s;">
        TBOX
      </h1>

      <!-- Loading Info Section (Fixed Height to prevent jumps) -->
      <div class="w-64 md:w-80 animate-focus-in" style="animation-delay: 0.5s;">
        <!-- Progress Bar -->
        <div class="h-1 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/50 relative mb-6">
          <div class="h-full bg-gradient-to-r transition-all duration-300 ease-linear"
               :class="isReady ? 'from-emerald-500 to-teal-400' : 'from-blue-600 to-indigo-500'"
               :style="{ width: progress + '%' }"></div>
        </div>
        
        <!-- Interaction Area: Fixed height to anchor the logo -->
        <div class="relative h-28 flex flex-col items-center">
            <transition name="fade-quick" mode="out-in">
                <!-- Terminal Output (Desktop) -->
                <div v-if="!isReady" key="logs" class="hidden md:block w-full h-20 overflow-hidden text-[10px] text-slate-500 font-mono space-y-1">
                    <div v-for="(line, idx) in terminalLines.slice(-4)" :key="idx" class="animate-in fade-in slide-in-from-left-2 duration-300">
                        <span class="text-blue-500/50 mr-2">></span> {{ line }}
                    </div>
                </div>

                <!-- Enter Button (Ready State) -->
                <div v-else key="button" class="flex flex-col items-center animate-in zoom-in-95 fade-in duration-700">
                    <button 
                        @click="enterTerminal(true)"
                        class="group relative px-8 py-3 bg-emerald-600/10 border border-emerald-500/50 rounded-xl overflow-hidden hover:bg-emerald-600/20 transition-all active:scale-95"
                    >
                        <div class="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-emerald-500/20 via-transparent to-teal-500/20 animate-logo-glitch"></div>
                        <span class="relative text-[10px] md:text-xs font-black text-emerald-400 tracking-[0.3em] uppercase italic group-hover:text-emerald-200 transition-colors">
                            {{ entryType === 'ACCESS' ? '存取獲准' : '前往登入' }}
                        </span>
                    </button>
                    <p class="mt-3 text-[9px] text-emerald-900/60 tracking-[0.2em] animate-pulse uppercase font-bold">
                        {{ entryType === 'ACCESS' ? '請按下鍵盤任意鍵進入' : '請登入以存取系統核心' }}
                    </p>
                </div>
            </transition>

            <!-- Pulse Status (Mobile Focus Overlay) -->
            <transition name="fade-quick">
                <div v-if="!isReady" class="md:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span class="text-[10px] text-blue-400/80 tracking-widest animate-pulse font-bold uppercase">
                        {{ loadingText.replace('_', ' ') }}
                    </span>
                </div>
            </transition>
        </div>
      </div>
    </div>

    <!-- Alert Badge & Peek Modal -->
    <div class="absolute bottom-12 md:bottom-20 z-20 flex flex-col items-center">
      <!-- Flicker Alert Tag -->
      <div 
        @mouseenter="isPeeking = true"
        @mouseleave="isPeeking = false"
        @touchstart="isPeeking = true"
        @touchend="isPeeking = false"
        class="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 cursor-help group transition-all hover:bg-amber-500/20 hover:border-amber-500/60"
      >
        <span class="relative flex h-2 w-2">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <span class="text-[9px] md:text-xs font-black text-amber-500 tracking-tighter md:tracking-widest uppercase">
          系統重大公告
        </span>
      </div>

      <!-- Preview Window -->
      <transition name="peek">
        <div v-if="isPeeking" class="absolute bottom-full mb-6 w-[320px] md:w-[480px] bg-[#0c1220]/98 backdrop-blur-xl border border-amber-500/40 rounded-2xl p-5 shadow-[0_0_60px_rgba(245,158,11,0.2)] pointer-events-none">
           <!-- Header -->
           <div class="flex items-center gap-3 mb-5 pb-3 border-b border-white/10">
              <div class="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span class="text-xs md:text-sm font-black text-slate-300 uppercase tracking-widest italic">加密通訊內容已解碼</span>
           </div>

           <!-- List of Updates -->
           <div class="space-y-5">
              <div v-for="upd in updates" :key="upd.type" class="flex gap-4 items-start animate-in fade-in slide-in-from-bottom-2 duration-500">
                 <!-- Type Tag as a Badge -->
                 <div class="shrink-0">
                    <span class="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] md:text-[10px] text-amber-500 font-bold whitespace-nowrap">
                      {{ upd.type }}
                    </span>
                 </div>
                 
                 <!-- Text Content -->
                 <div class="flex-1 min-w-0">
                    <h4 class="text-[13px] md:text-[15px] font-black text-white leading-none mb-1.5">{{ upd.title }}</h4>
                    <p class="text-[11px] md:text-[12px] text-slate-400 leading-relaxed">{{ upd.desc }}</p>
                 </div>
              </div>
           </div>

           <!-- Interactive Scanner Effect in Modal -->
           <div class="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent h-1 w-full animate-scan-beam opacity-40 pointer-events-none"></div>
        </div>
      </transition>
    </div>

    <!-- Random Decrypt Numbers -->
    <div class="absolute bottom-10 right-10 text-[10px] text-slate-700 font-mono hidden md:block">
      系統載入序號: 0x{{ Math.random().toString(16).slice(2, 10).toUpperCase() }}
    </div>
  </div>
</template>

<style scoped>
.peek-enter-active, .peek-leave-active {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.peek-enter-from, .peek-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.fade-quick-enter-active,
.fade-quick-leave-active {
  transition: opacity 0.4s ease;
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
    filter: blur(30px);
    opacity: 0;
    transform: translateY(15px) scale(0.95);
  }
  100% {
    filter: blur(0px);
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes matrix-fall {
  0% { transform: translateY(-100%); opacity: 0; }
  10% { opacity: 0.8; }
  90% { opacity: 0.8; }
  100% { transform: translateY(100vh); opacity: 0; }
}

@keyframes scan-beam {
  0% { top: 0%; opacity: 0; }
  50% { opacity: 1; }
  100% { top: 100%; opacity: 0; }
}

@keyframes logo-glitch {
  0% { transform: translate(0); }
  2% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
  4% { transform: translate(2px, -2px); filter: hue-rotate(-90deg); }
  6% { transform: translate(0); }
  100% { transform: translate(0); }
}

.animate-matrix-fall {
  animation: matrix-fall 5s linear infinite;
}

.animate-scan-beam {
  animation: scan-beam 2.5s linear infinite;
}

.animate-logo-glitch {
  animation: logo-glitch 4s linear infinite;
}

.animate-logo-pop {
  animation: logoPop 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes logoPop {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
</style>
