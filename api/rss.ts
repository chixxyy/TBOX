import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ESPN RSS to JSON Proxy
 * 解決 api.rss2json.com 的 429 (Too Many Requests) 與 CORS 問題
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { u } = req.query;
    
    // 預設來源
    const defaultUrl = 'https://www.espn.com/espn/rss/news';
    let rssUrl = typeof u === 'string' ? decodeURIComponent(u) : defaultUrl;

    // 安全檢查：白名單過濾，防止 SSRF 攻擊
    const whitelist = [
      'espn.com',
      'yahoo.com',
      'bbci.co.uk',
      'coindesk.com',
      'cointelegraph.com',
      'reuters.com',
      'reutersagency.com',
      'cnbc.com',
      'forexlive.com',
      'investinglive.com'
    ];
    
    const isAllowed = whitelist.some(domain => rssUrl.includes(domain));
    if (!isAllowed) {
      rssUrl = defaultUrl;
    }

    const response = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/xml, text/xml, */*'
      }
    });
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const xml = await response.text();
    const items: any[] = [];
    
    // 簡易 RSS XML 擷取器
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const getTag = (tag: string) => {
        // 支援 <tag> 或 <dc:tag> 等格式
        const m = content.match(new RegExp(`<(${tag}|dc:${tag})[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/\\1>`, 'i'));
        return m ? m[2] : '';
      };
      
      items.push({
        guid: getTag('guid') || getTag('link'),
        link: getTag('link'),
        title: getTag('title').replace(/&amp;/g, '&').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
        description: getTag('description').replace(/<[^>]*>?/gm, '').replace(/&amp;/g, '&').replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'),
        pubDate: getTag('pubDate') || getTag('date')
      });
      
      if (items.length >= 50) break; // 提高抓取數量至50，以確保前端有足夠的新聞數量（至少200則）
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ status: 'ok', items });
    
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
}
