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

const getErrorMessage = (err: any) => {
  const msg = err.message || ''
  if (msg.includes('Invalid login credentials')) return '帳號或密碼錯誤，請重新輸入'
  if (msg.includes('User already registered')) return '此電子信箱已被註冊，請直接登入'
  if (msg.includes('Password should be at least 6 characters')) return '密碼長度至少需要 6 位字元'
  if (msg.includes('Failed to fetch')) return '連線失敗，請檢查網路連線或嘗試關閉 VPN'
  if (msg.includes('Too many requests')) return '請求過於頻繁，請稍後再試'
  if (msg.includes('Unable to validate email address')) return '請輸入有效的電子信箱格式'
  if (msg.includes('Email not confirmed')) return '電子信箱尚未驗證，請至信箱查收信件'
  if (msg.includes('Database error')) return '資料庫存取錯誤，請稍後再試'
  return msg || '驗證失敗，請檢查輸入資訊'
}

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
    showToast('驗證失敗', getErrorMessage(err))
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

    <div class="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center gap-10 md:gap-16 p-4 md:p-8">
      
      <!-- Left: Value Proposition Section -->
      <div class="hidden lg:flex flex-col w-full lg:w-1/2 space-y-8 animate-fade-in pr-10">
        <div>
          <h2 class="text-4xl font-extrabold text-white mb-4 leading-tight">
            掌握先機，<br/>
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
              開啟您的專業交易旅程
            </span>
          </h2>
          <p class="text-slate-400 text-lg">加入 TradingBox，體驗專為投資者設計的智能追蹤與討論平台。</p>
        </div>

        <div class="space-y-6">
          <div class="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-slate-800 group">
            <div class="w-12 h-12 shrink-0 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <div>
              <h4 class="text-white font-bold mb-1">全球專家即時討論</h4>
              <p class="text-slate-500 text-sm">與來自世界市場的頂尖投資者即時交流策略，分享獨家見解。</p>
            </div>
          </div>

          <div class="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-slate-800 group">
            <div class="w-12 h-12 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h4 class="text-white font-bold mb-1">雲端同步持倉管理</h4>
              <p class="text-slate-500 text-sm">跨裝置即時同步您的虛擬持倉，隨時隨地掌控資產盈虧動態。</p>
            </div>
          </div>

          <div class="flex items-start gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all border border-transparent hover:border-slate-800 group">
            <div class="w-12 h-12 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <h4 class="text-white font-bold mb-1">智慧異常波動提醒</h4>
              <p class="text-slate-500 text-sm">自動偵測資產 ±5%/10%/20% 的重大波動，第一時間發布閃電警告。</p>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-6 pt-4">
          <div class="text-center">
            <div class="text-2xl font-black text-white leading-none">500+</div>
            <div class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Active Users</div>
          </div>
          <div class="w-px h-8 bg-slate-800"></div>
          <div class="text-center">
            <div class="text-2xl font-black text-white leading-none">24/7</div>
            <div class="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Price Monitoring</div>
          </div>
        </div>
      </div>

      <!-- Right: Form Section -->
      <div class="w-full max-w-md">
        <!-- Close Button -->
        <button 
          @click="handleLoginSuccess"
          class="fixed top-4 right-4 md:absolute md:-top-12 md:-right-4 p-2.5 text-slate-400 hover:text-white transition-all bg-slate-900/80 rounded-full border border-slate-700 backdrop-blur-xl z-[160] hover:scale-110 active:scale-95 shadow-lg"
          title="關閉並返回"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <!-- Logo Section (Mobile Only) -->
        <div class="text-center mb-6 group lg:hidden">
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
          <p class="text-slate-400 text-xs font-medium tracking-wide">
            {{ isRegister ? '開啟您的全球交易視野' : '歡迎回到專業交易社群' }}
          </p>
        </div>

        <!-- Auth Form Card -->
        <div class="glass-card p-6 md:p-8 rounded-[2rem] border border-slate-800/50 shadow-2xl backdrop-blur-xl bg-slate-900/40 relative overflow-hidden group">
          <!-- Subtle glow effect inside card -->
          <div class="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
          
          <div class="space-y-4">
            <div v-if="isRegister" class="space-y-1.5 animate-slide-down">
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">暱稱</label>
              <input 
                v-model="nickname"
                type="text" 
                placeholder="如何稱呼您？"
                @keyup.enter="handleAuth"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">電子信箱</label>
              <input 
                v-model="email"
                type="email" 
                placeholder="you@example.com"
                @keyup.enter="handleAuth"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
              />
            </div>

            <div class="space-y-1.5">
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider ml-1">密碼</label>
              <input 
                v-model="password"
                type="password" 
                placeholder="••••••••"
                @keyup.enter="handleAuth"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
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
                class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 text-[16px]"
              />
            </div>

            <button 
              @click="handleAuth"
              :disabled="loading"
              class="w-full mt-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ isRegister ? '立即開通帳號' : '登錄系統' }}
            </button>
          </div>

          <div class="mt-6 pt-6 border-t border-slate-800/50 text-center">
            <p class="text-slate-500 text-xs">
              {{ isRegister ? '已經有帳號了？' : '還沒有帳號嗎？' }}
              <button 
                @click="isRegister = !isRegister"
                class="text-blue-400 font-bold hover:text-blue-300 transition-colors ml-1"
              >
                {{ isRegister ? '立即登入' : '免費註冊帳號' }}
              </button>
            </p>
          </div>
        </div>

        <!-- Back to Market -->
        <div class="text-center mt-6">
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

@keyframes fade-in {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}

.animate-slide-down {
  animation: slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-fade-in {
  animation: fade-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
