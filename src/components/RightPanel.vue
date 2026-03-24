<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { activeSymbol, priceAlerts, addPriceAlert, removePriceAlert } from '../store'
import NewsFeed from './NewsFeed.vue'

const currentView = ref('FEED')
const isCrypto = computed(() => activeSymbol.value.toLowerCase().endsWith('usdt'))

// Alerts State
const newAlertPrice = ref<number | ''>('')
const newAlertCondition = ref<'above'|'below'>('above')

const createAlert = () => {
  if (newAlertPrice.value && !isNaN(Number(newAlertPrice.value))) {
    addPriceAlert(activeSymbol.value, Number(newAlertPrice.value), newAlertCondition.value)
    newAlertPrice.value = ''
  }
}

// Live orderbook data state
interface Order {
  price: string
  amount: string
  total: string
  percentage: number
}

const asks = ref<Order[]>([])
const bids = ref<Order[]>([])
const currentPriceStr = ref('64,230.50')
const currentDir = ref('up')

let ws: WebSocket | null = null

const calculateTotal = (data: [string, string][]) => {
  let accu = 0
  let maxTotal = 0
  const processed = data.slice(0, 15).map(level => { // show more depth
    const priceNum = parseFloat(level[0])
    const amountNum = parseFloat(level[1])
    accu += amountNum
    if (accu > maxTotal) maxTotal = accu
    
    return {
      price: priceNum.toFixed(2),
      amount: amountNum.toFixed(4),
      total: accu.toFixed(4),
      rawTotal: accu
    }
  })

  // Add percentage for the background bar
  return processed.map(p => ({
    ...p,
    percentage: maxTotal > 0 ? (p.rawTotal / maxTotal) * 100 : 0
  }))
}

