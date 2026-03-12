<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { createChart, ColorType, LineSeries, HistogramSeries } from 'lightweight-charts'
import { activeSymbol, activeInterval, setActiveInterval, formattedActiveSymbol } from '../store'
import { useFetch } from '@vueuse/core'

const chartContainer = ref<HTMLElement | null>(null)
const fullscreenContainer = ref<HTMLElement | null>(null)
const chart = shallowRef<any>(null)
const series = shallowRef<any>(null)
const volumeSeries = shallowRef<any>(null)
const isFullscreen = ref(false)
const intervals = ['1d', '1w', '1M']

const intervalColors: Record<string, string> = {
  '1d': '#38bdf8',
  '1w': '#10b981',
  '1M': '#f97316',
}

const displayIntervals: Record<string, string> = {
  '1d': '1D',
  '1w': '1W',
  '1M': '1M'
}

let ws: WebSocket | null = null
let resizeObserver: ResizeObserver | null = null

function createChartInContainer(container: HTMLElement) {
  const c = createChart(container, {
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#94a3b8',
    },
    grid: {
      vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
      horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
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
  const symbol = activeSymbol.value
  const interval = activeInterval.value
  const limit = 500
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const { data } = await useFetch(url).json()
  
  if (data.value && Array.isArray(data.value)) {
    const isDoge = symbol === 'DOGEUSDT'
    const priceData = data.value.map((k: any) => ({
      time: k[0] / 1000,
      value: parseFloat(k[4]),
    }))
    const volData = data.value.map((k: any) => ({
      time: k[0] / 1000,
      value: parseFloat(k[5]),
      color: parseFloat(k[4]) >= parseFloat(k[1])
        ? 'rgba(16, 185, 129, 0.5)'
        : 'rgba(239, 68, 68, 0.4)',
    }))

    // Update/recreate series on the target chart
    if (series.value) {
      series.value.applyOptions({
        color: intervalColors[activeInterval.value],
        priceFormat: {
          type: 'price',
          precision: isDoge ? 4 : 2,
          minMove: isDoge ? 0.0001 : 0.01,
        }
      })
      series.value.setData(priceData)
    }
    if (volumeSeries.value) {
      volumeSeries.value.setData(volData)
    }

    targetChart.timeScale().fitContent()
  }
}

const connectWebSocket = () => {
  if (ws) ws.close()
  const symbol = activeSymbol.value.toLowerCase()
  const interval = activeInterval.value
  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`)
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
  
  series.value = chart.value.addSeries(LineSeries, {
    color: intervalColors[activeInterval.value],
    lineWidth: 2,
    crosshairMarkerRadius: 5,
    priceFormat: {
      type: 'price',
      precision: isDoge ? 4 : 2,
      minMove: isDoge ? 0.0001 : 0.01,
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

  if (resizeObserver) resizeObserver.disconnect()
  resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0]
    if (!entry || !chart.value) return
    chart.value.applyOptions({
      height: entry.contentRect.height,
      width: entry.contentRect.width
    })
  })
  resizeObserver.observe(container)
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
  if (resizeObserver) resizeObserver.disconnect()
  window.removeEventListener('keydown', onEscKey)
})
</script>

<template>
  <div class="flex-1 flex flex-col relative bg-[#03050a] overflow-hidden">
    <!-- Chart Header -->
    <div class="h-12 border-b border-slate-800/80 flex items-center justify-between px-4 z-10 bg-[#05080f]/80 backdrop-blur-sm shrink-0">
      <div class="flex items-center space-x-4">
        <h2 class="text-white font-bold text-lg" :style="{ color: intervalColors[activeInterval], textShadow: `0 0 8px ${intervalColors[activeInterval]}80` }">{{ formattedActiveSymbol }}</h2>
        <div class="text-[10px] text-green-400 font-mono tracking-wider font-bold">LIVE <span class="text-slate-500 ml-1">Binance Stream</span></div>
      </div>
      
      <div class="flex items-center space-x-2">
        <div class="flex bg-[#111827] rounded border border-slate-800 p-0.5">
          <button v-for="t in intervals" :key="t" 
            @click="setActiveInterval(t)"
            class="text-[10px] font-bold px-2 py-1 rounded transition-colors"
            :class="t === activeInterval ? 'bg-slate-700 text-white shadow-[0_0_5px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:text-slate-300'">
            {{ displayIntervals[t] }}
          </button>
        </div>
        <!-- Expand Button -->
        <button @click="toggleFullscreen" class="p-1.5 text-slate-400 hover:text-white border border-slate-700 rounded bg-[#111827] transition-colors hover:border-blue-500/50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Normal Chart -->
    <div ref="chartContainer" class="flex-1 relative w-full cursor-crosshair"></div>
  </div>

  <!-- Fullscreen Modal (Teleport to body so it's above everything) -->
  <Teleport to="body">
    <div v-if="isFullscreen" class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6" @click.self="isFullscreen = false">
      <div class="w-full h-full max-w-[95vw] max-h-[95vh] bg-[#05080f] border border-slate-700 rounded-xl overflow-hidden flex flex-col shadow-[0_0_60px_rgba(56,189,248,0.15)]">
        <!-- Fullscreen Header -->
        <div class="h-12 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div class="flex items-center space-x-4">
            <h2 class="text-white font-bold text-lg" :style="{ color: intervalColors[activeInterval] }">{{ formattedActiveSymbol }}</h2>
            <div class="text-[10px] text-green-400 font-mono tracking-wider font-bold">LIVE <span class="text-slate-500 ml-1">Binance Stream</span></div>
          </div>
          <div class="flex items-center space-x-2">
            <div class="flex bg-[#111827] rounded border border-slate-800 p-0.5">
              <button v-for="t in intervals" :key="t"
                @click="setActiveInterval(t)"
                class="text-[10px] font-bold px-2 py-1 rounded transition-colors"
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

