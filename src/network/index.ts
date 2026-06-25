const FINNHUB_TOKENS = (import.meta.env.VITE_FINNHUB_TOKEN as string || '').split(',').map(t => t.trim()).filter(Boolean);
const ODDS_API_KEY = import.meta.env.VITE_ODDS_API_KEY as string;

/**
 * Returns a Finnhub token from the available pool.
 * Supports random selection or deterministic rotation via index.
 */
export function getFinnhubToken(index?: number) {
  if (FINNHUB_TOKENS.length === 0) return '';
  const idx = index !== undefined 
    ? (index % FINNHUB_TOKENS.length) 
    : Math.floor(Math.random() * FINNHUB_TOKENS.length);
  return FINNHUB_TOKENS[idx];
}

/**
 * Universal fetch wrapper with optional custom headers and caching
 */
const requestCache = new Map<string, { data: any, timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();

// Cache TTLs:
const QUOTE_CACHE_TTL = 10000;   // 10s — prevent hammering same symbol
const ODDS_CACHE_TTL = 600000;   // 10 min — paid quota protection
const NEWS_CACHE_TTL = 60000;    // 60s — cache news to prevent rate-limiting

async function apiFetch(url: string, options: RequestInit = {}) {
  const isFinnhub = url.includes('finnhub.io');
  const isNews = isFinnhub && url.includes('/news');
  const isQuote = isFinnhub && url.includes('/quote');
  const isOddsApi = url.includes('the-odds-api.com') || url.includes('/api/odds');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Cache lookup using base url (agnostic of token rotations)
  const cacheKey = url;

  if (isQuote || isOddsApi || isNews) {
    const ttl = isOddsApi ? ODDS_CACHE_TTL : (isNews ? NEWS_CACHE_TTL : QUOTE_CACHE_TTL);

    // Memory cache
    const memCached = requestCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < ttl) {
      return memCached.data;
    }

    // LocalStorage cache — Odds API only
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

  const maxRetries = 3;

  const performFetch = async (attempt: number): Promise<any> => {
    let finalUrl = url;

    if (isFinnhub) {
      const connector = finalUrl.includes('?') ? '&' : '?';
      // Use token rotation with attempt-based offset to try different keys on retry
      finalUrl = `${finalUrl}${connector}token=${getFinnhubToken(attempt)}`;
    } else if (isOddsApi && !url.startsWith('/api')) {
      const connector = finalUrl.includes('?') ? '&' : '?';
      finalUrl = `${finalUrl}${connector}apiKey=${ODDS_API_KEY}`;
    }

    try {
      const response = await fetch(finalUrl, { ...options, headers });

      if (response.status === 429) {
        throw { status: 429, message: 'Rate limited' };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`API Error [${response.status}]:`, errorData);
        
        const errorMsg = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
        const err: any = new Error(errorMsg);
        err.status = response.status;
        if (errorData.error_code) err.code = errorData.error_code;
        throw err;
      }

      const data = await response.json();
      return data;
    } catch (err: any) {
      const isNetworkError = err instanceof TypeError || err.message === 'Failed to fetch';
      const isRateLimit = err.status === 429;

      if ((isRateLimit || isNetworkError) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;
        console.warn(`[TBOX] Fetch failed (${isRateLimit ? '429 Rate Limit' : 'Network Error'}). Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms for URL: ${url}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return performFetch(attempt + 1);
      }

      // If we exhausted retries, try to fall back to expired cache (graceful degradation)
      const staleCached = requestCache.get(cacheKey);
      if (staleCached) {
        console.warn(`[TBOX] Fetch failed after ${attempt} attempts. Falling back to stale cache for: ${url}`);
        return staleCached.data;
      }

      throw err;
    }
  };

  const fetchPromise = (async () => {
    const data = await performFetch(0);

    // Save to memory cache
    if (isQuote || isOddsApi || isNews) {
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
const api = {
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

  async getFinnhubEarningsCalendar(from: string, to: string, symbol?: string) {
    let url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}`;
    if (symbol) url += `&symbol=${symbol}`;
    return apiFetch(url);
  },

  async getFinnhubEarningsSurprises(symbol: string) {
    return apiFetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=4`);
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
  async getEspnScores(league: 'mlb' | 'nba', dateStr?: string) {
    const sport = league === 'nba' ? 'basketball' : 'baseball';
    const query = dateStr ? `?dates=${dateStr}` : '';
    return apiFetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard${query}`);
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

export { api };
export default api;
