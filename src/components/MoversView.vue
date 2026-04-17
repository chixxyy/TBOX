<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import Sparkline from './Sparkline.vue'
import { 
  globalMovers as movers, 
  isMoversLoading as isLoading, 
  lastMoversUpdate as lastUpdateTime,
  type Mover,
  setScrollProgress,
  isChangingTab,
  portfolio,
  marketPrices,
  addToPortfolio,
  removeFromPortfolio,
  updatePortfolioItem,
  initialAssets,
  chatSession,
  goToLogin,
  openAIDrawer,
  showToast
} from '../stores'

let rafId: number | null = null
const handleScroll = (e: Event) => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const el = e.target as HTMLElement
    const scrollMax = el.scrollHeight - el.clientHeight
    if (scrollMax <= 0) {
      setScrollProgress(0)
    } else {
      const progress = (el.scrollTop / scrollMax) * 100
      setScrollProgress(progress)
    }
  })
}

// ---------- Inline Translation (mymemory API) ----------
interface CardTranslation {
  title: string
  news: string
}
const translationCache = new Map<number, CardTranslation>()
const translatingIds = ref<Set<number>>(new Set())
const translatedIds = ref<Set<number>>(new Set())

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)
    const data = await res.json()
    if (data.responseStatus !== 200) {
      console.warn('[TRANSLATE] API returned non-200 status:', data)
      return text
    }
    return data.responseData?.translatedText || text
  } catch (err) { 
    console.error('[TRANSLATE] Error fetching translation:', err)
    return text 
  }
}

async function toggleTranslateMover(item: Mover) {
  if (translatedIds.value.has(item.id)) {
    translatedIds.value.delete(item.id)
    translatedIds.value = new Set(translatedIds.value) // trigger reactivity
    return
  }
  if (translationCache.has(item.id)) {
    translatedIds.value = new Set([...translatedIds.value, item.id])
    return
  }
  translatingIds.value = new Set([...translatingIds.value, item.id])
  try {
    const [tTitle, tNews] = await Promise.all([
      translateText(item.title),
      item.news ? translateText(item.news) : Promise.resolve('')
    ])
    
    if (tTitle === item.title && (!item.news || tNews === item.news)) {
      showToast('翻譯未生效', 'API 目前暫時無法回應，請稍後再試。')
      return
    }

    translationCache.set(item.id, { title: tTitle, news: tNews })
    translatedIds.value = new Set([...translatedIds.value, item.id])
  } catch (err) {
    console.error('[TRANSLATE] Toggle error:', err)
    showToast('翻譯錯誤', '無法連接到翻譯伺服器')
  } finally {
    translatingIds.value.delete(item.id)
    translatingIds.value = new Set(translatingIds.value)
  }
}

const formatSymbol = (symbol: string) => symbol.replace('USDT', '').replace('^', '')

function getDisplayTitle(item: Mover): string {
  const trans = translationCache.get(item.id)
  if (translatedIds.value.has(item.id) && trans) {
    return trans.title
  }
  return item.title
}

function getDisplayNews(item: Mover): string {
  const trans = translationCache.get(item.id)
  if (translatedIds.value.has(item.id) && trans) {
    return trans.news
  }
  return item.news || ''
}

const UI_LABELS = {
  en: {
    detected: 'Detected',
    peak: 'Peak',
    now: 'Now',
    change: 'Change',
    volume: 'Volume',
    yes: 'YES moved',
    no: 'NO moved',
    newsPrefix: '*',
    durationPrefix: 'Market movement started ',
    durationSuffix: ' after detection'
  },
  zh: {
    detected: '偵測到時',
    peak: '峰值',
    now: '目前',
    change: '變動幅度',
    volume: '成交量',
    yes: '【激增】信號觸發',
    no: '【盤整】信號觸發',
    newsPrefix: '𝕏 新聞: ',
    durationPrefix: '偵測到後約於 ',
    durationSuffix: ' 開始異動'
  }
}

function getLabel(key: keyof typeof UI_LABELS.en, isTranslated: boolean): string {
  return isTranslated ? UI_LABELS.zh[key] : UI_LABELS.en[key]
}

// ---------- Filtering & Portfolio ----------
const filterTabs = [
  { label: '全部異動', tag: 'all' },
  { label: '快速上漲', tag: 'gainers' },
  { label: '極速下跌', tag: 'losers' },
  { label: '我的資產', tag: 'portfolio' },
]
const activeFilter = ref('all')

const categorizedPortfolio = computed(() => {
  return {
    crypto: portfolio.value.filter((item: any) => {
      const info = initialAssets.find(a => a.symbol === item.symbol)
      return info?.type === 'crypto'
    }),
    stock: portfolio.value.filter((item: any) => {
      const info = initialAssets.find(a => a.symbol === item.symbol)
      return info?.type === 'stock'
    })
  }
})

