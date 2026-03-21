<script setup lang="ts">
import TopHeader from './components/TopHeader.vue'
import TickerBanner from './components/TickerBanner.vue'
import AssetList from './components/AssetList.vue'
import ChartArea from './components/ChartArea.vue'
import RightPanel from './components/RightPanel.vue'
import MarketsView from './components/MarketsView.vue'
import NewsView from './components/NewsView.vue'
import MoversView from './components/MoversView.vue'
import BackgroundMonitor from './components/BackgroundMonitor.vue'
import SiteFooter from './components/SiteFooter.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { activeTab } from './store'

const windowWidth = ref(window.innerWidth)
const isMobile = ref(window.innerWidth < 768)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  window.addEventListener('resize', updateWindowWidth)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <div class="h-[100dvh] w-screen bg-[#070b14] text-slate-300 flex flex-col font-sans overflow-hidden">
    <TopHeader />
    <TickerBanner />
    <BackgroundMonitor />
    
    <main v-if="activeTab === '交易'" class="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden pb-12 md:pb-0">
      <!-- Left Sidebar: Asset List -->
      <aside class="w-full md:w-[260px] h-auto md:h-full border-b md:border-b-0 md:border-r border-slate-800 bg-[#0a0f1c] flex flex-col shrink-0">
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

    <main v-else-if="activeTab === '異動'" class="flex-1 flex overflow-hidden bg-[#05080f] overflow-y-auto">
      <MoversView />
    </main>

    <!-- Global Site Footer -->
    <SiteFooter />
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
