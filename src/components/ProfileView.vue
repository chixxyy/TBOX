<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { 
  userProfile, 
  updateUserProfile, 
  showToast, 
  chatSession, 
  handleLoginSuccess,
  activeSettingsTab
} from '../store'

const nickname = ref('')
const bio = ref('')
const avatarBgColor = ref('3b82f6') // Default blue
const loading = ref(false)
const passwordLoading = ref(false)
const newPassword = ref('')
const confirmNewPassword = ref('')
const showPasswordConfirm = ref(false)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

import { supabase } from '../supabase'

const avatarColors = [
  { name: 'Blue', hex: '3b82f6' },
  { name: 'Indigo', hex: '6366f1' },
  { name: 'Purple', hex: 'a855f7' },
  { name: 'Rose', hex: 'f43f5e' },
  { name: 'Amber', hex: 'f59e0b' },
  { name: 'Emerald', hex: '10b981' },
  { name: 'Cyan', hex: '06b6d4' },
  { name: 'Pink', hex: 'ec4899' },
  { name: 'Slate', hex: '64748b' },
  { name: 'Lime', hex: '84cc16' }
]

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
  
  if (userProfile.value) {
    nickname.value = userProfile.value.full_name
    bio.value = userProfile.value.bio || ''
    
    // Extract color from existing URL if possible
    const match = userProfile.value.avatar_url?.match(/background=([0-9a-fA-F]+)/)
    if (match) avatarBgColor.value = match[1] as string
  }
})

watch(userProfile, (newProfile) => {
  if (newProfile?.avatar_url) {
    const match = newProfile.avatar_url.match(/[&?]background=([0-9a-fA-F]+)/)
    if (match) avatarBgColor.value = match[1] as string
  }
}, { immediate: true })

