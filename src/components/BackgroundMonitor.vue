<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { 
  globalMovers, globalNews, 
  isMoversLoading, isNewsLoading, 
  lastMoversUpdate, lastNewsUpdate,
  priceAlerts,
  showToast,
  isNotificationsEnabled,
  updatePriceAlertTriggered,
  marketPrices,
  portfolio,
  trackedPlayers,
  type Mover
} from '../stores'
import { sendDesktopNotification } from '../utils/notify'
import { api } from '../network'

const knownNewsIds = new Set<string>()
const get24hTime = () => new Date().toLocaleTimeString('zh-TW', { 
  hour12: false, 
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit' 
})

// --- HELPERS ---

function getRelativeTime(timestamp: number) {
  if (!timestamp || isNaN(timestamp)) return 'now'
  const diff = Date.now() - timestamp
  if (diff < 0) return 'now' // Handle future dates from buggy APIs
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

function getSeverity(headline: string): string {
  const h = (headline || '').toLowerCase()
  // --- Critical Keywords ---
  if (h.includes('hack') || h.includes('attack') || h.includes('exploit') || h.includes('scam')) return 'critical'
  if (h.includes('season-ending') || h.includes('arrested') || h.includes('suspended') || h.includes('blockbuster trade')) return 'critical'
  
  // --- High Keywords ---
  if (h.includes('sec ') || h.includes('fed ') || h.includes('cpi') || h.includes('binance')) return 'high'
  if (h.includes('injury') || h.includes(' out ') || h.includes('lineup') || h.includes('contract extension') || h.includes('signing')) return 'high'
  
  return 'low'
}

function getAccentColor(category: string, isCritical: boolean): string {
  if (isCritical) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
  if (category === 'sports') return 'bg-indigo-600'
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
    cats.map(c => api.getFinnhubNews(c).catch(() => []))
  )
  // Finnhub sometimes returns an error object { error: "..." } on rate limit
  const flattened = results.flat()
  const validItems = Array.isArray(flattened) ? flattened.filter(i => i && i.headline) : []
  return validItems.map((item: any, i: number) => {
    return {
      uid: `fh-${item.id || i}`,
      source: item.source,
      cat: (item.category || 'general').toLowerCase(),
      ts: item.datetime * 1000,
      headline: item.headline,
      summary: item.summary || '',
      url: item.url || '#',
      avatarBg: item.category === 'crypto' ? '3b82f6' : item.category === 'forex' ? 'f59e0b' : '10b981',
      provider: 'finnhub'
    }
  })
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
      provider: 'cryptocompare'
    }
  })
}

async function fetchSports(): Promise<any[]> {
  try {
    // 使用自家 Vercel Proxy (/api/rss) 徹底消滅 429 報錯
    const res = await fetch('/api/rss')
    const data = await res.json()
    
    if (data.status !== 'ok') return []
    
    return (data.items || []).map((item: any) => ({
      uid: `espn-${item.guid || item.link}`,
      source: 'ESPN',
      cat: 'sports',
      ts: new Date(item.pubDate).getTime(),
      headline: item.title,
      summary: item.description,
      url: item.link || '#',
      avatarBg: 'ff0000',
      provider: 'espn'
    }))
  } catch (err) {
    console.warn('[Sports Sync] Failed via Logic Proxy:', err)
    return []
  }
}

async function fetchMlbTransactions(): Promise<any[]> {
  try {
    const now = new Date()
    const today = now.toISOString().split('T')[0] as string
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] as string
    const data = await api.getMlbTransactions(threeDaysAgo, today)
    const transactions = data.transactions || []
    
    return transactions.map((t: any) => {
      const pId = t.person?.id || t.personId
      const isTracked = trackedPlayers.value.some(p => p.id === String(pId))
      
      // Boost timestamp: If it's a transaction from today/yesterday, give it a high hour weight
      // so it clusters with recent news rather than sinking to 00:00:00
      const baseTs = new Date(t.date).getTime()
      const displayTs = baseTs + (12 * 3600 * 1000) + (isTracked ? 12 * 3600 * 1000 : 0)

      return {
        uid: `mlb-trans-${t.id}`,
        source: 'MLB.com',
        cat: 'sports',
        ts: displayTs,
        headline: t.description,
        summary: `${t.typeDesc}: ${t.description}`,
        url: pId ? `https://www.mlb.com/player/${pId}` : `https://www.mlb.com/transactions`,
        avatarBg: '002D72',
        provider: 'mlb-official',
        isTracked
      }
    })
  } catch { return [] }
}

