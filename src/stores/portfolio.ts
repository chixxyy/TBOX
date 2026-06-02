import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { supabase } from '../services/supabase'
import { useMarketStore } from './market'
import { useToastStore } from './toast'

interface PortfolioItem {
  id: string
  symbol: string
  amount: number
  entryPrice: number
}

interface PriceAlert {
  id: string
  symbol: string
  targetPrice: number
  condition: 'above' | 'below'
  triggered: boolean
}

export const usePortfolioStore = defineStore('portfolio', () => {
  const portfolio = ref<PortfolioItem[]>([])
  const priceAlerts = ref<PriceAlert[]>([])
  const alertThresholds = useStorage<Record<string, number[]>>('tbox-portfolio-alerts-triggered', {})

  const marketStore = useMarketStore()
  const toastStore = useToastStore()

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

  const addToPortfolio = async (userId: string, symbol: string, amount: number, entryPrice: number) => {
    const { data, error } = await supabase.from('portfolio').insert({
      user_id: userId,
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

  const updatePortfolioItem = async (id: string, amount: number, entryPrice: number) => {
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

  const removeFromPortfolio = async (id: string) => {
    const { error } = await supabase.from('portfolio').delete().eq('id', id)
    if (!error) {
      portfolio.value = portfolio.value.filter((item: PortfolioItem) => item.id !== id)
      if (alertThresholds.value) delete alertThresholds.value[id]
    }
  }

  const checkPortfolioAlerts = () => {
    const alerts = alertThresholds.value
    if (!alerts) return

    portfolio.value.forEach((item: PortfolioItem) => {
      const market = marketStore.marketPrices[item.symbol]
      if (!market || market.rawPrice === 0) return

      const change = (market.rawPrice / item.entryPrice - 1) * 100
      const absChange = Math.abs(change)

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

          toastStore.showToast(
            `${titlePrefix}資產異動提醒: ${item.symbol}`,
            `持倉 ${item.symbol} 已${type} ${t}%！目前回報: ${change.toFixed(2)}%`
          )
          currentItemAlerts.push(t)
          alertThresholds.value = { ...alerts }
          break
        }
      }
    })
  }

  const addPriceAlert = async (userId: string, symbol: string, targetPrice: number, condition: 'above' | 'below') => {
    const { data, error } = await supabase.from('price_alerts').insert({
      user_id: userId,
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

  const removePriceAlert = async (id: string) => {
    const { error } = await supabase.from('price_alerts').delete().eq('id', id)
    if (!error) {
      priceAlerts.value = priceAlerts.value.filter((a: PriceAlert) => a.id !== id)
    }
  }

  const updatePriceAlertTriggered = async (id: string) => {
    await supabase.from('price_alerts').update({ triggered: true }).eq('id', id)
    const alert = priceAlerts.value.find((a: PriceAlert) => a.id === id)
    if (alert) alert.triggered = true
  }

  // Watch marketPrices changes to check alerts
  watch(() => marketStore.marketPrices, () => {
    checkPortfolioAlerts()
  }, { deep: true })

  return {
    portfolio,
    priceAlerts,
    fetchPortfolio,
    addToPortfolio,
    updatePortfolioItem,
    removeFromPortfolio,
    addPriceAlert,
    fetchPriceAlerts,
    removePriceAlert,
    updatePriceAlertTriggered
  }
})
