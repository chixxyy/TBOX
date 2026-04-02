import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { playNewsChime } from './utils/audio'
import { supabase } from './supabase'

// Only track these 4 assets as requested

export const activeSymbol = ref('BTCUSDT')
export const activeInterval = ref('1d')
export const activeTab = ref('交易')
export const isEntryLoading = ref(true)

export const setActiveSymbol = (symbol: string) => {
  activeSymbol.value = symbol
}

export const setActiveInterval = (interval: string) => {
  activeInterval.value = interval
}

// Helper to get formatted pair name, e.g. BTC/USDT
export const formattedActiveSymbol = computed(() => {
  return activeSymbol.value.replace('USDT', '/USDT')
})

// --- AI Drawer State ---
export const showAIDrawer = ref(false)
export const activeAIAsset = ref<{ symbol: string, currentPrice: number, marketType: 'crypto' | 'stock' } | null>(null)

export const openAIDrawer = (symbol: string, currentPrice: number, marketType: 'crypto' | 'stock' = 'crypto') => {
  activeAIAsset.value = { symbol, currentPrice, marketType }
  showAIDrawer.value = true
}

// --- Global Data Store for Site-wide Monitoring ---

export interface Mover {
  id: number
  title: string
  slug: string
  image: string
  detectedPrice: number
  peakPrice: number
  currentPrice: number
  changePercent: number
  isUp: boolean
  detectedTimeStr: string
  peakTimeStr: string
  detectionDurationStr: string
  volumeStr: string
  news?: string
  newsTimeStr?: string
  sparklineData: number[]
  symbol?: string
  marketType?: 'crypto' | 'stock'
}

interface NewsItem {
  id: string
  source: string
  ts: number
  time: string
  cat: string
  headline: string
  summary: string
  image: string
  url: string
  severity: string
  accentColor: string
  avatar: string
  isCritical: boolean
  handle?: string
  isOfficial?: boolean
  tags?: any[]
}

export const globalMovers = ref<Mover[]>([])
export const globalNews = ref<NewsItem[]>([])

// Single session management
export const currentSessionId = ref(crypto.randomUUID())
export const isKickedOut = ref(false)
let sessionSyncChannel: any = null
let lastSyncedUserId: string | null = null

const initSessionSync = (userId: string) => {
  // If already syncing for this user AND channel is healthy, skip
  if (lastSyncedUserId === userId && sessionSyncChannel) return
  
  if (sessionSyncChannel) {
    supabase.removeChannel(sessionSyncChannel)
  }

  lastSyncedUserId = userId
  sessionSyncChannel = supabase.channel(`session-sync:${userId}`)
    .on('broadcast', { event: 'NEW_SESSION' }, (payload: any) => {
      const incomingId = payload.payload?.sessionId
      if (incomingId && incomingId !== currentSessionId.value) {
        console.warn('[SECURITY] New session detected on another device. Revoking current access.', {
          incoming: incomingId,
          local: currentSessionId.value
        })
        isKickedOut.value = true
        chatSignOut(true)
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        sessionSyncChannel.send({
          type: 'broadcast',
          event: 'NEW_SESSION',
          payload: { sessionId: currentSessionId.value }
        })
      }
    })
}

export const isMoversLoading = ref(true)
export const isNewsLoading = ref(true)
export const lastMoversUpdate = ref('')
export const lastNewsUpdate = ref('')

// --- Global Share State ---
export const showShareConfirm = ref(false)
export const newsToShare = ref<any>(null)
export const triggerShare = (news: any) => {
  newsToShare.value = news
  showShareConfirm.value = true
}

