<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '../api'
import { showToast, trackedPlayers, setScrollProgress } from '../store'

interface Outcome { name: string; price: number }
interface Market { key: string; outcomes: Outcome[] }
interface Bookmaker { key: string; title: string; markets: Market[] }
interface Game {
  id: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Bookmaker[]
}

// ── MLB logo map (ESPN CDN) ──
const espnMlbMap: Record<string, string> = {
  "Arizona Diamondbacks": "ari", "Atlanta Braves": "atl", "Baltimore Orioles": "bal",
  "Boston Red Sox": "bos", "Chicago Cubs": "chc", "Chicago White Sox": "chw",
  "Cincinnati Reds": "cin", "Cleveland Guardians": "cle", "Colorado Rockies": "col",
  "Detroit Tigers": "det", "Houston Astros": "hou", "Kansas City Royals": "kc",
  "Los Angeles Angels": "laa", "Los Angeles Dodgers": "lad", "Miami Marlins": "mia",
  "Milwaukee Brewers": "mil", "Minnesota Twins": "min", "New York Mets": "nym",
  "New York Yankees": "nyy", "Oakland Athletics": "oak", "Athletics": "oak",
  "Philadelphia Phillies": "phi", "Pittsburgh Pirates": "pit", "San Diego Padres": "sd",
  "San Francisco Giants": "sf", "Seattle Mariners": "sea", "St. Louis Cardinals": "stl",
  "Tampa Bay Rays": "tb", "Texas Rangers": "tex", "Toronto Blue Jays": "tor",
  "Washington Nationals": "wsh"
}

// ── NBA logo map (ESPN CDN) ──
const espnNbaMap: Record<string, string> = {
  "Atlanta Hawks": "atl", "Boston Celtics": "bos", "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha", "Chicago Bulls": "chi", "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal", "Denver Nuggets": "den", "Detroit Pistons": "det",
  "Golden State Warriors": "gs", "Houston Rockets": "hou", "Indiana Pacers": "ind",
  "LA Clippers": "lac", "Los Angeles Clippers": "lac", "Los Angeles Lakers": "lal",
  "Memphis Grizzlies": "mem", "Miami Heat": "mia", "Milwaukee Bucks": "mil",
  "Minnesota Timberwolves": "min", "New Orleans Pelicans": "no", "New York Knicks": "ny",
  "Oklahoma City Thunder": "okc", "Orlando Magic": "orl", "Philadelphia 76ers": "phi",
  "Phoenix Suns": "phx", "Portland Trail Blazers": "por", "Sacramento Kings": "sac",
  "San Antonio Spurs": "sa", "Toronto Raptors": "tor", "Utah Jazz": "utah",
  "Washington Wizards": "wsh"
}

const getMlbLogo = (name: string) => {
  const abbr = espnMlbMap[name]
  return abbr
    ? `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/${abbr}.png`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name.split(' ').slice(-2).join(' '))}&background=1e293b&color=fff&bold=true`
}

const getNbaLogo = (name: string) => {
  const abbr = espnNbaMap[name]
  return abbr
    ? `https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/${abbr}.png`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(name.split(' ').slice(-2).join(' '))}&background=1e293b&color=fff&bold=true`
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / 3600000
  if (diff < 0 && diff > -4) return '進行中 🔴'
  if (diff <= -4) return '已結束'
  if (diff < 24) return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')} 開打`
  return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

const getOdds = (game: Game, team: string) => {
  const prices: number[] = []
  game.bookmakers.forEach(bm => {
    const h2h = bm.markets.find(m => m.key === 'h2h')
    if (h2h) {
      const o = h2h.outcomes.find(o => o.name === team)
      if (o) prices.push(o.price)
    }
  })
  if (!prices.length) return '-'
  return (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)
}

const getOddsStyle = (odds: string) => {
  if (odds === '-') return { bg: 'bg-slate-800', text: 'text-slate-500 border-slate-700' }
  const prob = (1 / parseFloat(odds)) * 100
  if (prob >= 60) return { bg: 'bg-green-500/20', text: 'text-green-400 border-green-500/50' }
  if (prob >= 40) return { bg: 'bg-blue-500/20', text: 'text-blue-400 border-blue-500/50' }
  return { bg: 'bg-red-500/20', text: 'text-red-400 border-red-500/50' }
}

