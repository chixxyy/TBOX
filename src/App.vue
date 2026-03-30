<script setup lang="ts">
import TopHeader from './components/TopHeader.vue'
import GlobalToast from './components/GlobalToast.vue'
import TickerBanner from './components/TickerBanner.vue'
import AssetList from './components/AssetList.vue'
import ChartArea from './components/ChartArea.vue'
import RightPanel from './components/RightPanel.vue'
import MarketsView from './components/MarketsView.vue'
import NewsView from './components/NewsView.vue'
import MoversView from './components/MoversView.vue'
import ChatView from './components/ChatView.vue'
import LoginView from './components/LoginView.vue'
import ProfileView from './components/ProfileView.vue'
import AIDrawer from './components/AIDrawer.vue'
import BackgroundMonitor from './components/BackgroundMonitor.vue'
import SiteFooter from './components/SiteFooter.vue'
import ReloadPrompt from './components/ReloadPrompt.vue'
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { activeTab, setScrollProgress, isChangingTab, initSupabaseChat, showLogoutConfirm, chatSignOut, showPlatformNotice, dismissPlatformNotice } from './store'

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
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <div class="h-[100dvh] w-screen bg-[#070b14] text-slate-300 flex flex-col font-sans overflow-hidden">
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

    <!-- Platform Notice Modal -->
    <transition name="fade">
      <div 
        v-if="showPlatformNotice" 
        class="fixed inset-0 z-[10002] flex items-center justify-center px-4 bg-black/70 backdrop-blur-md"
      >
        <div class="bg-[#0a0f1c] border border-blue-500/30 rounded-2xl p-6 w-full max-w-md shadow-[0_0_40px_rgba(59,130,246,0.15)] relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          
          <div class="flex items-center gap-3 mb-4 mt-2">
            <div class="w-10 h-10 rounded-full bg-blue-900/30 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white tracking-wide">平台近期狀態公告</h3>
          </div>
          
          <div class="space-y-4 mb-8">
            <p class="text-sm text-slate-300 leading-relaxed font-bold bg-blue-900/20 p-4 rounded-xl border border-blue-900/40">
              💡 <span class="text-blue-400">溫馨提醒：</span>如果發現 <strong class="text-white">資產報價沒有即時跳動</strong> 或是 <strong class="text-white">討論區沒有正常連線</strong>，請點擊畫面右上方的 <strong class="text-white bg-slate-800 px-1.5 py-0.5 rounded mr-1 ml-1 text-xs">重置連線按鈕</strong> 或是直接 <strong class="text-white">重新整理網頁</strong> 來解決。
            </p>
          </div>
          
          <button 
            @click="dismissPlatformNotice" 
            class="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 text-white font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] transition-all active:scale-[0.98]"
          >
            我瞭解了，開始交易
          </button>
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
            <button @click="chatSignOut" class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-bold">
              確定登出
            </button>
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
