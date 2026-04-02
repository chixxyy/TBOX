<script setup lang="ts">
import { computed, ref } from 'vue'
import { showToast } from '../store'

const props = defineProps<{
  eventData: any,
  isNew?: boolean
}>()

const translatedQuestion = ref('')
const isTranslating = ref(false)
const showTranslated = ref(false)

async function translateText(text: string): Promise<string> {
  if (!text) return ''
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-TW`)
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`)
    const data = await res.json()
    if (data.responseStatus !== 200) {
      console.warn('[MARKET_TRANSLATE] API returned non-200 status:', data)
      return text
    }
    return data.responseData?.translatedText || text
  } catch (err) { 
    console.error('[MARKET_TRANSLATE] Error fetching translation:', err)
    return text 
  }
}

const toggleTranslate = async () => {
  if (showTranslated.value) {
    showTranslated.value = false
    return
  }
  
  if (translatedQuestion.value) {
    showTranslated.value = true
    return
  }
  
  isTranslating.value = true
  try {
    const result = await translateText(props.eventData.question)
    if (result === props.eventData.question) {
      showToast('翻譯未生效', 'API 目前暫時無法回應（可能已達每日限額）。')
      return
    }
    translatedQuestion.value = result
    showTranslated.value = true
  } catch (error) {
    console.error('[MARKET_TRANSLATE] Error:', error)
    showToast('翻譯錯誤', '無法連接到翻譯伺服器')
  } finally {
    isTranslating.value = false
  }
}

const displayQuestion = computed(() => {
  return showTranslated.value && translatedQuestion.value ? translatedQuestion.value : props.eventData.question
})

const outcomes = computed(() => {
  let rawLabels = props.eventData.outcomes
  let rawPrices = props.eventData.outcomePrices
  
  if (!rawLabels || !rawPrices) return []
  
  try {
    const labels = typeof rawLabels === 'string' ? JSON.parse(rawLabels) : rawLabels
    const prices = typeof rawPrices === 'string' ? JSON.parse(rawPrices) : rawPrices
    
    if (!Array.isArray(labels)) return []

    let mappedOutcomes = labels.map((label: string, index: number) => {
      const priceStr = prices[index] || "0"
      const prob = parseFloat(priceStr) * 100
      return {
        label,
        probability: prob,
        colorClass: getProbabilityColorClass(prob)
      }
    })
    
    if (mappedOutcomes.length === 2 && mappedOutcomes[0]?.label === 'Yes' && mappedOutcomes[1]?.label === 'No') {
       // Keep order
    } else {
       mappedOutcomes.sort((a: any, b: any) => b.probability - a.probability)
    }
    
    return mappedOutcomes.slice(0, 2)
  } catch (e) {
    console.error("Outcomes processing error:", e)
    return []
  }
})

function getProbabilityColorClass(prob: number) {
  if (prob >= 70) return 'bg-green-500'
  if (prob >= 40) return 'bg-blue-500'
  if (prob >= 15) return 'bg-yellow-500'
  return 'bg-slate-500'
}

const formatCurrency = (val: any) => {
  const num = parseFloat(val)
  if (!num || isNaN(num)) return '$0'
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
  return `$${num.toFixed(0)}`
}

const formattedDate = computed(() => {
  const dateStr = props.eventData.endDateIso || props.eventData.endDate
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})

const marketUrl = computed(() => {
  // Polymarket URL Logic:
  // 1. If part of an event, use event slug (most reliable for context)
  // 2. Otherwise, use specific market slug with /market/ prefix
  const eventSlug = props.eventData.events?.[0]?.slug
  const slug = props.eventData.slug || props.eventData.marketSlug
  
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`
  if (slug) return `https://polymarket.com/market/${slug}`
  return null
})

const goToMarket = () => {
  if (marketUrl.value) {
    window.open(marketUrl.value, '_blank')
  }
}
</script>

