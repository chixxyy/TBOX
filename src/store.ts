import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'

// Only track these 4 assets as requested

export const activeSymbol = ref('BTCUSDT')
export const activeInterval = ref('1d')
export const activeTab = ref('交易')

export const setActiveSymbol = (symbol: string) => {
  activeSymbol.value = symbol
}

export const setActiveInterval = (interval: string) => {
  activeInterval.value = interval
}

// Helper to get formatted pair name, e.g. BTC/USDT
export const formattedActiveSymbol = computed(() => {
  return activeSymbol.value.replace('USDT', '/USDT')
})

// --- Global Data Store for Site-wide Monitoring ---

export interface Mover {
  id: number
  title: string
  slug: string
  image: string
  detectedPrice: number
  peakPrice: number
  currentPrice: number
  changePercent: number
  isUp: boolean
  detectedTimeStr: string
  peakTimeStr: string
  detectionDurationStr: string
  volumeStr: string
  news: string
  newsTimeStr: string
  sparklineData: number[]
}

interface NewsItem {
  id: string
  source: string
  ts: number
  time: string
  cat: string
  headline: string
  summary: string
  image: string
  url: string
  severity: string
  accentColor: string
  avatar: string
  isCritical: boolean
  handle?: string
  isOfficial?: boolean
  tags?: any[]
}

export const globalMovers = ref<Mover[]>([])
export const globalNews = ref<NewsItem[]>([])
export const isMoversLoading = ref(true)
export const isNewsLoading = ref(true)
export const lastMoversUpdate = ref('')
export const lastNewsUpdate = ref('')

// --- Mobile UX State ---
export const scrollProgress = ref(0) // 0 to 100
export const isChangingTab = ref(false)
export const setScrollProgress = (progress: number) => {
  scrollProgress.value = Math.max(0, Math.min(100, progress))
}

// --- Price Alerts ---
export interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  condition: 'above' | 'below'
  triggered: boolean
}

export const priceAlerts = useStorage<PriceAlert[]>('tbox-price-alerts', [])

export const addPriceAlert = (symbol: string, targetPrice: number, condition: 'above' | 'below') => {
  priceAlerts.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    symbol,
    targetPrice,
    condition,
    triggered: false
  })
}

export const removePriceAlert = (id: string) => {
  priceAlerts.value = priceAlerts.value.filter(a => a.id !== id)
}

// --- Global UI Toast Alerts ---
interface ToastItem {
  id: string
  title: string
  message: string
}
export const toasts = ref<ToastItem[]>([])

export const showToast = (title: string, message: string) => {
  toasts.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    title,
    message
  })
}

export const removeToast = (id: string) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}
