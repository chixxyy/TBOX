<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { 
  showAIDrawer, activeAIAsset, chatSession, 
  userProfile, chatUser, addChatMessage, activeTab, showToast 
} from '../store'
import { analyzeAsset, type AIAnalysisResult } from '../api/gemini'

const isLoading = ref(false)
const errorMsg = ref('')
const result = ref<AIAnalysisResult | null>(null)

const closeDrawer = () => {
  showAIDrawer.value = false
}

watch(showAIDrawer, async (newVal) => {
  if (newVal && activeAIAsset.value) {
    isLoading.value = true
    errorMsg.value = ''
    result.value = null
    try {
      result.value = await analyzeAsset(activeAIAsset.value.symbol, activeAIAsset.value.currentPrice, activeAIAsset.value.marketType)
    } catch (err: any) {
      errorMsg.value = err.message || '分析失敗，請稍後再試'
    } finally {
      isLoading.value = false
    }
  } else {
    // Reset state on close
    setTimeout(() => {
      result.value = null
      errorMsg.value = ''
    }, 300)
  }
})

// Visual computing based on score
const emotionColor = computed(() => {
  if (!result.value) return 'text-slate-400'
  return result.value.score >= 50 ? 'text-emerald-400' : 'text-rose-400'
})

const emotionBg = computed(() => {
  if (!result.value) return 'bg-slate-900'
  return result.value.score >= 50 ? 'bg-emerald-950/40 border-emerald-900/50' : 'bg-rose-950/40 border-rose-900/50'
})