const portfolioAllocation = computed(() => {
  if (!chatSession.value || portfolio.value.length === 0) {
    return { cryptoValue: 0, stockValue: 0, cryptoPercent: 0, stockPercent: 0, totalValue: 0 }
  }

  let cryptoValue = 0
  let stockValue = 0

  portfolio.value.forEach((item: any) => {
    const info = initialAssets.find(a => a.symbol === item.symbol)
    const market = marketPrices.value[item.symbol]
    const currentPrice = market?.rawPrice || item.entryPrice
    const itemValue = item.amount * currentPrice
    
    if (info?.type === 'crypto') {
      cryptoValue += itemValue
    } else {
      stockValue += itemValue
    }
  })

  const totalValue = cryptoValue + stockValue
  return {
    cryptoValue,
    stockValue,
    cryptoPercent: totalValue > 0 ? (cryptoValue / totalValue) * 100 : 0,
    stockPercent: totalValue > 0 ? (stockValue / totalValue) * 100 : 0,
    totalValue
  }
})

const setTab = async (tag: string) => {
  isChangingTab.value = true
  activeFilter.value = tag
  setScrollProgress(0)
  await nextTick()
  setTimeout(() => {
    isChangingTab.value = false
  }, 50)
}

const filteredMovers = computed(() => {
  if (activeFilter.value === 'portfolio') return []
  if (activeFilter.value === 'all') return movers.value
  if (activeFilter.value === 'gainers') return movers.value.filter(m => m.isUp)
  if (activeFilter.value === 'losers') return movers.value.filter(m => !m.isUp)
  return movers.value
})

const stats = computed(() => {
  const up = movers.value.filter(m => m.isUp).length
  const down = movers.value.filter(m => !m.isUp).length
  
  // Gain calculations
  const gains = movers.value.filter(m => m.isUp).map(m => m.changePercent)
  const maxGain = gains.length > 0 ? Math.max(...gains) : 0
  
  // Loss calculations (absolute values for display)
  const losses = movers.value.filter(m => !m.isUp).map(m => Math.abs(m.changePercent))
  const maxLoss = losses.length > 0 ? Math.max(...losses) : 0
  
  return {
    total: movers.value.length,
    up,
    down,
    maxMove: maxGain.toFixed(1) + '%',
    maxDrop: maxLoss.toFixed(1) + '%'
  }
})

// Portfolio Add Form
const newSymbol = ref('')
const newAmount = ref<number | null>(null)
const newPrice = ref<number | null>(null)
const showAddForm = ref(false)

// Dropdown logic for Symbol Select
const showSymbolDropdown = ref(false)
const symbolSearch = ref('')
const filteredAssets = computed(() => {
  const q = symbolSearch.value.toLowerCase().trim()
  const assets = q 
    ? initialAssets.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
    : initialAssets
    
  return {
    crypto: assets.filter(a => a.type === 'crypto'),
    stock: assets.filter(a => a.type === 'stock' && !a.isIndex),
    index: assets.filter(a => a.isIndex)
  }
})

const selectSymbol = (sym: string) => {
  newSymbol.value = sym
  showSymbolDropdown.value = false
  symbolSearch.value = ''
}

const selectedAssetInfo = computed(() => initialAssets.find(a => a.symbol === newSymbol.value))

// Close dropdown on click outside
const closeOnOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (showSymbolDropdown.value && !target.closest('.symbol-dropdown-container')) {
    showSymbolDropdown.value = false
  }
}

onMounted(() => window.addEventListener('click', closeOnOutside))
onUnmounted(() => window.removeEventListener('click', closeOnOutside))

const handleAdd = async () => {
  if (!newSymbol.value || !newAmount.value || !newPrice.value) return
  if (newSymbol.value === 'FGI' || newSymbol.value === 'BDI' || newSymbol.value.startsWith('^')) {
    showToast('禁止加入', '此指標僅供參考，無法納入個人持倉。')
    return
  }
  await addToPortfolio(newSymbol.value, newAmount.value, newPrice.value)
  newSymbol.value = ''
  newAmount.value = null
  newPrice.value = null
  showAddForm.value = false
}

// Stats & Calculations
const portfolioStats = computed(() => {
  if (!chatSession.value || portfolio.value.length === 0) {
    return {
      value: '0',
      pnl: '0',
      pnlPercent: '0.00%'
    }
  }
  
  let totalCost = 0
  let totalValue = 0
  
  portfolio.value.forEach((item: any) => {
    const market = marketPrices.value[item.symbol]
    const currentPrice = market?.rawPrice || item.entryPrice
    totalCost += item.amount * item.entryPrice
    totalValue += item.amount * currentPrice
  })
  
  const totalPnL = totalValue - totalCost
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  
  return {
    value: totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    pnl: totalPnL.toLocaleString('en-US', { maximumFractionDigits: 0 }),
    pnlPercent: pnlPercent.toFixed(2) + '%'
  }
})

// Delete Confirmation
const confirmDeleteId = ref<string | null>(null)
const confirmDeleteSymbol = ref('')

const triggerDelete = (id: string, symbol: string) => {
  confirmDeleteId.value = id
  confirmDeleteSymbol.value = symbol
}

// Position Adjustment Logic
const showAdjustModal = ref(false)
const adjustItem = ref<any>(null)
const adjustType = ref<'add' | 'reduce'>('add')
const adjustAmount = ref<number | null>(null)
const adjustPrice = ref<number | null>(null)
const isAdjusting = ref(false)

const openAdjust = (item: any) => {
  adjustItem.value = item
  adjustAmount.value = null
  adjustPrice.value = marketPrices.value[item.symbol]?.rawPrice || item.entryPrice
  adjustType.value = 'add'
  showAdjustModal.value = true
}