// Normalized implied win probability (removes bookmaker vig)
const getWinProb = (game: Game, awayTeam: string, homeTeam: string): { away: number, home: number } => {
  const awayOddsStr = getOdds(game, awayTeam)
  const homeOddsStr = getOdds(game, homeTeam)
  if (awayOddsStr === '-' || homeOddsStr === '-') return { away: 50, home: 50 }

  const awayImplied = 1 / parseFloat(awayOddsStr)
  const homeImplied = 1 / parseFloat(homeOddsStr)
  const total = awayImplied + homeImplied

  return {
    away: Math.round((awayImplied / total) * 100),
    home: Math.round((homeImplied / total) * 100)
  }
}

// ── Data / Loading ──
const mlbGames = ref<Game[]>([])
const nbaGames = ref<Game[]>([])
const mlbLoading = ref(true)
const nbaLoading = ref(true)
const mlbError = ref('')
const nbaError = ref('')
const activeLeague = ref<'MLB' | 'NBA' | '球員'>('MLB')
const lastUpdateStr = ref('')

// ── Player Sub-filter ──
const currentYear = new Date().getFullYear()
const playerTypeFilter = ref<'all' | 'hitting' | 'pitching'>('all')

let rafId: number | null = null
const handleScroll = (e: Event) => {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const el = e.target as HTMLElement
    const scrollMax = el.scrollHeight - el.clientHeight
    if (scrollMax <= 0) {
      setScrollProgress(0)
    } else {
      const progress = (el.scrollTop / scrollMax) * 100
      setScrollProgress(progress)
    }
  })
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

const filteredTrackedPlayers = computed(() => {
  if (playerTypeFilter.value === 'all') return trackedPlayers.value
  return trackedPlayers.value.filter(p => p.roles.includes(playerTypeFilter.value as 'hitting' | 'pitching'))
})

// Group players by team
const groupedPlayers = computed(() => {
  const groups: Record<string, any[]> = {}
  filteredTrackedPlayers.value.forEach(player => {
    if (!groups[player.team]) {
      groups[player.team] = []
    }
    groups[player.team].push(player)
  })
  // Sort teams alphabetically
  return Object.keys(groups).sort().reduce((acc, team) => {
    acc[team] = groups[team]
    return acc
  }, {} as Record<string, any[]>)
})

const lastRefreshTime = ref(0)
const fetchPlayerStats = async (isManual = false) => {
  if (isManual) {
    const now = Date.now()
    const cooldown = 10 * 60 * 1000 // 10 mins
    if (now - lastRefreshTime.value < cooldown) {
      showToast('已是最新資料', '為避免系統負載過重，請稍後再試。')
      return
    }
    lastRefreshTime.value = now
  }

  for (const p of trackedPlayers.value) {
    p.loading = true
    p.error = ''
    try {
      // 1. Try to fetch Current Season Stats dynamically
      const resLive = await fetch(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=season&season=${currentYear}&group=hitting,pitching`)
      const dataLive = await resLive.json()
      
      let foundCurrent = false
      if (dataLive.stats && dataLive.stats.length > 0) {
        const hitting = dataLive.stats.find((s:any) => s.group.displayName === 'hitting')?.splits?.[0]
        const pitching = dataLive.stats.find((s:any) => s.group.displayName === 'pitching')?.splits?.[0]
        
        if (hitting || pitching) {
          if (hitting) p.hitting = { ...hitting.stat, year: String(currentYear) }
          if (pitching) p.pitching = { ...pitching.stat, year: String(currentYear) }
          foundCurrent = true
        }
      }

      // 2. Fallback to YearByYear if current season data is completely missing
      if (!foundCurrent) {
        const resHistory = await fetch(`https://statsapi.mlb.com/api/v1/people/${p.id}/stats?stats=yearByYear&group=hitting,pitching`)
        const dataHistory = await resHistory.json()
        if (dataHistory.stats) {
          const hittingGroup = dataHistory.stats.find((s:any) => s.group.displayName === 'hitting')
          const pitchingGroup = dataHistory.stats.find((s:any) => s.group.displayName === 'pitching')
          if (hittingGroup?.splits?.length) {
            const last = hittingGroup.splits[hittingGroup.splits.length - 1]
            p.hitting = { ...last.stat, year: last.year }
          }
          if (pitchingGroup?.splits?.length) {
            const last = pitchingGroup.splits[pitchingGroup.splits.length - 1]
            p.pitching = { ...last.stat, year: last.year }
          }
        }
      }
      
      // Auto-select based on what data is available if not strictly dual
      if (!p.hitting && p.pitching) p.activeStatType = 'pitching'
      if (p.hitting && !p.pitching) p.activeStatType = 'hitting'
    } catch (err) {
      p.error = '無法取得即時成績'
    } finally {
      p.loading = false
    }
  }
}

