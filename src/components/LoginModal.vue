<script setup lang="ts">
import { ref } from 'vue'
import { supabase } from '../supabase'

const emit = defineEmits(['close', 'login-success'])

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('') // Optional for registration
const isRegister = ref(false)
const errorMsg = ref('')
const loading = ref(false)
const successMsg = ref('')

const handleAuth = async () => {
  errorMsg.value = ''
  successMsg.value = ''
  loading.value = true
  
  try {
    if (isRegister.value) {
      if (!nickname.value.trim()) throw new Error('請輸入討論區暱稱')
      if (password.value !== confirmPassword.value) throw new Error('兩次輸入的密碼不一致')
      // SignUp
      const { data, error } = await supabase.auth.signUp({
        email: email.value,
        password: password.value,
        options: {
          data: {
            nickname: nickname.value.trim(),
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(nickname.value.trim())}&background=3b82f6&color=fff&rounded=true`
          }
        }
      })
      if (error) throw error
      
      // If auto-confirm is off, tell user to check email.
      if (data.session === null) {
        successMsg.value = '註冊成功！麻煩請去信箱點擊驗證信（若沒收到請檢查垃圾信件）。若您是開發者，可至 Supabase 後台關閉 Email Confirm。'
      } else {
        emit('login-success')
      }
    } else {
      // SignIn
      const { error } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value,
      })
      if (error) throw error
      emit('login-success')
    }
  } catch (err: any) {
    if (err.message.includes('User already registered')) {
      errorMsg.value = '此信箱已經註冊過了，請直接登入。'
    } else if (err.message.includes('Invalid login credentials')) {
      errorMsg.value = '信箱或密碼錯誤。'
    } else {
      errorMsg.value = err.message || '驗證失敗，請檢查輸入內容。'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="bg-[#111827] border border-slate-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in-up relative">
    <!-- Close Button -->
    <button 
      @click="emit('close')" 
      class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
      title="返回市場"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    <div class="text-center mb-6">
      <h2 class="text-xl font-bold text-white mb-2">{{ isRegister ? '加入投資討論區' : '登入討論區' }}</h2>
      <p class="text-xs text-slate-400">與全球投資者即時交流市場觀點</p>
    </div>

    <form @submit.prevent="handleAuth" class="space-y-4">
      <div v-if="isRegister">
        <label class="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">顯示暱稱</label>
        <input 
          v-model="nickname" 
          type="text" 
          placeholder="例如：幣圈韭菜、航海王"
          required
          class="w-full bg-[#0a0f1c] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label class="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email 信箱</label>
        <input 
          v-model="email" 
          type="email" 
          placeholder="your@email.com"
          required
          class="w-full bg-[#0a0f1c] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div>
        <label class="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">密碼</label>
        <input 
          v-model="password" 
          type="password" 
          :placeholder="isRegister ? '輸入大於 6 碼的密碼' : '請輸入密碼'"
          required
          minlength="6"
          class="w-full bg-[#0a0f1c] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div v-if="isRegister">
        <label class="block text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">確認密碼</label>
        <input 
          v-model="confirmPassword" 
          type="password" 
          placeholder="請再次輸入密碼"
          required
          minlength="6"
          class="w-full bg-[#0a0f1c] border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      <div v-if="errorMsg" class="text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-md border border-red-900/30 line-clamp-2">
        {{ errorMsg }}
      </div>
      
      <div v-if="successMsg" class="text-green-400 text-xs bg-green-900/20 px-3 py-2 rounded-md border border-green-900/30">
        {{ successMsg }}
      </div>

      <button 
        type="submit" 
        :disabled="loading"
        class="w-full py-2.5 rounded text-sm font-bold transition-colors flex items-center justify-center gap-2"
        :class="loading ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'"
      >
        <svg v-if="loading" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        {{ isRegister ? '立即註冊' : '登入' }}
      </button>

      <div class="space-y-2 pt-2 border-t border-slate-800 flex flex-col items-center">
        <button 
          type="button" 
          @click="isRegister = !isRegister; errorMsg = ''; successMsg = ''; confirmPassword = ''"
          class="text-xs text-slate-400 hover:text-white transition-colors"
        >
          {{ isRegister ? '已有帳號？返回登入' : '還沒有帳號？立即註冊' }}
        </button>
        <button 
          type="button"
          @click="emit('close')"
          class="text-[10px] text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-widest mt-1"
        >
          暫不加入，返回市場
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
@keyframes fade-in-up {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