const projectedStats = computed(() => {
  if (!adjustItem.value || !adjustAmount.value || !adjustPrice.value) return null
  
  const currentQty = Number(adjustItem.value.amount)
  const currentAvg = Number(adjustItem.value.entryPrice)
  const newQty = Number(adjustAmount.value)
  const newPrice = Number(adjustPrice.value)
  
  if (adjustType.value === 'add') {
    const totalQty = currentQty + newQty
    const totalCost = (currentQty * currentAvg) + (newQty * newPrice)
    const newAvg = totalCost / totalQty
    return {
      newAvg,
      totalQty,
      change: newAvg - currentAvg
    }
  } else {
    const totalQty = Math.max(0, currentQty - newQty)
    return {
      newAvg: currentAvg, // Price stays same when reducing
      totalQty,
      change: 0
    }
  }
})

const handleAdjust = async () => {
  if (!adjustItem.value || !adjustAmount.value || !adjustPrice.value) return
  
  isAdjusting.value = true
  const stats = projectedStats.value
  if (!stats) return

  try {
    if (stats.totalQty <= 0) {
      await removeFromPortfolio(adjustItem.value.id)
      showToast('持倉已移除', `${adjustItem.value.symbol} 已全數減倉`)
    } else {
      await updatePortfolioItem(adjustItem.value.id, stats.totalQty, stats.newAvg)
      showToast('調整成功', `${adjustItem.value.symbol} 持倉已更新`)
    }
    showAdjustModal.value = false
  } catch (e) {
    showToast('錯誤', '調整失敗，請稍後再試')
  } finally {
    isAdjusting.value = false
  }
}

