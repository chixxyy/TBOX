<script setup lang="ts">
import TopHeader from './components/TopHeader.vue'
import EntryLoader from './components/EntryLoader.vue'
import GlobalToast from './components/GlobalToast.vue'
import TickerBanner from './components/TickerBanner.vue'
import AssetList from './components/AssetList.vue'
import ChartArea from './components/ChartArea.vue'
import RightPanel from './components/RightPanel.vue'
import MarketsView from './components/MarketsView.vue'
import NewsView from './components/NewsView.vue'
import MoversView from './components/MoversView.vue'
import OddsView from './components/OddsView.vue'
import ChatView from './components/ChatView.vue'
import LoginView from './components/LoginView.vue'
import ProfileView from './components/ProfileView.vue'
import AIDrawer from './components/AIDrawer.vue'
import BackgroundMonitor from './components/BackgroundMonitor.vue'
import SiteFooter from './components/SiteFooter.vue'
import ReloadPrompt from './components/ReloadPrompt.vue'
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { 
  activeTab, 
  setScrollProgress, 
  isChangingTab, 
  initSupabaseChat, 
  showLogoutConfirm, 
  chatSignOut, 
  showPlatformNotice, 
  dismissPlatformNotice,
  isEntryLoading,
  isKickedOut,
  currentSessionId,
  activeSettingsTab,
  showToast
} from './store'

const currentNoticeTab = ref<'交易' | '平台' | '更新'>('平台')
const dontShowAgain = ref(false)

// Reset scroll progress instantly on tab change
watch(activeTab, async () => {
  isChangingTab.value = true
  setScrollProgress(0)
  await nextTick()
  // Brief delay to allow the "reset" frame to render without transition
  setTimeout(() => {
    isChangingTab.value = false
  }, 50)
})

// High-performance scroll tracking using rAF
let rafId: number | null = null
const handleScroll = (e: Event) => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const el = e.target as HTMLElement
    // Safety check for division by zero
    const scrollMax = el.scrollHeight - el.clientHeight
    if (scrollMax <= 0) {
      setScrollProgress(0)
    } else {
      const progress = (el.scrollTop / scrollMax) * 100
      setScrollProgress(progress)
    }
  })
}

