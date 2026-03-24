<script setup lang="ts">
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { chatMessages, addChatMessage, removeChatMessage, globalNews, chatUser, chatSession, chatLoading, isAdmin, activeTab, chatSignOut } from '../store'
import LoginModal from './LoginModal.vue'

const handleCloseLogin = () => {
  activeTab.value = '交易'
}

const currentUser = chatUser
const currentAvatar = computed(() => `https://ui-avatars.com/api/?name=${currentUser.value}&background=3b82f6&color=fff&rounded=true`)

const inputText = ref('')
const chatContainer = ref<HTMLElement | null>(null)
const visibleCount = ref(15)

const visibleMessages = computed(() => {
  return chatMessages.value.slice(Math.max(0, chatMessages.value.length - visibleCount.value))
})

const onScroll = async (e: Event) => {
  const el = e.target as HTMLElement
  // Check if scrolled to top
  if (el.scrollTop <= 5) {
    if (visibleCount.value < chatMessages.value.length) {
      const oldScrollHeight = el.scrollHeight
      visibleCount.value += 15 // Load 15 more messages
      await nextTick()
      const newScrollHeight = el.scrollHeight
      el.scrollTop = newScrollHeight - oldScrollHeight // Keep scroll position stable
    }
  }
}

const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

// Auto scroll on new messages only when length increases
watch(() => chatMessages.value.length, (newLen, oldLen) => {
  if (newLen > oldLen) {
    nextTick(() => scrollToBottom())
  }
})

onMounted(() => {
  scrollToBottom()
})

const formatTime = (ts: number) => {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

const sendMessage = () => {
  if (!inputText.value.trim()) return
  
  addChatMessage({
    user: currentUser.value,
    avatar: currentAvatar.value,
    text: inputText.value.trim()
  })
  
  inputText.value = ''
}

const formatMessage = (text: string) => {
  const div = document.createElement('div')
  div.textContent = text
  const escaped = div.innerHTML
  const urlRegex = /(https?:\/\/[^\s]+)/g
  return escaped.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline underline-offset-2 break-all transition-colors">${url}</a>`
  })
}

const shareNews = (news: any) => {
  addChatMessage({
    user: currentUser.value,
    avatar: currentAvatar.value,
    text: '快看這則重要新聞！',
    newsShare: {
      headline: news.headline,
      url: news.url,
      source: news.source
    }
  })
}

const hotNews = computed(() => globalNews.value.slice(0, 20))
</script>

