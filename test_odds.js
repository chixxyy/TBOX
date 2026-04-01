async function testOdds() {
  const url = 'https://api.the-odds-api.com/v4/sports/baseball_mlb/odds/?apiKey=3eb79b6bc84fa6476843ae28b7a62bc6&regions=us&markets=h2h&oddsFormat=decimal&bookmakers=draftkings,pinnacle,fanduel';
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
