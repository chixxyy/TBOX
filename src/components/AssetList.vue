<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { activeSymbol, setActiveSymbol } from '../store'

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

// Initial state with top pairs
const initialAssets: Asset[] = [
  // Crypto
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'ETHUSDT', name: 'Ethereum', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'SOLUSDT', name: 'Solana', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'USDCUSDT', name: 'USDC/USDT', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  // Stock
  { symbol: 'NVDA', name: 'Nvidia', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'AMD', name: 'AMD', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'CRCL', name: 'Circle', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'ORCL', name: 'Oracle', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'PLTR', name: 'Palantir', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' }
]
const assets = ref<Asset[]>(initialAssets)

const filter = ref('')
const activeFilterIndex = ref(0)
const filters = ['全部', '加密貨幣', '股票']

const filteredAssets = computed(() => {
  let result = assets.value

  if (activeFilterIndex.value === 1) {
    result = result.filter(a => a.type === 'crypto')
  } else if (activeFilterIndex.value === 2) {
    result = result.filter(a => a.type === 'stock')
  }

  if (!filter.value) return result
  
  const q = filter.value.toLowerCase()
  return result.filter(a => 
    a.symbol.toLowerCase().includes(q) || 
    a.name.toLowerCase().includes(q)
  )
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

onMounted(async () => {
  // Fetch initial stock prices from Finnhub directly
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
          asset.prevClose = quote.pc // store previous close to calculate live updates
        }
      } catch (err) {
        console.error(`Failed to fetch initial quote for ${asset.symbol}:`, err)
      }
    }))
  } catch (e) {
    console.error('Failed to fetch initial stock quotes:', e)
  }

  // 1. 加密貨幣 WebSocket (Binance)
  wsBinance = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr')
  
  wsBinance.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    // Create a map for quick lookup
    const updateMap = new Map()
    data.forEach((ticker: any) => {
      updateMap.set(ticker.s, ticker) // s = symbol
    })

    // Update tracked assets
    assets.value.forEach(asset => {
      // 加上 type 判斷，確保 Binance 只更新加密貨幣
      if (asset.type === 'crypto') {
        const ticker = updateMap.get(asset.symbol)
        if (ticker) {
          const currentPrice = parseFloat(ticker.c) // c = last price
          const priceChangePercent = parseFloat(ticker.P) // P = price change percent
          
          asset.price = formatPrice(ticker.c)
          asset.change = `${priceChangePercent > 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%`
          asset.up = priceChangePercent >= 0
          asset.rawPrice = currentPrice
        }
      }
    })
  }

  // 2. 美股 WebSocket (Finnhub)
  const token = import.meta.env.VITE_FINNHUB_TOKEN as string
  wsFinnhub = new WebSocket(`wss://ws.finnhub.io?token=${token}`)

  wsFinnhub.onopen = () => {
    ['NVDA', 'AMD', 'CRCL', 'AMZN', 'TSLA', 'ORCL', 'PLTR'].forEach(sym => {
      wsFinnhub?.send(JSON.stringify({'type':'subscribe', 'symbol': sym}))
    })
  }

  wsFinnhub.onmessage = (event) => {
    const response = JSON.parse(event.data)
    
    // 確保收到的是交易資料 (trade)
    if (response.type === 'trade') {
      response.data.forEach((trade: any) => {
        const symbol = trade.s
        const price = trade.p
        
        // 找到對應的股票資產並更新
        const asset = assets.value.find(a => a.symbol === symbol && a.type === 'stock')
        if (asset) {
          asset.rawPrice = price
          asset.price = formatPrice(price.toString()) 
          
          if (asset.prevClose) {
            const changePercent = ((price - asset.prevClose) / asset.prevClose) * 100
            asset.change = `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`
            asset.up = changePercent >= 0
          }
        }
      })
    }
  }
})

onUnmounted(() => {
  // 元件卸載時，記得把兩個 WebSocket 都關閉以節省資源
  if (wsBinance) wsBinance.close()
  if (wsFinnhub) wsFinnhub.close()
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
      <div class="flex space-x-2 mt-3 overflow-x-auto scrollbar-hide">
        <button 
          v-for="(f, i) in filters" 
          :key="f"
          @click="activeFilterIndex = i"
          class="px-3 py-1 rounded text-[10px] font-bold font-mono transition-all shrink-0 uppercase tracking-tighter"
          :class="activeFilterIndex === i ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'bg-[#111827] text-slate-500 border border-slate-800 hover:text-slate-300 hover:bg-slate-800'"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- List Headers -->
    <div class="flex items-center justify-between px-2 md:px-4 py-1 md:py-2 text-[9px] md:text-[10px] font-bold text-slate-500 border-b border-slate-800/50 bg-[#070b14]">
      <span>資產</span>
      <div class="flex space-x-2 md:space-x-4 text-right">
        <span class="w-14 md:w-16">價格</span>
        <span class="w-10 md:w-12">24H</span>
      </div>
    </div>

    <!-- Asset List -->
    <div class="h-[180px] md:h-auto md:flex-1 overflow-y-auto">
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