const connectOrderbook = () => {
  if (ws) ws.close()
  
  const symbol = activeSymbol.value.toLowerCase()
  if (!isCrypto.value) return // No orderbook for stocks

  ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@depth20@100ms`)
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (!data.bids || !data.asks) return

    // Bids are sorted descending by price (highest buy order first)
    bids.value = calculateTotal(data.bids).slice(0, 10)
    
    // Asks are sorted ascending by price (lowest sell order first), reverse to show highest at top
    asks.value = calculateTotal(data.asks).slice(0, 10).reverse()

    // Estimate current price from the middle of spread
    if (asks.value.length > 0 && bids.value.length > 0) {
      const askObj = asks.value[asks.value.length - 1]
      const bidObj = bids.value[0]
      if (askObj && bidObj) {
        const topAsk = parseFloat(askObj.price)
        const topBid = parseFloat(bidObj.price)
        const mid = (topAsk + topBid) / 2
        const prevPrice = parseFloat(currentPriceStr.value.replace(/,/g, ''))
        currentDir.value = mid >= prevPrice ? 'up' : 'down'
        currentPriceStr.value = mid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
    }
  }
}

watch(activeSymbol, () => {
  // Clear orderbook immediately when switching
  asks.value = []
  bids.value = []
  connectOrderbook()
})

onMounted(() => {
  connectOrderbook()
})

onUnmounted(() => {
  if (ws) ws.close()
})

</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden text-xs">
    <!-- View Switcher -->
    <div class="flex h-10 md:h-12 border-b border-slate-800 bg-[#070b14] shrink-0">
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2"
        :class="currentView === 'FEED' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'FEED'"
      >FEED NEWS</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2"
        :class="currentView === 'ORDERBOOK' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'ORDERBOOK'"
      >ORDER BOOK</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2"
        :class="currentView === 'ALERTS' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'ALERTS'"
      >ALERTS</button>
    </div>

    <!-- News Feed Section -->
    <div v-show="currentView === 'FEED'" class="min-h-[200px] h-auto md:h-auto md:flex-1 overflow-visible md:overflow-hidden">
      <NewsFeed />
    </div>

    <!-- Order Book Section -->
    <div v-show="currentView === 'ORDERBOOK'" class="h-[300px] md:h-auto md:flex-1 flex flex-col min-h-0 p-1 md:p-2 pb-12 md:pb-2 relative overflow-y-auto">
      
      <!-- Unavailable Overlay for Stocks -->
      <div v-if="!isCrypto" class="absolute inset-0 z-50 bg-[#070b14]/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-6 text-center border-t border-slate-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 md:h-8 md:w-8 text-slate-600 mb-2 md:mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="text-slate-400 text-[10px] md:text-xs font-bold font-mono tracking-widest leading-tight">ORDER BOOK UNAVAILABLE</span>
        <span class="text-slate-500 text-[9px] md:text-[10px] mt-1 md:mt-2 leading-relaxed">Level 2 market depth data is restricted for traditional equities.</span>
      </div>
      <div class="flex items-center justify-between mb-1 md:mb-2 px-1 md:px-2">
        <h3 class="text-[10px] md:text-xs font-bold text-slate-300">訂單</h3>
        <div class="flex space-x-1">
          <button class="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg></button>
          <button class="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
        </div>
      </div>

      <div class="flex text-[9px] md:text-[10px] text-slate-500 font-bold px-1 md:px-2 mb-1">
        <span class="flex-1">價格(USDT)</span>
        <span class="flex-1 text-right">數量(BTC)</span>
        <span class="flex-1 text-right">總計</span>
      </div>

      <!-- Asks (Sells) -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <div v-for="(ask, i) in asks" :key="'ask'+i" class="flex text-[9px] md:text-[10px] font-mono px-1 md:px-2 py-0.5 relative group cursor-pointer hover:bg-slate-800/30">
          <div class="absolute inset-y-0 right-0 bg-red-900/20 z-0 transition-all" :style="{ width: `${ask.percentage}%` }"></div>
          <span class="flex-1 text-red-400 z-10">{{ ask.price }}</span>
          <span class="flex-1 text-right text-slate-300 z-10">{{ ask.amount }}</span>
          <span class="flex-1 text-right text-slate-500 z-10">{{ ask.total }}</span>
        </div>
      </div>

      <!-- Current Price Spread -->
      <div class="flex items-center justify-between py-1.5 md:py-2 px-1 md:px-2 border-y border-slate-800 my-1 bg-[#0a0f1c]">
        <span class="text-xs md:text-sm font-bold flex items-center transition-colors duration-300"
              :class="currentDir === 'up' ? 'text-green-400' : 'text-red-400'">
          {{ currentPriceStr }} 
          <svg v-if="currentDir==='up'" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 md:h-4 md:w-4 ml-1 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
        </span>
        <span class="text-slate-400 text-[9px] md:text-xs text-decoration-underline underline-offset-2">{{ currentPriceStr }}</span>
      </div>

      <!-- Bids (Buys) -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <div v-for="(bid, i) in bids" :key="'bid'+i" class="flex text-[9px] md:text-[10px] font-mono px-1 md:px-2 py-0.5 relative group cursor-pointer hover:bg-slate-800/30">
          <div class="absolute inset-y-0 right-0 bg-green-900/20 z-0 transition-all" :style="{ width: `${bid.percentage}%` }"></div>
          <span class="flex-1 text-green-400 z-10">{{ bid.price }}</span>
          <span class="flex-1 text-right text-slate-300 z-10">{{ bid.amount }}</span>
          <span class="flex-1 text-right text-slate-500 z-10">{{ bid.total }}</span>
        </div>
      </div>
    </div>

    <!-- Alerts Section -->
    <div v-show="currentView === 'ALERTS'" class="h-[300px] md:h-auto md:flex-1 flex flex-col min-h-0 p-2 md:p-3 relative overflow-y-auto">
      <div class="mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
        <h4 class="text-xs font-bold text-slate-300 mb-2">新增 {{ activeSymbol }} 到價提醒</h4>
        <div class="flex gap-2">
          <select v-model="newAlertCondition" class="bg-[#0a0f1c] text-white border border-slate-700 rounded p-1 text-xs">
            <option value="above">≥ 大於</option>
            <option value="below">≤ 小於</option>
          </select>
          <input type="number" v-model="newAlertPrice" placeholder="目標價格" class="flex-1 min-w-0 bg-[#0a0f1c] text-white border border-slate-700 rounded p-1 text-xs outline-none focus:border-blue-500">
          <button @click="createAlert" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded text-xs transition-colors shrink-0">設定</button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        <h4 class="text-xs font-bold text-slate-300 mb-2">現有提醒</h4>
        <div v-if="priceAlerts.length === 0" class="text-slate-500 text-xs text-center py-4">目前無設定任何提醒</div>
        <div v-for="alert in priceAlerts" :key="alert.id" class="flex items-center justify-between p-2 mb-2 rounded bg-[#0a0f1c] border border-slate-800 transition-opacity" :class="{'opacity-50 grayscale': alert.triggered}">
          <div class="flex flex-col">
            <span class="text-white font-bold text-xs">{{ alert.symbol }}</span>
            <span class="text-slate-400 text-[10px]">{{ alert.condition === 'above' ? '≥' : '≤' }} {{ alert.targetPrice }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="alert.triggered" class="text-green-500 text-[10px] font-bold">已觸發</span>
            <button @click="removePriceAlert(alert.id)" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/20 rounded">刪除</button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* 隱藏 number input 預設的增減箭頭 */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
