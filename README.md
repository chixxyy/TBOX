# TradingBox 2.0

[![Live Demo](https://img.shields.io/badge/Live%20Demo-線上體驗-blue?style=for-the-badge&logo=vercel)](https://trading-box.vercel.app/)

---

## 🌟 核心進化功能

### 1. Gemini AI 智能速報 (AI Insights)

- **深度情緒分析**：整合 Google Gemini Pro，針對美股、加密貨幣提供即時情緒指數 (Sentiment Score)。
- **一鍵分享交流**：分析結果支援一鍵發送至全局討論區，自動生成專屬 AI 觀點卡片。
- **權限分級**：AI 分析功能為「會員專屬」，引導訪客註冊以獲取更高價值的投資建議。

### 2. 即時運彩賠率看板 (Sports Odds)

- **雙賽事監控**：即時抓取 MLB 與 NBA 官方賠率，包含對家盤口與分盤數據。
- **動態更新機制**：採用 1 小時自動刷新策略，並具備頁面休眠偵測以節省流量。
- **全方位資訊**：整合 ESPN 運動快訊，消除賽事資訊時差。

### 3. 全新討論區 2.0 (Supabase Realtime)

- **毫秒級同步**：基於 Supabase Realtime 頻道，實現無感知的訊息推送。
- **智能去重與修復**：徹底解決重複訊息問題，並優化了後端刪除邏輯 (RLS 加固)。
- **分析內容卡片**：針對 AI 分享內容與一般新聞連結，提供不同的視覺呈現與翻譯功能。

### 4. 智慧新聞優先級系統 (Priority News)

- **三級警報機制**：系統自動分析新聞標題與內容，將重要資訊標記為 `CRITICAL` (紅)、`HIGH` (橘) 或 `LOW` (藍)。
- **全域通知**：關鍵資訊 (CRITICAL) 將觸發頂部滾動條閃爍與全域 Toast 提示。

### 5. 持倉與提醒 (Mock Portfolio & Alerts)

- **雲端同步**：持倉數據與價格提醒全數雲端化，跨裝置即時存取。
- **重大異動警報**：當標的波動達 ±20% 時，發出顯著警告。

---

## 🚀 快速開始

### 環境變數配置

在根目錄建立 `.env.local` 並填入以下資訊：

```bash
VITE_SUPABASE_URL=你的_SUPABASE_網址
VITE_SUPABASE_ANON_KEY=你的_SUPABASE_金鑰
VITE_GEMINI_API_KEY=你的_GEMINI_API_KEY
```

### 安裝與啟動

```bash
npm install
npm run dev
```

### 健壯性檢查 (Code Quality)

```bash
# 執行 Knip 與 jscpd 檢查未使用的代碼與重複片段
npm run check
```

---

## 🧪 測試帳號

- **Email**: `test@test.com`
- **Password**: `test1234`
