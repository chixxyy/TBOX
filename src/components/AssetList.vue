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
}

// Initial state with top pairs
const initialAssets: Asset[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'ETHUSDT', name: 'Ethereum', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'SOLUSDT', name: 'Solana', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: '...', change: '...', up: true, rawPrice: 0, type: 'crypto'},
  { symbol: 'NVDA', name: 'Nvidia', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'AMD', name: 'AMD', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' },
  { symbol: 'CRCL', name: 'Circle', price: '...', change: '...', up: true, rawPrice: 0, type: 'stock' }
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

onMounted(() => {
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
  const finnhubToken = import.meta.env.VITE_FINNHUB_TOKEN as string
  wsFinnhub = new WebSocket(`wss://ws.finnhub.io?token=${finnhubToken}`)

  wsFinnhub.onopen = () => {
    wsFinnhub?.send(JSON.stringify({'type':'subscribe', 'symbol': 'NVDA'}))
    wsFinnhub?.send(JSON.stringify({'type':'subscribe', 'symbol': 'AMD'}))
    wsFinnhub?.send(JSON.stringify({'type':'subscribe', 'symbol': 'CRCL'}))
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
          // 將數字轉為字串傳入你的 formatPrice 函數
          asset.price = formatPrice(price.toString()) 
          
          // 備註：Finnhub 即時報價不包含 24H 漲跌幅，所以這裡先不更新 asset.change 和 asset.up
          // 若畫面初始有給定預設值（如 '...'），它會保持原樣
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
  <div class="flex flex-col h-full">
    <div class="p-3 border-b border-slate-800">
      <div class="relative flex items-center bg-[#111827] border border-slate-700 rounded mb-3 px-2 py-1.5 focus-within:border-blue-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input v-model="filter" type="text" placeholder="搜尋資產..." class="bg-transparent border-none outline-none text-xs w-full text-slate-300" />
      </div>

      <div class="flex space-x-1 decoration-slate-600 bg-slate-900/50 p-1 rounded-md border border-slate-800">
        <button 
          v-for="(f, i) in filters" 
          :key="f"
          @click="activeFilterIndex = i"
          class="flex-1 text-[10px] py-1 rounded transition-colors font-medium"
          :class="activeFilterIndex === i ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300'"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- Headers -->
    <div class="flex items-center justify-between px-4 py-2 text-[10px] font-bold text-slate-500 border-b border-slate-800/50 bg-[#070b14]">
      <span>資產</span>
      <div class="flex space-x-4 text-right">
        <span class="w-16">價格</span>
        <span class="w-12">24H</span>
      </div>
    </div>

    <!-- Asset List -->
    <div class="flex-1 overflow-y-auto">
      <div 
        v-for="asset in filteredAssets" 
        :key="asset.symbol"
        @click="setActiveSymbol(asset.symbol)"
        class="flex items-center justify-between px-4 py-3 border-b border-slate-800/30 cursor-pointer group transition-colors"
        :class="activeSymbol === asset.symbol ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/40'"
      >
        <div class="flex flex-col">
          <span class="text-xs font-bold group-hover:text-blue-400 group-hover:-translate-y-0.5 transition-all"
                :class="activeSymbol === asset.symbol ? 'text-blue-400' : 'text-slate-200'">{{ formatSymbolDisplay(asset.symbol) }}</span>
          <span class="text-[10px] text-slate-500">{{ asset.name }}</span>
        </div>
        
        <div class="flex space-x-4 text-right font-mono">
          <span class="text-xs w-16 text-slate-300 group-hover:text-white transition-colors duration-300" 
            :class="asset.up ? 'group-hover:text-green-400' : 'group-hover:text-red-400'">{{ asset.price }}</span>
          <span 
            class="text-[10px] w-12 py-0.5 rounded font-bold"
            :class="asset.up ? 'text-green-400 bg-green-900/20' : 'text-red-400 bg-red-900/20'"
          >
            {{ asset.change }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
