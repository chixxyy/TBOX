<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useFetch } from '@vueuse/core'
import { activeSymbol, setActiveSymbol, marketPrices, initialAssets, openAIDrawer } from '../stores'

interface Asset {
  symbol: string
  name: string
  price: string
  change: string
  up: boolean
  rawPrice: number
  type: 'crypto' | 'stock'
  prevClose?: number
  isIndex?: boolean
}

// Initial state with top pairs (Mapped from global store)
const assets = ref<Asset[]>(initialAssets.map(a => ({
  ...a,
  price: '---',
  change: '---',
  up: true,
  rawPrice: 0
})) as Asset[])

const filter = ref('')
const activeFilterIndex = ref(0)
const filters = ['全部', '加密貨幣', '股票', '指數']

const filteredAssets = computed(() => {
  // Separate assets by type
  const cryptos = assets.value.filter(a => a.type === 'crypto')
  const stocks = assets.value.filter(a => a.type === 'stock')

  let result: Asset[] = []

  // Determine base list based on filter
  if (activeFilterIndex.value === 0) {
    result = [...cryptos, ...stocks]
  } else if (activeFilterIndex.value === 1) {
    result = cryptos
  } else if (activeFilterIndex.value === 2) {
    // Show only regular stocks (exclude those marked as index)
    result = stocks.filter(s => !s.isIndex)
  } else {
    // Show only index assets
    result = stocks.filter(s => s.isIndex)
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

import { api, getFinnhubToken } from '../network'

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
    startStockPolling()
    return
  }

  const token = getFinnhubToken()
  if (!token) return

  try {
    wsFinnhub = new WebSocket(`wss://ws.finnhub.io?token=${token}`)
    
    wsFinnhub.onopen = () => {
      finnhubRetryCount = 0 
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
        reconnectTimerFinnhub = setTimeout(connectFinnhub, 5000)
      } else {
        startStockPolling()
      }
    }
  } catch (e) {
    finnhubRetryCount++
    startStockPolling()
  }
}

let stockPollingTimer: any = null

