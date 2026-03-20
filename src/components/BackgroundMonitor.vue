<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { 
  globalMovers, globalNews, 
  isMoversLoading, isNewsLoading, 
  lastMoversUpdate, lastNewsUpdate,
  type Mover
} from '../store'
import { playNewsChime, playMoversChime } from '../utils/audio'

const knownNewsIds = new Set<string>()

const get24hTime = () => new Date().toLocaleTimeString('zh-TW', { 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
})

// --- HELPERS ---

function getRelativeTime(timestamp: number) {
  const mins = Math.floor((Date.now() - timestamp) / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function getSeverity(headline: string): string {
  const h = (headline || '').toLowerCase()
  if (h.includes('hack') || h.includes('attack') || h.includes('exploit') || h.includes('scam')) return 'critical'
  if (h.includes('sec ') || h.includes('fed ') || h.includes('cpi') || h.includes('binance')) return 'high'
  return 'normal'
}

function getAccentColor(category: string, isCritical: boolean): string {
  if (isCritical) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
  if (category === 'crypto') return 'bg-blue-500'
  if (category === 'politics' || category === 'general') return 'bg-emerald-500'
  return 'bg-slate-600'
}

function generateSparklineData(start: number, end: number, points: number = 24): number[] {
  const data = [start]
  let current = start
  const trend = (end - start) / points
  const volatility = Math.abs(end - start) * 0.2 || 5
  for (let i = 1; i < points - 1; i++) {
    current += trend + (Math.random() - 0.5) * volatility
    current = Math.max(0.5, Math.min(99.5, current))
    data.push(current)
  }
  data.push(end)
  return data
}

// --- NEWS LOGIC ---

async function fetchFinnhub(): Promise<any[]> {
  const cats = ['crypto', 'general', 'forex']
  const results = await Promise.all(
    cats.map(c => fetch(`https://finnhub.io/api/v1/news?category=${c}&token=d5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag`).then(r => r.json()).catch(() => []))
  )
  return results.flat().map((item: any, i: number) => ({
    uid: `fh-${item.id || i}`,
    source: item.source,
    cat: (item.category || 'general').toLowerCase(),
    ts: item.datetime * 1000,
    headline: item.headline,
    summary: item.summary || '',
    image: item.image || '',
    url: item.url || '#',
    avatarBg: item.category === 'crypto' ? '3b82f6' : item.category === 'forex' ? 'f59e0b' : '10b981',
    isCritical: (item.headline || '').toLowerCase().includes('hack') || (item.headline || '').toLowerCase().includes('sec'),
  }))
}

async function fetchCC(): Promise<any[]> {
  const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=50&sortOrder=latest')
  const data = await res.json()
  return (data.Data || []).map((item: any) => {
    const categories = (item.categories || '').toUpperCase()
    const tags: string[] = []
    if (categories.includes('REGULAT')) tags.push('regulation')
    if (categories.includes('DEFI')) tags.push('defi')
    if (categories.includes('MARKET')) tags.push('markets')
    if (categories.includes('ETF')) tags.push('etf')
    if (tags.length === 0) tags.push('crypto')

    return {
      uid: `cc-${item.id}`,
      source: item.source_info?.name || item.source,
      cat: tags[0],
      ts: item.published_on * 1000,
      headline: item.title,
      summary: item.body?.slice(0, 200) || '',
      image: item.imageurl || '',
      url: item.url || '#',
      avatarBg: '7c3aed',
      isCritical: false,
    }
  })
}

async function syncNews() {
  try {
    const [fh, cc] = await Promise.allSettled([fetchFinnhub(), fetchCC()])
    const all = [
      ...(fh.status === 'fulfilled' ? fh.value : []),
      ...(cc.status === 'fulfilled' ? cc.value : []),
    ]
    const unique = new Map<string, any>()
    all.forEach(item => unique.set(item.uid, item))
    const sorted = Array.from(unique.values()).sort((a, b) => b.ts - a.ts)

    const isFirstLoad = knownNewsIds.size === 0
    let hasNew = false
    sorted.forEach(item => {
      if (!knownNewsIds.has(item.uid)) {
        if (!isFirstLoad) hasNew = true
        knownNewsIds.add(item.uid)
      }
    })
    
    if (hasNew) playNewsChime()

    const providerColors: Record<string, string> = { finnhub: '1d4ed8', cryptocompare: '7c3aed' }
    
    globalNews.value = sorted.slice(0, 150).map(item => {
      const severity = getSeverity(item.headline)
      const isCritical = severity === 'critical' || item.isCritical
      const bg = item.avatarBg || (providerColors[item.provider as any] || '1d4ed8')
      
      const categoryLabel = item.cat.toUpperCase()
      
      return {
        ...item,
        id: item.uid,
        severity,
        time: getRelativeTime(item.ts),
        accentColor: getAccentColor(item.cat, isCritical),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.source)}&background=${bg}&color=fff&rounded=true&font-size=0.4&bold=true`,
        handle: `@${item.source.replace(/\s+/g, '')}`,
        isOfficial: true,
        tags: [
          isCritical
            ? { type: 'critical', label: 'CRITICAL', icon: '⚠️' }
            : { type: 'news', label: categoryLabel, icon: '📰' }
        ],
        content: item.summary
      }
    })
    lastNewsUpdate.value = get24hTime()
  } catch (e) {
    // Silence errors silently
  } finally {
    isNewsLoading.value = false
  }
}

// --- MOVERS LOGIC ---

function mapEventToMover(ev: any, index: number): Mover {
  const market = ev.markets && ev.markets[0]
  if (!market) return null as any
  let currentPrice = 50
  try {
    const prices = JSON.parse(market.outcomePrices)
    currentPrice = Math.round(parseFloat(prices[0]) * 100)
  } catch (e) {
    if (market.outcomePrices && Array.isArray(market.outcomePrices)) {
      currentPrice = Math.round(parseFloat(market.outcomePrices[0]) * 100)
    }
  }
  
  // Synthesize history (Logic preserved from MoversView.vue)
  const isUp = Math.random() > 0.4
  let detected, peak
  if (isUp) {
    detected = Math.max(1, currentPrice - Math.floor(Math.random() * 30 + 10))
    peak = Math.min(99, currentPrice + Math.floor(Math.random() * 15))
  } else {
    detected = Math.min(99, currentPrice + Math.floor(Math.random() * 30 + 10))
    peak = detected
  }

  const changePercent = ((currentPrice - detected) / detected) * 100
  const vol = parseFloat(ev.volume) || 0

  return {
    id: index + 1,
    title: ev.title,
    slug: ev.slug || '',
    image: ev.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(ev.title.substring(0,2))}&background=random`,
    detectedPrice: detected,
    peakPrice: peak,
    currentPrice: currentPrice,
    changePercent: Math.abs(changePercent),
    isUp: changePercent >= 0,
    detectedTimeStr: `${Math.floor(Math.random() * 20 + 2)}h ago`,
    peakTimeStr: `${Math.floor(Math.random() * 5 + 1)}h ago`,
    detectionDurationStr: `${Math.floor(Math.random() * 5 + 1)}m ${Math.floor(Math.random() * 50 + 1)}s`,
    volumeStr: vol > 1000000 ? `$${(vol/1000000).toFixed(2)}M` : `$${(vol/1000).toFixed(1)}K`,
    news: Math.random() > 0.7 ? "REUTERS: BREAKING NEWS DEVELOPMENT REPORTED" : "",
    newsTimeStr: `${Math.floor(Math.random() * 20 + 2)}h ago`,
    sparklineData: generateSparklineData(detected, currentPrice)
  }
}

async function syncMovers() {
  try {
    const res = await fetch('/polymarket/events?closed=false&limit=50&active=true')
    const raw = await res.json()
    const validEvents = raw.filter((ev: any) => ev.markets && ev.markets.length > 0)
    let newDataProcessed = validEvents.map(mapEventToMover).filter((m: any) => m !== null)

    let hasSignificantRankChange = false
    
    newDataProcessed.forEach((newItem: Mover) => {
      const existing = globalMovers.value.find(m => m.title === newItem.title)
      if (existing) {
        newItem.detectedPrice = existing.detectedPrice
        newItem.peakPrice = Math.max(existing.peakPrice, newItem.currentPrice)
        newItem.sparklineData = [...existing.sparklineData]
        if (newItem.currentPrice !== existing.currentPrice) {
          newItem.sparklineData.push(newItem.currentPrice)
          if (newItem.sparklineData.length > 30) newItem.sparklineData.shift()
        }
        const changePercent = ((newItem.currentPrice - newItem.detectedPrice) / newItem.detectedPrice) * 100
        newItem.changePercent = Math.abs(changePercent)
        newItem.isUp = changePercent >= 0
      } else {
        if (globalMovers.value.length > 0) hasSignificantRankChange = true
      }
    })

    newDataProcessed.sort((a: Mover, b: Mover) => b.changePercent - a.changePercent)
    newDataProcessed.forEach((m: Mover, i: number) => m.id = i + 1)

    // Alert check
    const oldTop3 = globalMovers.value.slice(0, 3).map((m: Mover) => m.title).join(',')
    const newTop3 = newDataProcessed.slice(0, 3).map((m: Mover) => m.title).join(',')
    if (globalMovers.value.length > 0 && (oldTop3 !== newTop3 || hasSignificantRankChange)) {
      playMoversChime()
    }

    globalMovers.value = newDataProcessed
    lastMoversUpdate.value = get24hTime()
  } catch (e) {
    // Silence errors silently
  } finally {
    isMoversLoading.value = false
  }
}

let newsTimer: any, moversTimer: any

onMounted(() => {
  syncNews()
  syncMovers()
  newsTimer = setInterval(syncNews, 30000)
  moversTimer = setInterval(syncMovers, 10000)
})

onUnmounted(() => {
  clearInterval(newsTimer)
  clearInterval(moversTimer)
})
</script>
<template><div style="display:none"></div></template>
