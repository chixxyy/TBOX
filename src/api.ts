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

// Throttle queue to prevent burst 429 errors (max 5 req/sec)
let lastFinnhubCall = 0;
let finnhubQueue = Promise.resolve();

function getFinnhubSlot() {
  finnhubQueue = finnhubQueue.then(async () => {
    const diff = Date.now() - lastFinnhubCall;
    if (diff < 200) await new Promise(resolve => setTimeout(resolve, 200 - diff));
    lastFinnhubCall = Date.now();
  });
  return finnhubQueue;
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const isFinnhub = url.includes('finnhub.io');

  let finalUrl = url;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Standardize Finnhub token back to Query String for Browser compatibility (CORS/Preflight)
  if (isFinnhub) {
    const connector = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${connector}token=${FINNHUB_TOKEN}`;
  }

  // NOTE: Do not set User-Agent header in browser as it is a forbidden header and causes fetch to fail.

  const cacheKey = finalUrl;
  
  // 1. Return from cache if Finnhub and within 15 seconds (reduced to allow real-time 30s polling)
  if (isFinnhub) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 15000) {
      return cached.data;
    }
  }

  // 2. Queue concurrent exact requests
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }

  // 3. Execute fetch with 429 safety fallback
  const fetchPromise = (async () => {
    if (isFinnhub) await getFinnhubSlot();
    const response = await fetch(finalUrl, { ...options, headers });

    if (response.status === 429) {
      console.warn(`[TBOX] API 流量限制 (429 Too Many Requests): ${url}。正在啟用降級保護...`);
      const staleCached = requestCache.get(cacheKey);
      if (staleCached) return staleCached.data;
      throw new Error('伺服器資源限制，請稍後再試 (Too Many Requests)');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error [${response.status}]:`, errorData);
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Save successful Finnhub requests to cache
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
