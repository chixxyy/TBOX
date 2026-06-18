import { ref } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

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
  news?: string
  newsTimeStr?: string
  sparklineData: number[]
  symbol?: string
  marketType?: 'crypto' | 'stock'
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

interface MarketData {
  price: string
  change: string
  up: boolean
  rawPrice: number
  prevClose?: number
}

export const initialAssets = [
  // Crypto (Top 9 Market Cap + USDC)
  { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'crypto', isIndex: false },
  { symbol: 'ETHUSDT', name: 'Ethereum', type: 'crypto', isIndex: false },
  { symbol: 'SOLUSDT', name: 'Solana', type: 'crypto', isIndex: false },
  { symbol: 'BNBUSDT', name: 'Binance Coin', type: 'crypto', isIndex: false },
  { symbol: 'XRPUSDT', name: 'Ripple', type: 'crypto', isIndex: false },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', type: 'crypto', isIndex: false },
  { symbol: 'ADAUSDT', name: 'Cardano', type: 'crypto', isIndex: false },
  { symbol: 'TRXUSDT', name: 'Tron', type: 'crypto', isIndex: false },
  { symbol: 'AVAXUSDT', name: 'Avalanche', type: 'crypto', isIndex: false },
  { symbol: 'USDCUSDT', name: 'USDC/USDT', type: 'crypto', isIndex: false },
  // Stock
  { symbol: '^TNX', name: '10Y Treasury Yield', type: 'stock', isIndex: true },
  { symbol: 'BDI', name: 'Baltic Dry Index', type: 'stock', isIndex: true },
  { symbol: '^VIX', name: 'Volatility Index', type: 'stock', isIndex: true },
  { symbol: '^DJI', name: 'Dow Jones Industrial', type: 'stock', isIndex: true },
  { symbol: '^GSPC', name: 'S&P 500 Index', type: 'stock', isIndex: true },
  { symbol: '^IXIC', name: 'Nasdaq Composite', type: 'stock', isIndex: true },
  { symbol: '^RUT', name: 'Russell 2000 Index', type: 'stock', isIndex: true },
  { symbol: '^SOX', name: 'PHLX Semiconductor', type: 'stock', isIndex: true },
  { symbol: 'VTI', name: 'Vanguard Total Stock', type: 'stock', isIndex: true },
  { symbol: 'VOO', name: 'Vanguard S&P 500', type: 'stock', isIndex: true },
  { symbol: 'NVDA', name: 'Nvidia', type: 'stock', isIndex: false },
  { symbol: 'AMD', name: 'AMD', type: 'stock', isIndex: false },
  { symbol: 'GOOG', name: 'Alphabet Inc.', type: 'stock', isIndex: false },
  { symbol: 'CRCL', name: 'Cricut Inc.', type: 'stock', isIndex: false },
  { symbol: 'META', name: 'Meta', type: 'stock', isIndex: false },
  { symbol: 'ADBE', name: 'Adobe', type: 'stock', isIndex: false },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock', isIndex: false },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock', isIndex: false },
  { symbol: 'ORCL', name: 'Oracle', type: 'stock', isIndex: false },
  { symbol: 'PLTR', name: 'Palantir', type: 'stock', isIndex: false },
  { symbol: 'SPCX', name: 'Space Exploration', type: 'stock', isIndex: false },
  { symbol: 'MSFT', name: 'Microsoft', type: 'stock', isIndex: false },
  { symbol: 'IBM', name: 'IBM Corp', type: 'stock', isIndex: false },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', isIndex: false },
  { symbol: 'NEE', name: 'NextEra Energy', type: 'stock', isIndex: false }
] as const

export const useMarketStore = defineStore('market', () => {
  const globalMovers = ref<Mover[]>([])
  const globalNews = useStorage<NewsItem[]>('tbox-global-news', [])
  const lastNewsUpdate = useStorage('tbox-last-news-update', '')
  const isMoversLoading = ref(true)
  const isNewsLoading = ref(true)
  const lastMoversUpdate = ref('')
  const marketPrices = ref<Record<string, MarketData>>({})

  // Global share state
  const showShareConfirm = ref(false)
  const newsToShare = ref<any>(null)
  const triggerShare = (news: any) => {
    newsToShare.value = news
    showShareConfirm.value = true
  }

  return {
    globalMovers,
    globalNews,
    lastNewsUpdate,
    isMoversLoading,
    isNewsLoading,
    lastMoversUpdate,
    marketPrices,
    showShareConfirm,
    newsToShare,
    triggerShare,
    initialAssets
  }
})
