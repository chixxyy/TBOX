const FINNHUB_TOKENS = (import.meta.env.VITE_FINNHUB_TOKEN as string || '').split(',').map(t => t.trim()).filter(Boolean);
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY as string;

/**
 * Returns a random Finnhub token from the available pool to balance quota usage.
 */
export function getFinnhubToken() {
  if (FINNHUB_TOKENS.length === 0) return '';
  const idx = Math.floor(Math.random() * FINNHUB_TOKENS.length);
  return FINNHUB_TOKENS[idx];
}

/**
 * Universal fetch wrapper with optional custom headers and caching
 */
const requestCache = new Map<string, { data: any, timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();

// Cache TTLs (news has NO cache — always fetch fresh):
const QUOTE_CACHE_TTL = 10000;   // 10s — prevent hammering same symbol
const ODDS_CACHE_TTL = 600000;   // 10 min — paid quota protection

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
    // Use token rotation for Finnhub to multiply quota
    finalUrl = `${finalUrl}${connector}token=${getFinnhubToken()}`;
  } else if (isOddsApi && !url.startsWith('/api')) {
    // Only append key if calling external Odds API directly (for local dev)
    const connector = finalUrl.includes('?') ? '&' : '?';
    finalUrl = `${finalUrl}${connector}apiKey=${ODDS_API_KEY}`;
  }

  const cacheKey = finalUrl;

  // Cache only for quotes and odds — news always bypasses cache
  if (!isNews && (isQuote || isOddsApi)) {
    const ttl = isOddsApi ? ODDS_CACHE_TTL : QUOTE_CACHE_TTL;

    // Memory cache (quotes only use memory — localStorage key collision bug with btoa truncation)
    const memCached = requestCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < ttl) {
      return memCached.data;
    }

    // LocalStorage cache — Odds API only (long-lived, URL is distinct enough)
    if (isOddsApi) {
      const storageKey = `tbox_odds_${btoa(url).slice(-20)}`;
      try {
        const lsRaw = localStorage.getItem(storageKey);
        if (lsRaw) {
          const lsCached = JSON.parse(lsRaw);
          if (Date.now() - lsCached.timestamp < ttl) {
            requestCache.set(cacheKey, lsCached);
            return lsCached.data;
          }
        }
      } catch (e) { /* ignore */ }
    }
  }

  // Dedup concurrent identical requests
  if (activeRequests.has(cacheKey)) {
    return activeRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
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
      
      // Specifically throw the error code if available (needed for Odds API quota check)
      const errorMsg = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
      const err: any = new Error(errorMsg);
      if (errorData.error_code) err.code = errorData.error_code;
      throw err;
    }

    const data = await response.json();

    // Save to memory cache for quotes and odds
    if (!isNews && (isQuote || isOddsApi)) {
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    // Save to localStorage for odds only
    if (isOddsApi) {
      const storageKey = `tbox_odds_${btoa(url).slice(-20)}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ data, timestamp: Date.now() }));
      } catch (e) { /* ignore */ }
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

  async getFinnhubMetric(symbol: string, metric: string = 'all') {
    return apiFetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=${metric}`);
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