const fetchVixData = async () => {
  try {
    // We use range=5d because range=1d often returns chartPreviousClose equal to current price for VIX
    const url = `/yfinance/v8/finance/chart/^VIX?interval=1d&range=5d`
    const { data } = await useFetch(url).json()
    const result = data.value?.chart?.result?.[0]
    if (result && result.indicators?.quote?.[0]?.close) {
      const meta = result.meta
      // Filter out nulls/undefined to get valid historical closing prices
      const prices = result.indicators.quote[0].close.filter((p: any) => p !== null && p !== undefined)
      
      if (prices.length >= 1) {
        // Current price is either from meta or the last valid close in the array
        const currentPrice = meta.regularMarketPrice || prices[prices.length - 1]
        
        // Settlement price (Yesterday's Close):
        // If we have at least 2 prices, the one before the last is the previous session's close.
        const prevClose = prices.length >= 2 ? prices[prices.length - 2] : (meta.chartPreviousClose || meta.previousClose || currentPrice)
        
        const change = prevClose && prevClose !== 0 ? ((currentPrice - prevClose) / prevClose) * 100 : 0
        const safeChange = isNaN(change) || !isFinite(change) ? 0 : change
        
        return {
          price: currentPrice,
          change: `${safeChange > 0 ? '+' : ''}${safeChange.toFixed(2)}%`,
          up: safeChange >= 0,
          prevClose: prevClose
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch VIX from Yahoo:', e)
  }
  return null
}

const startStockPolling = () => {
  if (stockPollingTimer) return
  stockPollingTimer = setInterval(async () => {
    const stockAssets = assets.value.filter(a => a.type === 'stock')
    for (const asset of stockAssets) {
      // Add 1s delay to avoid Finnhub 429
      await new Promise(r => setTimeout(r, 1000))
      try {
        if (asset.symbol === '^VIX') {
          const vix = await fetchVixData()
          if (vix) {
            asset.rawPrice = vix.price
            asset.price = formatPrice(vix.price.toString())
            asset.change = vix.change
            asset.up = vix.up
            asset.prevClose = vix.prevClose
            marketPrices.value[asset.symbol] = {
              price: asset.price, change: asset.change,
              up: asset.up, rawPrice: asset.rawPrice, prevClose: asset.prevClose
            }
          }
          continue
        }

        let targetSymbol = asset.symbol
        let isBdi = asset.symbol === 'BDI'
        if (isBdi) targetSymbol = 'BDRY'

        const quote = await api.getFinnhubQuote(targetSymbol)
        if (quote && quote.c) {
          if (isBdi) {
            const scaledPrice = Math.round(quote.c * 255)
            asset.rawPrice = scaledPrice
            asset.price = scaledPrice.toLocaleString()
            asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
            asset.up = quote.dp >= 0
            asset.prevClose = Math.round(quote.pc * 255)
          } else {
            asset.rawPrice = quote.c
            asset.price = formatPrice(quote.c.toString())
            asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
            asset.up = quote.dp >= 0
            asset.prevClose = quote.pc
          }
          marketPrices.value[asset.symbol] = {
            price: asset.price, change: asset.change,
            up: asset.up, rawPrice: asset.rawPrice, prevClose: asset.prevClose
          }
        }
      } catch (err) { /* Silent fail for polling */ }
    }
  }, 60000)
}

onMounted(() => {
  // 1. Non-blocking initial fetches
  const fetchStocks = async () => {
    const stockAssets = assets.value.filter(a => a.type === 'stock')
    // Sequential to prevent activeRequests dedup from cross-contaminating symbols
    for (const asset of stockAssets) {
      try {
        if (asset.symbol === '^VIX') {
          const vix = await fetchVixData()
          if (vix) {
            asset.rawPrice = vix.price
            asset.price = formatPrice(vix.price.toString())
            asset.change = vix.change
            asset.up = vix.up
            asset.prevClose = vix.prevClose
            marketPrices.value[asset.symbol] = {
              price: asset.price,
              change: asset.change,
              up: asset.up,
              rawPrice: asset.rawPrice,
              prevClose: asset.prevClose
            }
          }
          continue
        }

        const isBdi = asset.symbol === 'BDI'
        const targetSymbol = isBdi ? 'BDRY' : asset.symbol

        const quote = await api.getFinnhubQuote(targetSymbol)
        if (quote && quote.c) {
          if (isBdi) {
            const scaledPrice = Math.round(quote.c * 255)
            asset.rawPrice = scaledPrice
            asset.price = scaledPrice.toLocaleString()
            asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
            asset.up = quote.dp >= 0
            asset.prevClose = Math.round(quote.pc * 255)
          } else {
            asset.rawPrice = quote.c
            asset.price = formatPrice(quote.c.toString())
            asset.change = `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`
            asset.up = quote.dp >= 0
            asset.prevClose = quote.pc
          }
          marketPrices.value[asset.symbol] = {
            price: asset.price,
            change: asset.change,
            up: asset.up,
            rawPrice: asset.rawPrice,
            prevClose: asset.prevClose
          }
        }
      } catch (err) { console.error(`Finnhub init error ${asset.symbol}:`, err) }
    }
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

const formatSymbolDisplay = (symbol: string) => symbol.replace('USDT', '/USDT').replace('^', '')
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

      <!-- Filters (Horizontal Scroll on Mobile) -->
      <div class="flex overflow-x-auto no-scrollbar gap-1.5 mt-3 w-full flex-nowrap pb-1">
        <button 
          v-for="(f, i) in filters" 
          :key="f"
          @click="activeFilterIndex = i"
          class="flex-1 min-w-[64px] py-1.5 rounded-md text-[10px] md:text-xs font-bold font-mono transition-all uppercase tracking-wider text-center shrink-0"
          :class="activeFilterIndex === i ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-[#111827] text-slate-500 border border-slate-800 hover:text-slate-300 hover:bg-slate-800'"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- List Headers -->
    <div class="flex items-center justify-between px-2 md:px-4 py-1 md:py-2 text-[9px] md:text-[10px] font-bold text-slate-500 border-b border-slate-800/50 bg-[#070b14]">
      <span>資產 ({{ filteredAssets.length }})</span>
      <div class="flex space-x-4 md:space-x-8 text-right pr-4 md:pr-10">
        <span class="w-16 md:w-20">價格</span>
        <span class="w-12 md:w-16">24H</span>
      </div>
    </div>

    <!-- Asset List -->
    <div class="h-[180px] md:h-auto md:flex-1 overflow-y-auto scrollbar-visible">
      <div 
        v-for="asset in filteredAssets" 
        :key="asset.symbol"
        @click="setActiveSymbol(asset.symbol)"
        class="flex items-center justify-between px-2 md:px-4 py-2 md:py-3 border-b border-slate-800/30 cursor-pointer group transition-colors relative"
        :class="activeSymbol === asset.symbol ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/40'"
      >
        <div class="flex flex-col">
          <span class="text-[10px] md:text-xs font-bold group-hover:text-blue-400 group-hover:-translate-y-0.5 transition-all"
                :class="activeSymbol === asset.symbol ? 'text-blue-400' : 'text-slate-200'">{{ formatSymbolDisplay(asset.symbol) }}</span>
          <span class="text-[9px] md:text-[10px] text-slate-500">{{ asset.name }}</span>
        </div>
        
        <div class="flex space-x-4 md:space-x-6 text-right font-mono items-center pr-8 md:pr-12">
          <span class="text-[10px] md:text-xs w-16 md:w-20 text-slate-300 group-hover:text-white transition-colors duration-300" 
            :class="asset.up ? 'group-hover:text-green-400' : 'group-hover:text-red-400'">{{ asset.price }}</span>
          <span 
            class="text-[9px] md:text-[10px] w-12 md:w-16 py-0.5 rounded font-bold"
            :class="asset.change === '---' ? 'text-slate-500' : (asset.up ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20')"
          >
            {{ asset.change }}
          </span>
        </div>

        <!-- Absolutely positioned AI Button -->
        <button 
          @click.stop="openAIDrawer(asset.symbol, asset.rawPrice, asset.type)" 
          title="AI 智能速報" 
          class="absolute right-1 md:right-3 w-8 h-8 flex items-center justify-center text-blue-500 hover:text-white hover:bg-blue-600 rounded transition-all shrink-0 z-10"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-visible::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-visible::-webkit-scrollbar-track {
  background: #05080f;
}
.scrollbar-visible::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
.scrollbar-visible::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>
