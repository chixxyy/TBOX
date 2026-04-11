const FINNHUB_TOKEN = import.meta.env.VITE_FINNHUB_TOKEN as string;
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY as string;

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
const ODDS_CACHE_TTL = 600000; // 10 minutes - Protect quota

async function apiFetch(url: string, options: RequestInit = {}) {
  const isFinnhub = url.includes('finnhub.io');
  const isNews = isFinnhub && url.includes('/news');
  const isQuote = isFinnhub && url.includes('/quote');
  const isOddsApi = url.includes('the-odds-api.com') || url.includes('/api/odds');

  let finalUrl = url;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (isFinnhub) {
    const connector = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${connector}token=${FINNHUB_TOKEN}`;
  } else if (isOddsApi && !url.startsWith('/api')) {
    // Only append key if calling external Odds API directly (for local dev)
    const connector = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${connector}apiKey=${ODDS_API_KEY}`;
  }

  const cacheKey = finalUrl;
  const storageKey = `tbox_cache_${btoa(cacheKey).slice(0, 32)}`; // Minimized safe key

  // Cache check hierarchy: Memory -> LocalStorage
  if (isFinnhub || isOddsApi) {
    let ttl = 10000;
    if (isNews) ttl = NEWS_CACHE_TTL;
    else if (isQuote) ttl = QUOTE_CACHE_TTL;
    else if (isOddsApi) ttl = ODDS_CACHE_TTL;

    // 1. Check Memory Cache
    const memCached = requestCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < ttl) {
      return memCached.data;
    }

    // 2. Check LocalStorage Cache (Shared across tabs/refreshes)
    try {
      const lsRaw = localStorage.getItem(storageKey);
      if (lsRaw) {
        const lsCached = JSON.parse(lsRaw);
        if (Date.now() - lsCached.timestamp < ttl) {
          // Re-populate memory cache
          requestCache.set(cacheKey, lsCached);
          return lsCached.data;
        }
      }
    } catch (e) { /* ignore LS errors */ }
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

    if (isFinnhub || isOddsApi) {
      const cacheEntry = { data, timestamp: Date.now() };
      requestCache.set(cacheKey, cacheEntry);
      try {
        localStorage.setItem(storageKey, JSON.stringify(cacheEntry));
      } catch (e) { /* ignore LS errors */ }
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
  },

  // The Odds API (Proxied for prod, Direct for local dev)
  async getMLBOdds() {
    if (import.meta.env.DEV) {
      return apiFetch(`https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?regions=us&markets=h2h&oddsFormat=decimal&bookmakers=draftkings,pinnacle,fanduel`);
    }
    return apiFetch(`/api/odds?league=mlb`);
  },

  async getNBAOdds() {
    if (import.meta.env.DEV) {
      return apiFetch(`https://api.the-odds-api.com/v4/sports/basketball_nba/odds/?regions=us&markets=h2h&oddsFormat=decimal&bookmakers=draftkings,pinnacle,fanduel`);
    }
    return apiFetch(`/api/odds?league=nba`);
  },

  // MLB Player Stats API
  async getPlayerStats(personId: string, season: number) {
    return apiFetch(`https://statsapi.mlb.com/api/v1/people/${personId}/stats?stats=season&group=hitting,pitching&season=${season}`);
  },

  // MLB Transactions API
  async getMlbTransactions(startDate: string, endDate: string) {
    return apiFetch(`https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=${startDate}&endDate=${endDate}`);
  },

  // ESPN Hidden API for Live Scores
  async getEspnScores(league: 'mlb' | 'nba') {
    const sport = league === 'nba' ? 'basketball' : 'baseball';
    return apiFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`);
  },

  // ESPN Standings API (Daily Cached)
  async getEspnStandings(league: 'mlb' | 'nba') {
    const sport = league === 'nba' ? 'basketball' : 'baseball';
    const dateStr = new Date().toISOString().split('T')[0];
    const cacheKey = `standings_${league}_${dateStr}`;
    
    // Check cache first
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch(e) {
      // Ignore parse err
    }

    // Fetch if not cached
    const data = await apiFetch(`https://site.api.espn.com/apis/v2/sports/${sport}/${league}/standings`);
    
    try {
      // Clean up old standings caches
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`standings_${league}_`) && key !== cacheKey) {
          localStorage.removeItem(key);
        }
      });
      // Save new cache
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch(e) {
      // LocalStorage might be full or blocked
    }
    
    return data;
  }
};
