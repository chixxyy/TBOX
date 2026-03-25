```
<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../supabase'
import { showToast, handleLoginSuccess } from '../store'

const isRegister = ref(false)
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const loading = ref(false)
const rememberMe = ref(true)

import { onMounted } from 'vue'

onMounted(() => {
  const savedEmail = localStorage.getItem('tbox_remembered_email')
  if (savedEmail) {
    email.value = savedEmail
    rememberMe.value = true
  }
})

const handleAuth = async () => {
  if (!email.value || !password.value) {
    showToast('錯誤', '請填寫完整資訊')
    return
  }
  
  if (isRegister.value) {
    if (password.value !== confirmPassword.value) {
      showToast('錯誤', '兩次密碼輸入不一致')
      return
    }
    if (!nickname.value) {
      showToast('錯誤', '請輸入暱稱')
      return
    }
  }

  loading.value = true
  try {
    if (isRegister.value) {
      const { error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: {
            full_name: nickname.value,
            avatar_url: `https://ui-avatars.com/api/?name=${nickname.value}&background=random`
          }
        }
      })
      if (error) throw error
      showToast('註冊成功', '請至信箱查收驗證信或直接登入', true)
      isRegister.value = false
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value
      })
      if (error) throw error
      
      // Handle Remember Me
      if (rememberMe.value) {
        localStorage.setItem('tbox_remembered_email', email.value)
      } else {
        localStorage.removeItem('tbox_remembered_email')
      }

      showToast('登入成功', '歡迎回到 TradingBox', true)
      handleLoginSuccess()
    }
  } catch (err: any) {
    showToast('驗證失敗', err.message || '請檢查輸入資訊')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[150] flex items-center justify-center bg-[#05080f] overflow-hidden">
    <!-- Dynamic high-end background -->
    <div class="fixed inset-0 bg-gradient-to-br from-[#05080f] via-[#0a1120] to-[#05080f]"></div>
    <div class="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse" style="animation-delay: 3s"></div>
    
    <!-- Pattern Overlay -->
    <div class="fixed inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png')"></div>

    <div class="relative z-10 w-full max-w-md p-4 md:p-6 mx-4">
      <!-- Close Button -->
      <button 
        @click="handleLoginSuccess"
        class="fixed top-4 right-4 md:absolute md:-top-4 md:-right-4 p-2.5 text-slate-400 hover:text-white transition-all bg-slate-900/80 rounded-full border border-slate-700 backdrop-blur-xl z-[160] hover:scale-110 active:scale-95 shadow-lg"
        title="關閉並返回"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Logo Section -->
      <div class="text-center mb-6 group">
        <div class="inline-flex items-center justify-center mb-4">
          <svg class="w-12 h-12 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-transform duration-700 group-hover:rotate-[360deg] group-hover:scale-110" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="boxGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3B82F6" /> <stop offset="100%" stop-color="#6366F1" /> </linearGradient>
              <linearGradient id="tGradLogin" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#06B6D4" /> <stop offset="100%" stop-color="#3B82F6" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#boxGradLogin)" stroke-width="2.5" fill="rgba(59, 130, 246, 0.1)"/>
            <rect x="8" y="15" width="3" height="9" rx="1.5" fill="#3B82F6" fill-opacity="0.8"/>
            <rect x="14" y="8" width="4" height="16" rx="2" fill="url(#tGradLogin)"/>
            <rect x="10" y="8" width="12" height="4" rx="2" fill="url(#tGradLogin)"/>
            <rect x="21" y="12" width="3" height="12" rx="1.5" fill="#6366F1" fill-opacity="0.8"/>
          </svg>
        </div>
        <h1 class="text-3xl font-black tracking-tighter mb-1 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-indigo-500">
          TBOX
        </h1>
        <div class="h-1 w-10 bg-gradient-to-r from-blue-500 to-indigo-500 mx-auto rounded-full mb-4 opacity-50"></div>
        <p class="text-slate-400 text-xs font-medium tracking-wide">
          {{ isRegister ? '開啟您的全球交易視野' : '歡迎回到專業交易社群' }}
        </p>
      </div>

      <!-- Auth Form Card -->
      <div class="glass-card p-5 md:p-6 rounded-[2rem] border border-slate-800/50 shadow-2xl backdrop-blur-xl bg-slate-900/40">
        <div class="space-y-3">          <div v-if="isRegister" class="space-y-1.5 animate-slide-down">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">暱稱</label>
            <input 
              v-model="nickname"
              type="text" 
              placeholder="如何稱呼您？"
              @keyup.enter="handleAuth"
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
            />
          </div>

          <div class="space-y-1.5">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">電子信箱</label>
            <input 
              v-model="email"
              type="email" 
              placeholder="you@example.com"
              @keyup.enter="handleAuth"
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
            />
          </div>

          <div class="space-y-1.5">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">密碼</label>
            <input 
              v-model="password"
              type="password" 
              placeholder="••••••••"
              @keyup.enter="handleAuth"
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
            />
          </div>

          <!-- Remember Me Toggle -->
          <div v-if="!isRegister" class="flex items-center justify-between px-1 py-1">
            <label class="flex items-center gap-2 cursor-pointer group">
              <div class="relative flex items-center justify-center w-4 h-4 rounded border transition-all duration-200"
                :class="rememberMe ? 'bg-blue-600 border-blue-500' : 'bg-slate-950/50 border-slate-700 group-hover:border-slate-500'">
                <input type="checkbox" v-model="rememberMe" class="absolute inset-0 opacity-0 cursor-pointer z-10" />
                <svg v-if="rememberMe" xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
              <span class="text-[11px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-wider">記住帳號</span>
            </label>
          </div>

          <div v-if="isRegister" class="space-y-1.5 animate-slide-down">
            <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">確認密碼</label>
            <input 
              v-model="confirmPassword"
              type="password" 
              placeholder="••••••••"
              @keyup.enter="handleAuth"
              class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
            />
          </div>

          <button 
            @click="handleAuth"
            :disabled="loading"
            class="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            {{ isRegister ? '立即註冊' : '登入帳號' }}
          </button>
        </div>

        <div class="mt-4 pt-4 border-t border-slate-800/50 text-center">
          <p class="text-slate-500 text-xs">
            {{ isRegister ? '已經有帳號了？' : '還沒有帳號嗎？' }}
            <button 
              @click="isRegister = !isRegister"
              class="text-blue-400 font-bold hover:text-blue-300 transition-colors ml-1"
            >
              {{ isRegister ? '立即登入' : '免費註冊' }}
            </button>
          </p>
        </div>
      </div>

      <!-- Back to Market -->
      <div class="text-center mt-4">
        <button 
          @click="handleLoginSuccess"
          class="inline-flex items-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回市場大廳
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-card {
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-down {
  animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
