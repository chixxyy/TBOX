import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { supabase } from '../services/supabase'
import { useMarketStore } from './market'
import { useToastStore } from './toast'
import { useAuthStore } from './auth'

interface PortfolioItem {
  id: string
  symbol: string
  amount: number
  entryPrice: number
}

interface PendingOrder {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  amount: number
  limitPrice: number
  createdAt: number
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

  // Load and save virtual trading data scoped by user ID
  const currentUserId = ref('GUEST')
  const virtualCash = ref(100000)
  const virtualPortfolio = ref<PortfolioItem[]>([])
  const virtualPendingOrders = ref<PendingOrder[]>([])

  const loadSupabaseVirtualData = async (userId: string) => {
    // 1. Fetch or initialize Cash
    const { data: cashData, error: cashErr } = await supabase
      .from('virtual_accounts')
      .select('cash')
      .eq('user_id', userId)
      .maybeSingle()

    if (!cashErr) {
      if (cashData) {
        virtualCash.value = Number(cashData.cash)
      } else {
        const { error: insErr } = await supabase
          .from('virtual_accounts')
          .insert({ user_id: userId, cash: 100000.00 })
        if (!insErr) {
          virtualCash.value = 100000
        }
      }
    }

    // 2. Fetch Portfolio Holdings
    const { data: portData, error: portErr } = await supabase
      .from('virtual_portfolio')
      .select('*')
      .eq('user_id', userId)

    if (!portErr && portData) {
      virtualPortfolio.value = portData.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        amount: Number(item.amount),
        entryPrice: Number(item.entry_price)
      }))
    }

    // 3. Fetch Pending Orders
    const { data: orderData, error: orderErr } = await supabase
      .from('virtual_pending_orders')
      .select('*')
      .eq('user_id', userId)

    if (!orderErr && orderData) {
      virtualPendingOrders.value = orderData.map((item: any) => ({
        id: item.id,
        symbol: item.symbol,
        type: item.type as 'buy' | 'sell',
        amount: Number(item.amount),
        limitPrice: Number(item.limit_price),
        createdAt: new Date(item.created_at).getTime()
      }))
    }
  }

  // Watch user ID changes dynamically to scope Supabase
  watch(() => {
    try {
      const authStore = useAuthStore()
      return authStore.chatSession?.user?.id || null
    } catch {
      return null
    }
  }, (newId) => {
    if (newId) {
      currentUserId.value = newId
      loadSupabaseVirtualData(newId)
    } else {
      currentUserId.value = 'GUEST'
      virtualCash.value = 100000
      virtualPortfolio.value = []
      virtualPendingOrders.value = []
    }
  }, { immediate: true })

  // Check pending orders and portfolio alerts when prices update
  const checkPendingOrders = async () => {
    if (virtualPendingOrders.value.length === 0) return

    const ordersToKeep: PendingOrder[] = []
    
    for (const order of virtualPendingOrders.value) {
      const market = marketStore.marketPrices[order.symbol]
      if (!market || market.rawPrice === 0) {
        ordersToKeep.push(order)
        continue
      }

      const currentPriceVal = market.rawPrice
      let triggered = false

      if (order.type === 'buy' && currentPriceVal <= order.limitPrice) {
        triggered = true
        
        if (currentUserId.value !== 'GUEST') {
          const { error: delErr } = await supabase
            .from('virtual_pending_orders')
            .delete()
            .eq('id', order.id)
          if (delErr) {
            triggered = false
            ordersToKeep.push(order)
            continue
          }

          const upperSymbol = order.symbol.toUpperCase()
          const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
          if (existing) {
            const totalAmount = existing.amount + order.amount
            const averagePrice = ((existing.entryPrice * existing.amount) + (order.limitPrice * order.amount)) / totalAmount
            await supabase
              .from('virtual_portfolio')
              .update({ amount: totalAmount, entry_price: averagePrice })
              .eq('user_id', currentUserId.value)
              .eq('symbol', upperSymbol)
          } else {
            await supabase
              .from('virtual_portfolio')
              .insert({
                user_id: currentUserId.value,
                symbol: upperSymbol,
                amount: order.amount,
                entry_price: order.limitPrice
              })
          }
        }

        const upperSymbol = order.symbol.toUpperCase()
        const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
        if (existing) {
          const totalAmount = existing.amount + order.amount
          const averagePrice = ((existing.entryPrice * existing.amount) + (order.limitPrice * order.amount)) / totalAmount
          existing.amount = totalAmount
          existing.entryPrice = averagePrice
        } else {
          virtualPortfolio.value.push({
            id: Math.random().toString(36).substring(2, 11),
            symbol: upperSymbol,
            amount: order.amount,
            entryPrice: order.limitPrice
          })
        }
        toastStore.showToast('限價買入成功', `已以價格 $${order.limitPrice} 買入 ${order.amount} 單位 ${order.symbol}`)
      } else if (order.type === 'sell' && currentPriceVal >= order.limitPrice) {
        triggered = true

        if (currentUserId.value !== 'GUEST') {
          const { error: delErr } = await supabase
            .from('virtual_pending_orders')
            .delete()
            .eq('id', order.id)
          if (delErr) {
            triggered = false
            ordersToKeep.push(order)
            continue
          }

          const revenue = order.amount * order.limitPrice
          const newCash = Math.min(100000, virtualCash.value + revenue)
          await supabase
            .from('virtual_accounts')
            .update({ cash: newCash })
            .eq('user_id', currentUserId.value)
        }

        const revenue = order.amount * order.limitPrice
        virtualCash.value = Math.min(100000, virtualCash.value + revenue)
        toastStore.showToast('限價賣出成功', `已以價格 $${order.limitPrice} 賣出 ${order.amount} 單位 ${order.symbol}`)
      }

      if (!triggered) {
        ordersToKeep.push(order)
      }
    }

    if (ordersToKeep.length !== virtualPendingOrders.value.length) {
      virtualPendingOrders.value = ordersToKeep
    }
  }

  // Watch marketPrices changes to check alerts and pending limit orders
  watch(() => marketStore.marketPrices, () => {
    checkPortfolioAlerts()
    checkPendingOrders()
  }, { deep: true })

  const buyVirtualAsset = async (symbol: string, amount: number, price: number) => {
    const cost = amount * price
    if (cost > virtualCash.value) {
      toastStore.showToast('交易失敗', '虛擬資金不足')
      return false
    }

    const upperSymbol = symbol.toUpperCase()
    const newCash = virtualCash.value - cost

    if (currentUserId.value !== 'GUEST') {
      const { error: cashErr } = await supabase
        .from('virtual_accounts')
        .update({ cash: newCash })
        .eq('user_id', currentUserId.value)
      if (cashErr) {
        toastStore.showToast('交易失敗', '資料庫連線錯誤')
        return false
      }

      const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
      let error: any = null
      if (existing) {
        const totalAmount = existing.amount + amount
        const averagePrice = ((existing.entryPrice * existing.amount) + (price * amount)) / totalAmount
        const { error: portErr } = await supabase
          .from('virtual_portfolio')
          .update({ amount: totalAmount, entry_price: averagePrice })
          .eq('user_id', currentUserId.value)
          .eq('symbol', upperSymbol)
        error = portErr
      } else {
        const { error: portErr } = await supabase
          .from('virtual_portfolio')
          .insert({
            user_id: currentUserId.value,
            symbol: upperSymbol,
            amount,
            entry_price: price
          })
        error = portErr
      }
      if (error) {
        await supabase.from('virtual_accounts').update({ cash: virtualCash.value }).eq('user_id', currentUserId.value)
        toastStore.showToast('交易失敗', '更新持倉資料失敗')
        return false
      }
    }

    virtualCash.value = newCash
    const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
    if (existing) {
      const totalAmount = existing.amount + amount
      const averagePrice = ((existing.entryPrice * existing.amount) + (price * amount)) / totalAmount
      existing.amount = totalAmount
      existing.entryPrice = averagePrice
    } else {
      virtualPortfolio.value.push({
        id: Math.random().toString(36).substring(2, 11),
        symbol: upperSymbol,
        amount,
        entryPrice: price
      })
    }

    toastStore.showToast('交易成功', `已買入 ${amount} 單位 ${upperSymbol}`)
    return true
  }

  const sellVirtualAsset = async (symbol: string, amount: number, price: number) => {
    const upperSymbol = symbol.toUpperCase()
    const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
    if (!existing) {
      toastStore.showToast('交易失敗', `未持有 ${upperSymbol}`)
      return false
    }

    if (existing.amount < amount) {
      toastStore.showToast('交易失敗', `持有數量不足，目前持有: ${existing.amount}`)
      return false
    }

    const revenue = amount * price
    const newCash = Math.min(100000, virtualCash.value + revenue)

    if (currentUserId.value !== 'GUEST') {
      const { error: cashErr } = await supabase
        .from('virtual_accounts')
        .update({ cash: newCash })
        .eq('user_id', currentUserId.value)
      if (cashErr) {
        toastStore.showToast('交易失敗', '資料庫連線錯誤')
        return false
      }

      let error: any = null
      if (existing.amount === amount) {
        const { error: portErr } = await supabase
          .from('virtual_portfolio')
          .delete()
          .eq('user_id', currentUserId.value)
          .eq('symbol', upperSymbol)
        error = portErr
      } else {
        const { error: portErr } = await supabase
          .from('virtual_portfolio')
          .update({ amount: existing.amount - amount })
          .eq('user_id', currentUserId.value)
          .eq('symbol', upperSymbol)
        error = portErr
      }
      if (error) {
        await supabase.from('virtual_accounts').update({ cash: virtualCash.value }).eq('user_id', currentUserId.value)
        toastStore.showToast('交易失敗', '更新持倉資料失敗')
        return false
      }
    }

    virtualCash.value = newCash
    if (existing.amount === amount) {
      virtualPortfolio.value = virtualPortfolio.value.filter(item => item.symbol !== upperSymbol)
    } else {
      existing.amount -= amount
    }

    toastStore.showToast('交易成功', `已賣出 ${amount} 單位 ${upperSymbol}`)
    return true
  }

  const placeLimitOrder = async (symbol: string, type: 'buy' | 'sell', amount: number, limitPrice: number) => {
    const upperSymbol = symbol.toUpperCase()
    if (type === 'buy') {
      const cost = amount * limitPrice
      if (cost > virtualCash.value) {
        toastStore.showToast('限價單委託失敗', '虛擬資金不足')
        return false
      }
      const newCash = virtualCash.value - cost

      if (currentUserId.value !== 'GUEST') {
        const { error: cashErr } = await supabase
          .from('virtual_accounts')
          .update({ cash: newCash })
          .eq('user_id', currentUserId.value)
        if (cashErr) {
          toastStore.showToast('限價單委託失敗', '資料庫連線錯誤')
          return false
        }
        
        const { data, error: orderErr } = await supabase
          .from('virtual_pending_orders')
          .insert({
            user_id: currentUserId.value,
            symbol: upperSymbol,
            type,
            amount,
            limit_price: limitPrice
          })
          .select()
          .single()

        if (orderErr) {
          await supabase.from('virtual_accounts').update({ cash: virtualCash.value }).eq('user_id', currentUserId.value)
          toastStore.showToast('限價單委託失敗', '新增委託單失敗')
          return false
        }

        virtualCash.value = newCash
        virtualPendingOrders.value.push({
          id: data.id,
          symbol: upperSymbol,
          type,
          amount,
          limitPrice,
          createdAt: new Date(data.created_at).getTime()
        })
      } else {
        virtualCash.value = newCash
        virtualPendingOrders.value.push({
          id: Math.random().toString(36).substring(2, 11),
          symbol: upperSymbol,
          type,
          amount,
          limitPrice,
          createdAt: Date.now()
        })
      }
    } else {
      const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
      if (!existing || existing.amount < amount) {
        toastStore.showToast('限價單委託失敗', `持股不足，目前持有: ${existing ? existing.amount : 0}`)
        return false
      }

      const newAmount = existing.amount - amount
      if (currentUserId.value !== 'GUEST') {
        let error: any = null
        if (newAmount === 0) {
          const { error: portErr } = await supabase
            .from('virtual_portfolio')
            .delete()
            .eq('user_id', currentUserId.value)
            .eq('symbol', upperSymbol)
          error = portErr
        } else {
          const { error: portErr } = await supabase
            .from('virtual_portfolio')
            .update({ amount: newAmount })
            .eq('user_id', currentUserId.value)
            .eq('symbol', upperSymbol)
          error = portErr
        }

        if (error) {
          toastStore.showToast('限價單委託失敗', '鎖定持倉資料失敗')
          return false
        }

        const { data, error: orderErr } = await supabase
          .from('virtual_pending_orders')
          .insert({
            user_id: currentUserId.value,
            symbol: upperSymbol,
            type,
            amount,
            limit_price: limitPrice
          })
          .select()
          .single()

        if (orderErr) {
          if (newAmount === 0) {
            await supabase.from('virtual_portfolio').insert({
              user_id: currentUserId.value,
              symbol: upperSymbol,
              amount: existing.amount,
              entry_price: existing.entryPrice
            })
          } else {
            await supabase.from('virtual_portfolio').update({ amount: existing.amount }).eq('user_id', currentUserId.value).eq('symbol', upperSymbol)
          }
          toastStore.showToast('限價單委託失敗', '新增委託單失敗')
          return false
        }

        if (newAmount === 0) {
          virtualPortfolio.value = virtualPortfolio.value.filter(item => item.symbol !== upperSymbol)
        } else {
          existing.amount = newAmount
        }

        virtualPendingOrders.value.push({
          id: data.id,
          symbol: upperSymbol,
          type,
          amount,
          limitPrice,
          createdAt: new Date(data.created_at).getTime()
        })
      } else {
        if (newAmount === 0) {
          virtualPortfolio.value = virtualPortfolio.value.filter(item => item.symbol !== upperSymbol)
        } else {
          existing.amount = newAmount
        }

        virtualPendingOrders.value.push({
          id: Math.random().toString(36).substring(2, 11),
          symbol: upperSymbol,
          type,
          amount,
          limitPrice,
          createdAt: Date.now()
        })
      }
    }

    toastStore.showToast('限價單已委託', `已委託以價格 $${limitPrice} ${type === 'buy' ? '買入' : '賣出'} ${amount} 單位 ${upperSymbol}`)
    return true
  }

  const cancelLimitOrder = async (orderId: string) => {
    const orderIndex = virtualPendingOrders.value.findIndex(o => o.id === orderId)
    if (orderIndex === -1) return false

    const order = virtualPendingOrders.value[orderIndex]
    if (!order) return false

    if (currentUserId.value !== 'GUEST') {
      const { error: delErr } = await supabase
        .from('virtual_pending_orders')
        .delete()
        .eq('id', orderId)
      if (delErr) {
        toastStore.showToast('撤單失敗', '資料庫連線錯誤')
        return false
      }

      if (order.type === 'buy') {
        const newCash = Math.min(100000, virtualCash.value + order.amount * order.limitPrice)
        await supabase
          .from('virtual_accounts')
          .update({ cash: newCash })
          .eq('user_id', currentUserId.value)
      } else {
        const upperSymbol = order.symbol.toUpperCase()
        const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
        if (existing) {
          await supabase
            .from('virtual_portfolio')
            .update({ amount: existing.amount + order.amount })
            .eq('user_id', currentUserId.value)
            .eq('symbol', upperSymbol)
        } else {
          await supabase
            .from('virtual_portfolio')
            .insert({
              user_id: currentUserId.value,
              symbol: upperSymbol,
              amount: order.amount,
              entry_price: order.limitPrice
            })
        }
      }
    }

    if (order.type === 'buy') {
      virtualCash.value = Math.min(100000, virtualCash.value + order.amount * order.limitPrice)
    } else {
      const upperSymbol = order.symbol.toUpperCase()
      const existing = virtualPortfolio.value.find(item => item.symbol === upperSymbol)
      if (existing) {
        existing.amount += order.amount
      } else {
        virtualPortfolio.value.push({
          id: Math.random().toString(36).substring(2, 11),
          symbol: upperSymbol,
          amount: order.amount,
          entryPrice: order.limitPrice
        })
      }
    }

    virtualPendingOrders.value.splice(orderIndex, 1)
    toastStore.showToast('已撤單', `限價單已取消，已退還鎖定資金/持股。`)
    return true
  }

  const resetVirtualAccount = async () => {
    if (currentUserId.value !== 'GUEST') {
      const { error } = await supabase
        .from('virtual_accounts')
        .update({ cash: 100000 })
        .eq('user_id', currentUserId.value)
      if (error) {
        toastStore.showToast('重置失敗', '更新資料庫失敗')
        return
      }
    }

    virtualCash.value = 100000
    toastStore.showToast('帳戶重置', '模擬帳戶虛擬資金已重置為 100,000 USD，保留您當前的持倉與未結訂單。')
  }

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
    updatePriceAlertTriggered,
    virtualCash,
    virtualPortfolio,
    virtualPendingOrders,
    buyVirtualAsset,
    sellVirtualAsset,
    placeLimitOrder,
    cancelLimitOrder,
    resetVirtualAccount
  }
})
