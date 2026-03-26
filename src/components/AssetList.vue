<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { activeSymbol, setActiveSymbol, marketPrices, initialAssets } from '../store'

interface Asset {
  symbol: string
  name: string
  price: string
  change: string
  up: boolean
  rawPrice: number
  type: 'crypto' | 'stock'
  prevClose?: number
}

// Initial state with top pairs (Mapped from global store)
const assets = ref<Asset[]>(initialAssets.map(a => ({
  ...a,
  price: '...',
  change: '...',
  up: true,
  rawPrice: 0
})) as Asset[])

const filter = ref('')
const activeFilterIndex = ref(0)
const filters = ['全部', '加密貨幣', '股票']

const filteredAssets = computed(() => {
  // Separate assets by type
  const cryptos = assets.value.filter(a => a.type === 'crypto')
  const stocks = [...assets.value.filter(a => a.type === 'stock')].sort((a, b) => a.symbol.localeCompare(b.symbol))

  let result: Asset[] = []

  // Determine base list based on filter
  if (activeFilterIndex.value === 0) {
    result = [...cryptos, ...stocks]
  } else if (activeFilterIndex.value === 1) {
    result = cryptos
  } else {
    result = stocks
  }

  // Apply search query
  if (filter.value) {
    const q = filter.value.toLowerCase()
    return result.filter(a => 
      a.symbol.toLowerCase().includes(q) || 
      a.name.toLowerCase().includes(q)
    )
  }

  return result
})

let wsBinance: WebSocket | null = null
let wsFinnhub: WebSocket | null = null