const currentAvatarUrl = computed(() => {
  const name = nickname.value || chatSession.value?.user.email?.split('@')[0] || 'U'
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${avatarBgColor.value}&color=fff&rounded=true`
})

const handleSave = async () => {
  if (!nickname.value.trim()) {
    showToast('錯誤', '暱稱不能為空')
    return
  }
  
  loading.value = true
  const { error } = await updateUserProfile({
    full_name: nickname.value.trim(),
    bio: bio.value.trim(),
    avatar_url: currentAvatarUrl.value as string
  })
  
  if (error) {
    showToast('更新失敗', typeof error === 'string' ? error : error.message)
  } else {
    showToast('更新成功', '個人檔案已儲存')
  }
  loading.value = false
}

watch(activeSettingsTab, (newTab) => {
  if (newTab === 'security') {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        showToast('注意', '連線已逾期，請重新登入')
      }
    })
  }
})

const handleUpdatePassword = async () => {
  if (!newPassword.value || newPassword.value !== confirmNewPassword.value) {
    showToast('錯誤', '請確認兩次密碼輸入一致')
    return
  }
  
  if (newPassword.value.length < 6) {
    showToast('錯誤', '密碼長度至少需要 6 位字元')
    return
  }

  showPasswordConfirm.value = true
}

const confirmUpdatePassword = async () => {
  if (!chatSession.value) {
    showToast('錯誤', '認證已過期，請重新登入')
    showPasswordConfirm.value = false
    return
  }

  passwordLoading.value = true
  
  // Hard 8-second timeout for better UX
  const timeoutId = setTimeout(() => {
    if (passwordLoading.value) {
      passwordLoading.value = false
      showPasswordConfirm.value = false // Force close modal
      showToast('超時', '通訊掛起，請重新整理頁面再試')
    }
  }, 8000)

  try {
    // 2. Perform the update directly (Skip refreshSession as it may break recovery)
    console.log('[AUTH] Attempting direct password update...')
    const { error } = await supabase.auth.updateUser({
      password: newPassword.value
    })
    
    if (error) throw error
    
    clearTimeout(timeoutId)
    showToast('更新成功', '您的登入密碼已變更')
    newPassword.value = ''
    confirmNewPassword.value = ''
    showPasswordConfirm.value = false
  } catch (err: any) {
    clearTimeout(timeoutId)
    console.error('[AUTH] Update error:', err)
    
    let errorMsg = err.message || '請稍後再試'
    if (errorMsg.includes('should be different from the old password')) {
      errorMsg = '新密碼不能與舊密碼相同'
    } else if (errorMsg.includes('least 6 characters')) {
      errorMsg = '密碼長度至少需要 6 位字元'
    }
    
    showToast('更新失敗', errorMsg)
    showPasswordConfirm.value = false
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[150] flex flex-col md:items-center md:justify-center bg-[#05080f] overflow-hidden p-2 md:p-10">
    <!-- Background Decoration -->
    <div class="fixed inset-0 opacity-[0.03] pointer-events-none" style="background-image: radial-gradient(#3b82f6 0.5px, transparent 0.5px); background-size: 24px 24px;"></div>
    
    <!-- Profile Header (Logo & Identity) -->
    <div class="relative z-10 w-full max-w-[800px] mb-3 md:mb-8 flex flex-row items-center justify-center gap-3 md:gap-6 animate-in fade-in duration-700">
      <div class="flex items-center gap-2">
        <svg class="w-7 h-7 md:w-9 md:h-9 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="boxGradProf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#3B82F6" /> <stop offset="100%" stop-color="#6366F1" /> </linearGradient>
            <linearGradient id="tGradProf" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stop-color="#06B6D4" /> <stop offset="100%" stop-color="#3B82F6" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="28" height="28" rx="7" stroke="url(#boxGradProf)" stroke-width="2" fill="rgba(59, 130, 246, 0.08)"/>
          <rect x="8" y="15" width="3" height="9" rx="1.5" fill="#3B82F6" fill-opacity="0.8"/>
          <rect x="14" y="8" width="4" height="16" rx="2" fill="url(#tGradProf)"/>
          <rect x="10" y="8" width="12" height="4" rx="2" fill="url(#tGradProf)"/>
          <rect x="21" y="12" width="3" height="12" rx="1.5" fill="#6366F1" fill-opacity="0.8"/>
        </svg>
        <span class="text-xl md:text-2xl font-black tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500">TBOX</span>
      </div>
      <div class="h-6 md:h-8 w-px bg-slate-800"></div>
      <div class="flex flex-col items-start">
        <div class="text-sm md:text-xl font-black text-white tracking-tight uppercase">個人檔案編輯</div>
        <div class="text-[9px] md:text-xs text-slate-500 font-mono tracking-[0.2em] md:tracking-[0.3em] uppercase">Profile Identity</div>
      </div>
      
      <!-- Close Button -->
      <button 
        @click="handleLoginSuccess" 
        class="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-white/5 bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <!-- Main Container Card -->
    <div class="relative z-10 w-full max-w-[800px] h-full md:h-auto md:max-h-[85vh] bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)] flex flex-col">
      <!-- Tab Navigation -->
      <nav class="flex border-b border-white/5 bg-slate-950/20 shrink-0">
        <button 
          @click="activeSettingsTab = 'basic'"
          class="flex-1 py-3 md:py-5 text-[10px] md:text-xs font-black tracking-[0.1em] md:tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 md:gap-3 relative overflow-hidden group"
          :class="activeSettingsTab === 'basic' ? 'text-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
          基本設定
          <div v-if="activeSettingsTab === 'basic'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
        </button>
        <button 
          @click="activeSettingsTab = 'security'"
          class="flex-1 py-3 md:py-5 text-[10px] md:text-xs font-black tracking-[0.1em] md:tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 md:gap-3 relative overflow-hidden group"
          :class="activeSettingsTab === 'security' ? 'text-orange-400 bg-orange-500/5' : 'text-slate-500 hover:text-slate-300'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 md:h-4 md:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          安全維護
          <div v-if="activeSettingsTab === 'security'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500"></div>
        </button>
      </nav>

      <div class="flex-1 p-4 md:p-10 overflow-y-auto custom-scrollbar">
        <transition name="tab-fade" mode="out-in">
          <!-- 1. Basic Info Tab -->
          <div v-if="activeSettingsTab === 'basic'" key="basic" class="space-y-6 md:space-y-12">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 lg:gap-20 items-center">
              <!-- Avatar Display Section (Centered Stack) -->
              <div class="flex flex-col items-center justify-center gap-8 md:border-r border-white/5 md:pr-10 min-h-0 md:min-h-[360px]">
                <div class="relative">
                  <img :src="currentAvatarUrl" class="relative w-32 h-32 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full border-4 border-white/5 bg-slate-900 shadow-2xl p-1 shrink-0" alt="Avatar" />
                </div>
                <div class="text-center w-full max-w-[280px]">
                  <div class="text-xs md:text-sm font-black text-slate-500 tracking-[0.2em] uppercase mb-4">預覽配色效果</div>
                  <div class="grid grid-cols-5 gap-3 p-4 bg-slate-950/40 border border-white/5 rounded-3xl">
                    <button 
                      v-for="color in avatarColors" 
                      :key="color.hex" 
                      @click="avatarBgColor = color.hex" 
                      class="w-7 h-7 md:w-8 md:h-8 rounded-full border md:border-2 transition-all active:scale-95 shadow-inner" 
                      :style="{ backgroundColor: `#${color.hex}` }" 
                      :class="avatarBgColor === color.hex ? 'border-white ring-4 ring-blue-500/20' : 'border-transparent opacity-60 hover:opacity-100'"
                    ></button>
                  </div>
                </div>
              </div>

              <!-- Form Inputs Section (Proportional Sizing) -->
              <div class="space-y-8 md:pl-6">
                <div class="space-y-4">
                  <label class="flex items-center gap-3 text-xs md:text-sm font-black text-blue-400 uppercase tracking-[0.3em] ml-1">
                    <div class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></div>
                    顯示暱稱
                  </label>
                  <input v-model="nickname" type="text" placeholder="顯示於聊天室與排行榜" class="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-6 py-4 md:py-5 text-white focus:outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-slate-700 text-base md:text-lg" />
                </div>
                <div class="space-y-4">
                  <label class="flex items-center gap-3 text-xs md:text-sm font-black text-blue-400 uppercase tracking-[0.3em] ml-1">
                    <div class="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-blue-500"></div>
                    自我介紹
                  </label>
                  <textarea v-model="bio" :rows="windowWidth < 768 ? 3 : 5" placeholder="分享您的交易理念..." class="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-6 py-5 md:py-6 text-white focus:outline-none focus:border-blue-500/50 transition-all text-sm md:text-base resize-none custom-scrollbar placeholder:text-slate-700"></textarea>
                </div>
              </div>
            </div>

            <!-- Global Action Button -->
            <div class="pt-6 md:pt-8 border-t border-white/5">
              <button @click="handleSave" :disabled="loading" class="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 md:py-5 rounded-2xl shadow-2xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm md:text-base tracking-widest uppercase">
                <svg v-if="loading" class="animate-spin h-5 w-5 md:h-6 md:w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                儲存個人檔案變更
              </button>
            </div>
          </div>

          <!-- 2. Security Tab -->
          <div v-else key="security" class="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-right-10 duration-500">
            <!-- Email Info Badge (Proportional) -->
            <div class="bg-slate-950/40 border border-white/5 rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden group">
              <div class="absolute inset-0 bg-blue-500/[0.02] pointer-events-none"></div>
              <div class="flex items-center gap-6 md:gap-8 relative z-10 w-full md:w-auto">
                <div class="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <h4 class="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mb-2">主要綁定帳號</h4>
                  <p class="text-lg md:text-2xl font-bold text-white tracking-tight break-all">{{ chatSession?.user.email }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 px-5 py-2.5 md:px-6 md:py-3 bg-green-500/10 border border-green-500/20 rounded-full w-fit">
                <div class="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <span class="text-xs font-black text-green-500 uppercase tracking-widest">已受安全保護</span>
              </div>
            </div>

            <!-- Password Update Section -->
            <div class="space-y-8">
              <div class="flex items-center gap-4">
                <div class="w-2 h-8 bg-orange-500 rounded-full"></div>
                <h3 class="text-lg md:text-xl font-black text-white tracking-tighter uppercase">修訂安全性存取密碼</h3>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div class="space-y-4">
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">新的存取密碼</label>
                  <input v-model="newPassword" type="password" placeholder="建議包含大小寫與符號" class="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-4 md:py-5 text-white focus:outline-none focus:border-orange-500/50 transition-all text-base md:text-lg font-bold placeholder:text-slate-800" />
                </div>
                <div class="space-y-4">
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">再次確認新密碼</label>
                  <input v-model="confirmNewPassword" type="password" placeholder="請確認輸入正確" class="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-6 py-4 md:py-5 text-white focus:outline-none focus:border-orange-500/50 transition-all text-base md:text-lg font-bold placeholder:text-slate-800" />
                </div>
              </div>

              <button @click="handleUpdatePassword" :disabled="passwordLoading" class="w-full mt-4 bg-slate-950 hover:bg-orange-600/20 border border-white/5 hover:border-orange-500/50 text-slate-400 hover:text-orange-400 font-black py-5 md:py-6 rounded-2xl transition-all disabled:opacity-50 flex items-center justify-center gap-4 text-xs tracking-[0.2em] uppercase">
                <svg v-if="passwordLoading" class="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                啟動安全密碼更新程序
              </button>
            </div>
          </div>
        </transition>
      </div>
    </div>

    <!-- HIGH-ALERT Security Confirmation Modal -->
    <transition name="notice">
      <div v-if="showPasswordConfirm" class="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl">
        <div class="w-full max-w-[360px] md:max-w-[400px] bg-[#0a0606] border border-red-500/30 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden p-6 md:p-10 relative">
          <div class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-red-600"></div>
          <div class="relative z-10 text-center">
            <div class="w-16 h-16 md:w-20 md:h-20 bg-red-950/30 border border-red-500/20 rounded-2xl md:rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-6 md:mb-8">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 md:h-10 md:w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            
            <h3 class="text-xl md:text-2xl font-black text-white mb-2 md:mb-3 uppercase tracking-tighter">確認安全變更</h3>
            <div class="text-[8px] md:text-[10px] text-red-500/60 font-mono mb-6 md:mb-8 uppercase tracking-[0.2em] md:tracking-[0.3em]">SECURITY_AUTH_CONFIRM</div>
            
            <p class="text-xs md:text-sm text-slate-400 mb-8 md:mb-10 leading-relaxed">
              您正在發起帳戶權限重設請求。
            </p>
            
            <div class="flex flex-col gap-3 md:gap-4">
              <button 
                @click="confirmUpdatePassword" 
                :disabled="passwordLoading"
                class="w-full py-4 md:py-5 bg-red-600 text-white font-black rounded-xl md:rounded-2xl transition-all shadow-xl active:scale-95 text-xs tracking-widest"
              >
                確認變更
              </button>
              <button 
                @click="showPasswordConfirm = false" 
                :disabled="passwordLoading"
                class="w-full py-4 md:py-5 bg-white/5 text-slate-500 font-bold rounded-xl md:rounded-2xl text-xs tracking-widest"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.tab-fade-enter-active, .tab-fade-leave-active {
  transition: all 0.3s ease-out;
}
.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.notice-enter-active, .notice-leave-active {
  transition: all 0.3s var(--ease-out-quint, cubic-bezier(0.23, 1, 0.32, 1));
}
.notice-enter-from, .notice-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
</style>
