/**
 * Centralized API utility for TradingBox
 * Handles fetch logic for Polymarket, Finnhub, and Proxy endpoints.
 */

const FINNHUB_TOKEN = import.meta.env.VITE_FINNHUB_TOKEN as string;

/**
 * Universal fetch wrapper with optional custom headers
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
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

  const response = await fetch(finalUrl, { ...options, headers });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error(`API Error [${response.status}]:`, errorData);
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
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