<template>
  <div class="flex flex-col md:flex-row w-full h-full bg-[#05080f] overflow-hidden text-slate-300">
    
    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col h-full border-r border-slate-800 relative z-10">
      
      <!-- Chat Header -->
      <div class="h-12 border-b border-slate-800 bg-[#0a0f1c] flex items-center px-4 shrink-0 shadow-sm">
        <h2 class="font-bold text-slate-200 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
          全球投資者討論區
        </h2>
        <div class="ml-auto flex items-center gap-3">
          <span class="hidden xs:block text-[10px] text-slate-500 bg-slate-800/50 px-2 py-1 rounded font-mono">{{ chatMessages.length }} 則留言</span>
          <button 
            @click="chatSignOut" 
            class="flex items-center gap-1 text-[10px] text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded border border-slate-800 hover:border-red-900/30 bg-slate-800/30"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            登出
          </button>
        </div>
      </div>

      <!-- Messages List -->
      <div 
        ref="chatContainer" 
        @scroll="onScroll"
        class="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 bg-[#070b14]/50"
      >
        <div v-if="chatLoading" class="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
          <svg class="animate-spin h-6 w-6 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          載入對話紀錄中...
        </div>

        <div v-else-if="chatMessages.length === 0" class="flex items-center justify-center h-full text-slate-500">
          目前沒有任何留言，來做第一個發言的人吧！
        </div>
        
        <div v-if="!chatLoading && visibleCount < chatMessages.length" class="text-center text-[10px] text-slate-500 font-mono py-2">
          ↑ 向上滑動載入較早紀錄
        </div>

        <div v-for="msg in visibleMessages" :key="msg.id" class="flex gap-3 group animate-fade-in-up">
          <img :src="msg.avatar" class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 shrink-0 shadow-sm border border-slate-700" loading="lazy" />
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-baseline gap-2 mb-1">
              <span class="font-bold text-slate-200 text-xs md:text-sm shadow-sm">{{ msg.user }}</span>
              <span class="text-[10px] text-slate-500 font-mono">{{ formatTime(msg.timestamp) }}</span>
              <button 
                v-if="msg.user === chatUser || isAdmin"
                @click="removeChatMessage(msg.id)"
                class="ml-auto flex items-center gap-1 text-[10px] transition-colors px-2 py-0.5 rounded bg-slate-800/30 hover:bg-slate-800"
                :class="isAdmin && msg.user !== chatUser ? 'text-amber-500 hover:text-amber-400' : 'text-slate-500 hover:text-red-500'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                刪除
              </button>
            </div>
            
            <div class="bg-[#0a0f1c] border border-slate-800/80 rounded-b-xl rounded-tr-xl px-3 py-2 text-xs md:text-sm text-slate-300 w-fit max-w-[90%] md:max-w-[75%] shadow hover:border-slate-700 transition-colors">
              <span class="leading-relaxed whitespace-pre-wrap" v-html="formatMessage(msg.text)"></span>
              
              <!-- Embedded News Card -->
              <a v-if="msg.newsShare" :href="msg.newsShare.url" target="_blank" rel="noopener noreferrer" class="mt-2 block w-full bg-[#111827] border border-blue-900/40 rounded-lg p-3 hover:border-blue-500/50 transition-colors group/news overflow-hidden box-border">
                <div class="flex items-center gap-1.5 mb-1.5 opacity-80 group-hover/news:opacity-100">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-400 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" /></svg>
                  <span class="text-[10px] text-blue-400 font-bold uppercase tracking-wider truncate">{{ msg.newsShare.source }}</span>
                </div>
                <h4 class="text-xs md:text-sm font-bold text-white leading-tight group-hover/news:text-blue-300 transition-colors line-clamp-3">
                  {{ msg.newsShare.headline }}
                </h4>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="p-3 md:p-4 bg-[#0a0f1c] border-t border-slate-800 shrink-0">
        <form @submit.prevent="sendMessage" class="flex gap-2">
          <input 
            v-model="inputText"
            type="text" 
            placeholder="與大家分享您的看法..." 
            class="flex-1 bg-[#05080f] border border-slate-700 rounded-lg px-4 py-2 text-xs md:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
          >
          <button 
            type="submit"
            :disabled="!inputText.trim()"
            class="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-colors flex items-center gap-1 shrink-0"
          >
            <span>傳送</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 hidden md:block border-l pl-1 border-white/20 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>

    <!-- Hot News Sidebar -->
    <div class="w-full md:w-[320px] lg:w-[380px] bg-[#0a0f1c] flex flex-col h-[40vh] md:h-full shrink-0 border-t md:border-t-0 border-slate-800">
      <div class="h-12 border-b border-slate-800 flex items-center px-4 shrink-0 bg-[#070b14]/50">
        <h3 class="font-bold text-slate-300 text-xs md:text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" /></svg>
          熱門新聞分享
        </h3>
      </div>
      
      <div class="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div v-if="hotNews.length === 0" class="text-center text-slate-500 text-xs py-8">
          目前沒有熱門新聞可分享
        </div>
        
        <div v-for="news in hotNews" :key="news.id" class="mb-2 p-3 bg-[#111827] rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group/item">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded text-white tracking-wider" :class="news.accentColor">{{ news.cat.toUpperCase() }}</span>
                <span class="text-[10px] text-slate-500 font-mono">{{ news.time }}</span>
              </div>
              <h4 class="text-xs font-bold text-slate-200 leading-snug line-clamp-2 md:line-clamp-3 mb-2">{{ news.headline }}</h4>
            </div>
          </div>
          <div class="flex justify-end border-t border-slate-800/80 pt-2 mt-1">
            <button 
              @click="shareNews(news)" 
              class="flex items-center gap-1.5 text-[10px] md:text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-2 py-1.5 rounded transition-colors font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              分享至討論
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- Login Modal Overlay -->
  <div v-if="!chatSession && !chatLoading" class="absolute inset-0 z-[100] bg-[#05080f]/90 backdrop-blur-sm flex items-center justify-center p-4">
    <LoginModal @close="handleCloseLogin" />
  </div>
</template>

<style scoped>
@keyframes fade-in-up {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fade-in-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
