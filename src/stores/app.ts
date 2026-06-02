import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const activeSymbol = ref('BTCUSDT')
  const activeInterval = ref('1d')
  const activeTab = ref('交易')
  const isEntryLoading = ref(true)
  const isForgotPassword = ref(false)
  const isSecurityUpdating = ref(false)
  const activeSettingsTab = ref<'basic' | 'security'>('basic')

  const showAIDrawer = ref(false)
  const activeAIAsset = ref<{ symbol: string; currentPrice: number; marketType: 'crypto' | 'stock' } | null>(null)

  const scrollProgress = ref(0) // 0 to 100
  const isChangingTab = ref(false)

  const setActiveSymbol = (symbol: string) => {
    activeSymbol.value = symbol
  }

  const setActiveInterval = (interval: string) => {
    activeInterval.value = interval
  }

  const formattedActiveSymbol = computed(() => {
    return activeSymbol.value.replace('USDT', '/USDT').replace('^', '')
  })

  const openAIDrawer = (symbol: string, currentPrice: number, marketType: 'crypto' | 'stock' = 'crypto') => {
    activeAIAsset.value = { symbol, currentPrice, marketType }
    showAIDrawer.value = true
  }

  const setScrollProgress = (progress: number) => {
    scrollProgress.value = Math.max(0, Math.min(100, progress))
  }

  return {
    activeSymbol,
    activeInterval,
    activeTab,
    isEntryLoading,
    isForgotPassword,
    isSecurityUpdating,
    activeSettingsTab,
    showAIDrawer,
    activeAIAsset,
    scrollProgress,
    isChangingTab,
    setActiveSymbol,
    setActiveInterval,
    formattedActiveSymbol,
    openAIDrawer,
    setScrollProgress
  }
})
