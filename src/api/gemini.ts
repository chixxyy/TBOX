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
  // Prompt instructions: Return strict JSON, act as a professional but degen/humorous crypto/stock analyst.
  const prompt = `
你是一位專業、犀利且帶有一點幣圈/美股網路幽默感 (Degen style) 的金融分析師。
請針對以下資產進行極速的「AI 智能速報」分析。

【資產資訊】
- 代號：${symbol} (${marketType})
- 目前價格：$${currentPrice}

【近期市場頭條參考】(可斟酌使用)
${recentNews ? recentNews : '目前無重大新聞'}

【輸出要求】
請務必只回傳合法的 JSON 格式字串，不要包含任何 Markdown 格式標籤 (例如 \`\`\`json)，只需純淨的 JSON 物件。
格式如下：
{
  "score": 0到100的情緒分數(>50看漲，<50看跌，請依據常理判斷),
  "bull": ["看漲理由 1 (限 20 字內)", "看漲理由 2 (限 20 字內)", "看漲理由 3 (限 20 字內)"],
  "bear": ["看跌理由 1 (限 20 字內)", "看跌理由 2 (限 20 字內)", "看跌理由 3 (限 20 字內)"],
  "summary": "一句話總結目前的市場氛圍 (例如：準備 To the moon！ 或 建議先去麥當勞打工)"
}
`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
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

    return JSON.parse(contentText) as AIAnalysisResult
  } catch (error) {
    console.error('AI Analysis failed:', error)
    throw error
  }
}
