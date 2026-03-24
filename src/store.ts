import { ref, computed } from 'vue'
import { useStorage } from '@vueuse/core'

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

export const priceAlerts = useStorage<PriceAlert[]>('tbox-price-alerts', [])

export const addPriceAlert = (symbol: string, targetPrice: number, condition: 'above' | 'below') => {
  priceAlerts.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    symbol,
    targetPrice,
    condition,
    triggered: false
  })
}

export const removePriceAlert = (id: string) => {
  priceAlerts.value = priceAlerts.value.filter(a => a.id !== id)
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

export const showToast = (title: string, message: string) => {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 7)
  toasts.value.push({ id, title, message })
  
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

export const unreadNotificationsCount = computed(() => notificationHistory.value.filter(n => !n.isRead).length)

// --- Chat & Discussion & Auth ---
import { supabase } from './supabase'

export interface ChatMessage {
  id: string
  user: string
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
export const isAdmin = computed(() => chatSession.value?.user?.email === 'admin@tradingbox.com')
export const chatAvatar = computed(() => `https://ui-avatars.com/api/?name=${encodeURIComponent(chatUser.value)}&background=3b82f6&color=fff&rounded=true`)

export const chatMessages = ref<ChatMessage[]>([])
export const chatLoading = ref(true)

export const initSupabaseChat = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  chatSession.value = session

  supabase.auth.onAuthStateChange((_event, session) => {
    chatSession.value = session
  })

  // Fetch initial messages
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
    
  if (msgs) {
    chatMessages.value = msgs.reverse().map(m => ({
      id: m.id,
      user: m.user_name,
      avatar: m.avatar,
      text: m.text,
      timestamp: new Date(m.created_at).getTime(),
      newsShare: m.news_share
    }))
  }
  
  chatLoading.value = false

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
    .subscribe()
}

export const addChatMessage = async (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
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
  await supabase.from('messages').delete().eq('id', id)
}


