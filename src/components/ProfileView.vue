```vue
<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { userProfile, updateUserProfile, showToast, chatSession, handleLoginSuccess } from '../store'

const nickname = ref('')
const bio = ref('')
const avatarBgColor = ref('3b82f6') // Default blue
const loading = ref(false)

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
</script>

<template>
  <div class="fixed inset-0 z-[150] flex items-center justify-center bg-[#05080f] overflow-hidden">
    <!-- Dynamic high-end background -->
    <div class="fixed inset-0 bg-gradient-to-br from-[#05080f] via-[#0a1120] to-[#05080f]"></div>
    <div class="fixed top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-pulse"></div>
    <div class="fixed bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse" style="animation-delay: 3s"></div>
    
    <!-- Pattern Overlay -->
    <div class="fixed inset-0 opacity-[0.03] pointer-events-none" style="background-image: url('https://www.transparenttextures.com/patterns/carbon-fibre.png')"></div>

    <div class="relative z-10 w-full max-w-xl p-4 md:p-6 mx-4">
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
      <div class="flex flex-col items-center mb-6">
        <div class="flex items-center gap-4 mb-4 group">
          <div class="flex items-center">
            <svg class="w-8 h-8 drop-shadow-[0_0_10px_rgba(59,130,246,0.4)] transition-transform duration-500 group-hover:scale-110" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            <span class="ml-2 font-black text-lg tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">TBOX</span>
          </div>
          <div class="w-px h-5 bg-slate-800 mx-1"></div>
          <div class="flex items-center gap-2.5">
            <img :src="currentAvatarUrl" class="w-10 h-10 rounded-full border-2 border-blue-500/30 object-cover shadow-lg bg-slate-800" />
            <div class="text-left">
              <h1 class="text-base font-black text-white leading-none">個人檔案編輯</h1>
              <p class="text-slate-500 text-[9px] mt-0.5 uppercase tracking-widest font-bold opacity-80">Profile Identity</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Profile Card -->
      <div class="glass-card p-5 md:p-6 rounded-[2rem] border border-slate-800/50 shadow-2xl backdrop-blur-xl bg-slate-900/40">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Left: Readonly & Colors -->
          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">註冊信箱</label>
              <div class="w-full bg-slate-950/30 border border-slate-800/50 rounded-xl px-4 py-2.5 text-slate-500 font-mono text-sm cursor-not-allowed">{{ chatSession?.user.email }}</div>
            </div>
            <div class="space-y-2">
              <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">頭像背景顏色</label>
              <div class="flex flex-wrap gap-2.5 p-3 bg-slate-950/30 border border-slate-800/50 rounded-xl">
                <button v-for="color in avatarColors" :key="color.hex" @click="avatarBgColor = color.hex" class="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-95" :style="{ backgroundColor: `#${color.hex}` }" :class="avatarBgColor === color.hex ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent opacity-60'"></button>
              </div>
            </div>
          </div>
          <!-- Right: Editable -->
          <div class="space-y-4">
            <div class="space-y-1.5">
              <label class="block text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">顯示暱稱</label>
              <input v-model="nickname" type="text" placeholder="輸入您的暱稱" class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all font-bold placeholder:text-slate-800" />
            </div>
            <div class="space-y-1.5">
              <label class="block text-[10px] font-bold text-blue-400 uppercase tracking-widest ml-1">自我介紹</label>
              <textarea v-model="bio" rows="3" placeholder="讓大家認識你..." class="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 transition-all text-sm resize-none"></textarea>
            </div>
          </div>
        </div>

        <!-- Action Button -->
        <div class="mt-5 pt-5 border-t border-slate-800/50 flex gap-4">
          <button @click="handleSave" :disabled="loading" class="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black py-3 rounded-xl shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3">
            <svg v-if="loading" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            儲存設定
          </button>
          <button @click="handleLoginSuccess" class="px-6 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white font-bold rounded-xl transition-all text-sm">取消</button>
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
