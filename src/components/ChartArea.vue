<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch, computed } from 'vue'
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts'
import { activeSymbol, activeInterval, setActiveInterval, formattedActiveSymbol, marketPrices } from '../stores'
import { useFetch } from '@vueuse/core'

const sentimentInfo = computed(() => {
  const sym = activeSymbol.value
  const price = marketPrices.value[sym]?.rawPrice || 0
  
  if (sym === '^TNX') {
    if (price >= 4.5) return { label: '高利壓力', color: 'text-red-500 border-red-500/30 bg-red-500/10' }
    if (price >= 3.8) return { label: '利率穩健', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' }
    return { label: '降息預期', color: 'text-green-400 border-green-500/30 bg-green-400/10' }
  }
  
  if (sym === '^VIX') {
    if (price >= 30) return { label: '極度恐慌', color: 'text-red-500 border-red-500/30 bg-red-500/10' }
    if (price >= 20) return { label: '市場擔憂', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' }
    return { label: '情緒穩定', color: 'text-green-400 border-green-500/30 bg-green-400/10' }
  }

  if (sym === 'BDI') {
    if (price >= 3000) return { label: '通膨預警', color: 'text-red-500 border-red-500/30 bg-red-500/10' }
    if (price >= 2000) return { label: '景氣繁榮', color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' }
    if (price >= 1000) return { label: '經濟穩健', color: 'text-green-400 border-green-500/30 bg-green-400/10' }
    return { label: '需求疲軟', color: 'text-slate-400 border-slate-500/30 bg-slate-400/10' }
  }

  // RSI-based sentiment for major ETFs (VOO, VTI)
  if (sym === 'VOO' || sym === 'VTI') {
    const rsi = currentRsi.value
    if (rsi === null) return null
    if (rsi >= 70) return { label: `超買過熱 (${rsi.toFixed(0)})`, color: 'text-red-500 border-red-500/30 bg-red-500/10' }
    if (rsi <= 30) return { label: `超跌底線 (${rsi.toFixed(0)})`, color: 'text-green-400 border-green-500/30 bg-green-400/10' }
    if (rsi >= 60) return { label: `動能轉強 (${rsi.toFixed(0)})`, color: 'text-emerald-400 border-emerald-500/30 bg-emerald-400/10' }
    if (rsi <= 40) return { label: `動能偏弱 (${rsi.toFixed(0)})`, color: 'text-orange-400 border-orange-400/30 bg-orange-400/10' }
    return { label: `平穩運行 (${rsi.toFixed(0)})`, color: 'text-slate-400 border-slate-500/30 bg-slate-400/10' }
  }
  
  return null
})

const currentRsi = ref<number | null>(null)
const chartContainer = ref<HTMLElement | null>(null)
const fullscreenContainer = ref<HTMLElement | null>(null)
const chart = shallowRef<any>(null)
const series = shallowRef<any>(null)
const volumeSeries = shallowRef<any>(null)
const isFullscreen = ref(false)
const isInteracting = ref(false)
const intervals = ['1s', '1m', '1h', '1d', '1w', '1M']
const filteredIntervals = computed(() => {
  const isCrypto = activeSymbol.value.endsWith('USDT')
  if (isCrypto) return intervals
  // Hide 1s and 1m for stocks
  return intervals.filter(i => i !== '1s' && i !== '1m')
})

// Reset interval if it becomes unavailable for the selected asset
watch(activeSymbol, (newSymbol) => {
  const isCrypto = newSymbol.endsWith('USDT')
  if (!isCrypto && (activeInterval.value === '1s' || activeInterval.value === '1m')) {
    setActiveInterval('1d')
  }
})

const intervalColors: Record<string, string> = {
  '1s': '#eab308',
  '1m': '#a855f7',
  '1h': '#ec4899',
  '1d': '#38bdf8',
  '1w': '#10b981',
  '1M': '#f97316',
}

const displayIntervals: Record<string, string> = {
  '1s': '1s',
  '1m': '1m',
  '1h': '1H',
  '1d': '1D',
  '1w': '1W',
  '1M': '1M'
}

let ws: WebSocket | null = null

function createChartInContainer(container: HTMLElement) {
  const isMobile = window.innerWidth < 768;
  const c = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
      horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
    },
    // Mobile Touch Optimization: Disable vertical touch drag to allow page scrolling
    handleScroll: {
      vertTouchDrag: !isMobile,
    },
    rightPriceScale: {
      borderColor: 'rgba(30, 41, 59, 0.8)',
    },
    timeScale: {
      borderColor: 'rgba(30, 41, 59, 0.8)',
      timeVisible: true,
    },
    crosshair: {
      mode: 1,
      vertLine: { color: 'rgba(56, 189, 248, 0.5)', width: 1, style: 3 },
      horzLine: { color: 'rgba(56, 189, 248, 0.5)', width: 1, style: 3 },
    },
    autoSize: true,
  })
  return c
}