const confirmDeleteAction = async () => {
  if (confirmDeleteId.value !== null) {
    await removeFromPortfolio(confirmDeleteId.value)
    confirmDeleteId.value = null
    confirmDeleteSymbol.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300">

    <!-- Stats Header (Adaptive) -->
    <div class="h-16 md:h-20 border-b border-slate-800 flex items-center px-2 md:px-6 space-x-2 md:space-x-3 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      <template v-if="activeFilter !== 'portfolio'">
        <div class="flex-1 flex items-center space-x-1.5 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
          <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">監控中異動</div>
            <div class="text-white font-bold text-xs md:text-lg leading-none">{{ stats.total }}</div>
          </div>
        </div>
        <div class="flex-1 flex items-center space-x-1.5 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
          <div class="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
               :class="activeFilter === 'losers' ? 'bg-red-900/30 border border-red-800/50 text-red-400' : 'bg-green-900/30 border border-green-800/50 text-green-400'">
            <svg v-if="activeFilter === 'losers'" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">{{ activeFilter === 'losers' ? '下跌信號' : '上漲信號' }}</div>
            <div class="text-white font-bold text-xs md:text-lg leading-none">{{ activeFilter === 'losers' ? stats.down : stats.up }}</div>
          </div>
        </div>
      </template>
      <template v-else>
        <!-- Portfolio Stats -->
        <div class="flex-1 flex items-center space-x-1.5 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
          <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-indigo-900/30 border border-indigo-800/50 flex items-center justify-center text-indigo-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">資產價值 (USD)</div>
            <div class="text-white font-bold text-xs md:text-lg leading-none">${{ portfolioStats.value }}</div>
          </div>
        </div>
        <div class="flex-1 flex items-center space-x-1.5 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
          <div class="w-7 h-7 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div class="min-w-0">
            <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">總回報率</div>
            <div class="font-black text-xs md:text-lg leading-none" :class="parseFloat(portfolioStats.pnlPercent) >= 0 ? 'text-green-400' : 'text-red-400'">
              {{ portfolioStats.pnlPercent }}
            </div>
          </div>
        </div>
      </template>

      <div class="flex-1 flex items-center space-x-1.5 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-2 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
          :class="activeFilter === 'portfolio' ? 'bg-indigo-900/30 border border-indigo-800/50 text-indigo-400' : (activeFilter === 'losers' ? 'bg-red-900/30 border border-red-800/50 text-red-500' : 'bg-green-900/30 border border-green-800/50 text-green-500')">
          <template v-if="activeFilter === 'portfolio'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </template>
          <template v-else-if="activeFilter === 'losers'">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          </template>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">
            {{ activeFilter === 'portfolio' ? '預估盈虧 (USD)' : (activeFilter === 'losers' ? '最大跌幅' : '最高漲幅') }}
          </div>
          <div class="text-white font-bold text-xs md:text-lg leading-none truncate">
            {{ activeFilter === 'portfolio' ? '$' + portfolioStats.pnl : (activeFilter === 'losers' ? stats.maxDrop : stats.maxMove) }}
          </div>
        </div>
      </div>

      <div class="hidden lg:flex flex-col items-end shrink-0 ml-auto">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">Movers Live</span>
        </div>
        <span class="text-[10px] text-slate-500 font-mono">最後更新: {{ lastUpdateTime }}</span>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="min-h-11 md:h-12 border-b border-slate-800 flex items-center px-1.5 md:px-6 shrink-0 bg-[#0a0f1c] w-full">
      <div class="flex w-full items-center overflow-x-auto no-scrollbar flex-nowrap">
        <button 
          v-for="tab in filterTabs" 
          :key="tab.tag"
          @click="setTab(tab.tag)"
          class="flex-1 min-w-[max-content] h-11 md:h-12 px-3 md:px-4 border-b-2 transition-colors relative text-[10px] md:text-[13px] font-bold whitespace-nowrap text-center shrink-0"
          :class="activeFilter === tab.tag ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          <span v-if="tab.tag === 'portfolio'" class="w-2 h-2 bg-blue-500 rounded-full animate-pulse md:mr-2 inline-block"></span>
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Content List -->
    <div @scroll="handleScroll" class="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8 space-y-4 no-scrollbar">
      
      <!-- 1. Portfolio View - Restricted -->
      <template v-if="activeFilter === 'portfolio'">
        <template v-if="chatSession">
          <div class="max-w-4xl mx-auto space-y-6">
            <div class="bg-[#111827] border border-blue-500/20 rounded-2xl p-4 md:p-6 shadow-xl">
              <div class="flex items-center justify-between mb-6">
                <div>
                  <h3 class="text-white font-bold flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" /></svg>
                    資產管理
                  </h3>
                  <p class="text-xs text-slate-500 mt-1">手動輸入代碼以追蹤目前資產即時盈虧狀況</p>
                </div>
                <button @click="showAddForm = !showAddForm" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-600/20">
                  {{ showAddForm ? '關閉表單' : '新增倉位' }}
                </button>
              </div>

              <!-- Asset Allocation Donut Chart -->
              <!-- Asset Allocation Donut Chart -->
              <div class="flex flex-col lg:flex-row items-center gap-8 bg-slate-900/40 p-6 md:p-8 rounded-3xl mb-8 border border-white/5 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
                <!-- Subtle background glow -->
                <div class="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div class="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

                <div class="relative w-32 h-32 shrink-0 group-hover:scale-105 transition-transform duration-500">
                  <svg viewBox="0 0 36 36" class="w-32 h-32 -rotate-90 filter drop-shadow-[0_0_12px_rgba(0,0,0,0.5)]">
                    <path class="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" />
                    <!-- Crypto segment (Blue) -->
                    <path class="text-blue-500 transition-all duration-1000 ease-out" :stroke-dasharray="`${portfolioAllocation.cryptoPercent}, 100`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
                    <!-- Stocks segment (Green) -->
                    <path class="text-emerald-500 transition-all duration-1000 ease-out" :stroke-dasharray="`${portfolioAllocation.stockPercent}, 100`" :stroke-dashoffset="`-${portfolioAllocation.cryptoPercent}`" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <span class="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">總資產</span>
                    <span class="text-sm font-black text-white font-mono tracking-tighter">${{ portfolioAllocation.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</span>
                  </div>
                </div>
                
                <div class="flex-1 w-full text-left">
                  <div class="flex items-center justify-between mb-6">
                    <div>
                      <h4 class="text-lg font-black text-white tracking-tight leading-none">資產配置分析</h4>
                      <p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-2">Portfolio Allocation Analysis</p>
                    </div>
                  </div>
                  
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="bg-slate-950/40 rounded-2xl p-4 border border-white/5 hover:border-blue-500/30 transition-all duration-300 group/item">
                      <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                          <div class="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                          <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider">加密貨幣</span>
                        </div>
                        <div class="text-xs font-black text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">{{ portfolioAllocation.cryptoPercent.toFixed(1) }}%</div>
                      </div>
                      <div class="text-xl font-black text-white font-mono tracking-tight">${{ portfolioAllocation.cryptoValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</div>
                      <div class="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">
                        <div class="bg-blue-500 h-full transition-all duration-1000" :style="{ width: portfolioAllocation.cryptoPercent + '%' }"></div>
                      </div>
                    </div>
                    
                    <div class="bg-slate-950/40 rounded-2xl p-4 border border-white/5 hover:border-emerald-500/30 transition-all duration-300 group/item">
                      <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                          <div class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                          <span class="text-[11px] font-black text-slate-400 uppercase tracking-wider">股票與指數</span>
                        </div>
                        <div class="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">{{ portfolioAllocation.stockPercent.toFixed(1) }}%</div>
                      </div>
                      <div class="text-xl font-black text-white font-mono tracking-tight">${{ portfolioAllocation.stockValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) }}</div>
                      <div class="w-full bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">
                        <div class="bg-emerald-500 h-full transition-all duration-1000" :style="{ width: portfolioAllocation.stockPercent + '%' }"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <transition enter-active-class="duration-300 ease-out" enter-from-class="transform opacity-0 -translate-y-4" enter-to-class="transform opacity-100 translate-y-0">
                <form v-if="showAddForm" @submit.prevent="handleAdd" class="grid grid-cols-1 md:grid-cols-4 gap-4 pb-6 border-b border-white/5 mb-6 items-start">
                  <div class="space-y-1.5 relative symbol-dropdown-container">
                    <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">代碼 (Symbol)</span>
                    <button 
                      type="button"
                      @click="showSymbolDropdown = !showSymbolDropdown"
                      class="h-10 w-full bg-[#05080f] border border-slate-700 rounded-lg px-3 flex items-center justify-between text-white text-sm outline-none focus:border-blue-500 transition-all hover:bg-slate-900/50"
                      :class="{ 'border-blue-500 ring-1 ring-blue-500/20': showSymbolDropdown }"
                    >
                      <div class="flex items-center gap-2 truncate">
                        <template v-if="selectedAssetInfo">
                          <img :src="`https://ui-avatars.com/api/?name=${selectedAssetInfo.symbol.slice(0,2)}&background=${selectedAssetInfo.type === 'crypto' ? '3b82f6' : '10b981'}&color=fff&size=32&rounded=true`" class="w-4 h-4 rounded-full" />
                          <span class="font-bold">{{ selectedAssetInfo.symbol }}</span>
                          <span class="text-slate-500 text-[10px] truncate">{{ selectedAssetInfo.name }}</span>
                        </template>
                        <span v-else class="text-slate-600">請選擇標的</span>
                      </div>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 transition-transform duration-300" :class="{ 'rotate-180': showSymbolDropdown }" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                      </svg>
                    </button>

                    <transition 
                      enter-active-class="duration-200 ease-out" 
                      enter-from-class="transform opacity-0 scale-95" 
                      enter-to-class="transform opacity-100 scale-100"
                      leave-active-class="duration-150 ease-in"
                      leave-from-class="transform opacity-100 scale-100"
                      leave-to-class="transform opacity-0 scale-95"
                    >
                      <div v-if="showSymbolDropdown" class="absolute top-[calc(100%+4px)] left-0 w-full min-w-[200px] bg-[#0a0f1c] border border-slate-700 shadow-2xl rounded-xl z-[200] overflow-hidden backdrop-blur-xl">
                        <div class="p-2 border-b border-slate-800 bg-[#070b14]">
                          <input v-model="symbolSearch" type="text" placeholder="搜索..." class="w-full bg-[#05080f] border border-slate-700 rounded-md px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500 transition-colors" auto-focus />
                        </div>
                        <div class="max-h-[240px] overflow-y-auto custom-scrollbar p-1">
                          <div v-if="filteredAssets.crypto.length > 0">
                            <div class="px-2 py-1 text-[9px] font-black text-blue-500 uppercase tracking-widest opacity-70">Crypto</div>
                            <button v-for="asset in filteredAssets.crypto" :key="asset.symbol" @click="selectSymbol(asset.symbol)" class="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-blue-600/10 transition-colors group" :class="{ 'bg-blue-600/20': newSymbol === asset.symbol }">
                              <div class="flex items-center gap-3">
                                <img :src="`https://ui-avatars.com/api/?name=${asset.symbol.slice(0,2)}&background=3b82f6&color=fff&size=32&rounded=true`" class="w-5 h-5 rounded-full" />
                                <div class="text-left">
                                  <div class="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">{{ formatSymbol(asset.symbol) }}</div>
                                  <div class="text-[9px] text-slate-500">{{ asset.name }}</div>
                                </div>
                              </div>
                            </button>
                          </div>
                          
                          <div v-if="filteredAssets.index.length > 0" class="mt-2">
                            <div class="px-2 py-1 text-[9px] font-black text-purple-500 uppercase tracking-widest opacity-70 border-t border-slate-800 pt-2 mt-1">Indices</div>
                            <button v-for="asset in filteredAssets.index" :key="asset.symbol" @click="selectSymbol(asset.symbol)" :disabled="asset.symbol === 'FGI' || asset.symbol === 'BDI' || asset.symbol.startsWith('^')" class="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-purple-600/10 transition-colors group disabled:opacity-40 disabled:cursor-not-allowed" :class="{ 'bg-purple-600/20': newSymbol === asset.symbol }">
                              <div class="flex items-center gap-3">
                                <img :src="`https://ui-avatars.com/api/?name=${asset.symbol.slice(0,2)}&background=a855f7&color=fff&size=32&rounded=true`" class="w-5 h-5 rounded-full" />
                                <div class="text-left">
                                  <div class="text-xs font-bold text-white group-hover:text-purple-400 transition-colors">{{ formatSymbol(asset.symbol) }}</div>
                                  <div class="text-[9px] text-slate-500">{{ asset.name }}</div>
                                </div>
                              </div>
                            </button>
                          </div>

                          <div v-if="filteredAssets.stock.length > 0" class="mt-2">
                            <div class="px-2 py-1 text-[9px] font-black text-emerald-500 uppercase tracking-widest opacity-70 border-t border-slate-800 pt-2 mt-1">Stocks</div>
                            <button v-for="asset in filteredAssets.stock" :key="asset.symbol" @click="selectSymbol(asset.symbol)" class="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-emerald-600/10 transition-colors group" :class="{ 'bg-emerald-600/20': newSymbol === asset.symbol }">
                              <div class="flex items-center gap-3">
                                <img :src="`https://ui-avatars.com/api/?name=${asset.symbol.slice(0,2)}&background=10b981&color=fff&size=32&rounded=true`" class="w-5 h-5 rounded-full" />
                                <div class="text-left">
                                  <div class="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">{{ formatSymbol(asset.symbol) }}</div>
                                  <div class="text-[9px] text-slate-500">{{ asset.name }}</div>
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      </div>
                    </transition>
                  </div>

                  <div class="space-y-1.5">
                    <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">數量 (Amount)</span>
                    <input v-model="newAmount" type="number" step="any" placeholder="0.00" class="h-10 hide-arrows w-full bg-[#05080f] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div class="space-y-1.5">
                    <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">平均單價 (Price)</span>
                    <input v-model="newPrice" type="number" step="any" placeholder="0.00" class="h-10 hide-arrows w-full bg-[#05080f] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
                  </div>
                  <div class="space-y-1.5">
                    <span class="text-[10px] opacity-0 select-none block tracking-wider">Btn</span>
                    <button type="submit" class="h-10 w-full bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-lg transition-all shadow-lg active:scale-95">確認加入</button>
                  </div>
                </form>
              </transition>

              <!-- Holding Cards -->
              <div class="space-y-8">
                <template v-if="portfolio.length > 0">
                  <!-- Crypto Group -->
                  <div v-if="categorizedPortfolio.crypto.length > 0">
                    <div class="flex items-center gap-2 mb-3 px-1">
                      <div class="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                      <span class="text-xs font-black text-blue-400 uppercase tracking-widest">加密貨幣 (Crypto)</span>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                      <div v-for="item in categorizedPortfolio.crypto" :key="item.id" 
                        class="bg-[#0a0f1c] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between group hover:border-slate-600 transition-all backdrop-blur-sm">
                        <div class="flex items-center gap-4 mb-4 md:mb-0">
                          <div class="w-10 h-10 rounded-full bg-blue-900/20 border border-blue-800/30 flex items-center justify-center font-bold text-blue-400 text-xs">
                            {{ item.symbol.slice(0, 2) }}
                          </div>
                          <div>
                            <div class="flex items-center gap-2">
                              <h4 class="text-white font-bold uppercase">{{ formatSymbol(item.symbol) }}</h4>
                              <span class="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Qty: {{ item.amount }}</span>
                            </div>
                            <p class="text-[10px] text-slate-500 mt-1 font-mono">買入成本: ${{ item.entryPrice.toLocaleString() }}</p>
                          </div>
                        </div>

                        <div class="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:gap-16 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-t-0">
                          <div class="text-right">
                            <p class="text-[10px] text-slate-500 uppercase tracking-widest mb-1">即時現價</p>
                            <p class="text-white font-mono font-bold">{{ marketPrices[item.symbol]?.price || '$' + item.entryPrice }}</p>
                          </div>
                          <div class="text-right min-w-[100px]">
                            <p class="text-[10px] text-slate-500 uppercase tracking-widest mb-1">估計盈虧</p>
                            <p :class="((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount >= 0 ? 'text-green-400' : 'text-red-400'" class="font-mono font-bold text-lg">
                              {{ ((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount >= 0 ? '+' : '' }}
                              ${{ (((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount).toLocaleString('en-US', {maximumFractionDigits: 1}) }}
                            </p>
                          </div>

                          <div class="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button @click="openAdjust(item)" class="p-2 text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-lg transition-all" title="調整持倉">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </button>
                            <button @click="triggerDelete(item.id, item.symbol)" class="p-2 text-red-400 hover:text-white hover:bg-red-600/20 rounded-lg transition-all" title="刪除">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Stock Group -->
                  <div v-if="categorizedPortfolio.stock.length > 0">
                    <div class="flex items-center gap-2 mb-3 px-1">
                      <div class="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                      <span class="text-xs font-black text-emerald-400 uppercase tracking-widest">股票與指數 (Stocks & Indices)</span>
                    </div>
                    <div class="grid grid-cols-1 gap-3">
                      <div v-for="item in categorizedPortfolio.stock" :key="item.id" 
                        class="bg-[#0a0f1c] border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between group hover:border-slate-600 transition-all backdrop-blur-sm">
                        <div class="flex items-center gap-4 mb-4 md:mb-0">
                          <div class="w-10 h-10 rounded-full bg-emerald-900/20 border border-emerald-800/30 flex items-center justify-center font-bold text-emerald-400 text-xs">
                            {{ item.symbol.slice(0, 2) }}
                          </div>
                          <div>
                            <div class="flex items-center gap-2">
                              <h4 class="text-white font-bold uppercase">{{ formatSymbol(item.symbol) }}</h4>
                              <span class="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Qty: {{ item.amount }}</span>
                            </div>
                            <p class="text-[10px] text-slate-500 mt-1 font-mono">買入成本: ${{ item.entryPrice.toLocaleString() }}</p>
                          </div>
                        </div>

                        <div class="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 md:gap-16 mt-3 md:mt-0 pt-3 md:pt-0 border-t border-white/5 md:border-t-0">
                          <div class="text-right">
                            <p class="text-[10px] text-slate-500 uppercase tracking-widest mb-1">即時現價</p>
                            <p class="text-white font-mono font-bold">{{ marketPrices[item.symbol]?.price || '$' + item.entryPrice }}</p>
                          </div>
                          <div class="text-right min-w-[100px]">
                            <p class="text-[10px] text-slate-500 uppercase tracking-widest mb-1">估計盈虧</p>
                            <p :class="((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount >= 0 ? 'text-green-400' : 'text-red-400'" class="font-mono font-bold text-lg">
                              {{ ((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount >= 0 ? '+' : '' }}
                              ${{ (((marketPrices[item.symbol]?.rawPrice || item.entryPrice) - item.entryPrice) * item.amount).toLocaleString('en-US', {maximumFractionDigits: 1}) }}
                            </p>
                          </div>

                          <div class="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button @click="openAdjust(item)" class="p-2 text-blue-400 hover:text-white hover:bg-blue-600/20 rounded-lg transition-all" title="調整持倉">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                            </button>
                            <button @click="triggerDelete(item.id, item.symbol)" class="p-2 text-red-400 hover:text-white hover:bg-red-600/20 rounded-lg transition-all" title="刪除">
                              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <div v-else class="py-12 flex flex-col items-center text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                  <p class="text-xs">尚無倉位，點擊「新增倉位」開始追蹤。</p>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Login Required Placeholder for Portfolio -->
        <template v-else>
          <div class="flex flex-col items-center justify-center py-20 px-4 text-center max-w-lg mx-auto">
            <div class="w-16 h-16 rounded-full bg-blue-900/20 flex items-center justify-center mb-6 border border-blue-500/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 class="text-white text-xl font-black mb-3">登入以使用此功能</h3>
            <p class="text-slate-400 text-sm md:text-base mb-8 leading-relaxed">
              為保護個人資產隱私，持倉功能僅限會員使用。
            </p>
            <button @click="goToLogin" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-600/30 active:scale-95">
              立即登入 / 註冊
            </button>
          </div>
        </template>
      </template>

      <!-- 2. Movers View - Public -->
      <template v-else>
        <div v-if="isLoading" class="flex justify-center items-center h-64">
          <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div v-else-if="filteredMovers.length === 0" class="flex flex-col items-center justify-center h-64 text-slate-500 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
          此類別暫無監控數據
        </div>
        <div v-else class="max-w-5xl mx-auto space-y-4">
          <div 
            v-for="item in filteredMovers" 
            :key="item.id"
            class="bg-[#111827] border border-slate-800/80 rounded-xl p-3 md:p-5 hover:border-slate-700 transition-colors flex flex-col"
          >
            <!-- Top Row: Icon, Title, Badge -->
            <div class="flex items-start justify-between mb-3 md:mb-6">
              <div class="flex items-start space-x-2 md:space-x-4 min-w-0">
                <div 
                  class="w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center font-black text-[10px] md:text-sm shrink-0 font-mono mt-0.5 relative"
                  :class="{
                    'bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-yellow-900 shadow-[0_0_14px_3px_rgba(234,179,8,0.55)] animate-medal-pulse': item.id === 1,
                    'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-700 shadow-[0_0_10px_2px_rgba(148,163,184,0.45)] animate-medal-pulse': item.id === 2,
                    'bg-gradient-to-br from-orange-600 via-amber-700 to-orange-800 text-orange-100 shadow-[0_0_10px_2px_rgba(180,83,9,0.4)] animate-medal-pulse': item.id === 3,
                    'bg-slate-800/80 border border-slate-700 text-slate-400': item.id > 3
                  }"
                >
                  <span>{{ item.id }}</span>
                </div>
                <!-- Image -->
                <img :src="item.image" class="w-7 h-7 md:w-10 md:h-10 rounded-md object-cover border border-slate-700 shrink-0 mt-0.5" alt="Market" />
                <!-- Title -->
                <div class="min-w-0">
                  <h3 class="text-white font-bold text-[11px] md:text-sm leading-tight mb-1 truncate md:whitespace-normal">{{ getDisplayTitle(item) }}</h3>
                  <div class="flex items-center text-[9px] md:text-xs text-slate-500 space-x-2">
                    <a v-if="item.slug" :href="`https://polymarket.com/event/${item.slug}`" target="_blank" rel="noopener" class="px-2 py-0.5 rounded bg-blue-600/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white transition-all text-[9px] md:text-[10px] font-black flex items-center gap-1.5 active:scale-95 shadow-sm">
                      <span>下注</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    <button 
                      @click.prevent="openAIDrawer(item.symbol || item.title, item.currentPrice, 'crypto')"
                      class="flex items-center space-x-1 text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-900/40 text-blue-400 bg-blue-950/20 hover:bg-blue-600 hover:text-white transition-all shadow-sm shrink-0"
                      title="AI 智能速報"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>AI 速報</span>
                    </button>
                    <button 
                      @click.prevent="toggleTranslateMover(item)" 
                      class="flex items-center space-x-1 text-[8px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-700 transition-all shrink-0"
                      :class="translatedIds.has(item.id) ? 'text-blue-400 border-blue-900/40 bg-blue-950/20 shadow-sm' : 'text-slate-500 hover:text-blue-400 hover:border-slate-600'"
                      :disabled="translatingIds.has(item.id)"
                    >
                      <svg v-if="translatingIds.has(item.id)" class="w-3 h-3 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
                      </svg>
                      <span>{{ translatingIds.has(item.id) ? '翻譯中...' : (translatedIds.has(item.id) ? '原文' : '翻譯') }}</span>
                    </button>
                  </div>
                </div>
              </div>
              <!-- Badge -->
              <div class="px-2 py-1 rounded font-mono font-black text-[10px] md:text-xs shrink-0 flex items-center shadow-lg" :class="item.isUp ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'">
                {{ item.isUp ? '↑' : '↓' }} {{ item.changePercent.toFixed(1) }}%
              </div>
            </div>

            <!-- Middle Block -->
            <div class="bg-[#0a0f1c] rounded-lg p-2 md:p-4 border border-slate-800/50 mb-3 md:mb-4 relative overflow-hidden">
              <div class="absolute right-0 top-0 bottom-0 w-2/3 opacity-30 z-0 pointer-events-none">
                <Sparkline :data="item.sparklineData" />
              </div>
              <div class="relative z-10 grid grid-cols-3 gap-2">
                <div>
                  <p class="text-[8px] md:text-[10px] text-slate-600 uppercase font-bold">{{ getLabel('detected', translatedIds.has(item.id)) }}</p>
                  <p class="text-white font-black text-sm md:text-lg">{{ item.detectedPrice }}¢</p>
                </div>
                <div>
                  <p class="text-[8px] md:text-[10px] text-slate-600 uppercase font-bold">{{ getLabel('peak', translatedIds.has(item.id)) }}</p>
                  <p class="text-green-400 font-black text-sm md:text-lg">{{ item.peakPrice }}¢</p>
                </div>
                <div>
                  <p class="text-[8px] md:text-[10px] text-slate-600 uppercase font-bold">{{ getLabel('now', translatedIds.has(item.id)) }}</p>
                  <p class="text-slate-300 font-black text-sm md:text-lg">{{ item.currentPrice }}¢</p>
                </div>
              </div>
            </div>

            <!-- News footer -->
            <div v-if="item.news" class="flex items-center text-[10px] text-slate-500 mt-2 border-t border-white/5 pt-2 truncate">
              <span class="mr-2 text-indigo-400 font-bold">NEWS</span>
              <span class="truncate">{{ getDisplayNews(item) }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Position Adjustment Modal -->
    <transition name="fade">
      <div v-if="showAdjustModal" class="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/70 backdrop-blur-md">
        <div class="bg-[#111827] border border-slate-700 rounded-2xl p-5 md:p-7 w-full max-w-md shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">⚙️</span>
              調整 {{ adjustItem?.symbol }} 持倉
            </h3>
            <button @click="showAdjustModal = false" class="text-slate-500 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Type Switcher -->
          <div class="flex p-1 bg-[#05080f] rounded-xl mb-6">
            <button 
              @click="adjustType = 'add'"
              class="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
              :class="adjustType === 'add' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'"
            >
              加倉 ⊕
            </button>
            <button 
              @click="adjustType = 'reduce'"
              class="flex-1 py-2 text-xs font-bold rounded-lg transition-all"
              :class="adjustType === 'reduce' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'"
            >
              減倉 ⊖
            </button>
          </div>

          <div class="space-y-5">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1.5">
                <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">數量</span>
                <input v-model="adjustAmount" type="number" step="any" placeholder="0.00" class="h-11 hide-arrows w-full bg-[#05080f] border border-slate-700 rounded-xl px-4 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
              </div>
              <div class="space-y-1.5">
                <span class="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">單價 (USD)</span>
                <input v-model="adjustPrice" type="number" step="any" placeholder="0.00" class="h-11 hide-arrows w-full bg-[#05080f] border border-slate-700 rounded-xl px-4 text-white text-sm outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>

            <!-- Projection Card -->
            <div v-if="projectedStats" class="bg-blue-600/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <div class="flex justify-between items-center text-xs">
                <span class="text-slate-400">當前持倉 / 成本</span>
                <span class="text-white font-bold">{{ adjustItem.amount }} / ${{ adjustItem.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) }}</span>
              </div>
              <div class="flex justify-between items-center text-xs">
                <span class="text-slate-400">調整後總量</span>
                <span class="text-white font-bold" :class="projectedStats.totalQty > adjustItem.amount ? 'text-blue-400' : 'text-red-400'">
                  {{ Number(projectedStats.totalQty.toFixed(8)) }}
                </span>
              </div>
              <div v-if="adjustType === 'add'" class="flex justify-between items-center text-xs pt-2 border-t border-white/5">
                <span class="text-blue-400 font-bold">預計新平均成本 (DCA)</span>
                <span class="text-blue-400 font-black text-sm">${{ projectedStats.newAvg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) }}</span>
              </div>
            </div>

            <button 
              @click="handleAdjust"
              :disabled="!adjustAmount || isAdjusting"
              class="w-full py-3.5 rounded-xl text-sm font-black tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-xl"
              :class="adjustType === 'add' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20' : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'"
            >
              {{ isAdjusting ? '同步中...' : (adjustType === 'add' ? '確認加倉並重新計算成本' : '確認執行減倉') }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete Confirmation Modal -->
    <transition name="fade">
      <div v-if="confirmDeleteId !== null" class="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-[#111827] border border-red-900/50 rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">確定要刪除持倉嗎？</h3>
          <p class="text-xs text-slate-400 mb-6">您即將移除 <span class="text-white font-bold">{{ confirmDeleteSymbol }}</span> 的持倉紀錄，此動作無法復原。</p>
          <div class="flex gap-3">
            <button @click="confirmDeleteId = null" class="flex-1 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold">
              取消
            </button>
            <button @click="confirmDeleteAction" class="flex-1 py-2.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-bold">
              確定刪除
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

@keyframes medal-pulse {
  0%, 100% { box-shadow: 0 0 8px 1px rgba(255,255,255,0.1); transform: scale(1); }
  50%       { box-shadow: 0 0 15px 3px rgba(255,255,255,0.2); transform: scale(1.03); }
}
.animate-medal-pulse {
  animation: medal-pulse 3s ease-in-out infinite;
}
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.hide-arrows {
  -webkit-appearance: none;
  -moz-appearance: textfield;
  appearance: none;
  margin: 0;
}
.hide-arrows::-webkit-outer-spin-button,
.hide-arrows::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
