<script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, watch } from 'vue'
import { createChart, ColorType, LineSeries } from 'lightweight-charts'
import { activeSymbol, activeInterval, setActiveInterval, formattedActiveSymbol } from '../store'
import { useFetch } from '@vueuse/core'

const chartContainer = ref<HTMLElement | null>(null)
const chart = shallowRef<any>(null)
const series = shallowRef<any>(null)
const intervals = ['1d', '1w', '1M']

const intervalColors: Record<string, string> = {
  '1d': '#38bdf8', // Neon blue
  '1w': '#10b981', // Neon green
  '1M': '#f97316', // Orange
}

const displayIntervals: Record<string, string> = {
  '1d': '1D',
  '1w': '1W',
  '1M': '1M'
}

let ws: WebSocket | null = null

// Real-time rendering logic
const loadHistoricalData = async () => {
  if (!series.value) return
  
  const symbol = activeSymbol.value
  const interval = activeInterval.value
  const limit = 500
  
  // Fetch historical klines from Binance REST API
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const { data } = await useFetch(url).json()
  
  if (data.value && Array.isArray(data.value)) {
    const chartData = data.value.map((k: any) => {
      // time in unix timestamp for lightweight charts (must be in seconds for daily/weekly/monthly)
      return {
        time: k[0] / 1000, 
        value: parseFloat(k[4]) // close price
      }
    })
    
    // Sort and set data
    series.value.setData(chartData)
    chart.value.timeScale().fitContent()
  }
}

const connectWebSocket = () => {
  if (ws) {
    ws.close()
  }
  
  const symbol = activeSymbol.value.toLowerCase()
  const interval = activeInterval.value
  
  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`)
  
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.k) {
      const kline = message.k
      if (kline.i !== activeInterval.value) return // Ignore old messages
      
      const latestBar = {
        time: kline.T / 1000, // close time of the kline in seconds
        value: parseFloat(kline.c) // Close price as line value
      }
      
      if (series.value) {
         series.value.update(latestBar)
      }
    }
  }
}

const changeInterval = async (interval: string) => {
  setActiveInterval(interval)
}

// Watchers for reactive UI
watch([activeSymbol, activeInterval], async () => {
  if (series.value) {
    const isDoge = activeSymbol.value === 'DOGEUSDT'
    series.value.applyOptions({
      color: intervalColors[activeInterval.value] || intervalColors['1d'],
      priceFormat: {
        type: 'price',
        precision: isDoge ? 4 : 2,
        minMove: isDoge ? 0.0001 : 0.01,
      }
    })
  }
  await loadHistoricalData()
  connectWebSocket()
})

onMounted(async () => {
  if (!chartContainer.value) return

  chart.value = createChart(chartContainer.value, {
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
      mode: 1, // Magnet mode
      vertLine: {
        color: 'rgba(56, 189, 248, 0.5)',
        width: 1,
        style: 3, // Dashed
      },
      horzLine: {
        color: 'rgba(56, 189, 248, 0.5)',
        width: 1,
        style: 3, // Dashed
      },
    },
    autoSize: true, // Let lightweight-charts handle resizing internally if possible
  })

  const isDoge = activeSymbol.value === 'DOGEUSDT'
  series.value = chart.value.addSeries(LineSeries, { 
    color: intervalColors[activeInterval.value],
    lineWidth: 2,
    crosshairMarkerRadius: 5,
    priceFormat: {
      type: 'price',
      precision: isDoge ? 4 : 2,
      minMove: isDoge ? 0.0001 : 0.01,
    }
  })

  const resizeObserver = new ResizeObserver(entries => {
    const entry = entries[0];
    if (!entry || !chartContainer.value || entry.target !== chartContainer.value) return;
    
    // Explicitly check for both entry and width/height
    if (entry.contentRect && chart.value) {
      chart.value.applyOptions({ 
        height: entry.contentRect.height, 
        width: entry.contentRect.width 
      });
    }
  });

  resizeObserver.observe(chartContainer.value);

  await loadHistoricalData()
  connectWebSocket()
})

onUnmounted(() => {
  if (chart.value) {
    chart.value.remove()
  }
  if (ws) {
    ws.close()
  }
})

</script>

<template>
  <div class="flex-1 flex flex-col relative bg-[#03050a] overflow-hidden group">
    <!-- Chart Header -->
    <div class="h-12 border-b border-slate-800/80 flex items-center justify-between px-4 z-10 bg-[#05080f]/80 backdrop-blur-sm">
      <div class="flex items-center space-x-4">
        <h2 class="text-white font-bold text-lg neon-text-blue" :style="{ color: intervalColors[activeInterval], textShadow: `0 0 8px ${intervalColors[activeInterval]}80` }">{{ formattedActiveSymbol }}</h2>
        <div class="text-[10px] text-green-400 font-mono tracking-wider font-bold">LIVE <span class="text-slate-500 ml-1">Binance Stream</span></div>
      </div>
      
      <div class="flex items-center space-x-2">
        <div class="flex bg-[#111827] rounded border border-slate-800 p-0.5">
          <button v-for="t in intervals" :key="t" 
            @click="changeInterval(t)"
            class="text-[10px] font-bold px-2 py-1 rounded transition-colors"
            :class="t === activeInterval ? 'bg-slate-700 text-white shadow-[0_0_5px_rgba(255,255,255,0.1)]' : 'text-slate-500 hover:text-slate-300'">
            {{ displayIntervals[t] }}
          </button>
        </div>
        <button class="p-1.5 text-slate-400 hover:text-white border border-slate-700 rounded bg-[#111827]">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Chart Content -->
    <div ref="chartContainer" class="flex-1 relative w-full h-full cursor-crosshair"></div>
    
  </div>
</template>