const loadHistoricalData = async (targetChart = chart.value) => {
  if (!targetChart) return
  let symbol = activeSymbol.value
  // Redirect BDI to BDRY for charting
  if (symbol === 'BDI') symbol = 'BDRY'
  
  const isCrypto = symbol.endsWith('USDT')
  const interval = activeInterval.value
  
  let priceData: any[] = []
  let volData: any[] = []

  if (isCrypto) {
    const limit = 1000
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    const { data } = await useFetch(url).json()
    
    if (data.value && Array.isArray(data.value)) {
      priceData = data.value.map((k: any) => ({
        time: k[0] / 1000,
        value: parseFloat(k[4]),
      }))
      volData = data.value.map((k: any) => ({
        time: k[0] / 1000,
        value: parseFloat(k[5]),
        color: parseFloat(k[4]) >= parseFloat(k[1])
          ? 'rgba(16, 185, 129, 0.5)'
          : 'rgba(239, 68, 68, 0.4)',
      }))
    }
  } else {
    // Stock fetched via Yahoo Finance proxy
    let yInterval = '1d'
    let yRange = '2y'
    
    if (interval === '1s' || interval === '1m') {
      yInterval = '1m'
      yRange = '5d' // Max 7d allowed for 1m
    } else if (interval === '1h') {
      yInterval = '60m'
      yRange = '1mo'
    } else if (interval === '1d') {
      yInterval = '1d'
      yRange = '2y'
    } else if (interval === '1w') {
      yInterval = '1wk'
      yRange = '5y'
    } else if (interval === '1M') {
      yInterval = '1mo'
      yRange = '10y'
    }
    
    const url = `/yfinance/v8/finance/chart/${symbol}?interval=${yInterval}&range=${yRange}`
    const { data } = await useFetch(url).json()

    const result = data.value?.chart?.result?.[0]
    const isBdi = activeSymbol.value === 'BDI'
    if (result && result.timestamp && result.indicators?.quote?.[0]) {
      const tArray = result.timestamp
      const q = result.indicators.quote[0]
      for (let i = 0; i < tArray.length; i++) {
        if (q.close[i] === null || q.open[i] === null) continue
        
        let close = q.close[i]
        let open = q.open[i]
        if (isBdi) {
          close *= 255
          open *= 255
        }

        // Yahoo Finance returns time in seconds
        priceData.push({ time: tArray[i], value: close })
        volData.push({
          time: tArray[i],
          value: q.volume[i] || 0,
          color: close >= open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.4)',
        })
      }
    }
  }

  // Determine scaling dynamically
  const isDoge = symbol === 'DOGEUSDT'
  const isStable = symbol.includes('USDC') || symbol.includes('FDUSD')
  const precision = isDoge || isStable ? 4 : 2
  const minMove = isDoge || isStable ? 0.0001 : 0.01

  // Update/recreate series on the target chart
  if (series.value && priceData.length > 0) {
    series.value.applyOptions({
      color: intervalColors[activeInterval.value],
      priceFormat: {
        type: 'price',
        precision,
        minMove,
      }
    })
    series.value.setData(priceData)
  }
  if (volumeSeries.value && volData.length > 0) {
    volumeSeries.value.setData(volData)
  }

  targetChart.timeScale().fitContent()

  // Calculate RSI for VOO/VTI
  if ((activeSymbol.value === 'VOO' || activeSymbol.value === 'VTI') && priceData.length > 14) {
    let gains = 0
    let losses = 0
    const period = 14
    
    // Simple RSI initial calculation
    for (let i = priceData.length - period; i < priceData.length; i++) {
      const diff = priceData[i].value - priceData[i - 1].value
      if (diff > 0) gains += diff
      else losses -= diff
    }
    
    if (losses === 0) currentRsi.value = 100
    else {
      const rs = (gains / period) / (losses / period)
      currentRsi.value = 100 - (100 / (1 + rs))
    }
  } else {
    currentRsi.value = null
  }
}

