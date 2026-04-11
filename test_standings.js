fetch('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings')
  .then(r=>r.json())
  .then(d=>{
     console.log(d.children.map(c => c.name));
     if(d.children[0].standings) {
       console.log(d.children[0].standings.entries[0].team.displayName, d.children[0].standings.entries[0].stats.find(s=>s.name==='winPercent')?.value);
     }
  })
  .catch(console.error);
