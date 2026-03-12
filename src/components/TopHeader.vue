<script setup lang="ts">
import { activeTab } from '../store'

const tabs = ['交易', '市場']
</script>

<template>
  <header class="h-14 bg-[#0a0f1c] border-b border-slate-800 flex items-center justify-between px-4 text-sm whitespace-nowrap">
    <div class="flex items-center space-x-8">
      
      <div class="flex items-center space-x-3 cursor-pointer group">
        <svg class="w-7 h-7 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover:scale-105" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        <span class="font-extrabold text-xl tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500">
          TBOX
        </span>
      </div>

      <nav class="flex space-x-6 h-full items-center">
        <button 
          v-for="tab in tabs" 
          :key="tab"
          @click="activeTab = tab"
          class="h-14 px-1 border-b-2 font-medium transition-colors duration-200"
          :class="activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'"
        >
          {{ tab }}
        </button>
      </nav>
    </div>

    <div class="flex items-center space-x-4">
      <div class="relative flex items-center bg-[#111827] border border-slate-700/80 rounded-lg px-3 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/50 transition-all duration-300 w-64 group">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 mr-2 group-focus-within:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" placeholder="搜尋市場與事件" class="bg-transparent border-none outline-none text-xs w-full text-slate-200 placeholder-slate-500" />
        <span class="ml-2 text-[10px] bg-[#1e293b] text-slate-400 px-1.5 py-0.5 rounded border border-slate-600 font-mono shadow-sm">F</span>
      </div>

      <button class="p-1.5 text-slate-400 hover:text-white border border-slate-700/80 rounded-lg bg-[#111827] hover:bg-slate-800 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.neon-border-blue-sm {
  box-shadow: 0 0 5px rgba(56, 189, 248, 0.2) inset, 0 0 5px rgba(56, 189, 248, 0.2);
}
</style>