// --- Global Asset List (Source of Truth) ---
export const initialAssets = [
  // Crypto
  { symbol: 'BTCUSDT', name: 'Bitcoin', type: 'crypto'},
  { symbol: 'ETHUSDT', name: 'Ethereum', type: 'crypto'},
  { symbol: 'BNBUSDT', name: 'Binance Coin', type: 'crypto'},
  { symbol: 'SOLUSDT', name: 'Solana', type: 'crypto'},
  { symbol: 'ADAUSDT', name: 'Cardano', type: 'crypto'},
  { symbol: 'XRPUSDT', name: 'Ripple', type: 'crypto'},
  { symbol: 'DOTUSDT', name: 'Polkadot', type: 'crypto'},
  { symbol: 'LINKUSDT', name: 'Chainlink', type: 'crypto'},
  { symbol: 'DOGEUSDT', name: 'Dogecoin', type: 'crypto'},
  { symbol: 'USDCUSDT', name: 'USDC/USDT', type: 'crypto'},
  // Stock
  { symbol: 'NVDA', name: 'Nvidia', type: 'stock' },
  { symbol: 'AMD', name: 'AMD', type: 'stock' },
  { symbol: 'META', name: 'Meta', type: 'stock' },
  { symbol: 'ADBE', name: 'Adobe', type: 'stock' },
  { symbol: 'VTI', name: 'Vanguard Total Stock', type: 'stock' },
  { symbol: 'VOO', name: 'Vanguard S&P 500', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', type: 'stock' },
  { symbol: 'ORCL', name: 'Oracle', type: 'stock' },
  { symbol: 'PLTR', name: 'Palantir', type: 'stock' }
] as const

// --- Global Market Prices (Shared across components) ---
interface MarketData {
  price: string
  change: string
  up: boolean
  rawPrice: number
  prevClose?: number
}
export const marketPrices = ref<Record<string, MarketData>>({})

// --- Mini Portfolio Tracker ---
interface PortfolioItem {
  id: string
  symbol: string
  amount: number
  entryPrice: number
}
export const portfolio = ref<PortfolioItem[]>([])

const fetchPortfolio = async (userId: string) => {
  const { data, error } = await supabase
    .from('portfolio')
    .select('*')
    .eq('user_id', userId)
  
  if (!error && data) {
    portfolio.value = data.map((item: any) => ({
      id: item.id,
      symbol: item.symbol,
      amount: Number(item.amount),
      entryPrice: Number(item.entry_price)
    }))
  }
}

export const addToPortfolio = async (symbol: string, amount: number, entryPrice: number) => {
  if (!chatSession.value) return
  const { data, error } = await supabase.from('portfolio').insert({
    user_id: chatSession.value.user.id,
    symbol: symbol.toUpperCase(),
    amount,
    entry_price: entryPrice
  }).select().single()
  
  if (!error && data) {
    portfolio.value.push({
      id: data.id,
      symbol: data.symbol,
      amount: Number(data.amount),
      entryPrice: Number(data.entry_price)
    })
  }
}

export const updatePortfolioItem = async (id: string, amount: number, entryPrice: number) => {
  if (!chatSession.value) return
  const { error } = await supabase
    .from('portfolio')
    .update({ 
      amount: Number(amount), 
      entry_price: Number(entryPrice) 
    })
    .eq('id', id)
  
  if (!error) {
    const item = portfolio.value.find(i => i.id === id)
    if (item) {
      item.amount = Number(amount)
      item.entryPrice = Number(entryPrice)
    }
  }
  return !error
}

export const removeFromPortfolio = async (id: string) => {
  if (!chatSession.value) return
  const { error } = await supabase.from('portfolio').delete().eq('id', id)
  if (!error) {
    portfolio.value = portfolio.value.filter((item: PortfolioItem) => item.id !== id)
    if (alertThresholds.value) delete alertThresholds.value[id]
  }
}

// --- Portfolio Alerts Monitoring ---
const alertThresholds = useStorage<Record<string, number[]>>('tbox-portfolio-alerts-triggered', {})

const checkPortfolioAlerts = () => {
  const alerts = alertThresholds.value
  if (!alerts) return
  
  portfolio.value.forEach((item: PortfolioItem) => {
    const market = marketPrices.value[item.symbol]
    if (!market || market.rawPrice === 0) return
    
    const change = (market.rawPrice / item.entryPrice - 1) * 100
    const absChange = Math.abs(change)
    
    // Thresholds: 20%, 10%, 5%
    const thresholds = [20, 10, 5]
    if (!alerts[item.id]) {
      alerts[item.id] = []
    }
    
    const currentItemAlerts = alerts[item.id]
    if (!currentItemAlerts) return

    for (const t of thresholds) {
      if (absChange >= t && !currentItemAlerts.includes(t)) {
        const type = change >= 0 ? '上漲' : '下跌'
        const isMajor = t === 20
        const titlePrefix = isMajor ? '🚨 [重大異動] ' : ''
        
        showToast(
          `${titlePrefix}資產異動提醒: ${item.symbol}`,
          `持倉 ${item.symbol} 已${type} ${t}%！目前回報: ${change.toFixed(2)}%`
        )
        currentItemAlerts.push(t)
        // Trigger save to storage
        alertThresholds.value = { ...alerts }
        break 
      }
    }
  })
}

import { watch } from 'vue'
watch(marketPrices, () => {
  checkPortfolioAlerts()
}, { deep: true })

// --- Mobile UX State ---
export const scrollProgress = ref(0) // 0 to 100
export const isChangingTab = ref(false)
export const setScrollProgress = (progress: number) => {
  scrollProgress.value = Math.max(0, Math.min(100, progress))
}

// --- Price Alerts ---
interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  condition: 'above' | 'below'
  triggered: boolean
}

