<script setup lang="ts">
import { activeTab } from '../store'

const tabs = ['交易', '新聞', '市場', '異動']
</script>

<template>
  <header class="h-12 md:h-14 bg-[#0a0f1c] border-b border-slate-800 flex items-center justify-between px-2 md:px-4 text-xs md:text-sm whitespace-nowrap overflow-x-auto scrollbar-hide">
    <div class="flex items-center space-x-4 md:space-x-8 shrink-0">
      
      <div class="flex items-center space-x-2 md:space-x-3 cursor-pointer group shrink-0 pr-2">
        <svg class="w-6 h-6 md:w-7 md:h-7 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover:scale-105" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3B82F6" /> <stop offset="100%" stop-color="#6366F1" /> </linearGradient>
            <linearGradient id="tGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#06B6D4" /> <stop offset="100%" stop-color="#3B82F6" />
            </linearGradient>
          </defs>
          
          <rect x="2" y="2" width="28" height="28" rx="7" stroke="url(#boxGrad)" stroke-width="2" fill="rgba(59, 130, 246, 0.08)"/>
          
          <rect x="8" y="15" width="3" height="9" rx="1.5" fill="#3B82F6" fill-opacity="0.8"/>
          <rect x="14" y="8" width="4" height="16" rx="2" fill="url(#tGrad)"/>
          <rect x="10" y="8" width="12" height="4" rx="2" fill="url(#tGrad)"/>
          <rect x="21" y="12" width="3" height="12" rx="1.5" fill="#6366F1" fill-opacity="0.8"/>
        </svg>

        <span class="font-extrabold text-lg md:text-xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500">
          TBOX
        </span>
      </div>

      <nav class="flex space-x-4 md:space-x-6 h-full items-center shrink-0">
        <button 
          v-for="tab in tabs" 
          :key="tab"
          @click="activeTab = tab"
          class="h-12 md:h-14 px-1 border-b-2 font-medium transition-colors duration-200"
          :class="activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'"
        >
          {{ tab }}
        </button>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.neon-border-blue-sm {
  box-shadow: 0 0 5px rgba(56, 189, 248, 0.2) inset, 0 0 5px rgba(56, 189, 248, 0.2);
}
</style>