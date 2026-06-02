import { computed } from 'vue'
import { useAppStore } from './app'
import { useAuthStore } from './auth'
import { useToastStore } from './toast'
import { useMarketStore } from './market'
import { usePortfolioStore } from './portfolio'
import { useSportsStore } from './sports'
import { useChatStore } from './chat'

export * from './app'
export * from './auth'
export * from './toast'
export * from './market'
export * from './portfolio'
export * from './sports'
export * from './chat'

// --- Backward Compatibility Layer mapping original refs and functions to Pinia Stores ---

// --- App Store Mapping ---
export const activeSymbol = computed({
  get: () => useAppStore().activeSymbol,
  set: (val) => { useAppStore().activeSymbol = val }
})

export const activeInterval = computed({
  get: () => useAppStore().activeInterval,
  set: (val) => { useAppStore().activeInterval = val }
})

export const activeTab = computed({
  get: () => useAppStore().activeTab,
  set: (val) => { useAppStore().activeTab = val }
})

export const isEntryLoading = computed({
  get: () => useAppStore().isEntryLoading,
  set: (val) => { useAppStore().isEntryLoading = val }
})

export const isForgotPassword = computed({
  get: () => useAppStore().isForgotPassword,
  set: (val) => { useAppStore().isForgotPassword = val }
})

export const isSecurityUpdating = computed({
  get: () => useAppStore().isSecurityUpdating,
  set: (val) => { useAppStore().isSecurityUpdating = val }
})

export const activeSettingsTab = computed({
  get: () => useAppStore().activeSettingsTab,
  set: (val) => { useAppStore().activeSettingsTab = val }
})

export const showAIDrawer = computed({
  get: () => useAppStore().showAIDrawer,
  set: (val) => { useAppStore().showAIDrawer = val }
})

export const activeAIAsset = computed({
  get: () => useAppStore().activeAIAsset,
  set: (val) => { useAppStore().activeAIAsset = val }
})

export const scrollProgress = computed({
  get: () => useAppStore().scrollProgress,
  set: (val) => { useAppStore().scrollProgress = val }
})

export const isChangingTab = computed({
  get: () => useAppStore().isChangingTab,
  set: (val) => { useAppStore().isChangingTab = val }
})

export const setActiveSymbol = (symbol: string) => useAppStore().setActiveSymbol(symbol)
export const setActiveInterval = (interval: string) => useAppStore().setActiveInterval(interval)
export const formattedActiveSymbol = computed(() => useAppStore().formattedActiveSymbol)
export const openAIDrawer = (symbol: string, currentPrice: number, marketType: 'crypto' | 'stock' = 'crypto') => 
  useAppStore().openAIDrawer(symbol, currentPrice, marketType)
export const setScrollProgress = (progress: number) => useAppStore().setScrollProgress(progress)


// --- Market Store Mapping ---
export { initialAssets } from './market'

export const globalMovers = computed({
  get: () => useMarketStore().globalMovers,
  set: (val) => { useMarketStore().globalMovers = val }
})

export const globalNews = computed({
  get: () => useMarketStore().globalNews,
  set: (val) => { useMarketStore().globalNews = val }
})

export const lastNewsUpdate = computed({
  get: () => useMarketStore().lastNewsUpdate,
  set: (val) => { useMarketStore().lastNewsUpdate = val }
})

export const isMoversLoading = computed({
  get: () => useMarketStore().isMoversLoading,
  set: (val) => { useMarketStore().isMoversLoading = val }
})

export const isNewsLoading = computed({
  get: () => useMarketStore().isNewsLoading,
  set: (val) => { useMarketStore().isNewsLoading = val }
})

export const lastMoversUpdate = computed({
  get: () => useMarketStore().lastMoversUpdate,
  set: (val) => { useMarketStore().lastMoversUpdate = val }
})

export const marketPrices = computed({
  get: () => useMarketStore().marketPrices,
  set: (val) => { useMarketStore().marketPrices = val }
})

export const showShareConfirm = computed({
  get: () => useMarketStore().showShareConfirm,
  set: (val) => { useMarketStore().showShareConfirm = val }
})

export const newsToShare = computed({
  get: () => useMarketStore().newsToShare,
  set: (val) => { useMarketStore().newsToShare = val }
})

export const triggerShare = (news: any) => useMarketStore().triggerShare(news)


// --- Sports Store Mapping ---
export const trackedPlayers = computed({
  get: () => useSportsStore().trackedPlayers,
  set: (val) => { useSportsStore().trackedPlayers = val }
})

export const initTrackedPlayers = () => useSportsStore().initTrackedPlayers()


// --- Auth Store Mapping ---
export const currentSessionId = computed({
  get: () => useAuthStore().currentSessionId,
  set: (val) => { useAuthStore().currentSessionId = val }
})