export const priceAlerts = ref<PriceAlert[]>([])

export const addPriceAlert = async (symbol: string, targetPrice: number, condition: 'above' | 'below') => {
  if (!chatSession.value) return
  const { data, error } = await supabase.from('price_alerts').insert({
    user_id: chatSession.value.user.id,
    symbol: symbol.toUpperCase(),
    target_price: targetPrice,
    condition,
    triggered: false
  }).select().single()
  
  if (!error && data) {
    priceAlerts.value.push({
      id: data.id,
      symbol: data.symbol,
      targetPrice: Number(data.target_price),
      condition: data.condition as 'above' | 'below',
      triggered: data.triggered
    })
  }
}

const fetchPriceAlerts = async (userId: string) => {
  const { data: alerts, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error fetching price alerts:', error)
    return
  }
  
  if (alerts) {
    priceAlerts.value = alerts.map(a => ({
      id: a.id,
      symbol: a.symbol,
      targetPrice: Number(a.target_price),
      condition: a.condition as 'above' | 'below',
      triggered: a.triggered
    }))
  }
}

export const removePriceAlert = async (id: string) => {
  if (!chatSession.value) return
  const { error } = await supabase.from('price_alerts').delete().eq('id', id)
  if (!error) {
    priceAlerts.value = priceAlerts.value.filter((a: PriceAlert) => a.id !== id)
  }
}

export const updatePriceAlertTriggered = async (id: string) => {
  if (!chatSession.value) return
  await supabase.from('price_alerts').update({ triggered: true }).eq('id', id)
  
  // Update local state immediately
  const alert = priceAlerts.value.find((a: PriceAlert) => a.id === id)
  if (alert) alert.triggered = true
}

// --- Global UI Toast Alerts & History ---
interface ToastItem {
  id: string
  title: string
  message: string
}

interface NotificationLog {
  id: string
  title: string
  message: string
  timestamp: number
  isRead: boolean
}

export const toasts = ref<ToastItem[]>([])
export const notificationHistory = useStorage<NotificationLog[]>('tbox-notification-history', [])
export const isNotificationsEnabled = useStorage('tbox-notifications-enabled', true)

export const showToast = (title: string, message: string, silent: boolean = false) => {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 7)
  
  // Only show the popup and play sound if notifications are enabled
  if (isNotificationsEnabled.value) {
    toasts.value.push({ id, title, message })
    if (!silent) playNewsChime()
  }
  
  // Always record in history
  notificationHistory.value.unshift({
    id,
    title,
    message,
    timestamp: Date.now(),
    isRead: false
  })
  
  if (notificationHistory.value.length > 50) {
    notificationHistory.value.pop()
  }
}

export const removeToast = (id: string) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

export const markAllNotificationsRead = () => {
  notificationHistory.value.forEach(n => n.isRead = true)
}

export const clearNotifications = () => {
  notificationHistory.value = []
}

export const removeNotificationLog = (id: string) => {
  notificationHistory.value = notificationHistory.value.filter(n => n.id !== id)
}

export const unreadNotificationsCount = computed(() => {
  return notificationHistory.value.filter(n => !n.isRead).length
})

// --- Global Auth UI State ---
const previousTab = ref('交易')

export const goToLogin = () => {
  previousTab.value = activeTab.value === '登入' ? '交易' : activeTab.value
  activeTab.value = '登入'
}

