<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  data: number[]
  width?: number
  height?: number
}>()

const width = 100
const height = 30

const pathData = computed(() => {
  const d = props.data
  if (!d || d.length === 0) return ''
  
  const min = Math.min(...d)
  const max = Math.max(...d)
  const range = max - min || 1 // Avoid division by zero
  
  const stepX = width / (d.length - 1 || 1)
  
  return d.map((val, index) => {
    const x = index * stepX
    // y goes from top (0) to bottom (height), so we invert the proportion
    const y = height - ((val - min) / range) * height
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})

const isUp = computed(() => {
  if (!props.data || props.data.length < 2) return true
  return props.data[props.data.length - 1]! >= props.data[0]!
})
</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 100 30" class="overflow-visible block" preserveAspectRatio="none">
    <path 
      :d="pathData" 
      fill="none" 
      :stroke="isUp ? '#4ade80' : '#f87171'" 
      stroke-width="1.5" 
      stroke-linecap="round" 
      stroke-linejoin="round"
      class="transition-all duration-300"
      :style="{ filter: `drop-shadow(0 2px 4px ${isUp ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'})` }"
    />
  </svg>
</template>