export const isKickedOut = computed({
  get: () => useAuthStore().isKickedOut,
  set: (val) => { useAuthStore().isKickedOut = val }
})

export const chatSession = computed({
  get: () => useAuthStore().chatSession,
  set: (val) => { useAuthStore().chatSession = val }
})

export const userProfile = computed({
  get: () => useAuthStore().userProfile,
  set: (val) => { useAuthStore().userProfile = val }
})

export const showLogoutConfirm = computed({
  get: () => useAuthStore().showLogoutConfirm,
  set: (val) => { useAuthStore().showLogoutConfirm = val }
})

export const showPlatformNotice = computed({
  get: () => useAuthStore().showPlatformNotice,
  set: (val) => { useAuthStore().showPlatformNotice = val }
})

export const chatUser = computed(() => useAuthStore().chatUser)
export const isAdmin = computed(() => useAuthStore().isAdmin)

export const goToLogin = () => useAuthStore().goToLogin()
export const handleLoginSuccess = () => useAuthStore().handleLoginSuccess()
export const updateUserProfile = (updates: any) => useAuthStore().updateUserProfile(updates)
export const chatSignOut = (isInternal: boolean = false) => useAuthStore().chatSignOut(isInternal)
export const dismissPlatformNotice = (forever: any = false) => useAuthStore().dismissPlatformNotice(forever)
export const resetPlatformNotice = () => useAuthStore().resetPlatformNotice()


// --- Portfolio Store Mapping ---
export const portfolio = computed({
  get: () => usePortfolioStore().portfolio,
  set: (val) => { usePortfolioStore().portfolio = val }
})

export const priceAlerts = computed({
  get: () => usePortfolioStore().priceAlerts,
  set: (val) => { usePortfolioStore().priceAlerts = val }
})

export const addToPortfolio = (symbol: string, amount: number, entryPrice: number) => {
  const auth = useAuthStore()
  if (!auth.chatSession?.user?.id) return
  return usePortfolioStore().addToPortfolio(auth.chatSession.user.id, symbol, amount, entryPrice)
}

export const updatePortfolioItem = (id: string, amount: number, entryPrice: number) => 
  usePortfolioStore().updatePortfolioItem(id, amount, entryPrice)

export const removeFromPortfolio = (id: string) => usePortfolioStore().removeFromPortfolio(id)

export const addPriceAlert = (symbol: string, targetPrice: number, condition: 'above' | 'below') => {
  const auth = useAuthStore()
  if (!auth.chatSession?.user?.id) return
  return usePortfolioStore().addPriceAlert(auth.chatSession.user.id, symbol, targetPrice, condition)
}

export const removePriceAlert = (id: string) => usePortfolioStore().removePriceAlert(id)
export const updatePriceAlertTriggered = (id: string) => usePortfolioStore().updatePriceAlertTriggered(id)


// --- Toast Store Mapping ---
export const toasts = computed({
  get: () => useToastStore().toasts,
  set: (val) => { useToastStore().toasts = val }
})

export const notificationHistory = computed({
  get: () => useToastStore().notificationHistory,
  set: (val) => { useToastStore().notificationHistory = val }
})

export const isNotificationsEnabled = computed({
  get: () => useToastStore().isNotificationsEnabled,
  set: (val) => { useToastStore().isNotificationsEnabled = val }
})

export const hasClickedNotifications = computed({
  get: () => useToastStore().hasClickedNotifications,
  set: (val) => { useToastStore().hasClickedNotifications = val }
})

export const showToast = (title: string, message: string, silent: boolean = false, force: boolean = false) => 
  useToastStore().showToast(title, message, silent, force)

export const removeToast = (id: string) => useToastStore().removeToast(id)
export const markAllNotificationsRead = () => useToastStore().markAllNotificationsRead()
export const clearNotifications = () => useToastStore().clearNotifications()
export const removeNotificationLog = (id: string) => useToastStore().removeNotificationLog(id)
export const unreadNotificationsCount = computed(() => useToastStore().unreadNotificationsCount)


// --- Chat Store Mapping ---
export const chatMessages = computed({
  get: () => useChatStore().chatMessages,
  set: (val) => { useChatStore().chatMessages = val }
})

export const chatLoading = computed({
  get: () => useChatStore().chatLoading,
  set: (val) => { useChatStore().chatLoading = val }
})

export const isChatConnected = computed({
  get: () => useChatStore().isChatConnected,
  set: (val) => { useChatStore().isChatConnected = val }
})

export const initSupabaseChat = () => useChatStore().initSupabaseChat()
export const addChatMessage = (msg: { user: string; avatar: string; text: string; newsShare?: any }) => 
  useChatStore().addChatMessage(msg)
export const removeChatMessage = (id: string) => useChatStore().removeChatMessage(id)
