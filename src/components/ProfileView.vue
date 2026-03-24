```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { userProfile, updateUserProfile, showToast, chatSession, handleLoginSuccess } from '../store'

const nickname = ref('')
const bio = ref('')
const loading = ref(false)

onMounted(() => {
  if (userProfile.value) {
    nickname.value = userProfile.value.full_name
    bio.value = userProfile.value.bio || ''
  }
})

const handleSave = async () => {
  if (!nickname.value.trim()) {
    showToast('錯誤', '暱稱不能為空')
    return
  }
  
  loading.value = true
  const { error } = await updateUserProfile({
    full_name: nickname.value.trim(),
    bio: bio.value.trim()
  })
  
  if (error) {
    showToast('更新失敗', typeof error === 'string' ? error : error.message)
  } else {
    showToast('更新成功', '個人檔案已儲存')
  }
  loading.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-[150] flex items-center justify-center bg-[#05080f] overflow-y-auto py-10">
    <!-- Dynamic high-end background -->
    <div class="fixed inset-0 bg-gradient-to-br from-[#05080f] via-[#0a1120] to-[#05080f]"></div>
    <div class="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse" style="animation-delay: 3s"></div>
    
    <!-- Pattern Overlay -->
    <div class="fixed inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png')"></div>

    <div class="relative z-10 w-full max-w-2xl p-6 md:p-10 mx-4 my-auto">
      <!-- Close Button -->
      <button 
        @click="handleLoginSuccess"
        class="fixed top-4 right-4 md:absolute md:-top-4 md:-right-4 p-2.5 text-slate-400 hover:text-white transition-all bg-slate-900/80 rounded-full border border-slate-700 backdrop-blur-xl z-[160] hover:scale-110 active:scale-95 shadow-lg"
        title="返回"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Branding & Header -->
      <div class="text-center mb-10 group">
        <div class="inline-flex items-center justify-center mb-4">
          <svg class="w-12 h-12 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] transition-transform duration-500 group-hover:scale-110" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="boxGradProfile" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3B82F6" /> <stop offset="100%" stop-color="#6366F1" /> </linearGradient>
              <linearGradient id="tGradProfile" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stop-color="#06B6D4" /> <stop offset="100%" stop-color="#3B82F6" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#boxGradProfile)" stroke-width="2.5" fill="rgba(59, 130, 246, 0.1)"/>
            <rect x="8" y="15" width="3" height="9" rx="1.5" fill="#3B82F6" fill-opacity="0.8"/>
            <rect x="14" y="8" width="4" height="16" rx="2" fill="url(#tGradProfile)"/>
            <rect x="10" y="8" width="12" height="4" rx="2" fill="url(#tGradProfile)"/>
            <rect x="21" y="12" width="3" height="12" rx="1.5" fill="#6366F1" fill-opacity="0.8"/>
          </svg>
          <span class="ml-3 font-black text-2xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">TBOX</span>
        </div>
        
        <div class="relative inline-block mb-4 mt-2">
          <img 
            :src="userProfile?.avatar_url" 
            class="w-20 h-20 md:w-24 md:h-24 rounded-[2rem] border-4 border-blue-500/20 object-cover shadow-xl"
          />
        </div>
        <h1 class="text-2xl font-black text-white tracking-tight">個人檔案編輯</h1>
        <p class="text-slate-500 text-xs mt-1">設定您在 TBOX 社群的對外形象</p>
      </div>

      <!-- Profile Card -->
      <div class="glass-card p-6 md:p-10 rounded-[2.5rem] border border-slate-800/50 shadow-2xl backdrop-blur-xl bg-slate-900/40">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Left: Readonly Info -->
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">註冊信箱 (不可更改)</label>
              <div class="w-full bg-slate-950/30 border border-slate-800/50 rounded-2xl px-5 py-4 text-slate-500 font-mono text-sm cursor-not-allowed">
                {{ chatSession?.user.email }}
              </div>
            </div>
            
            <div class="space-y-2">
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1">帳戶 ID</label>
              <div class="w-full bg-slate-950/30 border border-slate-800/50 rounded-2xl px-5 py-4 text-slate-700 font-mono text-[10px] truncate">
                {{ chatSession?.user.id }}
              </div>
            </div>
          </div>

          <!-- Right: Editable Info -->
          <div class="space-y-6">
            <div class="space-y-2">
              <label class="block text-[11px] font-bold text-blue-400 uppercase tracking-widest ml-1">顯示暱稱</label>
              <input 
                v-model="nickname"
                type="text" 
                placeholder="輸入您的暱稱"
                class="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 font-bold"
              />
            </div>

            <div class="space-y-2">
              <label class="block text-[11px] font-bold text-blue-400 uppercase tracking-widest ml-1">自我介紹</label>
              <textarea 
                v-model="bio"
                rows="4"
                placeholder="寫點什麼讓大家認識你..."
                class="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all placeholder:text-slate-700 resize-none text-sm leading-relaxed"
              ></textarea>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="mt-10 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row gap-4">
          <button 
            @click="handleSave"
            :disabled="loading"
            class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
          >
            <svg v-if="loading" class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            儲存個人設定
          </button>
          
          <button 
            @click="handleLoginSuccess"
            class="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white font-bold rounded-2xl transition-all"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.glass-card {
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}
</style>
