<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { 
  activeSymbol, 
  priceAlerts, 
  addPriceAlert, 
  removePriceAlert, 
  chatSession, 
  goToLogin, 
  t,
  usePortfolioStore,
  useMarketStore,
  setActiveSymbol
} from '../stores'
import { api } from '../network'
import NewsFeed from './NewsFeed.vue'
import EconomicCalendar from './EconomicCalendar.vue'

const currentView = ref('TRADE')
const isCrypto = computed(() => activeSymbol.value.toLowerCase().endsWith('usdt'))

// Mock Trading State
const portfolioStore = usePortfolioStore()
const marketStore = useMarketStore()
const tradeType = ref<'buy' | 'sell'>('buy')
const orderType = ref<'market' | 'limit'>('market')
const tradeAmount = ref<number | ''>('')
const limitPriceInput = ref<number | ''>('')

const currentPrice = computed(() => marketStore.marketPrices[activeSymbol.value]?.rawPrice || 0)
const currentPriceFormatted = computed(() => marketStore.marketPrices[activeSymbol.value]?.price || '---')
const currentChangePercent = computed(() => marketStore.marketPrices[activeSymbol.value]?.change || '---')
const currentChangeUp = computed(() => marketStore.marketPrices[activeSymbol.value]?.up ?? true)

const estimatedTotal = computed(() => {
  if (!tradeAmount.value || isNaN(Number(tradeAmount.value))) return 0
  let price = orderType.value === 'market' ? currentPrice.value : Number(limitPriceInput.value || 0)
  if (price <= 0) price = currentPrice.value
  return Number(tradeAmount.value) * price
})

const currentPosition = computed(() => 
  portfolioStore.virtualPortfolio.find(item => item.symbol === activeSymbol.value.toUpperCase())
)

const sliderPercent = ref(0)

const handleSliderInput = () => {
  let price = orderType.value === 'market' ? currentPrice.value : Number(limitPriceInput.value || 0)
  if (price <= 0) price = currentPrice.value
  
  if (tradeType.value === 'buy') {
    if (price > 0) {
      const maxBuy = portfolioStore.virtualCash / price
      tradeAmount.value = Number((maxBuy * (sliderPercent.value / 100)).toFixed(4))
    }
  } else {
    if (currentPosition.value) {
      tradeAmount.value = Number((currentPosition.value.amount * (sliderPercent.value / 100)).toFixed(4))
    }
  }
}

watch([activeSymbol, tradeType, orderType], () => {
  sliderPercent.value = 0
  tradeAmount.value = ''
})

const executeTrade = async () => {
  if (!tradeAmount.value || Number(tradeAmount.value) <= 0) return
  
  let success = false
  if (orderType.value === 'market') {
    if (currentPrice.value <= 0) return
    if (tradeType.value === 'buy') {
      success = await portfolioStore.buyVirtualAsset(activeSymbol.value, Number(tradeAmount.value), currentPrice.value)
    } else {
      success = await portfolioStore.sellVirtualAsset(activeSymbol.value, Number(tradeAmount.value), currentPrice.value)
    }
  } else {
    // Limit Order
    if (!limitPriceInput.value || Number(limitPriceInput.value) <= 0) return
    success = await portfolioStore.placeLimitOrder(
      activeSymbol.value, 
      tradeType.value, 
      Number(tradeAmount.value), 
      Number(limitPriceInput.value)
    )
  }
  
  if (success) {
    tradeAmount.value = ''
    limitPriceInput.value = ''
  }
}

const totalPortfolioValue = computed(() => {
  let assetsVal = 0
  portfolioStore.virtualPortfolio.forEach(item => {
    const price = marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice
    assetsVal += item.amount * price
  })
  return portfolioStore.virtualCash + assetsVal
})

const totalPnL = computed(() => {
  let totalCost = 0
  let currentVal = 0
  portfolioStore.virtualPortfolio.forEach(item => {
    totalCost += item.amount * item.entryPrice
    const price = marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice
    currentVal += item.amount * price
  })
  return currentVal - totalCost
})

const totalPnLPercent = computed(() => {
  let totalCost = 0
  portfolioStore.virtualPortfolio.forEach(item => {
    totalCost += item.amount * item.entryPrice
  })
  if (totalCost === 0) return 0
  return (totalPnL.value / totalCost) * 100
})

