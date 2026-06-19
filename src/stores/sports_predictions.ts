import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../services/supabase'
import { useToastStore } from './toast'

export interface SportsPrediction {
  id: string
  user_id: string
  match_id: string
  sport_type: 'MLB' | 'NBA'
  home_team: string
  away_team: string
  commence_time: string
  predicted_outcome: 'home' | 'away'
  status: 'pending' | 'won' | 'lost'
  created_at: string
  home_score?: number | null
  away_score?: number | null
}

export const useSportsPredictionsStore = defineStore('sportsPredictions', () => {
  const predictions = ref<SportsPrediction[]>([])
  const toastStore = useToastStore()

  const fetchPredictions = async (userId: string) => {
    const { data, error } = await supabase
      .from('sports_predictions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      predictions.value = data as SportsPrediction[]
    }
  }

  const placePrediction = async (
    userId: string,
    matchId: string,
    sportType: 'MLB' | 'NBA',
    homeTeam: string,
    awayTeam: string,
    commenceTime: string,
    outcome: 'home' | 'away'
  ) => {
    // 1. Check daily limit (3 predictions per day in user local time)
    const todayStr = new Date().toLocaleDateString('zh-TW')
    const todayCount = predictions.value.filter(
      p => new Date(p.created_at).toLocaleDateString('zh-TW') === todayStr
    ).length

    if (todayCount >= 3) {
      toastStore.showToast('預測失敗', '每日最多預測三場賽事！', false)
      return false
    }

    // 2. Check if already predicted this match
    const existing = predictions.value.find(p => p.match_id === matchId)
    if (existing) {
      toastStore.showToast('預測失敗', '您已預測過此場賽事！', false)
      return false
    }

    // 3. Insert into Supabase
    const { data, error } = await supabase
      .from('sports_predictions')
      .insert({
        user_id: userId,
        match_id: matchId,
        sport_type: sportType,
        home_team: homeTeam,
        away_team: awayTeam,
        commence_time: commenceTime,
        predicted_outcome: outcome,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      toastStore.showToast('預測失敗', '資料庫寫入錯誤', false)
      return false
    }

    if (data) {
      predictions.value.unshift(data as SportsPrediction)
      toastStore.showToast(
        '預測成功',
        `已預測 ${homeTeam} vs ${awayTeam} 的勝出者為 ${outcome === 'home' ? homeTeam : awayTeam}`
      )
      return true
    }

    return false
  }

  const updatePredictionStatus = async (id: string, status: 'won' | 'lost', homeScore?: number, awayScore?: number) => {
    const updates: any = { status }
    if (homeScore !== undefined) updates.home_score = homeScore
    if (awayScore !== undefined) updates.away_score = awayScore

    let { error } = await supabase
      .from('sports_predictions')
      .update(updates)
      .eq('id', id)

    // Fallback if database columns home_score/away_score don't exist yet
    if (error && (error.message.includes('column') || error.code === '42703')) {
      const fallbackRes = await supabase
        .from('sports_predictions')
        .update({ status })
        .eq('id', id)
      error = fallbackRes.error
    }

    if (!error) {
      const pred = predictions.value.find(p => p.id === id)
      if (pred) {
        pred.status = status
        if (homeScore !== undefined) pred.home_score = homeScore
        if (awayScore !== undefined) pred.away_score = awayScore
      }
    }
  }

  const deletePrediction = async (id: string) => {
    const { error } = await supabase
      .from('sports_predictions')
      .delete()
      .eq('id', id)

    if (!error) {
      predictions.value = predictions.value.filter(p => p.id !== id)
      toastStore.showToast('已刪除預測', '您可以重新進行預測選擇。')
      return true
    } else {
      toastStore.showToast('刪除失敗', '無法刪除預測紀錄，請稍後再試。', false)
      return false
    }
  }

  const clearPredictions = () => {
    predictions.value = []
  }

  // Calculated Stats
  const winRate = computed(() => {
    const won = predictions.value.filter(p => p.status === 'won').length
    const lost = predictions.value.filter(p => p.status === 'lost').length
    const total = won + lost
    if (total === 0) return '0.0%'
    return `${((won / total) * 100).toFixed(1)}%`
  })

  const predictionsRemainingToday = computed(() => {
    const todayStr = new Date().toLocaleDateString('zh-TW')
    const todayCount = predictions.value.filter(
      p => new Date(p.created_at).toLocaleDateString('zh-TW') === todayStr
    ).length
    return Math.max(0, 3 - todayCount)
  })

  return {
    predictions,
    fetchPredictions,
    placePrediction,
    updatePredictionStatus,
    deletePrediction,
    clearPredictions,
    winRate,
    predictionsRemainingToday
  }
})