export const handleLoginSuccess = () => {
  activeTab.value = previousTab.value
}

// --- Supabase Realtime Chat & Auth ---

interface ChatMessage {
  id: string
  user: string
  userId: string
  avatar: string
  text: string
  timestamp: number
  newsShare?: {
    // For regular news
    headline?: string
    url?: string
    source?: string
    // For AI insights
    type?: 'ai_insight'
    symbol?: string
    score?: number
    summary?: string
  }
}

export const chatSession = ref<any>(null)
export const chatUser = computed(() => chatSession.value?.user?.user_metadata?.nickname || chatSession.value?.user?.email?.split('@')[0] || 'GUEST')
export const isAdmin = computed(() => {
  const email = chatSession.value?.user?.email || ''
  return email.toLowerCase() === 'a27976566@gmail.com' || email.toLowerCase() === 'admin@tradingbox.com'
})

export const chatMessages = ref<ChatMessage[]>([])
export const chatLoading = ref(true)
export const isChatConnected = ref(true) // Default to true, will update on subscribe

// --- User Profile State ---
interface UserProfile {
  id: string
  full_name: string
  avatar_url: string
  bio: string
  email?: string
}
export const userProfile = ref<UserProfile | null>(null)

const fetchUserProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error)
    return
  }
  
  if (data) {
    userProfile.value = data
  } else {
    // If no profile, create a default one from user metadata
    const user = (await supabase.auth.getUser()).data.user
    if (user) {
      const newProfile = {
        id: user.id,
        full_name: user.user_metadata.full_name || '無名氏',
        avatar_url: user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=User&background=random`,
        bio: ''
      }
      const { error: insError } = await supabase.from('profiles').insert([newProfile])
      if (!insError) userProfile.value = newProfile
    }
  }
}

export const updateUserProfile = async (updates: Partial<UserProfile>) => {
  if (!chatSession.value?.user.id) return { error: 'Not logged in' }
  
  // 1. Update the profile table first (Priority)
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', chatSession.value.user.id)
  
  if (error) return { error }

  // 2. Local state update immediately
  if (userProfile.value) {
    userProfile.value = { ...userProfile.value, ...updates }
  }

  // 3. Background: Update historical messages (Non-blocking)
  const msgUpdates: any = {}
  if (updates.full_name) msgUpdates.user_name = updates.full_name
  if (updates.avatar_url) msgUpdates.avatar = updates.avatar_url
  
  if (Object.keys(msgUpdates).length > 0) {
    // We launch this without await to prevent UI blocking
    supabase.from('messages')
      .update(msgUpdates)
      .eq('user_id', chatSession.value.user.id)
      .then(({ error: syncErr }) => {
        if (syncErr) console.warn('Historical message sync deferred or failed:', syncErr.message)
      })
  }
  
  return { error: null }
}

let chatChannel: any = null

// --- Supabase Interaction ---
export const initSupabaseChat = async () => {
  // Prevent multiple active subscriptions (Double message fix)
  if (chatChannel) {
    supabase.removeChannel(chatChannel)
    chatChannel = null
  }

  chatLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    chatSession.value = session
    if (session?.user.id) {
      await fetchUserProfile(session.user.id)
      await fetchPortfolio(session.user.id)
      initSessionSync(session.user.id)
    } else {
      userProfile.value = null
      portfolio.value = []
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      chatSession.value = session
      if (session?.user.id) {
        await fetchUserProfile(session.user.id)
        await fetchPriceAlerts(session.user.id)
        await fetchPortfolio(session.user.id)
        initSessionSync(session.user.id)
      } else {
        userProfile.value = null
        priceAlerts.value = []
        portfolio.value = []
      }
    })

    // Fetch initial messages
    const { data: msgs, error: msgsError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      
    if (msgsError) throw msgsError
    
    if (msgs) {
      chatMessages.value = [...msgs].reverse().map((m: any) => ({
        id: String(m.id),
        user: m.user_name || '匿名使用者',
        userId: m.user_id,
        avatar: m.avatar || `https://ui-avatars.com/api/?name=User&background=random`,
        text: m.text || '',
        timestamp: new Date(m.created_at).getTime(),
        newsShare: m.news_share
      }))
    }

    // Fetch initial price alerts if logged in
    if (session?.user.id) {
      await fetchPriceAlerts(session.user.id)
    } else {
      priceAlerts.value = []
    }
  } catch (err) {
    console.error('Supabase init error:', err)
  } finally {
    chatLoading.value = false
  }


  // Realtime Subscriptions
  const channel = supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
      const m = payload.new
      // Enhanced Deduplication for Optimistic UI
      const existingTempIndex = chatMessages.value.findIndex(msg => 
        msg.id.startsWith('temp-') && 
        msg.userId === m.user_id && 
        msg.text === m.text
      )

      if (existingTempIndex !== -1) {
        // Replace temp msg with real one
        chatMessages.value[existingTempIndex] = {
          id: String(m.id),
          user: m.user_name,
          userId: m.user_id,
          avatar: m.avatar,
          text: m.text,
          timestamp: new Date(m.created_at).getTime(),
          newsShare: m.news_share
        }
      } else if (!chatMessages.value.find((msg: ChatMessage) => String(msg.id) === String(m.id))) {
        // Add as new if no match found
        chatMessages.value.push({
          id: String(m.id),
          user: m.user_name,
          userId: m.user_id,
          avatar: m.avatar,
          text: m.text,
          timestamp: new Date(m.created_at).getTime(),
          newsShare: m.news_share
        })
        if (chatMessages.value.length > 500) chatMessages.value.shift()
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload: any) => {
      chatMessages.value = chatMessages.value.filter((msg: ChatMessage) => String(msg.id) !== String(payload.old.id))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload: any) => {
      const idx = chatMessages.value.findIndex((msg: ChatMessage) => String(msg.id) === String(payload.new.id))
      if (idx !== -1) {
        const m = payload.new
        const existing = chatMessages.value[idx]
        if (!existing) return
        
        chatMessages.value[idx] = {
          id: String(m.id || existing.id),
          user: m.user_name || existing.user,
          userId: m.user_id || existing.userId,
          avatar: m.avatar || existing.avatar,
          text: m.text || existing.text,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : existing.timestamp,
          newsShare: m.news_share !== undefined ? m.news_share : existing.newsShare
        }
      }
    })
  
  chatChannel = channel
  channel.subscribe((status: string, err?: Error) => {
    if (err) {
      console.error('Realtime subscription error:', err)
      isChatConnected.value = false
    }
    if (status === 'SUBSCRIBED') {
      console.log('Successfully connected to chat realtime')
      isChatConnected.value = true
    } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      isChatConnected.value = false
    }
  })
}

