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

async function testOdds() {
  const apiKey = getEnvVar('VITE_ODDS_API_KEY');
  const url = `https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=decimal&bookmakers=draftkings,pinnacle,fanduel`;
  console.log('Fetching:', url);
  try {
    const res = await fetch(url);
    if (!res.ok) {
        console.error('API Error:', res.status, await res.text())
        return;
    }
    const data = await res.json();
    console.log(`Loaded ${data.length} games.`);
    if (data.length > 0) {
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('No games found currently.');
    }
  } catch (err) {
    console.error(err.message);
  }
}

testOdds();
