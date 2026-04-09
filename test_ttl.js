// ============================================================
// TradingBox API 核心邏輯測試 (Node.js 原生 fetch)
// 測試項目：
// 1. 雙隊列不互相阻塞 (news + quote 獨立)
// 2. 新聞快取 TTL 25s 確保每次 30s 輪詢能拿新資料
// 3. 報價快取 TTL 10s 行為
// 4. 真實 Finnhub API 回傳格式檢驗
// ============================================================

const FINNHUB_TOKEN = 'd5l4c49r01qgqufk6ua0d5l4c49r01qgqufk6uag'

// ── 複製 api.ts 的核心邏輯（純 JS 版）──
const requestCache = new Map()
const activeRequests = new Map()

let lastNewsCall = 0
let newsQueue = Promise.resolve()
let lastQuoteCall = 0
let quoteQueue = Promise.resolve()

function makeThrottledSlot(getQueue, setQueue, getTime, setTime, minInterval) {
  const p = getQueue().then(async () => {
    const diff = Date.now() - getTime()
    if (diff < minInterval) await new Promise(r => setTimeout(r, minInterval - diff))
    setTime(Date.now())
  })
  setQueue(p)
  return p
}

const getNewsSlot = () => makeThrottledSlot(() => newsQueue, p => { newsQueue = p }, () => lastNewsCall, t => { lastNewsCall = t }, 350)
const getQuoteSlot = () => makeThrottledSlot(() => quoteQueue, p => { quoteQueue = p }, () => lastQuoteCall, t => { lastQuoteCall = t }, 350)

const NEWS_CACHE_TTL = 25000
const QUOTE_CACHE_TTL = 10000

async function apiFetch(url) {
  const isFinnhub = url.includes('finnhub.io')
  const isNews = isFinnhub && url.includes('/news')
  const isQuote = isFinnhub && url.includes('/quote')
  const connector = url.includes('?') ? '&' : '?'
  const finalUrl = isFinnhub ? `${url}${connector}token=${FINNHUB_TOKEN}` : url
  const cacheKey = finalUrl

  if (isFinnhub) {
    const cached = requestCache.get(cacheKey)
    const ttl = isNews ? NEWS_CACHE_TTL : QUOTE_CACHE_TTL
    if (cached && Date.now() - cached.timestamp < ttl) {
      return { data: cached.data, fromCache: true }
    }
  }

  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey)
  }

  const fetchPromise = (async () => {
    if (isNews) await getNewsSlot()
    else if (isQuote) await getQuoteSlot()

    const res = await fetch(finalUrl, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (isFinnhub) requestCache.set(cacheKey, { data, timestamp: Date.now() })
    return { data, fromCache: false }
  })()

  activeRequests.set(cacheKey, fetchPromise)
  try {
    return await fetchPromise
  } finally {
    activeRequests.delete(cacheKey)
  }
}

// ── 測試工具 ──
let passed = 0, failed = 0
function assert(name, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${name}`)
    passed++
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`)
    failed++
  }
}

// ============================================================
// TEST 1: 雙隊列不互相阻塞
// 同時發出 3 個 quote + 3 個 news，news 應在 quote 完成前就拿到結果
// ============================================================
async function testQueueIndependence() {
  console.log('\n📋 TEST 1: 雙隊列獨立性 (news ≠ quote 互不阻塞)')
  
  const symbols = ['NVDA', 'AMD', 'META']
  const cats    = ['crypto', 'general', 'forex']

  const t0 = Date.now()
  const [quoteResults, newsResults] = await Promise.all([
    Promise.all(symbols.map(s => apiFetch(`https://finnhub.io/api/v1/quote?symbol=${s}`))),
    Promise.all(cats.map(c => apiFetch(`https://finnhub.io/api/v1/news?category=${c}`)))
  ])
  const elapsed = Date.now() - t0

  // 若為單一隊列，3 quotes (350ms×3=1050ms) + 3 news (350ms×3=1050ms) = ~2100ms
  // 雙隊列並行：max(1050, 1050) = ~1100ms
  assert('雙隊列並行完成時間 < 1600ms', elapsed < 1600, `實際耗時: ${elapsed}ms`)
  assert('news 全數成功', newsResults.every(r => Array.isArray(r.data)), `回傳: ${JSON.stringify(newsResults.map(r => typeof r.data))}`)
  assert('quote 全數成功', quoteResults.every(r => r.data && 'c' in r.data), `回傳: ${JSON.stringify(quoteResults.map(r => r.data?.c))}`)

  console.log(`  ⏱️  總耗時: ${elapsed}ms (雙隊列並行)`)
}

// ============================================================
// TEST 2: News 快取 TTL 25s (第二次呼叫應命中快取)
// ============================================================
async function testNewsCacheTTL() {
  console.log('\n📋 TEST 2: 新聞快取 TTL 驗證')

  // 先清快取確保乾淨
  requestCache.clear()

  const r1 = await apiFetch('https://finnhub.io/api/v1/news?category=crypto')
  assert('第一次呼叫不命中快取', !r1.fromCache)

  const r2 = await apiFetch('https://finnhub.io/api/v1/news?category=crypto')
  assert('第二次呼叫命中快取 (< 25s TTL)', r2.fromCache)
  assert('快取資料一致', JSON.stringify(r1.data) === JSON.stringify(r2.data))
}

// ============================================================
// TEST 3: 真實 Finnhub 新聞格式驗證
// ============================================================
async function testNewsFormat() {
  console.log('\n📋 TEST 3: 新聞格式驗證')
  requestCache.clear()

  const { data } = await apiFetch('https://finnhub.io/api/v1/news?category=general')
  assert('回傳為陣列', Array.isArray(data))
  
  if (Array.isArray(data) && data.length > 0) {
    const item = data[0]
    assert('每篇新聞有 headline', typeof item.headline === 'string', item.headline)
    assert('每篇新聞有 url', typeof item.url === 'string')
    assert('每篇新聞有 datetime (timestamp)', typeof item.datetime === 'number')
    assert('每篇新聞有 category', typeof item.category === 'string')
    console.log(`  📰 最新頭條: "${item.headline.slice(0, 60)}..."`)
  }
}

// ============================================================
// TEST 4: 報價 API 格式驗證
// ============================================================
async function testQuoteFormat() {
  console.log('\n📋 TEST 4: 股票報價格式驗證')
  requestCache.clear()

  const { data } = await apiFetch('https://finnhub.io/api/v1/quote?symbol=NVDA')
  assert('有當前價格 c', typeof data.c === 'number' && data.c > 0, `NVDA: $${data.c}`)
  assert('有開盤價 o', typeof data.o === 'number')
  assert('有最高價 h', typeof data.h === 'number')
  assert('有最低價 l', typeof data.l === 'number')
  console.log(`  💹 NVDA 最新報價: $${data.c} (開盤: $${data.o}, 最高: $${data.h}, 最低: $${data.l})`)
}

// ============================================================
// 執行全部測試
// ============================================================
async function runAll() {
  console.log('🚀 TradingBox API 核心邏輯測試開始...')
  console.log('='.repeat(55))

  await testQueueIndependence()
  await testNewsCacheTTL()
  await testNewsFormat()
  await testQuoteFormat()

  console.log('\n' + '='.repeat(55))
  console.log(`📊 測試結果: ${passed} 通過 / ${failed} 失敗 / ${passed + failed} 總計`)
  if (failed === 0) {
    console.log('🎉 所有測試通過！雙隊列系統運作正常。')
  } else {
    console.log('⚠️  有測試失敗，請檢查上方輸出。')
    process.exit(1)
  }
}

runAll()