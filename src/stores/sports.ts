import { ref } from 'vue'
import { defineStore } from 'pinia'

interface PlayerStats {
  id: string
  name: string
  team: string
  teamId: string
  hitting?: any
  pitching?: any
  loading: boolean
  error?: string
  activeStatType?: 'hitting' | 'pitching'
  roles: ('hitting' | 'pitching')[]
}

export const useSportsStore = defineStore('sports', () => {
  const trackedPlayers = ref<PlayerStats[]>([])

  const initTrackedPlayers = async (): Promise<boolean> => {
    if (trackedPlayers.value.length > 0) return true;
    
    try {
      const CACHE_KEY = 'mlb_players_with_stats';
      const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
      const cachedStr = localStorage.getItem(CACHE_KEY);
      
      if (cachedStr) {
        const { data, timestamp } = JSON.parse(cachedStr);
        if (Date.now() - timestamp < CACHE_TTL && data && data.length > 0) {
          trackedPlayers.value = data;
          return true; // Loaded from cache
        }
      }

      const currentYear = new Date().getFullYear();
      const res = await fetch(`https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns,battingAverage,runsBattedIn,onBasePlusSlugging,earnedRunAverage,strikeOuts,wins,saves&statGroup=hitting,pitching&season=${currentYear}&limit=100`);
      const data = await res.json();
      
      const playersMap = new Map<string, PlayerStats>();
      
      for (const category of data.leagueLeaders || []) {
        const isPitching = category.statGroup === 'pitching';
        const role = isPitching ? 'pitching' : 'hitting';
        
        for (const leader of category.leaders || []) {
          const pId = String(leader.person.id);
          const teamId = String(leader.team?.id || '');
          const teamName = leader.team?.name || 'Unknown';
          const shortTeamMap: Record<string, string> = {
            "Los Angeles Dodgers": "LAD", "New York Yankees": "NYY", "Philadelphia Phillies": "PHI",
            "Baltimore Orioles": "BAL", "Atlanta Braves": "ATL", "Houston Astros": "HOU",
            "Cleveland Guardians": "CLE", "Milwaukee Brewers": "MIL", "San Diego Padres": "SD",
            "Minnesota Twins": "MIN", "Kansas City Royals": "KC", "Boston Red Sox": "BOS",
            "Arizona Diamondbacks": "ARI", "Seattle Mariners": "SEA", "New York Mets": "NYM",
            "Texas Rangers": "TEX", "Tampa Bay Rays": "TB", "Cincinnati Reds": "CIN",
            "St. Louis Cardinals": "STL", "Chicago Cubs": "CHC", "San Francisco Giants": "SF",
            "Detroit Tigers": "DET", "Pittsburgh Pirates": "PIT", "Washington Nationals": "WSH",
            "Toronto Blue Jays": "TOR", "Los Angeles Angels": "LAA", "Oakland Athletics": "OAK", "Athletics": "OAK",
            "Miami Marlins": "MIA", "Colorado Rockies": "COL", "Chicago White Sox": "CHW"
          };
          const displayTeam = shortTeamMap[teamName] || teamName;

          if (!playersMap.has(pId)) {
            playersMap.set(pId, {
              id: pId,
              name: leader.person.fullName,
              team: displayTeam,
              teamId: teamId,
              loading: false,
              activeStatType: role,
              roles: [role]
            });
          } else {
            const existing = playersMap.get(pId)!;
            if (!existing.roles.includes(role)) {
              existing.roles.push(role);
              if (existing.roles.includes('hitting') && existing.roles.includes('pitching')) {
                existing.activeStatType = 'hitting';
              }
            }
          }
        }
      }
      
      const teamGroups: Record<string, PlayerStats[]> = {};
      for (const player of playersMap.values()) {
        if (!teamGroups[player.teamId]) {
          teamGroups[player.teamId] = [];
        }
        teamGroups[player.teamId]!.push(player);
      }
      
      const finalPlayers: PlayerStats[] = [];
      for (const tId in teamGroups) {
        finalPlayers.push(...(teamGroups[tId] || []).slice(0, 5));
      }
      
      trackedPlayers.value = finalPlayers;
      return false; // Indicates stats need to be fetched
    } catch (error) {
      console.error('Failed to init tracked players:', error);
      return false;
    }
  }

  return {
    trackedPlayers,
    initTrackedPlayers
  }
})
