async function test() {
  try {
    const url = 'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=10&order=volumeNum&ascending=false';
    
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" }
    });

    const data = await res.json();
    console.log(`✅ 成功抓取！全站交易量最大的前 ${data.length} 筆市場：\n`);

    data.slice(0, 3).forEach((market, i) => {
      console.log(`🔥 [熱門排行 #${i + 1}]`);
      console.log(`📌 題目: ${market.question}`);
      console.log(`💰 總交易量: $${Math.floor(market.volumeNum).toLocaleString()}`);
      console.log(`📊 原始機率資料 (outcomePrices):`, market.outcomePrices);
      console.log(`🏷️  標籤 (Tags):`, market.tags?.map(t => t.label).join(', '));
      console.log("--------------------------------------------------\n");
    });

  } catch(e) {
    console.error("❌ 錯誤:", e.message);
  }
}
test();