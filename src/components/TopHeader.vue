<script setup lang="ts">
import { ref } from 'vue'
import { activeTab, notificationHistory, unreadNotificationsCount, markAllNotificationsRead, clearNotifications, removeNotificationLog, isNotificationsEnabled, chatSession, chatSignOut, goToLogin, isAdmin, chatUser, userProfile } from '../store'
import { onClickOutside } from '@vueuse/core'

const showUserMenu = ref(false)
const userMenuRef = ref(null)
onClickOutside(userMenuRef, () => {
  showUserMenu.value = false
})

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

const tabs = ['交易', '新聞', '市場', '異動', '討論']

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

const showLogoutConfirm = ref(false)
const handleLogout = () => {
  showLogoutConfirm.value = true
  showUserMenu.value = false
}
const confirmLogout = () => {
  chatSignOut()
  showLogoutConfirm.value = false
  showUserMenu.value = false
}
</script>

<template>
  <header class="h-12 md:h-14 bg-[#0a0f1c] border-b border-slate-800 flex items-center justify-between px-2 md:px-4 text-xs md:text-sm whitespace-nowrap sticky top-0 z-[100]">
    <div class="flex items-center h-full min-w-0 flex-1">
      <!-- Logo Section -->
      <div class="flex items-center space-x-2 md:space-x-3 cursor-pointer group shrink-0 pr-2 md:pr-4">
        <svg class="w-5 h-5 md:w-7 md:h-7 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-transform group-hover:scale-105" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <span class="font-extrabold text-base md:text-xl tracking-tighter md:tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500 hidden sm:block">
          TBOX
        </span>
      </div>

      <!-- Navigation Tabs -->
      <nav class="grid grid-cols-5 h-full items-center flex-1 min-w-0">
        <button 
          v-for="tab in tabs" 
          :key="tab"
          @click="activeTab = tab"
          class="h-full flex items-center justify-center border-b-2 font-medium transition-all duration-200 text-[11px] md:text-sm"
          :class="activeTab === tab ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'"
        >
          {{ tab }}
        </button>
      </nav>
    </div>

    <!-- Right Side: Notifications Bell -->
    <div class="flex items-center shrink-0 ml-2 relative" ref="notificationDropdown">
      <button @click.stop="toggleNotifications" class="p-2 relative text-slate-400 hover:text-white transition-colors cursor-pointer">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 md:h-6 md:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span v-if="unreadNotificationsCount > 0" class="absolute top-1.5 right-1.5 w-2 h-2 md:w-2.5 md:h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
      </button>

      <!-- Dropdown -->
      <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-2 scale-95" enter-to-class="opacity-100 translate-y-0 scale-100" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100 translate-y-0 scale-100" leave-to-class="opacity-0 translate-y-2 scale-95">
        <div v-show="showNotifications" class="fixed right-2 top-12 w-[calc(100vw-16px)] md:absolute md:right-0 md:top-full md:mt-2 md:w-80 border-slate-700 bg-slate-900 shadow-2xl z-[100] border border-slate-600 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.8)] flex flex-col max-h-[400px]">
          <div class="px-4 py-3 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-lg">
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-white tracking-widest text-sm">通知中心</h3>
              <button 
                @click.stop="isNotificationsEnabled = !isNotificationsEnabled" 
                class="p-1 rounded-full hover:bg-slate-700 transition-all group/mute" 
                :title="isNotificationsEnabled ? '點擊靜音通知與音效' : '點擊開啟通知與音效'"
              >
                <svg v-if="isNotificationsEnabled" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400 group-hover/mute:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 group-hover/mute:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              </button>
            </div>
            <button v-if="notificationHistory.length > 0" @click="clearNotifications" class="text-xs text-slate-400 hover:text-blue-400 transition-colors border border-slate-700 px-2 py-0.5 rounded bg-slate-900/50">清除全部</button>
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

    <!-- Right Side: User Profile / Login -->
    <div class="flex items-center ml-1 md:ml-3 relative" ref="userMenuRef">
      <!-- Not Logged In -->
      <button 
        v-if="!chatSession" 
        @click="goToLogin"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/30 transition-all text-[11px] md:text-sm font-bold whitespace-nowrap"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
        登入
      </button>

      <!-- Logged In -->
      <div v-else class="relative">
        <button 
          @click.stop="toggleUserMenu"
          class="flex items-center gap-2 p-1 rounded-full hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
        >
          <img 
            :src="userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${chatUser || 'User'}&background=3b82f6&color=fff&rounded=true`" 
            class="h-7 w-7 md:h-8 md:w-8 rounded-full border border-slate-700"
          />
          <span class="hidden md:block text-xs font-medium text-slate-200 truncate max-w-[80px]">
            {{ userProfile?.full_name || chatUser }}
          </span>
        </button>

        <!-- User Dropdown -->
        <transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 translate-y-2 scale-95" enter-to-class="opacity-100 translate-y-0 scale-100" leave-active-class="transition ease-in duration-100" leave-from-class="opacity-100 translate-y-0 scale-100" leave-to-class="opacity-0 translate-y-2 scale-95">
          <div v-if="showUserMenu" class="absolute right-0 top-full mt-2 w-56 md:w-64 bg-[#0d1425] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden backdrop-blur-xl bg-opacity-95">
          <div class="px-4 py-3 border-b border-slate-800/50">
            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">目前登入為</p>
            <p class="text-xs md:text-sm font-black text-white truncate">{{ chatUser }}</p>
            <p class="text-[9px] text-slate-500 font-mono truncate opacity-60 mt-0.5">{{ chatSession?.user.email }}</p>
          </div>
          
          <div class="py-1">
            <button 
              @click="activeTab = '個人檔案'; showUserMenu = false"
              class="w-full px-4 py-2.5 text-left text-xs md:text-sm text-slate-300 hover:bg-blue-600/10 hover:text-blue-400 flex items-center gap-3 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              個人檔案
            </button>
            <button 
              v-if="isAdmin"
              class="w-full px-4 py-2.5 text-left text-xs md:text-sm text-amber-500 hover:bg-amber-500/10 flex items-center gap-3 transition-all cursor-default"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              管理員權限已啟動
            </button>
            <button 
              @click.stop="handleLogout"
              class="w-full px-4 py-2.5 text-left text-xs md:text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              帳號登出
            </button>
          </div>
        </div>
        </transition>
      </div>
    </div>

    <!-- Logout Confirmation Modal Overlay -->
    <transition name="fade">
      <div v-if="showLogoutConfirm" class="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-[#111827] border border-blue-900/40 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">確定要登出嗎？</h3>
          <p class="text-xs text-slate-400 mb-6">登出後將無法使用討論區並清除目前的自定義設定。</p>
          <div class="flex gap-3">
            <button @click.stop="showLogoutConfirm = false" class="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors text-sm font-bold">
              取消
            </button>
            <button @click.stop="confirmLogout" class="flex-1 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-bold">
              確定登出
            </button>
          </div>
        </div>
      </div>
    </transition>
  </header>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
.neon-border-blue-sm {
  box-shadow: 0 0 5px rgba(56, 189, 248, 0.2) inset, 0 0 5px rgba(56, 189, 248, 0.2);
}
</style>