type SortMode = 'time' | 'prob_desc' | 'alpha'
const sortMode = ref<SortMode>('time')

const sortModes: { key: SortMode; label: string; icon: string }[] = [
  { key: 'time',      label: '開賽',    icon: '🕐' },
  { key: 'prob_desc', label: '勝率',  icon: '📉' },
  { key: 'alpha',     label: '字母',   icon: '🔤' },
]

const currentSort = computed(() => sortModes.find(s => s.key === sortMode.value)!)

const cycleSort = () => {
  const idx = sortModes.findIndex(s => s.key === sortMode.value)
  sortMode.value = sortModes[(idx + 1) % sortModes.length]!.key
}

// Get the max win probability from a game (used for sorting)
const getMaxProb = (game: Game) => {
  const awayOdds = getOdds(game, game.away_team)
  const homeOdds = getOdds(game, game.home_team)
  if (awayOdds === '-' || homeOdds === '-') return 50
  const a = 1 / parseFloat(awayOdds)
  const h = 1 / parseFloat(homeOdds)
  return Math.round((Math.max(a, h) / (a + h)) * 100)
}

const applySort = (games: Game[]) => {
  const copy = [...games]
  switch (sortMode.value) {
    case 'prob_desc': return copy.sort((a, b) => getMaxProb(b) - getMaxProb(a))
    case 'alpha':     return copy.sort((a, b) => a.away_team.localeCompare(b.away_team))
    default:          return copy.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime())
  }
}

const sortedMlbGames = computed(() => applySort(mlbGames.value))
const sortedNbaGames = computed(() => applySort(nbaGames.value))

