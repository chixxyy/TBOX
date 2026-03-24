import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { playNewsChime } from './utils/audio'

// Only track these 4 assets as requested

export const activeSymbol = ref('BTCUSDT')
export const activeInterval = ref('1d')
export const activeTab = ref('交易')

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
  news: string
  newsTimeStr: string
  sparklineData: number[]
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
export const isMoversLoading = ref(true)
export const isNewsLoading = ref(true)
export const lastMoversUpdate = ref('')
export const lastNewsUpdate = ref('')

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
    priceAlerts.value = priceAlerts.value.filter(a => a.id !== id)
  }
}

export const updatePriceAlertTriggered = async (id: string) => {
  if (!chatSession.value) return
  await supabase.from('price_alerts').update({ triggered: true }).eq('id', id)
  
  // Update local state immediately
  const alert = priceAlerts.value.find(a => a.id === id)
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

export const showToast = (title: string, message: string) => {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 7)
  
  // Only show the popup and play sound if notifications are enabled
  if (isNotificationsEnabled.value) {
    toasts.value.push({ id, title, message })
    playNewsChime()
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
import { supabase } from './supabase'

interface ChatMessage {
  id: string
  user: string
  userId: string
  avatar: string
  text: string
  timestamp: number
  newsShare?: {
    headline: string
    url: string
    source: string
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
  
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', chatSession.value.user.id)
  
  // Also update all historical messages for this user (Global Sync)
  if (!error) {
    const msgUpdates: any = {}
    if (updates.full_name) msgUpdates.user_name = updates.full_name
    if (updates.avatar_url) msgUpdates.avatar = updates.avatar_url
    
    if (Object.keys(msgUpdates).length > 0) {
      await supabase.from('messages')
        .update(msgUpdates)
        .eq('user_id', chatSession.value.user.id)
    }
  }
  
  if (!error && userProfile.value) {
    userProfile.value = { ...userProfile.value, ...updates }
  }
  return { error }
}

// --- Supabase Interaction ---
export const initSupabaseChat = async () => {
  chatLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    chatSession.value = session
    if (session?.user.id) {
      await fetchUserProfile(session.user.id)
    } else {
      userProfile.value = null
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      chatSession.value = session
      if (session?.user.id) {
        await fetchUserProfile(session.user.id)
        await fetchPriceAlerts(session.user.id)
      } else {
        userProfile.value = null
        priceAlerts.value = []
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
      chatMessages.value = [...msgs].reverse().map(m => ({
        id: m.id,
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
  supabase
    .channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new
      // Avoid duplicate insert if we already have it locally (though we don't do optimistic updates here yet)
      if (!chatMessages.value.find(msg => msg.id === m.id)) {
        chatMessages.value.push({
          id: m.id,
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
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
      chatMessages.value = chatMessages.value.filter(msg => msg.id !== payload.old.id)
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
      const idx = chatMessages.value.findIndex(msg => msg.id === payload.new.id)
      if (idx !== -1) {
        const m = payload.new
        const existing = chatMessages.value[idx]
        if (!existing) return
        
        chatMessages.value[idx] = {
          id: m.id || existing.id,
          user: m.user_name || existing.user,
          userId: m.user_id || existing.userId,
          avatar: m.avatar || existing.avatar,
          text: m.text || existing.text,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : existing.timestamp,
          newsShare: m.news_share !== undefined ? m.news_share : existing.newsShare
        }
      }
    })
    .subscribe((status, err) => {
      if (err) console.error('Realtime subscription error:', err)
      if (status === 'SUBSCRIBED') console.log('Successfully connected to chat realtime')
    })
}

export const addChatMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp' | 'userId'>) => {
  if (!chatSession.value) return
  await supabase.from('messages').insert({
    user_id: chatSession.value.user.id,
    user_name: msg.user,
    avatar: msg.avatar,
    text: msg.text,
    news_share: msg.newsShare || null
  })
}

export const removeChatMessage = async (id: string) => {
  if (!chatSession.value) return
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) {
    console.error('刪除留言失敗:', error.message)
    alert('刪除留言失敗，可能沒有權限：' + error.message)
  }
}

export const chatSignOut = async () => {
  await supabase.auth.signOut()
  priceAlerts.value = [] // Clear alerts on logout
  showToast('登出成功', '您已安全退出 TradingBox')
}