async function syncNews(skipNotifications = false) {
  try {
    const [fh, cc, sp, mt] = await Promise.allSettled([fetchFinnhub(), fetchCC(), fetchSports(), fetchMlbTransactions()])
    const all = [
      ...(fh.status === 'fulfilled' ? fh.value : []),
      ...(cc.status === 'fulfilled' ? cc.value : []),
      ...(sp.status === 'fulfilled' ? sp.value : []),
      ...(mt.status === 'fulfilled' ? mt.value : []),
    ]
    const unique = new Map<string, any>()
    all.forEach(item => {
      // Ultimate defensive check before entering the store
      if (item && item.headline && item.uid) {
        unique.set(item.uid, item)
      }
    })
    const sorted = Array.from(unique.values()).sort((a, b) => b.ts - a.ts)

    const isFirstLoad = knownNewsIds.size === 0
    let hasNew = false
    const newItems: any[] = []
    const staleThreshold = 4 * 60 * 60 * 1000 // 4 hours
    const now = Date.now()
    
    sorted.forEach(item => {
      if (!knownNewsIds.has(item.uid)) {
        // Trigger notification if NOT skipping (initial sync) AND NOT the first session load
        // Also added a safety check: News shouldn't be more than 4 hours old to avoid spamming very old items.
        if (!isFirstLoad && !skipNotifications && (now - item.ts < staleThreshold)) {
          hasNew = true
          newItems.push(item)
        }
        knownNewsIds.add(item.uid)
      }
    })
    
    if (hasNew) {
      if (newItems.length > 0) {
        if (isNotificationsEnabled.value) {
          sendDesktopNotification(
            newItems.length === 1 ? '新快訊 (News)' : `${newItems.length} 則新快訊`,
            newItems.length === 1 ? newItems[0].headline : newItems.map(n => n.headline).join('\n')
          )
        }
        showToast(
          newItems.length === 1 ? '新快訊' : `${newItems.length} 則新快訊`,
          newItems.length === 1 ? newItems[0].headline : newItems.map(n => n.headline).join('\n')
        )
      }
    }

    const providerColors: Record<string, string> = { 
      finnhub: '1d4ed8', 
      cryptocompare: '7c3aed',
      espn: 'ff0000',
      'mlb-official': '002D72'
    }
    
    globalNews.value = sorted.slice(0, 200).map(item => {
      const severity = item.isTracked ? 'critical' : getSeverity(item.headline)
      const isCritical = severity === 'critical'
      const bg = item.avatarBg || (providerColors[item.provider as any] || '1d4ed8')
      
      // Normalize categories: everything not sports/crypto goes to general (Finance)
      let finalCat = item.cat
      if (finalCat !== 'sports' && finalCat !== 'crypto') {
        finalCat = 'general'
      }
      
      const categoryLabel = finalCat.toUpperCase()
      
      return {
        ...item,
        id: item.uid,
        cat: finalCat,
        severity,
        time: getRelativeTime(item.ts) ,
        accentColor: getAccentColor(finalCat, isCritical),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(item.source || 'N')}&background=${bg}&color=fff&rounded=true&font-size=0.4&bold=true`,
        handle: `@${(item.source || 'News').replace(/\s+/g, '')}`,
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
    symbol: ev.slug?.toUpperCase() || ev.title.split(' ')[0].toUpperCase(), // Extract symbol from slug or title
    slug: ev.slug || '',
    image: ev.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(ev.title.substring(0,2))}&background=random`,
    detectedPrice: detected,
    peakPrice: peak,
    currentPrice: currentPrice,
    marketType: 'crypto', // Default for background monitor events
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
    const data = await api.getPolyEvents('closed=false&limit=50&active=true')
    const validEvents = data.filter((ev: any) => ev.markets && ev.markets.length > 0)
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
      if (isNotificationsEnabled.value) {
        sendDesktopNotification('大行情異動 (Market Movers)', 'Top 3 排行發生變化或有顯著價格波動')
      }
      showToast('大行情異動', 'Top 3 排行發生變化或有顯著價格波動')
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
let alertWs: WebSocket | null = null

function connectAlertMonitor() {
  if (alertWs) alertWs.close()
  alertWs = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr')
  
  alertWs.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (!Array.isArray(data)) return
    
    const prices: Record<string, number> = {}
    for (const d of data) {
      const sym = d.s
      const p = parseFloat(d.c)
      prices[sym] = p
      
      // Global Price Sync for Alerts & Portfolio
      if (portfolio.value.some(i => i.symbol === sym) || priceAlerts.value.some(a => a.symbol === sym)) {
        if (!marketPrices.value[sym]) {
          marketPrices.value[sym] = {
            price: p.toString(),
            change: '0%',
            up: true,
            rawPrice: p
          }
        } else {
          marketPrices.value[sym].rawPrice = p
        }
      }
    }

    priceAlerts.value.forEach(alert => {
      if (alert.triggered) return
      
      const normalizedSymbol = alert.symbol.replace('/', '').toUpperCase()
      const currentPrice = prices[normalizedSymbol]
      if (!currentPrice) return

      let isTriggered = false
      if (alert.condition === 'above' && currentPrice >= alert.targetPrice) isTriggered = true
      if (alert.condition === 'below' && currentPrice <= alert.targetPrice) isTriggered = true

      if (isTriggered) {
        alert.triggered = true
        if (isNotificationsEnabled.value) {
          sendDesktopNotification(
            '🔔 到價提醒觸發',
            `${alert.symbol} 已達到設定價格 ${alert.targetPrice} (目前: ${currentPrice})`
          )
        }
        showToast('🔔 到價提醒觸發', `${alert.symbol} 已達到設定價格 ${alert.targetPrice} (目前: ${currentPrice})`)
        updatePriceAlertTriggered(alert.id)
      }
    })
  }

  alertWs.onclose = () => {
    setTimeout(connectAlertMonitor, 5000)
  }
}

async function fetchFearGreedIndex() {
  try {
    const res = await fetch('https://api.alternative.me/fng/')
    const data = await res.json()
    if (data && data.data && data.data[0]) {
      const fngValue = parseInt(data.data[0].value)
      const classification = data.data[0].value_classification
      
      const target = marketPrices.value['FGI']
      if (!target) {
        marketPrices.value['FGI'] = {
          price: fngValue.toString(),
          change: classification,
          up: fngValue >= 50,
          rawPrice: fngValue
        }
      } else {
        target.price = fngValue.toString()
        target.change = classification
        target.rawPrice = fngValue
        target.up = fngValue >= 50
      }
    }
  } catch (e) {
    console.warn('[FGI_SYNC] Failed to fetch Fear & Greed Index:', e)
  }
}

async function fetchBdiData() {
  try {
    // We use BDRY (Breakwave Dry Bulk Shipping ETF) as a proxy for the BDI calculation
    const quote = await api.getFinnhubQuote('BDRY')
    if (quote && quote.c) {
      // Historical approximation for BDI scaling: BDRY price * 250
      const bdiValue = Math.round(quote.c * 255)
      const target = marketPrices.value['BDI']
      
      const updateData = {
        price: bdiValue.toLocaleString(),
        change: `${quote.dp > 0 ? '+' : ''}${quote.dp.toFixed(2)}%`,
        up: quote.dp >= 0,
        rawPrice: bdiValue
      }
      
      if (!target) {
        marketPrices.value['BDI'] = updateData
      } else {
        Object.assign(target, updateData)
      }
    }
  } catch (e) {
    console.warn('[BDI_SYNC] Failed to fetch BDI Data:', e)
  }
}

async function syncPortfolioStockPrices() {
  // Exclude non-tradable indicators like FGI, VIX, or BDI from portfolio sync
  const stocks = portfolio.value.filter(p => !p.symbol.endsWith('USDT') && p.symbol !== 'FGI' && p.symbol !== '^VIX' && p.symbol !== 'BDI')
  if (stocks.length === 0) return

  for (const s of stocks) {
    // Add 1s delay to avoid Finnhub 429
    await new Promise(r => setTimeout(r, 1000))
    try {
      const quote = await api.getFinnhubQuote(s.symbol)
      if (quote && quote.c) {
        const target = marketPrices.value[s.symbol]
        if (!target) {
          marketPrices.value[s.symbol] = {
            price: quote.c.toString(),
            change: '0%',
            up: true,
            rawPrice: quote.c
          }
        } else {
          target.rawPrice = quote.c
        }
      }
    } catch (e) {
      console.error(`Failed to sync stock price for ${s.symbol}:`, e)
    }
  }
}

onMounted(() => {
  // 1. Initial hydration from cache: Populate known IDs to prevent duplicate alerts
  if (globalNews.value.length > 0) {
    globalNews.value.forEach(n => knownNewsIds.add(n.id))
    isNewsLoading.value = false
  }

  // 2. Cold-start bypass: if cached news is stale or too small, force a fresh full fetch
  //    This ensures users always see ~200 items on first load, not a half-filled stale cache
  const cachedCount = globalNews.value.length
  if (cachedCount < 50) {
    // Not enough data — clear LS news caches and fetch fresh immediately
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('tbox_cache_')) localStorage.removeItem(k)
      })
    } catch (e) { /* ignore */ }
  }

  syncNews(true) // Initial sync — pass true to skip notifications (even if cache is stale)
  syncMovers()
  connectAlertMonitor()
  syncPortfolioStockPrices() // Initial sync — now parallel!
  fetchFearGreedIndex() // Initial FGI sync
  fetchBdiData() // Initial BDI sync
  newsTimer = setInterval(syncNews, 30000)
  moversTimer = setInterval(syncMovers, 10000)
  setInterval(syncPortfolioStockPrices, 60000) // Every minute
  setInterval(fetchFearGreedIndex, 300000) // Every 5 minutes
  setInterval(fetchBdiData, 300000) // Every 5 minutes
})

onUnmounted(() => {
  clearInterval(newsTimer)
  clearInterval(moversTimer)
  if (alertWs) alertWs.close()
})
</script>
<template><div style="display:none"></div></template>
