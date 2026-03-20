<script setup lang="ts">
import TopHeader from './components/TopHeader.vue'
import TickerBanner from './components/TickerBanner.vue'
import AssetList from './components/AssetList.vue'
import ChartArea from './components/ChartArea.vue'
import RightPanel from './components/RightPanel.vue'
import MarketsView from './components/MarketsView.vue'
import NewsView from './components/NewsView.vue'
import MoversView from './components/MoversView.vue'
import { ref, onMounted, onUnmounted } from 'vue'
import { activeTab } from './store'

const rightPanelWidth = ref(320)
const minRightPanelWidth = 320
const isDraggingRight = ref(false)
const windowWidth = ref(window.innerWidth)
const isMobile = ref(window.innerWidth < 768)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
  isMobile.value = window.innerWidth < 768
}

const startDragRight = () => {
  isDraggingRight.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onMouseMove = (e: MouseEvent) => {
  if (isDraggingRight.value) {
    const newWidth = window.innerWidth - e.clientX
    if (newWidth >= minRightPanelWidth) {
      rightPanelWidth.value = newWidth
    }
  }
}

const onMouseUp = () => {
  if (isDraggingRight.value) {
    isDraggingRight.value = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    // Dispatch resize event to force lightweight-charts to recalculate its container size
    window.dispatchEvent(new Event('resize'))
  }
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  window.addEventListener('resize', updateWindowWidth)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <div class="h-screen w-screen bg-[#070b14] text-slate-300 flex flex-col font-sans overflow-hidden">
    <TopHeader />
    <TickerBanner />
    
    <main v-if="activeTab === '交易'" class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- Left Sidebar: Asset List -->
      <aside class="w-full md:w-64 h-[180px] md:h-full border-b md:border-b-0 md:border-r border-slate-800 bg-[#0a0f1c] flex flex-col shrink-0">
        <AssetList />
      </aside>

      <!-- Center: Chart Area -->
      <section class="flex-1 bg-[#05080f] flex flex-col border-b md:border-b-0 md:border-r border-slate-800 relative min-h-[350px] md:min-h-0">
        <ChartArea />
      </section>

      <!-- Right Sidebar: Trading Panel & Order Book -->
      <aside class="bg-[#0a0f1c] flex flex-col overflow-hidden relative shrink-0 h-[300px] md:h-full" :style="{ width: isMobile ? '100%' : rightPanelWidth + 'px' }">
        <!-- Resizer handle -->
        <div 
          class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 z-50 transition-colors hidden md:block"
          @mousedown="startDragRight"
        ></div>
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
