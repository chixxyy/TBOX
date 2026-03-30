/**
 * Centralized API utility for TradingBox
 * Handles fetch logic for Polymarket, Finnhub, and Proxy endpoints.
 */

const FINNHUB_TOKEN = import.meta.env.VITE_FINNHUB_TOKEN as string;

/**
 * Universal fetch wrapper with optional custom headers and caching
 */
const requestCache = new Map<string, { data: any, timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();

// Two INDEPENDENT throttle queues — news and quotes must not block each other
let lastNewsCall = 0;
let newsQueue = Promise.resolve();

let lastQuoteCall = 0;
let quoteQueue = Promise.resolve();

function makeThrottledSlot(getQueue: () => Promise<void>, setQueue: (p: Promise<void>) => void, getTime: () => number, setTime: (t: number) => void, minInterval: number) {
  const p = getQueue().then(async () => {
    const diff = Date.now() - getTime();
    if (diff < minInterval) await new Promise(r => setTimeout(r, minInterval - diff));
    setTime(Date.now());
  });
  setQueue(p);
  return p;
}

function getNewsSlot() {
  return makeThrottledSlot(
    () => newsQueue, p => { newsQueue = p }, () => lastNewsCall, t => { lastNewsCall = t }, 350
  );
}
function getQuoteSlot() {
  return makeThrottledSlot(
    () => quoteQueue, p => { quoteQueue = p }, () => lastQuoteCall, t => { lastQuoteCall = t }, 350
  );
}

// Cache TTLs:
// - News: 25s (slightly under 30s poll interval so each cycle is fresh)
// - Quotes: 10s (frequent updates for live price)
const NEWS_CACHE_TTL = 25000;
const QUOTE_CACHE_TTL = 10000;

async function apiFetch(url: string, options: RequestInit = {}) {
  const isFinnhub = url.includes('finnhub.io');
  const isNews = isFinnhub && url.includes('/news');
  const isQuote = isFinnhub && url.includes('/quote');

  let finalUrl = url;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (isFinnhub) {
    const connector = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${connector}token=${FINNHUB_TOKEN}`;
  }

  const cacheKey = finalUrl;

  // Cache check with appropriate TTL per request type
  if (isFinnhub) {
    const cached = requestCache.get(cacheKey);
    const ttl = isNews ? NEWS_CACHE_TTL : QUOTE_CACHE_TTL;
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  // Dedup concurrent identical requests
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    // Dispatch to the appropriate independent queue
    if (isNews) await getNewsSlot();
    else if (isQuote) await getQuoteSlot();

    const response = await fetch(finalUrl, { ...options, headers });

    if (response.status === 429) {
      console.warn(`[TBOX] Rate limited (429): ${url}`);
      const staleCached = requestCache.get(cacheKey);
      if (staleCached) return staleCached.data;
      throw new Error('Rate limited — please retry in a moment');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error [${response.status}]:`, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (isFinnhub) {
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  })();

  activeRequests.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    activeRequests.delete(cacheKey);
  }
}


/**
 * Specific helpers for common endpoints
 */
export const api = {
  // Polymarket Gamma API (via Vercel Rewrites or Vite Proxy)
  async getPolyEvents(params: string = 'closed=false&limit=50&active=true') {
    return apiFetch(`/polymarket/events?${params}`);
  },

  async getPolyMarkets(params: string = 'active=true&closed=false&limit=100') {
    return apiFetch(`/polymarket/markets?${params}`);
  },

  // Finnhub API
  async getFinnhubNews(category: string) {
    return apiFetch(`https://finnhub.io/api/v1/news?category=${category}`);
  },

  async getFinnhubQuote(symbol: string) {
    return apiFetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}`);
  }
};