export const addChatMessage = async (msg: { user: string; avatar: string; text: string; newsShare?: any }) => {
  console.log('Store: addChatMessage start', msg)
  if (!chatSession.value) {
    showToast('發送失敗', '請先登入後再發言', false)
    return
  }
  
  // 1. Optimistic Update: Create a temporary message
  const tempId = 'temp-' + Date.now()
  const tempMsg: ChatMessage = {
    id: tempId,
    user: msg.user,
    userId: chatSession.value.user.id,
    avatar: msg.avatar,
    text: msg.text,
    timestamp: Date.now(),
    newsShare: msg.newsShare ? JSON.parse(JSON.stringify(msg.newsShare)) : undefined
  }
  
  // Add to local state immediately
  chatMessages.value.push(tempMsg)
  if (chatMessages.value.length > 500) chatMessages.value.shift()
  
  try {
    const newsData = msg.newsShare ? JSON.parse(JSON.stringify(msg.newsShare)) : null
    
    const { data: insertedData, error } = await supabase.from('messages').insert({
      user_id: chatSession.value.user.id,
      user_name: msg.user,
      avatar: msg.avatar,
      text: msg.text,
      news_share: newsData
    }).select().single()

    if (error) throw error

    // On success, we don't necessarily NEED to replace it here because 
    // the Realtime subscription (postgres_changes) will catch the INSERT 
    // and we'll handle avoid-duplicates there.
    
    console.log('Store: Supabase insert success', insertedData?.id)
  } catch (err: any) {
    console.error('Store: addChatMessage error:', err)
    // Rollback: Remove the temporary message on failure
    chatMessages.value = chatMessages.value.filter(m => m.id !== tempId)
    showToast('發送失敗', '請確認網路連線: ' + (err.message || 'Unknown'), false)
    throw err
  }
}

