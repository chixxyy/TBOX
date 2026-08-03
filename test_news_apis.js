
import fs from 'fs';
import path from 'path';

function getEnvVar(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve('.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
      if (match) return match[1].split(',')[0].trim();
    }
  } catch (e) {}
  return '';
}

const FINNHUB_TOKEN = getEnvVar('VITE_FINNHUB_TOKEN');

async function testApi(name, url) {
  console.log(`Testing ${name}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.error(`❌ ${name} Failed: HTTP ${res.status}`);
        return false;
    }
    const data = await res.json();
    console.log(`✅ ${name} Success! Items found: ${Array.isArray(data) ? data.length : (data.Data?.length || data.items?.length || data.transactions?.length || 0)}`);
    return true;
  } catch (err) {
    console.error(`❌ ${name} Error:`, err.message);
    return false;
  }
}

async function runTests() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  await testApi('Finnhub (General)', `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_TOKEN}`);
  await testApi('Finnhub (Crypto)', `https://finnhub.io/api/v1/news?category=crypto&token=${FINNHUB_TOKEN}`);
  await testApi('CoinTelegraph (via rss2json)', `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://cointelegraph.com/rss')}`);
  await testApi('ESPN (via rss2json)', `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent('https://www.espn.com/espn/rss/news')}`);
  await testApi('MLB Transactions', `https://statsapi.mlb.com/api/v1/transactions?sportId=1&startDate=${threeDaysAgo}&endDate=${today}`);
}

runTests();