const fetchAll = async () => {
  mlbLoading.value = true
  nbaLoading.value = true
  mlbError.value = ''
  nbaError.value = ''

  const [mlb, nba] = await Promise.allSettled([api.getMLBOdds(), api.getNBAOdds()])

  if (mlb.status === 'fulfilled') {
    mlbGames.value = mlb.value
  } else {
    mlbError.value = (mlb.reason as Error).message || '無法取得 MLB 資料'
  }
  mlbLoading.value = false

  if (nba.status === 'fulfilled') {
    nbaGames.value = nba.value
  } else {
    nbaError.value = (nba.reason as Error).message || '無法取得 NBA 資料'
  }
  nbaLoading.value = false
  
  const now = new Date()
  lastUpdateStr.value = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

// Predict season progress dynamically based on current date
const getSeasonProgress = (league: 'MLB' | 'NBA') => {
  const now = new Date()
  const year = now.getFullYear()
  
  if (league === 'NBA') {
    // Dynamic NBA Logic: Previous Year Oct to Current Year April
    const start = new Date(year - 1, 9, 21).getTime()
    const end = new Date(year, 3, 12).getTime()
    if (now.getTime() > end) return { played: 82, total: 82, status: '季後賽' }
    if (now.getTime() < start) return { played: 0, total: 82, status: '休賽季' }
    const totalDays = (end - start) / (1000 * 3600 * 24)
    const currentDays = (now.getTime() - start) / (1000 * 3600 * 24)
    let played = Math.round((currentDays / totalDays) * 82)
    return { played: Math.min(played, 82), total: 82, status: played >= 78 ? '季末/季後賽' : '例行賽' }
  } else {
    // Dynamic MLB Logic: Current Year March to Sep
    const start = new Date(year, 2, 26).getTime()
    const end = new Date(year, 8, 27).getTime()
    if (now.getTime() > end) return { played: 162, total: 162, status: '季後賽' }
    if (now.getTime() < start) return { played: 0, total: 162, status: '休賽季' }
    const totalDays = (end - start) / (1000 * 3600 * 24)
    const currentDays = (now.getTime() - start) / (1000 * 3600 * 24)
    let played = Math.round((currentDays / totalDays) * 162)
    return { played: Math.max(1, Math.min(played, 162)), total: 162, status: '例行賽' }
  }
}

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchAll()
  fetchPlayerStats()
  autoRefreshTimer = setInterval(() => {
    if (!document.hidden) {
      fetchAll()
    }
  }, 3600000) // 1 hour
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300">

    <!-- Stats Header (Adaptive) -->
    <div class="h-16 md:h-20 border-b border-slate-800 flex items-center px-1.5 md:px-6 space-x-1 md:space-x-3 shrink-0 bg-[#0a0f1c] w-full overflow-hidden">
      
      <!-- Box 1: Overall Title -->
      <div class="flex-1 flex items-center space-x-1 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-1.5 md:px-4 py-1.5 md:py-2.5 min-w-0">
        <div class="w-6 h-6 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">即時更新</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">運彩賠率</div>
        </div>
      </div>

      <!-- Box 2: MLB Stats -->
      <div class="flex-1 flex items-center space-x-1 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-1.5 md:px-4 py-1.5 md:py-2.5 min-w-0" title="MLB 賽季進度">
        <div class="w-6 h-6 md:w-9 md:h-9 rounded-full bg-blue-900/30 border border-blue-800/50 flex items-center justify-center shrink-0">
          <span class="text-[12px] md:text-[16px] leading-none text-blue-400 opacity-80 backdrop-grayscale">⚾</span>
        </div>
        <div class="min-w-0">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate">MLB 賽季</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none">{{ getSeasonProgress('MLB').played }} <span class="text-[8px] md:text-[10px] text-slate-500">/ 162</span></div>
        </div>
      </div>

      <!-- Box 3: NBA Stats -->
      <div class="flex-1 flex items-center space-x-1 md:space-x-4 bg-[#111827] border border-slate-800 rounded-lg px-1.5 md:px-4 py-1.5 md:py-2.5 min-w-0 relative" title="NBA 賽季進度">
        <div class="w-6 h-6 md:w-9 md:h-9 rounded-full bg-orange-900/30 border border-orange-800/50 flex items-center justify-center shrink-0">
          <span class="text-[12px] md:text-[16px] leading-none text-orange-400 opacity-80">🏀</span>
        </div>
        <div class="min-w-0 relative flex-1">
          <div class="text-[8px] md:text-[10px] text-slate-500 font-mono tracking-widest uppercase truncate mb-0.5">NBA 賽季</div>
          <div class="text-white font-bold text-xs md:text-lg leading-none whitespace-nowrap">{{ getSeasonProgress('NBA').played }} <span class="text-[8px] md:text-[10px] text-slate-500 font-normal">/ 82</span></div>
          <span v-if="getSeasonProgress('NBA').status.includes('季後賽')" class="absolute -top-1 -right-0.5 md:-top-5 md:right-0 text-[6px] md:text-[8px] bg-red-500/20 text-red-500 px-1 py-0.5 rounded border border-red-500/30 font-black animate-pulse whitespace-nowrap">季後賽</span>
        </div>
      </div>

      <!-- Live badge & Sort -->
      <div class="hidden lg:flex flex-col items-end shrink-0 ml-auto justify-center">
        <div class="flex items-center space-x-2 bg-green-900/20 border border-green-800/50 rounded-full px-4 py-1.5 mb-1">
          <span class="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          <span class="text-green-400 font-bold text-[11px] tracking-wide uppercase">ODDS LIVE</span>
        </div>
        <div class="flex items-center justify-end w-full mt-1">
          <span class="text-[10px] text-slate-500 font-mono flex items-center">最後更新: {{ lastUpdateStr }}</span>
        </div>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="min-h-11 md:h-12 border-b border-slate-800 flex items-center px-1.5 md:px-6 shrink-0 bg-[#0a0f1c] w-full">
      <div class="flex w-full items-center overflow-x-auto no-scrollbar flex-nowrap">
        <button 
          v-for="league in (['MLB', 'NBA', '球員'] as const)"
          :key="league"
          @click="activeLeague = league"
          class="flex-1 min-w-[max-content] h-11 md:h-12 px-3 md:px-4 border-b-2 transition-colors relative text-[10px] md:text-[13px] font-bold whitespace-nowrap text-center shrink-0"
          :class="activeLeague === league ? 'border-blue-400 text-white bg-blue-400/5' : 'border-transparent text-slate-500 hover:text-slate-300'"
        >
          <span class="mr-1 md:mr-2 inline-block">{{ league === 'MLB' ? '⚾' : (league === 'NBA' ? '🏀' : '🌟') }}</span>
          {{ league }}
        </button>
      </div>
    </div>

    <!-- Scrollable Body -->
    <div @scroll="handleScroll" class="flex-1 overflow-y-auto px-4 pb-20 scrollbar-hide">

      <!-- ===== Players Tab ===== -->
      <template v-if="activeLeague === '球員'">
        <div class="mt-4 mb-3 flex items-center gap-2">
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-lg">🌟</span>
            <h2 class="text-sm font-black text-slate-400 tracking-widest uppercase">MLB 關注球員</h2>
          </div>
          
          <div class="flex-1 h-px bg-slate-800 ml-1 mr-2"></div>

          <!-- Player Sub-Filter -->
          <div class="flex items-center bg-[#0a0f1c] border border-slate-800 p-0.5 rounded-lg shrink-0">
            <button 
              v-for="f in ([{k:'all', l:'全部'}, {k:'hitting', l:'打者'}, {k:'pitching', l:'投手'}] as const)"
              :key="f.k"
              @click="playerTypeFilter = f.k"
              class="px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all whitespace-nowrap"
              :class="playerTypeFilter === f.k ? 'bg-blue-500/10 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'"
            >
              {{ f.l }}
            </button>
          </div>
        </div>

        <div class="space-y-8">
          <div v-for="(players, team) in groupedPlayers" :key="team" class="space-y-4">
            <!-- Team Header -->
            <div class="flex items-center gap-3">
              <div class="bg-blue-600 px-3 py-1 rounded-md text-[10px] font-black text-white shadow-lg shadow-blue-500/20">{{ team }}</div>
              <div class="flex-1 h-px bg-slate-800/50"></div>
              <div class="text-[10px] text-slate-500 font-mono">{{ players.length }} 員</div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="player in players" :key="player.id" class="flex flex-col bg-[#0a0f1c] border border-blue-900/10 rounded-xl overflow-hidden shadow-lg relative hover:border-blue-500/30 transition-all group">
                <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-50 pointer-events-none"></div>
                
                <div class="flex items-center p-4 border-b border-slate-800/80">
                  <img :src="`https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${player.id}/headshot/67/current`" class="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 object-cover mr-4 group-hover:border-blue-500/50 transition-colors" />
                  <div class="flex-1 flex flex-col sm:flex-row sm:items-center justify-between mr-2">
                    <div>
                      <h3 class="text-white font-bold">{{ player.name }}</h3>
                      <span class="text-xs text-blue-400 font-black tracking-widest">{{ player.team }}</span>
                    </div>
                    <!-- Toggle Button -->
                    <div v-if="player.hitting && player.pitching" class="bg-black/40 p-0.5 rounded-lg flex items-center border border-slate-800 mt-2 sm:mt-0 w-max">
                      <button @click="player.activeStatType = 'hitting'" :class="player.activeStatType === 'hitting' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'" class="px-2 py-1 text-[9px] font-bold uppercase rounded transition-all">打擊</button>
                      <button @click="player.activeStatType = 'pitching'" :class="player.activeStatType === 'pitching' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'" class="px-2 py-1 text-[9px] font-bold uppercase rounded transition-all">投球</button>
                    </div>
                  </div>
                  <button @click="fetchPlayerStats(true)" class="p-1.5 text-slate-500 hover:text-white rounded transition-colors self-start sm:self-auto" title="重新整理">
                    <svg v-if="player.loading" class="animate-spin w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                  </button>
                </div>

                <div class="p-4 flex-1">
                  <div v-if="player.loading && !player.hitting && !player.pitching" class="flex justify-center items-center py-6">
                    <span class="text-slate-500 text-xs text-center border border-slate-800/50 bg-slate-900/50 rounded w-full py-4 animate-pulse">載入數據中...</span>
                  </div>
                  
                  <div v-else-if="player.error" class="flex justify-center items-center py-6 text-red-400 text-xs text-center border border-red-500/20 bg-red-500/5 rounded">
                    {{ player.error }}
                  </div>

                  <div v-else class="space-y-4">
                    <!-- Hitting Stats -->
                    <div v-if="player.hitting && player.activeStatType === 'hitting'">
                      <h4 class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-800 pb-1 flex justify-between">
                        <span>打擊成績 (Hitting)</span>
                        <span class="text-blue-400/80">{{ player.hitting.year }} 賽季</span>
                      </h4>
                      <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="bg-blue-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">AVG</p><p class="text-sm font-black text-white">{{ player.hitting.avg || '.000' }}</p></div>
                        <div class="bg-blue-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">HR</p><p class="text-sm font-black text-rose-400">{{ player.hitting.homeRuns || '0' }}</p></div>
                        <div class="bg-blue-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">RBI</p><p class="text-sm font-black text-emerald-400">{{ player.hitting.rbi || '0' }}</p></div>
                        <div class="bg-blue-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">G (場次)</p><p class="text-xs font-black text-slate-300">{{ player.hitting.gamesPlayed || '0' }}</p></div>
                        <div class="bg-blue-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">AB (打數)</p><p class="text-xs font-black text-slate-300">{{ player.hitting.atBats || '0' }}</p></div>
                        <div class="bg-blue-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">OPS</p><p class="text-xs font-black text-sky-400">{{ player.hitting.ops || '.000' }}</p></div>
                      </div>
                    </div>

                    <!-- Pitching Stats -->
                    <div v-if="player.pitching && player.activeStatType === 'pitching'">
                      <h4 class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-800 pb-1 flex justify-between">
                        <span>投球成績 (Pitching)</span>
                        <span class="text-indigo-400/80">{{ player.pitching.year }} 賽季</span>
                      </h4>
                      <div class="grid grid-cols-3 gap-2 text-center">
                        <div class="bg-indigo-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">ERA</p><p class="text-sm font-black text-rose-400">{{ player.pitching.era || '0.00' }}</p></div>
                        <div class="bg-indigo-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">W-L</p><p class="text-sm font-black text-white">{{ player.pitching.wins || '0' }}-{{ player.pitching.losses || '0' }}</p></div>
                        <div class="bg-indigo-900/10 rounded-lg py-2"><p class="text-[9px] text-slate-500 font-bold uppercase">SO</p><p class="text-sm font-black text-emerald-400">{{ player.pitching.strikeOuts || '0' }}</p></div>
                        <div class="bg-indigo-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">G (場次)</p><p class="text-xs font-black text-slate-300">{{ player.pitching.gamesPlayed || '0' }}</p></div>
                        <div class="bg-indigo-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">IP (局數)</p><p class="text-xs font-black text-slate-300">{{ player.pitching.inningsPitched || '0.0' }}</p></div>
                        <div class="bg-indigo-900/5 border border-slate-800/50 rounded-lg py-1.5"><p class="text-[8px] text-slate-600 font-bold uppercase">WHIP</p><p class="text-xs font-black text-sky-400">{{ player.pitching.whip || '0.00' }}</p></div>
                      </div>
                    </div>

                    <div v-if="!player.hitting && !player.pitching" class="text-center text-slate-500 text-xs py-4 border border-slate-800/40 rounded-lg bg-slate-900/20">
                      尚未有本賽季數據
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== MLB Tab ===== -->
      <template v-if="activeLeague === 'MLB'">
        <div class="mt-4 mb-3 flex items-center gap-2">
          <span class="text-lg">⚾</span>
          <h2 class="text-sm font-black text-slate-400 tracking-widest uppercase">MLB 美國職棒</h2>
          <div class="flex-1 h-px bg-slate-800 ml-1 mr-2"></div>
          
          <!-- Sort Toggle (MLB) -->
          <button @click="cycleSort" class="flex items-center space-x-1.5 px-2 py-1 bg-[#111827] border border-slate-700 rounded-md transition-all hover:border-blue-500 group active:scale-95">
            <span class="text-xs">{{ currentSort.icon }}</span>
            <span class="text-[11px] font-black text-slate-400 group-hover:text-blue-400 uppercase tracking-tight">{{ currentSort.label }}</span>
          </button>
        </div>

        <!-- MLB Loading -->
        <div v-if="mlbLoading" class="flex items-center gap-3 py-8 justify-center text-slate-500">
          <div class="w-5 h-5 rounded-full border-2 border-slate-700 border-t-blue-400 animate-spin"></div>
          <span class="text-sm font-medium">載入中...</span>
        </div>

        <!-- MLB Error -->
        <div v-else-if="mlbError" class="py-6 text-center text-red-400 text-sm">⚠️ {{ mlbError }}</div>

        <!-- MLB Empty -->
        <div v-else-if="mlbGames.length === 0"
          class="py-8 flex flex-col items-center gap-2 bg-slate-900/40 rounded-2xl border border-slate-800 text-center">
          <span class="text-4xl">⚾</span>
          <p class="text-slate-500 font-bold text-sm">目前無 MLB 賽事</p>
          <p class="text-slate-600 text-xs">請稍後再查詢</p>
        </div>

        <!-- MLB Games Grid -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div v-for="game in sortedMlbGames" :key="game.id"
          class="bg-[#0a0f1c] rounded-2xl border border-slate-800/60 p-4 hover:border-slate-600 transition-colors shadow-lg relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-28 h-28 bg-blue-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-blue-500/8 pointer-events-none"></div>

          <!-- Time -->
          <div class="flex items-center justify-between mb-3 text-xs">
            <span class="text-slate-400 flex items-center gap-1.5 bg-slate-900/60 px-2 py-0.5 rounded font-mono">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
              {{ formatTime(game.commence_time) }}
            </span>
            <span class="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">MLB</span>
          </div>

          <!-- Teams -->
          <div class="space-y-3">
            <!-- Away -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <img :src="getMlbLogo(game.away_team)" :alt="game.away_team"
                  class="w-10 h-10 rounded-full bg-white object-contain p-1 ring-2 ring-black shrink-0 shadow" />
                <div class="min-w-0">
                  <div class="text-[10px] text-slate-500 font-bold tracking-widest">客隊</div>
                  <div class="text-sm font-black text-slate-200 truncate">{{ game.away_team }}</div>
                </div>
              </div>
              <div class="shrink-0 min-w-[62px] text-center px-2.5 py-1.5 rounded-lg border font-bold font-mono text-sm"
                :class="[getOddsStyle(getOdds(game, game.away_team)).bg, getOddsStyle(getOdds(game, game.away_team)).text]">
                {{ getOdds(game, game.away_team) }}
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-slate-800"></div>
              <span class="text-[10px] font-black text-slate-600">VS</span>
              <div class="flex-1 h-px bg-slate-800"></div>
            </div>

            <!-- Home -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <img :src="getMlbLogo(game.home_team)" :alt="game.home_team"
                  class="w-10 h-10 rounded-full bg-white object-contain p-1 ring-2 ring-black shrink-0 shadow" />
                <div class="min-w-0">
                  <div class="text-[10px] text-slate-500 font-bold tracking-widest">主隊</div>
                  <div class="text-sm font-black text-slate-200 truncate">{{ game.home_team }}</div>
                </div>
              </div>
              <div class="shrink-0 min-w-[62px] text-center px-2.5 py-1.5 rounded-lg border font-bold font-mono text-sm"
                :class="[getOddsStyle(getOdds(game, game.home_team)).bg, getOddsStyle(getOdds(game, game.home_team)).text]">
                {{ getOdds(game, game.home_team) }}
              </div>
            </div>
          </div>

          <!-- Win Probability Bar -->
          <div class="mt-4 pt-3 border-t border-slate-800/60">
            <div class="flex justify-between items-center mb-1.5 text-[10px] font-bold">
              <span :class="getWinProb(game, game.away_team, game.home_team).away >= 50 ? 'text-green-400' : 'text-red-400'">
                {{ game.away_team.split(' ').slice(-1)[0] }} {{ getWinProb(game, game.away_team, game.home_team).away }}%
              </span>
              <span class="text-slate-600 tracking-widest">市場勝率</span>
              <span :class="getWinProb(game, game.away_team, game.home_team).home >= 50 ? 'text-green-400' : 'text-red-400'">
                {{ getWinProb(game, game.away_team, game.home_team).home }}% {{ game.home_team.split(' ').slice(-1)[0] }}
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div class="h-full rounded-l-full transition-all duration-700"
                :class="getWinProb(game, game.away_team, game.home_team).away >= 50 ? 'bg-green-500' : 'bg-red-500'"
                :style="{ width: getWinProb(game, game.away_team, game.home_team).away + '%' }"
              ></div>
              <div class="h-full rounded-r-full transition-all duration-700"
                :class="getWinProb(game, game.away_team, game.home_team).home >= 50 ? 'bg-green-500' : 'bg-red-500'"
                :style="{ width: getWinProb(game, game.away_team, game.home_team).home + '%' }"
              ></div>
            </div>
          </div>

        </div>
        </div>
      </template>

      <!-- ===== NBA Tab ===== -->
      <template v-if="activeLeague === 'NBA'">
        <div class="mt-4 mb-3 flex items-center gap-2">
          <span class="text-lg">🏀</span>
          <h2 class="text-sm font-black text-slate-400 tracking-widest uppercase">NBA 美國職籃</h2>
          <div class="flex-1 h-px bg-slate-800 ml-1 mr-2"></div>

          <!-- Sort Toggle (NBA) -->
          <button @click="cycleSort" class="flex items-center space-x-1.5 px-2 py-1 bg-[#111827] border border-slate-700 rounded-md transition-all hover:border-orange-500 group active:scale-95">
            <span class="text-xs">{{ currentSort.icon }}</span>
            <span class="text-[11px] font-black text-slate-400 group-hover:text-orange-400 uppercase tracking-tight">{{ currentSort.label }}</span>
          </button>
        </div>

        <!-- NBA Loading -->
        <div v-if="nbaLoading" class="flex items-center gap-3 py-8 justify-center text-slate-500">
          <div class="w-5 h-5 rounded-full border-2 border-slate-700 border-t-orange-400 animate-spin"></div>
          <span class="text-sm font-medium">載入中...</span>
        </div>

        <!-- NBA Error -->
        <div v-else-if="nbaError" class="py-6 text-center text-red-400 text-sm">⚠️ {{ nbaError }}</div>

        <!-- NBA Empty -->
        <div v-else-if="nbaGames.length === 0"
          class="py-8 flex flex-col items-center gap-2 bg-slate-900/40 rounded-2xl border border-slate-800 text-center">
          <span class="text-4xl">🏀</span>
          <p class="text-slate-500 font-bold text-sm">目前無 NBA 賽事</p>
          <p class="text-slate-600 text-xs">請稍後再查詢</p>
        </div>

        <!-- NBA Games Grid -->
        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div v-for="game in sortedNbaGames" :key="game.id"
          class="bg-[#0a0f1c] rounded-2xl border border-slate-800/60 p-4 hover:border-slate-600 transition-colors shadow-lg relative overflow-hidden group">
          <div class="absolute top-0 right-0 w-28 h-28 bg-orange-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-orange-500/8 pointer-events-none"></div>

          <!-- Time -->
          <div class="flex items-center justify-between mb-3 text-xs">
            <span class="text-slate-400 flex items-center gap-1.5 bg-slate-900/60 px-2 py-0.5 rounded font-mono">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd" />
              </svg>
              {{ formatTime(game.commence_time) }}
            </span>
            <span class="text-[10px] text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">NBA</span>
          </div>

          <!-- Teams -->
          <div class="space-y-3">
            <!-- Away -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <img :src="getNbaLogo(game.away_team)" :alt="game.away_team"
                  class="w-10 h-10 rounded-full bg-white object-contain p-1 ring-2 ring-black shrink-0 shadow" />
                <div class="min-w-0">
                  <div class="text-[10px] text-slate-500 font-bold tracking-widest">客隊</div>
                  <div class="text-sm font-black text-slate-200 truncate">{{ game.away_team }}</div>
                </div>
              </div>
              <div class="shrink-0 min-w-[62px] text-center px-2.5 py-1.5 rounded-lg border font-bold font-mono text-sm"
                :class="[getOddsStyle(getOdds(game, game.away_team)).bg, getOddsStyle(getOdds(game, game.away_team)).text]">
                {{ getOdds(game, game.away_team) }}
              </div>
            </div>

            <div class="flex items-center gap-3">
              <div class="flex-1 h-px bg-slate-800"></div>
              <span class="text-[10px] font-black text-slate-600">VS</span>
              <div class="flex-1 h-px bg-slate-800"></div>
            </div>

            <!-- Home -->
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <img :src="getNbaLogo(game.home_team)" :alt="game.home_team"
                  class="w-10 h-10 rounded-full bg-white object-contain p-1 ring-2 ring-black shrink-0 shadow" />
                <div class="min-w-0">
                  <div class="text-[10px] text-slate-500 font-bold tracking-widest">主隊</div>
                  <div class="text-sm font-black text-slate-200 truncate">{{ game.home_team }}</div>
                </div>
              </div>
              <div class="shrink-0 min-w-[62px] text-center px-2.5 py-1.5 rounded-lg border font-bold font-mono text-sm"
                :class="[getOddsStyle(getOdds(game, game.home_team)).bg, getOddsStyle(getOdds(game, game.home_team)).text]">
                {{ getOdds(game, game.home_team) }}
              </div>
            </div>
          </div>

          <!-- Win Probability Bar -->
          <div class="mt-4 pt-3 border-t border-slate-800/60">
            <div class="flex justify-between items-center mb-1.5 text-[10px] font-bold">
              <span :class="getWinProb(game, game.away_team, game.home_team).away >= 50 ? 'text-green-400' : 'text-red-400'">
                {{ game.away_team.split(' ').slice(-1)[0] }} {{ getWinProb(game, game.away_team, game.home_team).away }}%
              </span>
              <span class="text-slate-600 tracking-widest">市場勝率</span>
              <span :class="getWinProb(game, game.away_team, game.home_team).home >= 50 ? 'text-green-400' : 'text-red-400'">
                {{ getWinProb(game, game.away_team, game.home_team).home }}% {{ game.home_team.split(' ').slice(-1)[0] }}
              </span>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex">
              <div class="h-full rounded-l-full transition-all duration-700"
                :class="getWinProb(game, game.away_team, game.home_team).away >= 50 ? 'bg-green-500' : 'bg-red-500'"
                :style="{ width: getWinProb(game, game.away_team, game.home_team).away + '%' }"
              ></div>
              <div class="h-full rounded-r-full transition-all duration-700"
                :class="getWinProb(game, game.away_team, game.home_team).home >= 50 ? 'bg-green-500' : 'bg-red-500'"
                :style="{ width: getWinProb(game, game.away_team, game.home_team).home + '%' }"
              ></div>
            </div>
          </div>

        </div>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