const connectWebSocket = () => {
  if (ws) ws.close()
  const symbol = activeSymbol.value
  const isCrypto = symbol.endsWith('USDT')
  
  if (!isCrypto) return // No Binance WS for stocks
  
  const interval = activeInterval.value
  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`)
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.k) {
      const kline = message.k
      if (kline.i !== activeInterval.value) return
      if (series.value) {
        series.value.update({ time: kline.T / 1000, value: parseFloat(kline.c) })
      }
      if (volumeSeries.value) {
        volumeSeries.value.update({
          time: kline.T / 1000,
          value: parseFloat(kline.v),
          color: parseFloat(kline.c) >= parseFloat(kline.o)
            ? 'rgba(16, 185, 129, 0.5)'
            : 'rgba(239, 68, 68, 0.4)',
        })
      }
    }
  }
}

watch([activeSymbol, activeInterval], async () => {
  await loadHistoricalData()
  connectWebSocket()
})

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function onEscKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) isFullscreen.value = false
}

// When fullscreen toggles, remount the chart into the appropriate container
watch(isFullscreen, async (val) => {
  // Wait one tick for the container to be mounted/removed from DOM
  await new Promise(r => setTimeout(r, 50))
  const target = val ? fullscreenContainer.value : chartContainer.value
  if (!target) return
  initChart(target)
  await loadHistoricalData()
  connectWebSocket()
})

function initChart(container: HTMLElement) {
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
  
  chart.value = createChartInContainer(container)
  const isDoge = activeSymbol.value === 'DOGEUSDT'
  const isStable = activeSymbol.value.includes('USDC') || activeSymbol.value.includes('FDUSD')
  const precision = isDoge || isStable ? 4 : 2
  const minMove = isDoge || isStable ? 0.0001 : 0.01
  
  series.value = chart.value.addSeries(LineSeries, {
    color: intervalColors[activeInterval.value],
    lineWidth: 2,
    crosshairMarkerRadius: 5,
    priceFormat: {
      type: 'price',
      precision,
      minMove,
    },
    priceScaleId: 'right',
  })

  volumeSeries.value = chart.value.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  })
  chart.value.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.8, bottom: 0 },
  })

  // Since autoSize: true is set in createChartInContainer, 
  // we don't need a manual ResizeObserver to applyOptions(width/height).
}

onMounted(async () => {
  if (!chartContainer.value) return
  initChart(chartContainer.value)
  await loadHistoricalData()
  connectWebSocket()
  window.addEventListener('keydown', onEscKey)
})

onUnmounted(() => {
  if (chart.value) chart.value.remove()
  if (ws) ws.close()
  window.removeEventListener('keydown', onEscKey)
})
</script>

<template>
  <div class="flex flex-col h-full w-full relative group">
    
    <!-- Top Bar -->
    <div class="h-10 md:h-12 border-b border-slate-800/80 flex items-center justify-between px-2 md:px-4 z-10 bg-[#05080f]/80 backdrop-blur-sm shrink-0">
      <div class="flex items-center space-x-2 md:space-x-3">
        <h2 class="text-white font-bold text-base md:text-lg flex items-center tracking-wide font-mono">
          <span class="mr-2" :style="{ color: intervalColors[activeInterval], textShadow: `0 0 8px ${intervalColors[activeInterval]}80` }">{{ formattedActiveSymbol }}</span>
          
          <!-- Sentiment Badge -->
          <span 
            v-if="sentimentInfo"
            class="text-[9px] md:text-[10px] px-2 py-0.5 rounded-full border font-bold mr-2 transition-all animate-fade-in"
            :class="sentimentInfo.color"
          >
            {{ sentimentInfo.label }}
          </span>

          <!-- Data Source Badge -->
          <span 
            class="text-[8px] md:text-[9px] px-1.5 py-0.5 rounded border tracking-wider opacity-80"
            :class="activeSymbol.endsWith('USDT') ? 'bg-yellow-900/30 text-yellow-500 border-yellow-800' : 'bg-purple-900/30 text-purple-400 border-purple-800'"
          >
            {{ activeSymbol.endsWith('USDT') ? 'BINANCE' : 'YAHOO' }}
          </span>
        </h2>
      </div>

      <div class="flex items-center space-x-2 md:space-x-4">
        <!-- Interval Selector -->
        <div class="flex items-center space-x-0.5 md:space-x-1 bg-[#0a0f1c] rounded p-0.5 md:p-1 border border-slate-800/50">
          <button 
            v-for="t in filteredIntervals" 
            :key="t"
            class="text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 md:py-1 rounded transition-colors font-mono"
            :class="t === activeInterval ? 'bg-slate-700 text-white shadow-[0_0_5px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'"
            @click="setActiveInterval(t)"
          >
            {{ displayIntervals[t] }}
          </button>
        </div>

        <button @click="toggleFullscreen" class="p-1 md:p-1.5 hover:bg-slate-800 rounded text-slate-500 transition-colors hidden sm:block">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Normal Chart -->
    <div class="h-[320px] md:flex-1 relative w-full overflow-hidden">
      <div ref="chartContainer" class="w-full h-full cursor-crosshair touch-pan-y"></div>
      
      <!-- Mobile Scroll Protection Overlay -->
      <div 
        v-if="!isInteracting"
        class="md:hidden absolute inset-0 z-20 bg-transparent flex items-center justify-center group/overlay"
        @click="isInteracting = true"
      >
        <div class="bg-blue-600/10 backdrop-blur-[1px] border border-blue-500/20 px-4 py-2 rounded-full text-[10px] text-blue-400 font-bold opacity-0 group-hover/overlay:opacity-100 transition-opacity">
          TOUCH TO INTERACT
        </div>
      </div>
      
      <!-- Close interaction button -->
      <button 
        v-if="isInteracting"
        @click="isInteracting = false"
        class="md:hidden absolute top-2 right-2 z-30 bg-slate-900/80 p-1.5 rounded-full text-slate-400 border border-slate-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Fullscreen Modal (Teleport to body so it's above everything) -->
  <Teleport to="body">
    <div v-if="isFullscreen" class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" @click.self="isFullscreen = false">
      <div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-[#05080f] border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-[0_0_60px_rgba(56,189,248,0.15)]">
        <!-- Fullscreen Header -->
        <div class="h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div class="flex items-center space-x-4">
            <h2 class="text-white font-bold text-lg" :style="{ color: intervalColors[activeInterval] }">{{ formattedActiveSymbol }}</h2>
            <!-- Sentiment Badge (Fullscreen) -->
            <span 
              v-if="sentimentInfo"
              class="text-[10px] px-2 py-0.5 rounded-full border font-bold animate-fade-in"
              :class="sentimentInfo.color"
            >
              {{ sentimentInfo.label }}
            </span>
            <div class="text-[10px] text-green-400 font-mono tracking-wider font-bold">LIVE <span class="text-slate-500 ml-1">{{ activeSymbol.endsWith('USDT') ? 'Binance Stream' : 'Yahoo Finance' }}</span></div>
          </div>
          <div class="flex items-center space-x-2">
            <div class="flex bg-[#111827] rounded border border-slate-800 p-0.5">
              <button v-for="t in filteredIntervals" :key="t"
                @click="setActiveInterval(t)"
                class="text-[10px] font-bold px-2 py-1 rounded transition-colors font-mono"
                :class="t === activeInterval ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'">
                {{ displayIntervals[t] }}
              </button>
            </div>
            <button @click="isFullscreen = false" class="p-1.5 text-slate-400 hover:text-white border border-slate-700 rounded bg-[#111827] transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <!-- Fullscreen Chart Container — same chart instance by sharing ref via watch -->
        <div ref="fullscreenContainer" class="flex-1 w-full cursor-crosshair"></div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeInUp 0.4s ease-out forwards;
}

:deep(a[href*="tradingview.com"]) {
  display: none !important;
}
</style>