const shareToChat = async () => {
    console.log('Attempting to share AI Insight...', { result: result.value, asset: activeAIAsset.value })
    if (!result.value || !activeAIAsset.value) {
        console.warn('Share cancelled: result or activeAIAsset is null')
        return
    }

    if (!chatSession.value) {
        showToast('需要登入', '請先登入交流區，即可分享最新 AI 觀點！', false)
        activeTab.value = '登入'
        closeDrawer()
        return
    }

    try {
        const emotionStr = (result.value.score || 0) >= 50 ? '看漲 🚀' : '看跌 📉'
        const shareText = `🤖 【AI 速報】${activeAIAsset.value.symbol} (${emotionStr})\n▸ 核心情緒: ${result.value.score}/100\n▸ AI 診斷: 深度分析報告已解鎖，請參閱下方。`
        
        console.log('Calling addChatMessage with:', shareText)
        
        await addChatMessage({
            user: userProfile.value?.full_name || chatUser.value || 'GUEST',
            avatar: userProfile.value?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${chatSession.value.user.id}`,
            text: shareText,
            newsShare: {
                type: 'ai_insight',
                symbol: activeAIAsset.value.symbol,
                score: result.value.score,
                summary: result.value.summary
            }
        })
        
        console.log('Share success')
        showToast('分享成功', '您的 AI 觀點已發送至討論區', true)
        activeTab.value = '討論'
        closeDrawer()
    } catch (e: any) {
        console.error('Share failure:', e)
        showToast('分享失敗', e.message || '請稍後再試', false)
    }
}

const retryAnalysis = () => {
    showAIDrawer.value = false
    setTimeout(() => {
        showAIDrawer.value = true
    }, 100)
}

</script>

<template>
<Teleport to="body">
  <div v-if="showAIDrawer" class="fixed inset-0 z-[1000] flex justify-end">
    <!-- Overlay -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="closeDrawer"></div>
    
    <!-- Drawer Panel -->
    <transition name="slide-right" appear>
      <div v-if="showAIDrawer" class="relative w-full md:w-[400px] h-full bg-[#070b14] border-l border-blue-900/30 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] flex-shrink-0 z-10 top-0 right-0">
        
        <!-- Header -->
        <div class="flex items-center justify-between p-4 border-b border-slate-800 bg-[#0a0f1c]">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-900/30 flex items-center justify-center border border-blue-800/50 relative overflow-hidden group">
              <div class="absolute inset-0 bg-blue-500/20 group-hover:bg-blue-400/30 transition-colors"></div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 class="text-white font-black text-sm md:text-base tracking-wide flex items-center gap-2">
                {{ activeAIAsset?.symbol }}
                <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{{ activeAIAsset?.marketType === 'stock' ? 'STOCK' : 'CRYPTO' }}</span>
              </h2>
              <p class="text-[10px] text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 font-bold tracking-wider mt-0.5 uppercase">Gemini AI 速報</p>
            </div>
          </div>
          <button @click="closeDrawer" class="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-thin scrollbar-thumb-slate-800">
          
          <!-- Loading State -->
          <div v-if="isLoading" class="h-full flex flex-col items-center justify-center space-y-6">
            <div class="relative w-20 h-20 flex items-center justify-center">
              <div class="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
              <div class="absolute inset-2 rounded-full border-b-2 border-l-2 border-indigo-400 animate-spin-reverse"></div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="text-center space-y-2">
              <p class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 text-sm font-black tracking-widest animate-pulse">呼叫 GEMINI 引擎中</p>
              <p class="text-slate-500 text-[10px] font-mono tracking-wider">正在整合即時市場數據與新聞情緒...</p>
            </div>
          </div>

          <!-- Login Required State -->
          <div v-else-if="!chatSession" class="h-full flex flex-col items-center justify-center space-y-6 text-center px-4">
            <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 relative">
               <div class="absolute inset-0 bg-blue-400/10 animate-ping rounded-2xl opacity-20"></div>
               <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div class="space-y-2">
              <h3 class="text-white font-black text-lg tracking-tight">AI 功能僅限會員使用</h3>
              <p class="text-slate-400 text-xs leading-relaxed">
                登入後即可解鎖由 Google Gemini 驅動的<br>
                即時市場分析、情緒指數與投資建議。
              </p>
            </div>
            <button 
              @click="activeTab = '登入'; closeDrawer()" 
              class="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              立刻登入啟用 AI
            </button>
          </div>

          <!-- Error State -->
          <div v-else-if="errorMsg" class="h-full flex flex-col items-center justify-center space-y-4 text-center">
            <div class="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center border border-red-800/50">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p class="text-red-400 text-sm font-bold">{{ errorMsg }}</p>
            <button @click="retryAnalysis" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors font-bold tracking-widest">重試</button>
          </div>

          <!-- Exact Result -->
          <div v-else-if="result" class="space-y-6 animate-fade-in-up pb-10">
            
            <!-- Emotion Score -->
            <div class="p-5 rounded-2xl border flex items-center justify-between" :class="emotionBg">
              <div>
                <div class="text-xs uppercase tracking-widest font-black mb-1.5" :class="emotionColor">AI 情緒指數</div>
                <div class="text-[10px] text-slate-400 font-mono tracking-wider">基於近 24H 動態與報價</div>
              </div>
              <div class="text-4xl font-black tabular-nums tracking-tighter" :class="emotionColor">
                {{ result.score }}<span class="text-base opacity-40 font-bold">/100</span>
              </div>
            </div>

            <!-- Bull & Bear Cases -->
            <div class="grid grid-cols-1 gap-4">
              <!-- Bull Case -->
              <div class="bg-emerald-950/20 border border-emerald-900/30 rounded-2xl p-4.5">
                <div class="flex items-center justify-between mb-4 border-b border-emerald-900/40 pb-2">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                    <h3 class="text-emerald-400 font-black text-xs tracking-widest">看漲視角 (BULL)</h3>
                  </div>
                  <span class="text-emerald-900 font-black text-lg">↑</span>
                </div>
                <ul class="space-y-3">
                  <li v-for="(item, i) in result.bull" :key="'bull-'+i" class="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed font-medium">
                    <span class="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                    {{ item }}
                  </li>
                </ul>
              </div>

              <!-- Bear Case -->
              <div class="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-4.5">
                <div class="flex items-center justify-between mb-4 border-b border-rose-900/40 pb-2">
                  <div class="flex items-center gap-2">
                     <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
                    <h3 class="text-rose-400 font-black text-xs tracking-widest">看跌視角 (BEAR)</h3>
                  </div>
                  <span class="text-rose-900 font-black text-lg">↓</span>
                </div>
                <ul class="space-y-3">
                  <li v-for="(item, i) in result.bear" :key="'bear-'+i" class="flex items-start gap-2.5 text-sm text-slate-300 leading-relaxed font-medium">
                    <span class="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>

            <!-- Summary -->
            <div class="mt-6">
              <div class="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                AI 最終簡評
              </div>
              <div class="bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-l-2 border-indigo-500 p-3.5 text-sm text-indigo-200 font-medium leading-relaxed italic rounded-r-xl">
                "{{ result.summary }}"
              </div>
            </div>

          </div>

        </div>

        <!-- Footer Action -->
        <div v-if="result" class="p-4 md:p-5 border-t border-slate-800 bg-[#0a0f1c] shrink-0">
          <button @click="shareToChat" class="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs tracking-widest rounded-xl transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_20px_rgba(99,102,241,0.5)] active:scale-95 flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            分享觀點
          </button>
        </div>

      </div>
    </transition>
  </div>
</Teleport>
</template>

<style scoped>
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}

.animate-spin-reverse {
  animation: spin-reverse 1.5s linear infinite;
}

@keyframes spin-reverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

.animate-fade-in-up {
  animation: fadeInUp 0.5s ease-out forwards;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
