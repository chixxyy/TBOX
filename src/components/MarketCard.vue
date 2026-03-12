<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  eventData: any
}>()

// Extract the first market to display primary outcomes
const primaryMarket = computed(() => {
  return props.eventData.markets && props.eventData.markets.length > 0
    ? props.eventData.markets[0]
    : null
})

const outcomes = computed(() => {
  if (!primaryMarket.value || !primaryMarket.value.outcomes) return []
  
  try {
    const labels = JSON.parse(primaryMarket.value.outcomes)
    const prices = JSON.parse(primaryMarket.value.outcomePrices)
    
    // Combine labels and prices, sort by highest price (probability) first
    let mappedOutcomes = labels.map((label: string, index: number) => {
      const priceStr = prices[index] || "0"
      const prob = parseFloat(priceStr) * 100
      return {
        label,
        probability: prob,
        colorClass: getProbabilityColorClass(prob)
      }
    })
    
    // For specific Yes/No, keep order as Yes then No if they both exist. Otherwise just show top ones.
    if (mappedOutcomes.length === 2 && mappedOutcomes[0].label === 'Yes' && mappedOutcomes[1].label === 'No') {
       // Keep original order
    } else {
       // Sort descending by probability for multi-choice
       mappedOutcomes.sort((a: any, b: any) => b.probability - a.probability)
    }
    
    // Only return top 2 to match UI
    return mappedOutcomes.slice(0, 2)
  } catch (e) {
    return []
  }
})

function getProbabilityColorClass(prob: number) {
  if (prob >= 70) return 'bg-green-500'
  if (prob >= 40) return 'bg-blue-500'
  if (prob >= 15) return 'bg-yellow-500'
  return 'bg-slate-500'
}

const formatCurrency = (val: number) => {
  if (!val) return '$0'
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`
  if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`
  return `$${val.toFixed(0)}`
}

const formattedDate = computed(() => {
  if (!props.eventData.endDateIso) return ''
  const date = new Date(props.eventData.endDateIso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
})
</script>

<template>
  <div class="bg-[#0f1523] border border-[#1e293b] rounded-lg p-4 hover:border-slate-600 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all cursor-pointer flex flex-col group">
    
    <!-- Header: Image and Title -->
    <div class="flex items-start mb-6">
      <img :src="eventData.image" :alt="eventData.title" class="w-10 h-10 rounded-md object-cover border border-slate-700 shadow-lg mr-3 shrink-0" v-if="eventData.image" />
      <div v-else class="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 shadow-lg mr-3 shrink-0 flex items-center justify-center text-slate-500">?</div>
      <h3 class="text-slate-200 font-bold text-sm leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">{{ eventData.title }}</h3>
    </div>

    <!-- Outcomes List (Probabilities) -->
    <div class="flex-1 flex flex-col justify-end space-y-4 mb-5">
      <div v-for="outcome in outcomes" :key="outcome.label" class="flex flex-col space-y-1.5">
        <div class="flex justify-between items-end text-xs font-mono">
          <span class="text-slate-400 truncate pr-2 w-3/4">{{ outcome.label }}</span>
          <span class="text-slate-200 font-bold" :class="outcome.probability >= 50 ? 'text-green-400' : ''">{{ outcome.probability.toFixed(1) }}%</span>
        </div>
        <!-- Progress Bar -->
        <div class="h-1 w-full bg-[#1e293b] rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-1000" :class="outcome.colorClass" :style="{ width: `${outcome.probability}%` }"></div>
        </div>
      </div>
    </div>

    <!-- Action Buttons (Buy Yes / No) -->
    <div class="grid grid-cols-2 gap-3 mb-4" v-if="outcomes.length === 2 && outcomes[0].label === 'Yes'">
      <button class="bg-green-950/30 border border-green-900/50 hover:bg-green-900/50 text-green-500 rounded font-bold text-xs py-2 flex items-center justify-center space-x-1 transition-colors">
        <span>Yes</span>
        <span class="opacity-80 font-mono">{{ outcomes[0].probability.toFixed(0) }}¢</span>
      </button>
      <button class="bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 text-red-500 rounded font-bold text-xs py-2 flex items-center justify-center space-x-1 transition-colors">
        <span>No</span>
        <span class="opacity-80 font-mono">{{ outcomes[1].probability.toFixed(0) }}¢</span>
      </button>
    </div>

    <!-- Footer Stats -->
    <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-800/80">
      <div class="flex items-center space-x-2">
        <span>{{ formatCurrency(eventData.volume) }} Vol</span>
        <span class="text-slate-700">·</span>
        <span>{{ formatCurrency(eventData.liquidity) }} Liq</span>
      </div>
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <div class="flex items-center space-x-1 ml-1" v-if="formattedDate">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{{ formattedDate }}</span>
        </div>
      </div>
    </div>

  </div>
</template>
