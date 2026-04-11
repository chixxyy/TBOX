import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Get league from query
  const { league } = req.query;
  const sport = league === 'nba' ? 'basketball_nba' : 'baseball_mlb';
  
  // 2. Get API Key from Environment
  // Using the user's preferred variable name
  const apiKey = process.env.VITE_ODDS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      error: 'ODDS_API_KEY is not configured in Vercel environment variables.' 
    });
  }

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?regions=us&markets=h2h&oddsFormat=decimal&bookmakers=draftkings,pinnacle,fanduel&apiKey=${apiKey}`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `External API Error: ${errText}` });
    }

    const data = await response.json();

    /**
     * SHARED CACHE STRATEGY:
     * - s-maxage=600: Cache on Vercel Edge CDN for 10 minutes. 
     *   Multiple users will all hit the SAME cached data.
     * - stale-while-revalidate=3600: Allow serving stale data for up to 1 hour 
     *   while refreshing in the background.
     */
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('[API_ODDS] Fetch error:', error);
    return res.status(500).json({ error: 'Internal Server Error while fetching odds.' });
  }
}