const positionPnL = computed(() => {
  if (!currentPosition.value) return 0
  const price = currentPrice.value || currentPosition.value.entryPrice
  return (price - currentPosition.value.entryPrice) * currentPosition.value.amount
})

const positionPnLPercent = computed(() => {
  if (!currentPosition.value || currentPosition.value.entryPrice === 0) return 0
  const price = currentPrice.value || currentPosition.value.entryPrice
  return ((price - currentPosition.value.entryPrice) / currentPosition.value.entryPrice) * 100
})

const stockInfo = ref<any>(null)
const isStockInfoLoading = ref(false)

// Alerts State
const newAlertPrice = ref<number | ''>('')
const newAlertCondition = ref<'above'|'below'>('above')

const createAlert = async () => {
  if (newAlertPrice.value && !isNaN(Number(newAlertPrice.value))) {
    await addPriceAlert(activeSymbol.value, Number(newAlertPrice.value), newAlertCondition.value)
    newAlertPrice.value = ''
  }
}

// Delete Alert Confirmation
const alertToDelete = ref<{id: string, symbol: string, price: number} | null>(null)

const triggerDeleteAlert = (alert: any) => {
  alertToDelete.value = { id: alert.id, symbol: alert.symbol, price: alert.targetPrice }
}

const confirmDeleteAlertAction = async () => {
  if (alertToDelete.value) {
    await removePriceAlert(alertToDelete.value.id)
    alertToDelete.value = null
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
  stockInfo.value = null
  
  if (isCrypto.value) {
    connectOrderbook()
  } else {
    if (ws) ws.close()
    fetchStockInfo()
  }
})

const fetchStockInfo = async () => {
  const symbol = activeSymbol.value
  if (!symbol || symbol.startsWith('^') || symbol === 'FGI' || symbol === 'BDI') return
  isStockInfoLoading.value = true
  try {
    const data = await api.getFinnhubMetric(symbol)
    if (data && data.metric) {
      stockInfo.value = data.metric
    }
  } catch (e) {
    console.error('Failed to fetch stock info:', e)
  } finally {
    isStockInfoLoading.value = false
  }
}

