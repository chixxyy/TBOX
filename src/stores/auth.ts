import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { supabase } from '../services/supabase'
import { useAppStore } from './app'
import { useToastStore } from './toast'
import { usePortfolioStore } from './portfolio'

// Fallback for crypto.randomUUID()
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface UserProfile {
  id: string
  full_name: string
  avatar_url: string
  bio: string
  email?: string
}

export const useAuthStore = defineStore('auth', () => {
  const currentSessionId = ref(generateUUID())
  const isKickedOut = ref(false)
  const chatSession = ref<any>(null)
  const userProfile = ref<UserProfile | null>(null)
  const showLogoutConfirm = ref(false)

  // Platform Notice Logic
  const skipPlatformNotice = useStorage('tbox-skip-platform-notice', false)
  const showPlatformNotice = ref(!skipPlatformNotice.value)

  let lastAuthStartTime = Date.now()
  let sessionSyncChannel: any = null
  let lastSyncedUserId: string | null = null

  const appStore = useAppStore()
  const toastStore = useToastStore()
  const portfolioStore = usePortfolioStore()

  const chatUser = computed(() => 
    chatSession.value?.user?.user_metadata?.nickname || 
    chatSession.value?.user?.email?.split('@')[0] || 
    'GUEST'
  )

  const isAdmin = computed(() => {
    const email = chatSession.value?.user?.email || ''
    return email.toLowerCase() === 'a27976566@gmail.com' || email.toLowerCase() === 'admin@tradingbox.com'
  })

  // Global Auth UI Navigation
  const previousTab = ref('交易')

  const goToLogin = () => {
    previousTab.value = appStore.activeTab === '登入' ? '交易' : appStore.activeTab
    appStore.activeTab = '登入'
  }

  const handleLoginSuccess = () => {
    appStore.activeTab = previousTab.value
  }

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

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    if (!chatSession.value?.user.id) return { error: 'Not logged in' }

    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', chatSession.value.user.id)

    if (error) return { error }

    if (userProfile.value) {
      userProfile.value = { ...userProfile.value, ...updates }
    }

    const msgUpdates: any = {}
    if (updates.full_name) msgUpdates.user_name = updates.full_name
    if (updates.avatar_url) msgUpdates.avatar = updates.avatar_url

    if (Object.keys(msgUpdates).length > 0) {
      supabase.from('messages')
        .update(msgUpdates)
        .eq('user_id', chatSession.value.user.id)
        .then(({ error: syncErr }) => {
          if (syncErr) console.warn('Historical message message sync deferred or failed:', syncErr.message)
        })
    }

    return { error: null }
  }

  const initSessionSync = (userId: string) => {
    lastAuthStartTime = Date.now()

    if (lastSyncedUserId === userId && sessionSyncChannel) return

    if (sessionSyncChannel) {
      supabase.removeChannel(sessionSyncChannel)
    }

    lastSyncedUserId = userId
    sessionSyncChannel = supabase.channel(`session-sync:${userId}`, {
      config: {
        broadcast: { self: false }
      }
    })
      .on('broadcast', { event: 'NEW_SESSION' }, (payload: any) => {
        if (appStore.isSecurityUpdating) {
          console.log('[SECURITY] Security update in progress, ignoring sync conflict.')
          return
        }

        const incomingId = payload.payload?.sessionId
        if (Date.now() - lastAuthStartTime < 5000) return

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

  const chatSignOut = async (isInternal: boolean = false) => {
    console.log('[AUTH] Initiating sign-out sequence...', { isInternal })

    if (sessionSyncChannel) {
      console.log('[AUTH] Removing session sync channel...')
      supabase.removeChannel(sessionSyncChannel)
      sessionSyncChannel = null
      lastSyncedUserId = null
    }

    chatSession.value = null
    userProfile.value = null
    showLogoutConfirm.value = false
    skipPlatformNotice.value = false

    // Clear portfolio and price alerts from portfolioStore
    portfolioStore.portfolio = []
    portfolioStore.priceAlerts = []

    try {
      if (!isInternal) {
        await supabase.auth.signOut()
        console.log('[AUTH] Supabase signOut completed.')
      } else {
        console.log('[AUTH] Internal sign-out, skipping Supabase signOut.')
      }
    } catch (err) {
      console.error('[AUTH] Supabase signOut error:', err)
    }

    if (!isInternal) {
      isKickedOut.value = false
      appStore.activeTab = '交易'

      toastStore.showToast('登出成功', '您已安全退出 TradingBox', true)

      console.log('[AUTH] Performing clean reload in 1s...')
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
    } else {
      appStore.activeTab = '交易'
      console.warn('[AUTH] Session revoked internally (Single Session Logic)')
    }
  }

  watch(chatSession, (newSession, oldSession) => {
    if (newSession && newSession.user && (!oldSession || !oldSession.user) && !skipPlatformNotice.value) {
      showPlatformNotice.value = true
    }
  })

  const dismissPlatformNotice = (forever: any = false) => {
    const shouldSkipForever = forever === true
    showPlatformNotice.value = false
    if (shouldSkipForever) {
      skipPlatformNotice.value = true
    }

    toastStore.notificationHistory.unshift({
      id: 'notice-' + Date.now(),
      title: '平台公告紀錄',
      message: '溫馨提醒：如果發現資產報價沒有即時跳動或是討論區沒有正常連線，請點擊畫面右上方的「重置連線」按鈕或是直接重新整理網頁。',
      timestamp: Date.now(),
      isRead: false
    })
  }

  const resetPlatformNotice = () => {
    if (!skipPlatformNotice.value) {
      showPlatformNotice.value = true
    }
  }

  return {
    currentSessionId,
    isKickedOut,
    chatSession,
    userProfile,
    showLogoutConfirm,
    showPlatformNotice,
    chatUser,
    isAdmin,
    goToLogin,
    handleLoginSuccess,
    fetchUserProfile,
    updateUserProfile,
    initSessionSync,
    chatSignOut,
    dismissPlatformNotice,
    resetPlatformNotice
  }
})
