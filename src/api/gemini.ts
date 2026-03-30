import { globalNews } from '../store'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

export interface AIAnalysisResult {
  score: number
  bull: string[]
  bear: string[]
  summary: string
}

export async function analyzeAsset(symbol: string, currentPrice: number, marketType: 'crypto' | 'stock' = 'crypto'): Promise<AIAnalysisResult> {
  if (!GEMINI_API_KEY) {
    throw new Error('未設定 VITE_GEMINI_API_KEY，請確認 .env.local')
  }

  // 1. Gather recent news
  const recentNews = globalNews.value
    .slice(0, 10)
    .map(n => `- ${n.headline}`)
    .join('\n')

  // 2. Build the prompt
  const prompt = `
你是一位專業、犀利且帶有一點幣圈/美股網路幽默感 (Degen style) 的金融分析師。
請針對這筆資產進行極速的「AI 智能速報」分析。

【資產資訊】
- 代號：${symbol} (${marketType})
- 目前價格：$${currentPrice}

【近期市場頭條參考】
${recentNews ? recentNews : '雷達目前無重大新聞，靠技術面或信仰支撐。'}

請直接以 JSON 格式回覆：包含 score (0-100情緖指標), bull (3點看漲理由), bear (3點看跌理由), summary (一句話總結)。
`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: {
              score: { type: "INTEGER", description: "0到100的情緒分數，大於50看漲，小於50看跌" },
              bull: { type: "ARRAY", items: { type: "STRING" }, description: "3個看漲理由(每個少於20字)" },
              bear: { type: "ARRAY", items: { type: "STRING" }, description: "3個看跌理由(每個少於20字)" },
              summary: { type: "STRING", description: "一句話帶有幽默感的總結評價" }
            },
            required: ["score", "bull", "bear", "summary"]
          }
        }
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API 錯誤: ${response.status} ${errText}`)
    }

    const data = await response.json()
    const contentText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!contentText) {
      throw new Error('未獲取到 AI 分析結果')
    }

    // 防禦性清理：去除可能被硬插進來的 Markdown 標記
    const cleanJsonStr = contentText.replace(/^```json\s*/, '').replace(/\s*```$/, '').trim()
    
    return JSON.parse(cleanJsonStr) as AIAnalysisResult
  } catch (error) {
    console.error('AI Analysis failed:', error)
    throw new Error('AI 分析暫時遇到格式問題，請再試一次！')
  }
}
