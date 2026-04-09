async function testMlbApi() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  // Fetch last 3 days to ensure we get data
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=${threeDaysAgo}&endDate=${today}`;
  
  console.log(`Checking MLB API: ${url}`);
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const transactions = data.transactions || [];
    
    console.log(`Successfully fetched ${transactions.length} transactions.`);
    
    if (transactions.length > 0) {
      const sample = transactions[0];
      console.log('--- Sample Transaction (Found Data!) ---');
      console.log(`Date: ${sample.date}`);
      console.log(`Type: ${sample.typeDesc}`);
      console.log(`Description: ${sample.description}`);
      console.log(`Person ID: ${sample.personId}`);
      console.log('--- Verification Done ---');
    } else {
      console.log('No transactions found in the last 3 days.');
    }
  } catch (e) {
    console.error('API Fetch Failed:', e.message);
  }
}

testMlbApi();