export const removeChatMessage = async (id: string) => {
  if (!chatSession.value) return
  
  // Optimistic UI update
  const prevMessages = [...chatMessages.value]
  chatMessages.value = chatMessages.value.filter(m => String(m.id) !== String(id))
  
  try {
    // Attempt to delete. Try both casting to number (most common PK) and string.
    const numericId = Number(id)
    const { error, count } = await supabase
      .from('messages')
      .delete({ count: 'exact' })
      .eq('id', isNaN(numericId) ? id : numericId)

    if (error) {
      throw error
    }

    if (count === 0) {
      console.warn('Supabase delete succeeded but 0 rows affected. Check RLS or ID.')
      // If no rows were deleted (likely RLS), we should still consider it a failure for the user
      throw new Error('找不到該留言或權限不足 (RLS)')
    }

    showToast('刪除成功', '留言已從討論區移除')
  } catch (err: any) {
    console.error('刪除留言失敗:', err.message || err)
    // Rollback local state on error
    chatMessages.value = prevMessages
    showToast('刪除失敗', `錯誤: ${err.message || '連線或權限問題'}`, false)
  }
}

export const showLogoutConfirm = ref(false)

// Platform Notice Logic
const skipPlatformNotice = useStorage('tbox-skip-platform-notice', false)
export const showPlatformNotice = ref(!skipPlatformNotice.value)

watch(chatSession, (newSession, oldSession) => {
  if (newSession && newSession.user && (!oldSession || !oldSession.user) && !skipPlatformNotice.value) {
    showPlatformNotice.value = true
  }
})

export const dismissPlatformNotice = (forever: any = false) => {
  // Ensure we check for boolean true, as some event payloads might be truthy
  const shouldSkipForever = forever === true
  
  showPlatformNotice.value = false
  if (shouldSkipForever) {
    skipPlatformNotice.value = true
  }
  
  // Also log into notification history
  notificationHistory.value.unshift({
    id: 'notice-' + Date.now(),
    title: '平台公告紀錄',
    message: '溫馨提醒：如果發現資產報價沒有即時跳動或是討論區沒有正常連線，請點擊畫面右上方的「重置連線」按鈕或是直接重新整理網頁。',
    timestamp: Date.now(),
    isRead: false
  })
}

// Helper to reset the notice state (used when re-clicking logo)
export const resetPlatformNotice = () => {
  if (!skipPlatformNotice.value) {
    showPlatformNotice.value = true
  }
}

export const chatSignOut = async (isInternal: boolean = false) => {
  console.log('[AUTH] Initiating sign-out sequence...', { isInternal })
  
  // 1. Immediately cut all realtime connections (Priority)
  // This prevents the app from receiving data while session is being revoked
  if (chatChannel) {
    console.log('[AUTH] Removing chat channel...')
    supabase.removeChannel(chatChannel)
    chatChannel = null
  }
  
  if (sessionSyncChannel) {
    console.log('[AUTH] Removing session sync channel...')
    supabase.removeChannel(sessionSyncChannel)
    sessionSyncChannel = null
    lastSyncedUserId = null
  }

  // 2. Swiftly clear local state to prevent UI ghosting
  chatMessages.value = []
  chatSession.value = null
  userProfile.value = null
  priceAlerts.value = [] 
  portfolio.value = []
  showLogoutConfirm.value = false
  skipPlatformNotice.value = false 
  
  try {
    // 3. Notify Supabase server to invalidate session
    await supabase.auth.signOut()
    console.log('[AUTH] Supabase signOut completed.')
  } catch (err) {
    console.error('[AUTH] Supabase signOut error:', err)
  }

  // 4. Final Cleanup & Redirect
  if (!isInternal) {
    isKickedOut.value = false
    activeTab.value = '交易'
    
    // Show confirmation before redirect
    showToast('登出成功', '您已安全退出 TradingBox', true)
    
    // MANDATORY: Force a clean reload after a short delay to let the toast be seen
    console.log('[AUTH] Performing clean reload in 1s...')
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)
  } else {
     // If internal (e.g. kicked out), we stay on page to show the alert modal
     activeTab.value = '交易'
     console.warn('[AUTH] Session revoked internally (Single Session Logic)')
  }
}
