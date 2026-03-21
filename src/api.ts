/**
 * Centralized API utility for TradingBox
 * Handles fetch logic for Polymarket, Finnhub, and Proxy endpoints.
 */

const FINNHUB_TOKEN = import.meta.env.VITE_FINNHUB_TOKEN as string;

/**
 * Universal fetch wrapper with optional custom headers
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const isPolymarket = url.includes('/polymarket');
  const isFinnhub = url.includes('finnhub.io');

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Standardize Finnhub token to Headers as requested
  if (isFinnhub) {
    headers['X-Finnhub-Token'] = FINNHUB_TOKEN;
    // Remove token from query string if present to avoid overlap
    url = url.replace(/&token=[^&]+/, '').replace(/\?token=[^&]+/, '');
  }

  // Polymarket requires specific User-Agent sometimes (gamma-api)
  if (isPolymarket) {
    headers['User-Agent'] = 'TradingBox-App/1.0';
  }

  const response = await fetch(url, { ...options, headers });

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