<template>
  <div 
    class="bg-[#0f1523] border border-[#1e293b] rounded-lg p-4 transition-all flex flex-col relative"
    :class="{ 'animate-flash': isNew }"
  >
    
    <div class="flex items-start mb-6">
      <img :src="eventData.image" :alt="eventData.question" class="w-10 h-10 rounded-md object-cover border border-slate-700 shadow-lg mr-3 shrink-0" v-if="eventData.image" />
      <div v-else class="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 shadow-lg mr-3 shrink-0 flex items-center justify-center text-slate-500">?</div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between mb-1">
          <h3 class="text-slate-200 font-bold text-sm leading-snug line-clamp-2 transition-colors pr-20">
            {{ displayQuestion }}
          </h3>
        </div>
      </div>
    </div>

    <!-- Absolute Positioned Translate Button -->
    <button 
      @click.stop="toggleTranslate" 
      class="absolute top-3 right-3 shrink-0 flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-800 transition-all hover:border-slate-600 bg-slate-900/50 z-10"
      :class="showTranslated ? 'text-blue-400 border-blue-900/30 bg-blue-950/20' : 'text-slate-500 hover:text-blue-400'"
      :disabled="isTranslating"
    >
      <svg v-if="isTranslating" class="w-2.5 h-2.5 animate-spin text-blue-500" viewBox="0 0 24 24" fill="none">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      <span>{{ isTranslating ? '...' : (showTranslated ? 'ORIGINAL' : '翻譯') }}</span>
    </button>

    <div class="flex-1 flex flex-col justify-end space-y-4 mb-5">
      <div v-for="outcome in outcomes" :key="outcome.label" class="flex flex-col space-y-1.5">
        <div class="flex justify-between items-end text-xs font-mono">
          <span class="text-slate-400 truncate pr-2 w-3/4">{{ outcome.label }}</span>
          <span class="text-slate-200 font-bold" :class="outcome.probability >= 50 ? 'text-green-400' : ''">
            {{ outcome.probability.toFixed(1) }}%
          </span>
        </div>
        <div class="h-1 w-full bg-[#1e293b] rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-1000" :class="outcome.colorClass" :style="{ width: `${outcome.probability}%` }"></div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-4" v-if="outcomes.length === 2">
      <button 
        @click.stop="goToMarket"
        class="bg-green-950/30 border border-green-900/50 hover:bg-green-900/50 text-green-500 rounded font-bold text-xs py-2 flex items-center justify-center space-x-1 transition-colors"
      >
        <span>{{ outcomes[0]?.label }}</span>
        <span class="opacity-80 font-mono">{{ outcomes[0]?.probability?.toFixed(0) }}¢</span>
      </button>
      <button 
        @click.stop="goToMarket"
        class="bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 text-red-500 rounded font-bold text-xs py-2 flex items-center justify-center space-x-1 transition-colors"
      >
        <span>{{ outcomes[1]?.label }}</span>
        <span class="opacity-80 font-mono">{{ outcomes[1]?.probability?.toFixed(0) }}¢</span>
      </button>
    </div>

    <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-800/80">
      <div class="flex items-center space-x-2">
        <span>{{ formatCurrency(eventData.volumeNum) }} Vol</span>
        <span class="text-slate-700">·</span>
        <span>{{ formatCurrency(eventData.liquidity) }} Liq</span>
      </div>
      <div class="flex items-center space-x-1" v-if="formattedDate">
        <span>📅 {{ formattedDate }}</span>
      </div>
    </div>

  </div>
</template>

<style scoped>
@keyframes flash-new {
  0% { 
    background-color: rgba(59, 130, 246, 0.5); 
    border-color: #3b82f6; 
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.4);
    transform: scale(1.02);
  }
  50% {
    background-color: rgba(59, 130, 246, 0.2);
  }
  100% { 
    background-color: #0f1523; 
    border-color: #1e293b; 
    box-shadow: none;
    transform: scale(1);
  }
}

.animate-flash {
  animation: flash-new 2.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 1000ms;
}
</style>