onMounted(() => {
  if (isCrypto.value) {
    connectOrderbook()
  } else {
    fetchStockInfo()
  }
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
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2 cursor-pointer"
        :class="currentView === 'TRADE' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'TRADE'"
      >{{ t('mockTrading') }}</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2 cursor-pointer"
        :class="currentView === 'FEED' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'FEED'"
      >{{ t('feedNews') }}</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2 cursor-pointer"
        :class="currentView === 'ORDERBOOK' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'ORDERBOOK'"
      >{{ isCrypto ? t('orderBook') : t('fundamentals') }}</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2 cursor-pointer"
        :class="currentView === 'ALERTS' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'ALERTS'"
      >{{ t('alerts') }}</button>
      <button 
        class="flex-1 py-1 px-1 md:py-2 text-[10px] md:text-xs font-bold text-center transition-colors border-b-2 cursor-pointer"
        :class="currentView === 'CALENDAR' ? 'text-blue-400 border-blue-500 bg-blue-900/10' : 'text-slate-500 border-transparent hover:text-slate-300'"
        @click="currentView = 'CALENDAR'"
      >{{ t('calendar') }}</button>
    </div>

    <!-- Mock Trading Section -->
    <div v-show="currentView === 'TRADE'" class="flex-1 flex flex-col min-h-0 p-2 md:p-3 overflow-y-auto custom-scrollbar space-y-3">
      <template v-if="chatSession">
        <!-- 1. Portfolio Account Summary -->
      <div class="bg-gradient-to-br from-[#111827] to-[#070b14] border border-blue-500/10 rounded-xl p-3 shadow-md">
        <div class="flex justify-between items-center mb-2">
          <span class="text-slate-400 font-bold uppercase tracking-wider text-[9px] md:text-[10px]">{{ t('mockTrading') }}</span>
          <button @click="portfolioStore.resetVirtualAccount()" class="text-[9px] text-red-400 hover:text-red-300 font-mono bg-red-950/20 px-2 py-0.5 rounded border border-red-500/10 transition-colors cursor-pointer">
            {{ t('resetAccount') }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-1">
          <div>
            <div class="text-[9px] text-slate-500 mb-0.5">{{ t('virtualPortfolioVal') }}</div>
            <div class="text-sm md:text-base font-black text-slate-100 font-mono">{{ totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} <span class="text-[9px] text-slate-400">USD</span></div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 mb-0.5">{{ t('unrealizedPnL') }}</div>
            <div class="text-sm md:text-base font-black font-mono" :class="totalPnL >= 0 ? 'text-green-400' : 'text-red-400'">
              {{ totalPnL >= 0 ? '+' : '' }}{{ totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} <span class="text-[9px]">USD</span>
              <span class="text-[10px] font-bold">({{ totalPnLPercent.toFixed(2) }}%)</span>
            </div>
          </div>
          <div class="col-span-2 border-t border-slate-800/60 pt-1.5 mt-0.5 flex justify-between items-center">
            <span class="text-[9px] text-slate-500">{{ t('virtualCash') }}</span>
            <span class="text-xs font-bold text-blue-400 font-mono">{{ portfolioStore.virtualCash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} USD</span>
          </div>
        </div>
      </div>

      <!-- 2. Active Asset Info & Order Entry -->
      <div class="bg-[#111827] border border-slate-800/80 rounded-xl p-3 flex flex-col space-y-3">
        <div class="flex justify-between items-center border-b border-slate-800/50 pb-2">
          <div class="flex flex-col">
            <span class="text-xs font-black text-slate-200 uppercase">{{ activeSymbol }}</span>
            <span class="text-[9px] text-slate-500">{{ isCrypto ? 'Crypto' : 'Stock' }}</span>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold text-slate-200 font-mono">{{ currentPriceFormatted }}</div>
            <div class="text-[9px] font-bold font-mono" :class="currentChangeUp ? 'text-green-400' : 'text-red-400'">
              {{ currentChangePercent }}
            </div>
          </div>
        </div>

        <!-- Buy / Sell Toggle Buttons -->
        <div class="grid grid-cols-2 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
          <button 
            @click="tradeType = 'buy'"
            class="py-1.5 rounded-md text-xs font-bold tracking-wider transition-all cursor-pointer"
            :class="tradeType === 'buy' ? 'bg-green-600/20 text-green-400 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]' : 'text-slate-500 hover:text-slate-300'"
          >
            {{ t('buyAction') }}
          </button>
          <button 
            @click="tradeType = 'sell'"
            class="py-1.5 rounded-md text-xs font-bold tracking-wider transition-all cursor-pointer"
            :class="tradeType === 'sell' ? 'bg-red-600/20 text-red-400 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'text-slate-500 hover:text-slate-300'"
          >
            {{ t('sellAction') }}
          </button>
        </div>

        <!-- Order Type Selector -->
        <div class="grid grid-cols-2 p-0.5 bg-slate-950 rounded-lg border border-slate-800 text-[10px]">
          <button 
            @click="orderType = 'market'"
            class="py-1 rounded text-center transition-all cursor-pointer font-bold"
            :class="orderType === 'market' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'"
          >
            {{ t('marketOrder') }}
          </button>
          <button 
            @click="orderType = 'limit'"
            class="py-1 rounded text-center transition-all cursor-pointer font-bold"
            :class="orderType === 'limit' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'"
          >
            {{ t('limitOrder') }}
          </button>
        </div>

        <!-- Limit Price Input -->
        <div v-if="orderType === 'limit'" class="space-y-1">
          <label class="text-[10px] text-slate-400 block ml-0.5">{{ t('limitPrice') }}</label>
          <div class="relative flex items-center bg-slate-950 border border-slate-800 rounded-lg focus-within:border-blue-500/50 transition-colors p-1.5">
            <input 
              v-model="limitPriceInput"
              type="number"
              min="0.0001"
              step="any"
              placeholder="0.00"
              class="bg-transparent border-none text-slate-200 text-xs focus:outline-none w-full font-mono placeholder-slate-700 pl-1.5"
            />
            <span class="text-[10px] text-slate-500 font-mono font-bold pr-1.5">USD</span>
          </div>
        </div>

        <!-- Inputs and details -->
        <div class="space-y-2">
          <div class="flex justify-between items-center text-[10px] text-slate-400">
            <span>{{ t('tradeAmount') }}</span>
            <span v-if="tradeType === 'buy'" class="text-[9px] text-slate-500 font-mono">
              Max: {{ (orderType === 'market' ? currentPrice : Number(limitPriceInput || 0)) > 0 ? (portfolioStore.virtualCash / (orderType === 'market' ? currentPrice : Number(limitPriceInput || 0))).toFixed(4) : 0 }}
            </span>
            <span v-else class="text-[9px] text-slate-500 font-mono">
              Held: {{ currentPosition ? currentPosition.amount : 0 }}
            </span>
          </div>

          <div class="relative flex items-center bg-slate-950 border border-slate-800 rounded-lg focus-within:border-blue-500/50 transition-colors p-1.5">
            <input 
              v-model="tradeAmount"
              type="number"
              min="0.0001"
              step="any"
              placeholder="0.00"
              class="bg-transparent border-none text-slate-200 text-xs focus:outline-none w-full font-mono placeholder-slate-700 pl-1.5"
            />
            <span class="text-[10px] text-slate-500 font-mono font-bold pr-1.5 uppercase">{{ activeSymbol.replace('USDT', '') }}</span>
          </div>

          <!-- OKX-style custom slider -->
          <div class="pt-2 pb-1 px-1">
            <div class="relative flex items-center h-5 select-none">
              <!-- Slider Track background -->
              <div class="absolute left-0 right-0 h-1 bg-slate-800 rounded-full"></div>
              
              <!-- Slider Active Progress -->
              <div 
                class="absolute left-0 h-1 rounded-full pointer-events-none" 
                :class="tradeType === 'buy' ? 'bg-green-500' : 'bg-red-500'" 
                :style="{ width: `${sliderPercent}%` }"
              ></div>
              
              <!-- Slider Input element (transparent overlay to capture events) -->
              <input 
                type="range"
                min="0"
                max="100"
                step="1"
                v-model.number="sliderPercent"
                @input="handleSliderInput"
                class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              
              <!-- Ticks / Marks (OKX style dots at 0%, 25%, 50%, 75%, 100%) -->
              <div 
                v-for="tick in [0, 25, 50, 75, 100]" 
                :key="tick"
                class="absolute w-2 h-2 -ml-1 rounded-full border border-slate-700 bg-[#0a0f1c] z-10 pointer-events-none transition-colors duration-200"
                :class="sliderPercent >= tick ? (tradeType === 'buy' ? 'bg-green-500 border-green-400' : 'bg-red-500 border-red-400') : ''"
                :style="{ left: `${tick}%` }"
              ></div>
              
              <!-- Thumb decoration (glowing circle) -->
              <div 
                class="absolute w-4 h-4 -ml-2 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)] border-2 bg-white z-10 pointer-events-none transition-transform duration-75 scale-110"
                :class="tradeType === 'buy' ? 'border-green-500 shadow-green-500/50' : 'border-red-500 shadow-red-500/50'"
                :style="{ left: `${sliderPercent}%` }"
              ></div>
            </div>
            
            <!-- Percentage labels -->
            <div class="flex justify-between text-[8px] text-slate-500 font-mono mt-1 px-0.5 select-none">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <!-- Estimate cost & Action button -->
        <div class="pt-2 border-t border-slate-800/40 space-y-2">
          <div class="flex justify-between items-center text-[10px] text-slate-400">
            <span>{{ t('estTotal') }}</span>
            <span class="font-mono text-slate-200">{{ estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} USD</span>
          </div>

          <button 
            @click="executeTrade"
            :disabled="!tradeAmount || Number(tradeAmount) <= 0 || (orderType === 'market' && currentPrice <= 0) || (orderType === 'limit' && (!limitPriceInput || Number(limitPriceInput) <= 0))"
            class="w-full py-2.5 rounded-lg font-bold text-white text-xs tracking-wider transition-all duration-300 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase"
            :class="tradeType === 'buy' ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 shadow-green-900/10' : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-red-900/10'"
          >
            {{ tradeType === 'buy' ? t('buyAction') : t('sellAction') }} {{ activeSymbol }}
          </button>
        </div>

        <!-- Position Info for active symbol if held -->
        <div v-if="currentPosition" class="mt-1 p-2 bg-[#0a0f1c] border border-blue-500/5 rounded-lg flex flex-col space-y-1.5">
          <div class="text-[9px] font-bold text-blue-400 uppercase tracking-wider">{{ t('holdings') }}</div>
          <div class="grid grid-cols-2 gap-1 text-[10px]">
            <div class="flex justify-between pr-2">
              <span class="text-slate-500">{{ t('amount') }}</span>
              <span class="font-mono text-slate-300">{{ currentPosition.amount }}</span>
            </div>
            <div class="flex justify-between pl-2 border-l border-slate-800/80">
              <span class="text-slate-500">{{ t('avgCost') }}</span>
              <span class="font-mono text-slate-300">{{ currentPosition.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} USD</span>
            </div>
            <div class="flex justify-between pr-2">
              <span class="text-slate-500">{{ t('totalValue') }}</span>
              <span class="font-mono text-slate-300">{{ (currentPosition.amount * (currentPrice || currentPosition.entryPrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} USD</span>
            </div>
            <div class="flex justify-between pl-2 border-l border-slate-800/80">
              <span class="text-slate-500">{{ t('profit') }}</span>
              <span class="font-mono font-bold" :class="positionPnL >= 0 ? 'text-green-400' : 'text-red-400'">
                {{ positionPnL >= 0 ? '+' : '' }}{{ positionPnLPercent.toFixed(2) }}%
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2.5 Pending Orders List -->
      <div v-if="portfolioStore.virtualPendingOrders.length > 0" class="bg-[#111827] border border-slate-800/80 rounded-xl p-3 flex flex-col max-h-[200px] overflow-hidden shrink-0">
        <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">{{ t('pendingOrders') }} ({{ portfolioStore.virtualPendingOrders.length }})</h4>
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-0.5 space-y-1.5">
          <div 
            v-for="order in portfolioStore.virtualPendingOrders"
            :key="order.id"
            class="p-2 rounded-lg bg-[#0a0f1c] border border-slate-800/50 flex justify-between items-center relative"
          >
            <div class="flex flex-col">
              <div class="flex items-center space-x-1.5">
                <span class="text-[10px] font-bold text-slate-200 uppercase">{{ order.symbol }}</span>
                <span 
                  class="text-[9px] px-1 rounded font-bold uppercase"
                  :class="order.type === 'buy' ? 'text-green-400 bg-green-950/30' : 'text-red-400 bg-red-950/30'"
                >
                  {{ order.type === 'buy' ? t('buyAction') : t('sellAction') }}
                </span>
              </div>
              <span class="text-[9px] text-slate-500 mt-0.5">{{ order.amount }} Units @ ${{ order.limitPrice }}</span>
            </div>
            <button 
              @click.stop="portfolioStore.cancelLimitOrder(order.id)"
              class="text-[9px] text-slate-400 hover:text-red-400 hover:bg-red-950/20 border border-slate-800 hover:border-red-500/20 px-2 py-0.5 rounded transition-all cursor-pointer"
            >
              {{ t('cancel') }}
            </button>
          </div>
        </div>
      </div>

      <!-- 3. Current Positions List -->
      <div class="bg-[#111827] border border-slate-800/80 rounded-xl p-3 flex-1 flex flex-col min-h-[160px] overflow-hidden">
        <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 shrink-0">{{ t('holdings') }} ({{ portfolioStore.virtualPortfolio.length }})</h4>
        <div class="flex-1 overflow-y-auto custom-scrollbar pr-0.5">
          <div v-if="portfolioStore.virtualPortfolio.length === 0" class="flex flex-col items-center justify-center h-full text-slate-600 space-y-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-[10px] font-bold uppercase tracking-wider">{{ t('noHoldings') }}</span>
          </div>
          <div v-else class="space-y-2">
            <div 
              v-for="item in portfolioStore.virtualPortfolio"
              :key="item.id"
              @click="setActiveSymbol(item.symbol)"
              class="p-2 rounded-lg bg-[#0a0f1c] hover:bg-slate-800 border border-slate-800/50 hover:border-slate-700 transition-all cursor-pointer flex justify-between items-center group"
              :class="activeSymbol.toUpperCase() === item.symbol ? 'border-blue-500/40 bg-blue-950/5' : ''"
            >
              <div class="flex flex-col">
                <span class="text-[10px] font-bold text-slate-200 group-hover:text-blue-400 transition-colors uppercase">{{ item.symbol }}</span>
                <span class="text-[9px] text-slate-500">{{ item.amount }} Units</span>
              </div>
              <div class="text-right">
                <div class="text-[10px] font-bold text-slate-300 font-mono">
                  ${{ (item.amount * (marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </div>
                <div class="text-[9px] font-mono font-bold" :class="(marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice) >= item.entryPrice ? 'text-green-400' : 'text-red-400'">
                  {{ (marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice) >= item.entryPrice ? '+' : '' }}
                  {{ (((marketStore.marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) / item.entryPrice * 100).toFixed(2) }}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>
      <template v-else>
        <div class="flex-1 flex flex-col items-center justify-center p-4 text-center my-auto min-h-[300px]">
          <div class="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h4 class="text-white font-bold mb-2">{{ t('loginToTrade') }}</h4>
          <p class="text-slate-500 text-[10px] mb-6 leading-relaxed max-w-[260px]">{{ t('loginToTradeSub') }}</p>
          <button @click="goToLogin" class="w-full max-w-[260px] bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all text-xs shadow-lg shadow-blue-600/20 cursor-pointer active:scale-95">
            {{ t('goToLoginOrRegister') }}
          </button>
        </div>
      </template>
    </div>

    <!-- News Feed Section -->
    <div v-show="currentView === 'FEED'" class="min-h-[200px] h-auto md:h-auto md:flex-1 overflow-visible md:overflow-hidden">
      <NewsFeed />
    </div>

    <!-- Order Book Section -->
    <div v-show="currentView === 'ORDERBOOK'" class="h-[300px] md:h-auto md:flex-1 flex flex-col min-h-0 p-1 md:p-2 pb-12 md:pb-2 relative overflow-y-auto">
      
      <!-- Stock Data Display for Stocks -->
      <div v-if="!isCrypto" class="absolute inset-0 z-50 bg-[#070b14] flex flex-col p-1 md:p-2 border-t border-slate-800 overflow-y-auto custom-scrollbar">
        <div class="flex items-center justify-between mb-2 md:mb-4 px-1 md:px-2">
          <h3 class="text-xs font-bold text-slate-300 tracking-widest uppercase">{{ t('fundamentals') }}</h3>
          <span v-if="isStockInfoLoading" class="text-[10px] text-slate-500 font-mono animate-pulse">{{ t('loading') }}</span>
        </div>
        
        <template v-if="stockInfo">
          <div class="grid grid-cols-2 gap-2 md:gap-3">
            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('peRatio') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.peTTM ? stockInfo.peTTM.toFixed(2) : '---' }}</div>
            </div>
            
            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('eps') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.epsTTM ? stockInfo.epsTTM.toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('marketCap') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.marketCapitalization ? (stockInfo.marketCapitalization > 1000 ? (stockInfo.marketCapitalization / 1000).toFixed(2) + 'B' : stockInfo.marketCapitalization.toFixed(2) + 'M') : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('beta') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.beta ? stockInfo.beta.toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('high52w') }}</div>
              <div class="text-xs md:text-sm font-bold text-green-400 font-mono">{{ stockInfo['52WeekHigh'] ? stockInfo['52WeekHigh'].toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('low52w') }}</div>
              <div class="text-xs md:text-sm font-bold text-red-400 font-mono">{{ stockInfo['52WeekLow'] ? stockInfo['52WeekLow'].toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('psRatio') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.psTTM ? stockInfo.psTTM.toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('pbRatio') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.pbTTM ? stockInfo.pbTTM.toFixed(2) : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('roe') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.roeTTM ? stockInfo.roeTTM.toFixed(2) + '%' : '---' }}</div>
            </div>

            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('revenueGrowth') }}</div>
              <div class="text-xs md:text-sm font-bold text-slate-200 font-mono">{{ stockInfo.revenueGrowthTTMYoy ? stockInfo.revenueGrowthTTMYoy.toFixed(2) + '%' : '---' }}</div>
            </div>
            
            <div class="bg-[#111827] p-2 md:p-3 rounded-md border border-slate-800/50 col-span-2">
              <div class="text-[9px] md:text-[10px] text-slate-500 mb-1">{{ t('dividendYield') }}</div>
              <div class="text-xs md:text-sm font-bold text-blue-400 font-mono">{{ stockInfo.currentDividendYieldTTM ? stockInfo.currentDividendYieldTTM.toFixed(2) + '%' : '---' }}</div>
            </div>
          </div>
        </template>
        <template v-else-if="!isStockInfoLoading">
          <div class="flex-1 flex flex-col items-center justify-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 md:h-8 md:w-8 text-slate-600 mb-2 md:mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="text-slate-400 text-[10px] md:text-xs font-bold font-mono tracking-widest leading-tight">{{ t('noFundamentals') }}</span>
            <span class="text-slate-500 text-[9px] md:text-[10px] mt-1 md:mt-2 leading-relaxed">{{ t('noFundamentalsSub') }}</span>
          </div>
        </template>
      </div>
      <div class="flex items-center justify-between mb-2 md:mb-4 px-1 md:px-2">
        <h3 class="text-xs font-bold text-slate-300 tracking-widest uppercase">{{ t('orders') }}</h3>
        <div class="flex space-x-1">
          <button class="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg></button>
          <button class="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
        </div>
      </div>

      <div class="flex text-[9px] md:text-[10px] text-slate-500 font-bold px-1 md:px-2 mb-1">
        <span class="flex-1">{{ t('priceUsdt') }}</span>
        <span class="flex-1 text-right">{{ t('amountBtc') }}</span>
        <span class="flex-1 text-right">{{ t('total') }}</span>
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
      <template v-if="chatSession">
        <div class="mb-4 bg-slate-800/50 p-3 rounded-lg border border-slate-700">
          <h4 class="text-xs font-bold text-slate-300 mb-2">{{ t('addPriceAlertLabel') }} ({{ activeSymbol }})</h4>
          <div class="flex gap-2">
            <select v-model="newAlertCondition" class="bg-[#0a0f1c] text-white border border-slate-700 rounded p-1 text-xs">
              <option value="above">{{ t('aboveLabel') }}</option>
              <option value="below">{{ t('belowLabel') }}</option>
            </select>
            <input type="number" v-model="newAlertPrice" :placeholder="t('targetPrice')" class="flex-1 min-w-0 bg-[#0a0f1c] text-white border border-slate-700 rounded p-1 text-xs outline-none focus:border-blue-500 font-mono">
            <button @click="createAlert" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1 px-3 rounded text-xs transition-colors shrink-0 cursor-pointer">{{ t('setAlert') }}</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto">
          <h4 class="text-xs font-bold text-slate-300 mb-2">{{ t('existingAlerts') }}</h4>
          <div v-if="priceAlerts.length === 0" class="text-slate-500 text-xs text-center py-4">{{ t('noAlerts') }}</div>
          <div v-for="alert in priceAlerts" :key="alert.id" class="flex items-center justify-between p-2 mb-2 rounded bg-[#0a0f1c] border border-slate-800 transition-opacity" :class="{'opacity-50 grayscale': alert.triggered}">
            <div class="flex flex-col">
              <span class="text-white font-bold text-xs">{{ alert.symbol }}</span>
              <span class="text-slate-400 text-[10px] font-mono">{{ alert.condition === 'above' ? '≥' : '≤' }} {{ alert.targetPrice }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="alert.triggered" class="text-green-500 text-[10px] font-bold">{{ t('triggered') }}</span>
              <button @click="triggerDeleteAlert(alert)" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-900/20 rounded cursor-pointer">{{ t('delete') }}</button>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex flex-col items-center justify-center h-full p-4 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-slate-700 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h4 class="text-white font-bold mb-2">{{ t('loginToSetAlert') }}</h4>
          <p class="text-slate-500 text-[10px] mb-6 leading-relaxed">{{ t('loginToSetAlertSub') }}</p>
          <button @click="goToLogin" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-all text-xs shadow-lg shadow-blue-600/20 cursor-pointer">
            {{ t('goToLoginOrRegister') }}
          </button>
        </div>
      </template>
    </div>

    <!-- Calendar Section -->
    <div v-show="currentView === 'CALENDAR'" class="h-[450px] md:h-auto md:flex-1 w-full overflow-hidden">
      <EconomicCalendar />
    </div>

    <!-- Alert Delete Confirmation Modal -->
    <transition name="fade">
      <div v-if="alertToDelete !== null" class="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-[#111827] border border-red-900/50 rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">{{ t('confirmDeleteAlertTitle') }}</h3>
          <p class="text-xs text-slate-400 mb-6">{{ t('confirmDeleteAlertSub') }} <span class="text-white font-bold">{{ alertToDelete.symbol }}</span> @ <span class="text-white font-bold">${{ alertToDelete.price }}</span></p>
          <div class="flex gap-3">
            <button @click="alertToDelete = null" class="flex-1 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold cursor-pointer">
              {{ t('cancel') }}
            </button>
            <button @click="confirmDeleteAlertAction" class="flex-1 py-2.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-bold cursor-pointer">
              {{ t('confirmDelete') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
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

.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #05080f;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #1e293b;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #334155;
}
</style>
