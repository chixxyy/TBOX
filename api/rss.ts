import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * ESPN RSS to JSON Proxy
 * 解決 api.rss2json.com 的 429 (Too Many Requests) 與 CORS 問題
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const rssUrl = 'https://www.espn.com/espn/rss/news';
    const response = await fetch(rssUrl);
    
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const xml = await response.text();
    const items: any[] = [];
    
    // 簡易 RSS XML 擷取器 (避免在 Serverless 環境安裝大型庫)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const content = match[1];
      const getTag = (tag: string) => {
        const m = content.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
        return m ? m[1] : '';
      };
      
      items.push({
        guid: getTag('guid'),
        link: getTag('link'),
        title: getTag('title').replace(/&amp;/g, '&'),
        description: getTag('description').replace(/<[^>]*>?/gm, '').replace(/&amp;/g, '&'),
        pubDate: getTag('pubDate')
      });
      
      if (items.length >= 15) break; // 只取最新 15 則
    }

    // 設定快取 5 分鐘，減輕後端與來源壓力
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.status(200).json({ status: 'ok', items });
    
  } catch (error: any) {
    console.error('[RSS Proxy Error]:', error.message);
    res.status(500).json({ status: 'error', message: error.message });
  }
}
