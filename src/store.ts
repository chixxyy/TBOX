import { ref, computed } from 'vue'

// Only track these 4 assets as requested
export const SUPPORTED_ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT']

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
