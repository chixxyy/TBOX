<script setup lang="ts">
import { onMounted, ref } from 'vue'

const container = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!container.value) return

  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js'
  script.async = true
  script.innerHTML = JSON.stringify({
    colorTheme: "dark",
    isTransparent: true,
    width: "100%",
    height: "100%",
    locale: "zh_TW",
    importanceFilter: "-1,0,1",
    currencyFilter: "USD,EUR,GBP,JPY,AUD,CNY,CAD"
  })

  // Append script to the inner div
  const widgetDiv = container.value.querySelector('.tradingview-widget-container__widget')
  if (widgetDiv) {
    widgetDiv.appendChild(script)
  }
})
</script>

<template>
  <div class="w-full h-full bg-[#05080f] relative" ref="container">
    <!-- TradingView Widget BEGIN -->
    <div class="tradingview-widget-container w-full h-full">
      <div class="tradingview-widget-container__widget w-full h-full"></div>
    </div>
    <!-- TradingView Widget END -->
    
    <!-- Top right cover for "Current Time" display overlay -->
    <div class="absolute top-2 right-2 z-10 bg-[#070b14]/90 backdrop-blur border border-slate-800 rounded px-2 py-1 flex items-center gap-2 shadow-lg pointer-events-none">
      <span class="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
      <span class="text-[10px] font-bold text-slate-300 font-mono tracking-widest uppercase">全球總體經濟時鐘</span>
    </div>
  </div>
</template>
