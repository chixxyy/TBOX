<script setup lang="ts">
import { ref } from 'vue'
import { activeTab, notificationHistory, unreadNotificationsCount, markAllNotificationsRead, clearNotifications, removeNotificationLog } from '../store'
import { onClickOutside } from '@vueuse/core'

const tabs = ['交易', '新聞', '市場', '異動']

const showNotifications = ref(false)
const notificationDropdown = ref<HTMLElement | null>(null)

onClickOutside(notificationDropdown, () => {
  showNotifications.value = false
})

const toggleNotifications = () => {
  showNotifications.value = !showNotifications.value
  if (showNotifications.value) {
    markAllNotificationsRead()
  }
}

const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <header class="h-12 md:h-14 bg-[#0a0f1c] border-b border-slate-800 flex items-center justify-between px-2 md:px-4 text-xs md:text-sm whitespace-nowrap">
    <div class="flex items-center space-x-4 md:space-x-8 shrink-0 overflow-x-auto scrollbar-hide h-full flex-1">
      
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

    <!-- Right Side: Notifications Bell -->
    <div class="flex items-center shrink-0 ml-2 relative" ref="notificationDropdown">
      <button @click="toggleNotifications" class="p-2 relative text-slate-400 hover:text-white transition-colors cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span v-if="unreadNotificationsCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
      </button>

      <!-- Dropdown -->
      <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-2 scale-95" enter-to-class="opacity-100 translate-y-0 scale-100" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100 translate-y-0 scale-100" leave-to-class="opacity-0 translate-y-2 scale-95">
        <div v-show="showNotifications" class="fixed right-2 top-12 w-[calc(100vw-16px)] md:absolute md:right-0 md:top-full md:mt-2 md:w-80 border-slate-700 bg-slate-900 shadow-2xl z-[100] border border-slate-600 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col max-h-[400px]">
          <div class="px-4 py-3 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-lg">
            <h3 class="font-bold text-white tracking-widest text-sm">通知中心</h3>
            <button v-if="notificationHistory.length > 0" @click="clearNotifications" class="text-xs text-slate-400 hover:text-blue-400 transition-colors">清除全部</button>
          </div>
          
          <div class="flex-1 overflow-y-auto p-2">
            <div v-if="notificationHistory.length === 0" class="p-6 text-center text-slate-500 text-sm">
              目前沒有任何通知
            </div>
            <div v-for="log in notificationHistory" :key="log.id" class="p-3 mb-2 bg-[#0a0f1c] rounded-md border border-slate-800/50 flex flex-col hover:border-slate-600 transition-colors group relative">
              <button @click.stop="removeNotificationLog(log.id)" class="absolute top-2 right-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div class="flex justify-between items-start mb-1 gap-2 pr-5">
                <span class="font-bold text-blue-400 text-xs shadow-sm break-keep">{{ log.title }}</span>
                <span class="text-[10px] text-slate-500 shrink-0 mt-0.5">{{ formatTime(log.timestamp) }}</span>
              </div>
              <p class="text-slate-300 text-xs whitespace-normal leading-relaxed break-words break-all pr-2">{{ log.message }}</p>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </header>
</template>

<style scoped>
.neon-border-blue-sm {
  box-shadow: 0 0 5px rgba(56, 189, 248, 0.2) inset, 0 0 5px rgba(56, 189, 248, 0.2);
}
</style>