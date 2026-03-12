const fetch = require('node-fetch');

async function test() {
  try {
    const res = await fetch('https://gamma-api.polymarket.com/events?closed=false&limit=5');
    const data = await res.json();
    console.log("Is Array?", Array.isArray(data));
    console.log("Length:", data.length);
    if(data.length > 0) {
      console.log("First item markets length:", data[0].markets?.length);
      if(data[0].markets?.length > 0) {
        console.log("First market outcomes:", data[0].markets[0].outcomes);
        console.log("First market prices:", data[0].markets[0].outcomePrices);
      }
    } else {
        console.log(data);
    }
  } catch(e) {
    console.error(e.message);
  }
}
test();