const windowWidth = ref(window.innerWidth)
const isMobile = ref(window.innerWidth < 768)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  window.addEventListener('resize', updateWindowWidth)
  // Run exactly once on app load
  initSupabaseChat()

  // Detect Supabase Password Reset hash
  if (window.location.hash.includes('type=recovery')) {
    // If there's an error in the hash (e.g. expired link), don't redirect
    if (window.location.hash.includes('error=')) {
      showToast('驗證失敗', '郵件連結已過期或無效，請重新申請')
      return
    }
    
    isKickedOut.value = false // Crucial: Clear any stale conflict alerts
    activeTab.value = '個人檔案'
    activeSettingsTab.value = 'security'
    showToast('認證成功', '請在此處更新您的新密碼')
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <div class="h-[100dvh] w-screen bg-[#070b14] text-slate-300 flex flex-col font-sans overflow-hidden">
    <transition name="fade-overlay">
      <EntryLoader v-if="isEntryLoading" />
    </transition>

    <GlobalToast />
    <TopHeader />
    <TickerBanner />
    <BackgroundMonitor />
    
    <main v-if="activeTab === '交易'" @scroll="handleScroll" class="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden pb-12 md:pb-0">
      <!-- Left Sidebar: Asset List -->
      <aside class="w-full md:w-[320px] h-auto md:h-full border-b md:border-b-0 md:border-r border-slate-800 bg-[#0a0f1c] flex flex-col shrink-0">
        <AssetList />
      </aside>

      <!-- Center: Chart Area -->
      <section class="flex-1 bg-[#05080f] flex flex-col border-b md:border-b-0 md:border-r border-slate-800 relative min-h-[400px] md:min-h-0">
        <ChartArea />
      </section>

      <!-- Right Sidebar: Trading Panel & Order Book -->
      <aside class="bg-[#0a0f1c] flex flex-col relative shrink-0 h-auto md:h-full w-full md:w-[380px]">
        <RightPanel />
      </aside>
    </main>
    
    <main v-else-if="activeTab === '新聞'" class="flex-1 flex overflow-hidden">
      <NewsView />
    </main>

    <main v-else-if="activeTab === '市場'" class="flex-1 flex overflow-hidden">
      <MarketsView />
    </main>

    <main v-else-if="activeTab === '異動'" class="flex-1 flex overflow-hidden bg-[#05080f]">
      <MoversView />
    </main>

    <main v-else-if="activeTab === '運動'" class="flex-1 flex overflow-hidden bg-[#05080f]">
      <OddsView />
    </main>

    <main v-else-if="activeTab === '討論'" class="flex-1 flex overflow-hidden bg-[#05080f]">
      <ChatView />
    </main>

    <main v-else-if="activeTab === '登入'" class="flex-1 flex overflow-hidden bg-[#05080f]">
      <LoginView />
    </main>

    <main v-else-if="activeTab === '個人檔案'" class="flex-1 flex overflow-hidden bg-[#05080f]">
      <ProfileView />
    </main>

    <!-- Global Site Footer -->
    <SiteFooter />
    
    <!-- PWA Update Prompt -->
    <ReloadPrompt />

    <!-- AI Asset Summary Drawer -->
    <AIDrawer />

    <!-- Global Platform Notice Modal (Multi-tab) -->
    <transition name="fade">
      <div 
        v-if="showPlatformNotice && !isEntryLoading" 
        class="fixed inset-0 z-[10002] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md"
      >
        <div class="bg-[#0a0f1c] border border-blue-500/30 rounded-2xl w-full max-w-md shadow-[0_0_50px_rgba(59,130,246,0.2)] relative overflow-hidden flex flex-col max-h-[90vh]">
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"></div>
          
          <!-- Modal Header -->
          <div class="p-6 pb-0">
            <div class="flex items-center gap-3 mb-5">
              <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 class="text-xl font-black text-white tracking-tight">平台公告系統</h3>
                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Notification Center</p>
              </div>
            </div>

            <!-- Tabs -->
            <div class="flex p-1 bg-slate-900/50 rounded-xl border border-slate-800/50 mb-6">
              <button 
                v-for="t in (['交易', '平台', '更新'] as const)" 
                :key="t"
                @click="currentNoticeTab = t"
                class="flex-1 py-2 text-xs font-black rounded-lg transition-all"
                :class="currentNoticeTab === t ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'"
              >
                {{ t }}
              </button>
            </div>
          </div>

          <!-- Content Area -->
          <div class="px-6 pb-6 overflow-y-auto custom-scrollbar flex-1">
            <div v-show="currentNoticeTab === '交易'" class="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div class="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-4">
                <div class="flex items-center gap-2 mb-2 text-amber-500">
                  <span class="text-sm">⚠️</span>
                  <span class="text-xs font-black uppercase tracking-wider">風險提示</span>
                </div>
                <p class="text-sm text-slate-300 leading-relaxed">
                  市場波動劇烈，請務必注意倉位風險管理。本平台所有資產報價及分析僅供參考，不構成任何投資建議。交易前請確認您的資金安全。
                </p>
              </div>
              <ul class="space-y-2 text-xs text-slate-400">
                <li class="flex items-start gap-2">
                  <span class="text-blue-500 mt-0.5">●</span>
                  <span>整合 AI 智能分析，即時生成市場趨勢與標的速報。</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="text-blue-500 mt-0.5">●</span>
                  <span>支援多市場即時報價與圖表，包含加密貨幣、股票與運動賽事。</span>
                </li>
              </ul>
            </div>

            <div v-show="currentNoticeTab === '平台'" class="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p class="text-sm text-slate-300 leading-relaxed font-bold bg-blue-900/20 p-4 rounded-xl border border-blue-900/40 mb-4">
                <span class="text-blue-400">連線優化提示：</span><br/>
                如果發現資產報價沒有即時跳動或是討論區連線中斷，請點擊畫面右上方的「重置連線」按鈕或是直接重新整理網頁。
              </p>
              <div class="p-3 bg-slate-900/40 rounded-xl border border-slate-800">
                <p class="text-[11px] text-slate-500 italic">
                  本平台採用邊緣計算優化，推薦使用 Chrome 核心瀏覽器以獲得最佳效能體驗。
                </p>
              </div>
            </div>

            <div v-show="currentNoticeTab === '更新'" class="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div class="space-y-4">
                <div v-for="item in [
                  { title: '運動賽事看板', desc: '新增 MLB/NBA 實時賠率監測功能。' },
                  { title: '全球運動快訊', desc: '串接 ESPN 實時新聞並支援 AI 翻譯。' },
                  { title: '智慧分選系統', desc: '可依據勝率與時間快速篩選熱門賽事。' }
                ]" :key="item.title" class="flex gap-3">
                  <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-white">{{ item.title }}</h4>
                    <p class="text-[11px] text-slate-500 mt-0.5">{{ item.desc }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="p-6 pt-0 border-t border-slate-800/30 mt-auto">
            <div class="flex items-center gap-2 mb-4 mt-4">
              <label class="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  v-model="dontShowAgain"
                  class="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-offset-slate-900"
                />
                <span class="text-xs text-slate-500 group-hover:text-slate-300 transition-colors">在此設備上不再顯示此公告</span>
              </label>
            </div>
            
            <button 
              @click="dismissPlatformNotice(dontShowAgain)" 
              class="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_10px_15px_-3px_rgba(59,130,246,0.5)] transition-all active:scale-[0.98]"
            >
              確認並開始使用
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Global Logout Confirmation Modal -->
    <transition name="fade">
      <div 
        v-if="showLogoutConfirm" 
        @click="showLogoutConfirm = false"
        class="fixed inset-0 z-[10001] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm"
      >
        <div @click.stop class="bg-[#111827] border border-blue-900/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">確定要登出嗎？</h3>
          <p class="text-xs text-slate-400 mb-6">登出後將無法使用討論區並清除目前的自定義設定。</p>
          <div class="flex gap-3">
            <button @click="showLogoutConfirm = false" class="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-bold">
              取消
            </button>
            <button @click="chatSignOut()" class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-bold">
              確定登出
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Security Alert Modal (Kicked Out) -->
    <transition name="notice">
      <div v-if="isKickedOut" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
        <div class="w-full max-w-md bg-[#0a0f1c] border border-red-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.15)] relative">
          <!-- Background Grid decoration -->
          <div class="absolute inset-0 opacity-[0.05] pointer-events-none" style="background-image: radial-gradient(#ef4444 0.5px, transparent 0.5px); background-size: 10px 10px;"></div>
          
          <!-- Header Area -->
          <div class="h-1.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 animate-pulse"></div>
          
          <div class="p-8 text-center relative z-10">
            <div class="inline-flex items-center justify-center w-20 h-20 bg-red-950/30 border border-red-500/20 rounded-full mb-6 relative">
              <div class="absolute inset-0 bg-red-500/10 rounded-full animate-ping opacity-20"></div>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-500 animate-in zoom-in duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 class="text-xl md:text-2xl font-black text-white mb-2 tracking-tighter uppercase">
              [ <span class="text-red-500 animate-pulse">SESSION_SECURITY_ALERT</span> ]
            </h2>
            <div class="text-[10px] text-red-500/60 font-mono mb-6 uppercase tracking-[0.2em]">連線授權狀態變更</div>
            
            <div class="space-y-4 mb-8">
              <p class="text-sm text-slate-400 leading-relaxed max-w-[280px] mx-auto">
                檢測到帳號在另一台裝置登入。系統當前已建立新的通訊通道，此終端的授權已自動撤銷。
              </p>
              
              <div class="bg-red-500/5 border border-red-500/10 rounded-lg p-3 font-mono">
                <div class="text-[10px] text-red-400/80 mb-1">SECURITY_LOG:</div>
                <div class="text-[11px] text-slate-500">REF_ID: {{ currentSessionId.slice(0, 8) }} // SYNC_CONFLICT_1002</div>
              </div>
            </div>

            <button 
              @click="isKickedOut = false; isEntryLoading = true; initSupabaseChat()" 
              class="w-full py-4 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-black rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.5)] text-sm tracking-widest uppercase"
            >
              重新建立連線
            </button>
            <p class="mt-4 text-[10px] text-slate-600 uppercase tracking-widest font-bold">TradingBox Encryption Protocol</p>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style>
/* Global neon effect classes */
.neon-text-blue {
  color: #38bdf8;
  text-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
}
.neon-border-blue {
  border-color: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.3) inset, 0 0 8px rgba(56, 189, 248, 0.3);
}
.neon-text-green {
  color: #10b981;
  text-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
}
.neon-text-red {
  color: #ef4444;
  text-shadow: 0 0 8px rgba(239, 68, 68, 0.5);
}
</style>
