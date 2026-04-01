<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { api } from '../api'

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
const activeLeague = ref<'MLB' | 'NBA'>('MLB')

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
}

let autoRefreshTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  fetchAll()
  autoRefreshTimer = setInterval(fetchAll, 120000) // auto-refresh every 2 min
})

onUnmounted(() => {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer)
})
</script>

<template>
  <div class="flex flex-col h-full w-full bg-[#05080f] text-slate-300">

    <!-- Page Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 border-b border-slate-800">
      <div>
        <h1 class="text-xl font-black text-white tracking-wide flex items-center gap-2">
          運彩賠率
        </h1>
        <p class="text-slate-500 text-xs font-medium flex items-center gap-1.5 mt-0.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span>
          即時 H2H Moneyline · DraftKings / Pinnacle / FanDuel 平均
        </p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Sort Toggle -->
        <button @click="cycleSort"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-300 hover:text-white transition active:scale-95 border border-slate-700 text-xs font-bold">
          <span>{{ currentSort.icon }}</span>
          <span class="hidden sm:inline">{{ currentSort.label }}</span>
        </button>
      </div>
    </div>

    <!-- League Tab Nav -->
    <div class="flex shrink-0 border-b border-slate-800 bg-[#05080f]">
      <button
        v-for="league in (['MLB', 'NBA'] as const)"
        :key="league"
        @click="activeLeague = league"
        class="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-black tracking-widest uppercase transition-all border-b-2"
        :class="activeLeague === league
          ? 'border-blue-500 text-blue-400 bg-blue-500/5'
          : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'"
      >
        <span>{{ league === 'MLB' ? '⚾' : '🏀' }}</span>
        {{ league }}
        <!-- Badge: game count -->
        <span v-if="league === 'MLB' && !mlbLoading && mlbGames.length > 0"
          class="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
          {{ mlbGames.length }}
        </span>
        <span v-if="league === 'NBA' && !nbaLoading && nbaGames.length > 0"
          class="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-bold">
          {{ nbaGames.length }}
        </span>
      </button>
    </div>

    <!-- Scrollable Body -->
    <div class="flex-1 overflow-y-auto px-4 pb-20 scrollbar-hide">

      <!-- ===== MLB Tab ===== -->
      <template v-if="activeLeague === 'MLB'">
        <div class="mt-4 mb-3 flex items-center gap-2">
          <span class="text-lg">⚾</span>
          <h2 class="text-sm font-black text-slate-400 tracking-widest uppercase">MLB 美國職棒</h2>
          <div class="flex-1 h-px bg-slate-800 ml-1"></div>
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
          <div class="flex-1 h-px bg-slate-800 ml-1"></div>
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