const formatPrice = (priceStr: string) => {
  const p = parseFloat(priceStr)
  if (p < 1) return p.toFixed(4)
  if (p < 10) return p.toFixed(3)
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

import { api } from '../api'

let reconnectTimerBinance: any = null
let reconnectTimerFinnhub: any = null
let finnhubRetryCount = 0
const MAX_FINNHUB_RETRIES = 3

const connectBinance = () => {
  if (wsBinance) {
    wsBinance.close()
    wsBinance = null
  }
  
  const cryptoSymbols = assets.value.filter(a => a.type === 'crypto').map(a => a.symbol.toLowerCase())
  const streams = cryptoSymbols.map(s => `${s}@ticker`).join('/')
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`
  
  wsBinance = new WebSocket(url)
  wsBinance.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      const ticker = msg.data
      const asset = assets.value.find(a => a.symbol === ticker.s)
      if (asset) {
        const currentPrice = parseFloat(ticker.c)
        const priceChangePercent = parseFloat(ticker.P)
        asset.price = formatPrice(ticker.c)
        asset.change = `${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`
        asset.up = priceChangePercent >= 0
        asset.rawPrice = currentPrice
        marketPrices.value[asset.symbol] = {
          price: asset.price, change: asset.change,
          up: asset.up, rawPrice: asset.rawPrice
        }
      }
    } catch (e) {
      console.error('Binance WS process error:', e)
    }
  }

  wsBinance.onclose = () => {
    if (reconnectTimerBinance) clearTimeout(reconnectTimerBinance)
    reconnectTimerBinance = setTimeout(connectBinance, 5000)
  }
}

const connectFinnhub = () => {
  if (wsFinnhub) {
    wsFinnhub.close()
    wsFinnhub = null
  }
  
  if (finnhubRetryCount >= MAX_FINNHUB_RETRIES) {
    console.warn(`Finnhub WebSocket failed ${MAX_FINNHUB_RETRIES} times. Switching to polling mode for stocks.`)
    // Fallback: Start periodic polling if not already started
    startStockPolling()
    return
  }

  const token = import.meta.env.VITE_FINNHUB_TOKEN as string
  if (!token) return

  wsFinnhub = new WebSocket(`wss://ws.finnhub.io?token=${token}`)
  
  wsFinnhub.onopen = () => {
    finnhubRetryCount = 0 // Reset on successful connection
    assets.value.filter(a => a.type === 'stock').forEach(asset => {
      wsFinnhub?.send(JSON.stringify({'type':'subscribe', 'symbol': asset.symbol}))
    })
  }

  wsFinnhub.onmessage = (event) => {
    try {
      const response = JSON.parse(event.data)
      if (response.type === 'trade') {
        response.data.forEach((trade: any) => {
          const asset = assets.value.find(a => a.symbol === trade.s && a.type === 'stock')
          if (asset && asset.prevClose) {
            asset.rawPrice = trade.p
            asset.price = formatPrice(trade.p.toString())
            const changePercent = ((trade.p - asset.prevClose) / asset.prevClose) * 100
            asset.change = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`
            asset.up = changePercent >= 0
            marketPrices.value[asset.symbol] = {
              price: asset.price, change: asset.change,
              up: asset.up, rawPrice: asset.rawPrice, prevClose: asset.prevClose
            }
          }
        })
      }
    } catch (e) {
      console.error('Finnhub WS process error:', e)
    }
  }

  wsFinnhub.onerror = () => {
    finnhubRetryCount++
    if (wsFinnhub) wsFinnhub.close()
  }

  wsFinnhub.onclose = () => {
    if (finnhubRetryCount < MAX_FINNHUB_RETRIES) {
      if (reconnectTimerFinnhub) clearTimeout(reconnectTimerFinnhub)
      const delay = Math.pow(2, finnhubRetryCount) * 1000 // Exponential backoff
      reconnectTimerFinnhub = setTimeout(connectFinnhub, delay)
    }
  }
}

let stockPollingTimer: any = null
const startStockPolling = () => {
  if (stockPollingTimer) return
  stockPollingTimer = setInterval(async () => {
    const stockAssets = assets.value.filter(a => a.type === 'stock')
    for (const asset of stockAssets) {
      try {
        const quote = await api.getFinnhubQuote(asset.symbol)
        if (quote && quote.c) {
          asset.rawPrice = quote.c
          asset.price = formatPrice(quote.c.toString())
          asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
          asset.up = quote.dp >= 0
          asset.prevClose = quote.pc
          marketPrices.value[asset.symbol] = {
            price: asset.price, change: asset.change,
            up: asset.up, rawPrice: asset.rawPrice, prevClose: asset.prevClose
          }
        }
      } catch (err) { /* Silent fail for polling */ }
    }
  }, 30000) // Poll every 30s as fallback
}

onMounted(() => {
  // 1. Non-blocking initial fetches
  const fetchStocks = async () => {
    try {
      const stockAssets = assets.value.filter(a => a.type === 'stock')
      await Promise.all(stockAssets.map(async (asset) => {
        try {
          const quote = await api.getFinnhubQuote(asset.symbol)
          if (quote && quote.c) {
            asset.rawPrice = quote.c
            asset.price = formatPrice(quote.c.toString())
            asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
            asset.up = quote.dp >= 0
            asset.prevClose = quote.pc
            marketPrices.value[asset.symbol] = {
              price: asset.price,
              change: asset.change,
              up: asset.up,
              rawPrice: asset.rawPrice,
              prevClose: asset.prevClose
            }
          }
        } catch (err) { console.error(`Finnhub init error ${asset.symbol}:`, err) }
      }))
    } catch (e) { console.error('Stock init failed:', e) }
  }

  const fetchCryptos = async () => {
    try {
      const resp = await fetch('https://api.binance.com/api/v3/ticker/24hr')
      const data: any[] = await resp.json()
      const updateMap = new Map<string, any>(data.map(t => [t.symbol, t]))
      
      assets.value.forEach(asset => {
        if (asset.type === 'crypto') {
          const t = updateMap.get(asset.symbol)
          if (t) {
            asset.rawPrice = parseFloat(t.lastPrice)
            asset.price = formatPrice(t.lastPrice)
            const ch = parseFloat(t.priceChangePercent)
            asset.change = `${ch > 0 ? '+' : ''}${ch.toFixed(2)}%`
            asset.up = ch >= 0
            marketPrices.value[asset.symbol] = {
              price: asset.price, change: asset.change,
              up: asset.up, rawPrice: asset.rawPrice
            }
          }
        }
      })
    } catch (e) { console.error('Binance init error:', e) }
  }

  fetchStocks()
  fetchCryptos()

  // 2. Initialize Real-time status
  connectBinance()
  connectFinnhub()
})

onUnmounted(() => {
  if (wsBinance) wsBinance.close()
  if (wsFinnhub) wsFinnhub.close()
  if (reconnectTimerBinance) clearTimeout(reconnectTimerBinance)
  if (reconnectTimerFinnhub) clearTimeout(reconnectTimerFinnhub)
})

const formatSymbolDisplay = (symbol: string) => symbol.replace('USDT', '/USDT')
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-[#0a0f1c] text-white">
    <!-- Header Area -->
    <div class="p-3 border-b border-white/5 shrink-0 bg-[#070b14]/50">
      <!-- Search Box (Prominent at top) -->
      <div class="flex items-center space-x-2 bg-[#111827]/80 rounded-md p-2 border border-slate-800 transition-all focus-within:border-blue-500/50 shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          v-model="filter" 
          type="text" 
          placeholder="搜尋名稱、幣種或股票" 
          class="bg-transparent border-none text-xs text-slate-300 focus:outline-none w-full placeholder-slate-600 font-mono"
        />
      </div>

      <!-- Filters -->
      <div class="grid grid-cols-3 gap-2 mt-3 w-full">
        <button 
          v-for="(f, i) in filters" 
          :key="f"
          @click="activeFilterIndex = i"
          class="py-1.5 rounded-md text-[10px] md:text-xs font-bold font-mono transition-all uppercase tracking-wider text-center"
          :class="activeFilterIndex === i ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-[#111827] text-slate-500 border border-slate-800 hover:text-slate-300 hover:bg-slate-800'"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- List Headers -->
    <div class="flex items-center justify-between px-2 md:px-4 py-1 md:py-2 text-[9px] md:text-[10px] font-bold text-slate-500 border-b border-slate-800/50 bg-[#070b14]">
      <span>資產 ({{ filteredAssets.length }})</span>
      <div class="flex space-x-2 md:space-x-4 text-right">
        <span class="w-14 md:w-16">價格</span>
        <span class="w-10 md:w-12">24H</span>
      </div>
    </div>

    <!-- Asset List -->
    <div class="h-[180px] md:h-auto md:flex-1 overflow-y-auto scrollbar-visible">
      <div 
        v-for="asset in filteredAssets" 
        :key="asset.symbol"
        @click="setActiveSymbol(asset.symbol)"
        class="flex items-center justify-between px-2 md:px-4 py-2 md:py-3 border-b border-slate-800/30 cursor-pointer group transition-colors"
        :class="activeSymbol === asset.symbol ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/40'"
      >
        <div class="flex flex-col">
          <span class="text-[10px] md:text-xs font-bold group-hover:text-blue-400 group-hover:-translate-y-0.5 transition-all"
                :class="activeSymbol === asset.symbol ? 'text-blue-400' : 'text-slate-200'">{{ formatSymbolDisplay(asset.symbol) }}</span>
          <span class="text-[9px] md:text-[10px] text-slate-500">{{ asset.name }}</span>
        </div>
        
        <div class="flex space-x-2 md:space-x-4 text-right font-mono">
          <span class="text-[10px] md:text-xs w-14 md:w-16 text-slate-300 group-hover:text-white transition-colors duration-300" 
            :class="asset.up ? 'group-hover:text-green-400' : 'group-hover:text-red-400'">{{ asset.price }}</span>
          <span 
            class="text-[9px] md:text-[10px] w-10 md:w-12 py-0.5 rounded font-bold"
            :class="asset.up ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'"
          >
            {{ asset.change }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
