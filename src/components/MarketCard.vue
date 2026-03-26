<script setup lang="ts">
import { computed } from 'vue'

// 定義 Prop，包含原本的 eventData 和新增的 isNew
const props = defineProps<{
  eventData: any,
  isNew?: boolean // 新增：用來觸發閃爍動畫
}>()

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
      <h3 class="text-slate-200 font-bold text-sm leading-snug line-clamp-2 transition-colors">
        {{ eventData.question }}
      </h3>
    </div>

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