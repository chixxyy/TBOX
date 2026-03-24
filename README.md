# TradingBox

[![Live Demo](https://img.shields.io/badge/Live%20Demo-線上體驗-blue?style=for-the-badge&logo=vercel)](https://trading-box.vercel.app/)

現代化終端風格 (Terminal Style) 預測市場交易儀表板，深度整合 Polymarket 數據與多維度分析工具。

## 主要核心功能

### 1. 實時交易面板 (Trade)

- **整合圖表**：使用 TradingView Lightweight Charts 顯示即時價格走勢。
- **資產列表**：快速搜尋並切換加密貨幣、政治、股票等不同市場。
- **買賣介面**：緊湊的訂單與交易操作面版（Right Panel）。

### 2. 即時異動監控 (Movers)

- **排行勳章**：前三名自動標註並具備動態光暈呼吸燈效果。
- **Sparklines**：每個市場均附帶 24 小時極簡趨勢線，視覺化機率變化。
- **智能翻譯**：整合 MyMemory API，一鍵切換標題中英對照。
- **多維過濾**：可依據「快速上漲」、「極速下跌」或「高波動」進行篩選。

### 3. 動態新聞饋送 (News Feed)

- **全站監控**：同步 Polymarket 全站最新的重大新聞與推特消息。
- **嚴重度標籤**：自動辨識 Critical (紅色呼吸燈) 或重大事件。
- **分類導覽**：支援水平捲動的分類標籤，在手機端也能流暢過濾新聞。

### 4. 音效與反饋系統

- **多頻提示音**：為市場異動與新消息定制的 3 音符上行和聲 (Gain 0.5)。
- **測試新聞音效**：`testNewsSound()`
- **測試異動音效**：`testMoversSound()`
- **即時狀態**：每個頁面均有「最後更新時間」與「Live 狀態燈」。

### 5. 極致響應式設計 (RWD)

- **Mobile-First**：針對手機端深度優化的垂直布局與導覽控制。
- **橫向導覽**：所有工具列在小螢幕下自動轉為水平滑動，避免破版。
- **絲滑進度條**：手機端導航區移除原生捲軸，改為原生般滑順的全局捲動進度條。

### 6. 測試帳號

- 帳號：[test@test.com]
- 密碼：[test1234]

---

## 🚀 快速開始 & 可用指令

### 安裝相依套件

請確保您的環境已有 Node.js (建議 v18 以上)。

```bash
npm install
```

### 啟動本地開發伺服器

```bash
npm run dev
```

### 編譯與打包生產版本

```bash
npm run build
```

### 健壯性自動化檢查 (Code Quality Check)

這是一支我們自製的進階檢查指令，它會自動掃描專案內的多餘程式碼。
使用了 **Knip** 來捕捉未被使用到的 `import`、`export` 與未呼叫的套件；並使用 **jscpd** 來偵測重複的代碼片段。

```bash
npm run check
```

### 本地預覽打包結果

```bash
npm run preview
```
