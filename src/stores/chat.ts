import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../services/supabase'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { usePortfolioStore } from './portfolio'
import { useSportsPredictionsStore } from './sports_predictions'

interface ChatMessage {
  id: string
  user: string
  userId: string
  avatar: string
  text: string
  timestamp: number
  newsShare?: {
    headline?: string
    url?: string
    source?: string
    type?: 'ai_insight'
    symbol?: string
    score?: number
    summary?: string
  }
}

export const useChatStore = defineStore('chat', () => {
  const chatMessages = ref<ChatMessage[]>([])
  const chatLoading = ref(true)
  const isChatConnected = ref(true)

  let chatChannel: any = null

  const authStore = useAuthStore()
  const toastStore = useToastStore()
  const portfolioStore = usePortfolioStore()
  const sportsPredictionsStore = useSportsPredictionsStore()

  const initSupabaseChat = async () => {
    if (chatChannel) {
      supabase.removeChannel(chatChannel)
      chatChannel = null
    }

    chatLoading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      authStore.chatSession = session
      if (session?.user.id) {
        await authStore.fetchUserProfile(session.user.id)
        await portfolioStore.fetchPortfolio(session.user.id)
        await portfolioStore.loadSupabaseVirtualData(session.user.id)
        await sportsPredictionsStore.fetchPredictions(session.user.id)
        authStore.initSessionSync(session.user.id)
      } else {
        authStore.userProfile = null
        portfolioStore.portfolio = []
        portfolioStore.clearVirtualData()
        sportsPredictionsStore.clearPredictions()
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        authStore.chatSession = session
        if (session?.user.id) {
          authStore.fetchUserProfile(session.user.id)
          portfolioStore.fetchPriceAlerts(session.user.id)
          portfolioStore.fetchPortfolio(session.user.id)
          await portfolioStore.loadSupabaseVirtualData(session.user.id)
          await sportsPredictionsStore.fetchPredictions(session.user.id)
          authStore.initSessionSync(session.user.id)
        } else {
          authStore.userProfile = null
          portfolioStore.priceAlerts = []
          portfolioStore.portfolio = []
          portfolioStore.clearVirtualData()
          sportsPredictionsStore.clearPredictions()
        }
      })

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

      if (session?.user.id) {
        await portfolioStore.fetchPriceAlerts(session.user.id)
      } else {
        portfolioStore.priceAlerts = []
      }
    } catch (err) {
      console.error('Supabase init error:', err)
    } finally {
      chatLoading.value = false
    }

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
        const m = payload.new
        const existingTempIndex = chatMessages.value.findIndex(msg =>
          msg.id.startsWith('temp-') &&
          msg.userId === m.user_id &&
          msg.text === m.text
        )

        if (existingTempIndex !== -1) {
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

  const addChatMessage = async (msg: { user: string; avatar: string; text: string; newsShare?: any }) => {
    console.log('Store: addChatMessage start', msg)
    if (!authStore.chatSession) {
      toastStore.showToast('發送失敗', '請先登入後再發言', false)
      return
    }

    const tempId = 'temp-' + Date.now()
    const tempMsg: ChatMessage = {
      id: tempId,
      user: msg.user,
      userId: authStore.chatSession.user.id,
      avatar: msg.avatar,
      text: msg.text,
      timestamp: Date.now(),
      newsShare: msg.newsShare ? JSON.parse(JSON.stringify(msg.newsShare)) : undefined
    }

    chatMessages.value.push(tempMsg)
    if (chatMessages.value.length > 500) chatMessages.value.shift()

    try {
      const newsData = msg.newsShare ? JSON.parse(JSON.stringify(msg.newsShare)) : null

      const { data: insertedData, error } = await supabase.from('messages').insert({
        user_id: authStore.chatSession.user.id,
        user_name: msg.user,
        avatar: msg.avatar,
        text: msg.text,
        news_share: newsData
      }).select().single()

      if (error) throw error

      console.log('Store: Supabase insert success', insertedData?.id)
    } catch (err: any) {
      console.error('Store: addChatMessage error:', err)
      chatMessages.value = chatMessages.value.filter(m => m.id !== tempId)
      toastStore.showToast('發送失敗', '請確認網路連線: ' + (err.message || 'Unknown'), false)
      throw err
    }
  }

  const removeChatMessage = async (id: string) => {
    if (!authStore.chatSession) return

    const prevMessages = [...chatMessages.value]
    chatMessages.value = chatMessages.value.filter(m => String(m.id) !== String(id))

    try {
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
        throw new Error('找不到該留言或權限不足 (RLS)')
      }

      toastStore.showToast('刪除成功', '留言已從討論區移除')
    } catch (err: any) {
      console.error('刪除留言失敗:', err.message || err)
      chatMessages.value = prevMessages
      toastStore.showToast('刪除失敗', `錯誤: ${err.message || '連線或權限問題'}`, false)
    }
  }

  return {
    chatMessages,
    chatLoading,
    isChatConnected,
    initSupabaseChat,
    addChatMessage,
    removeChatMessage
  }
})
