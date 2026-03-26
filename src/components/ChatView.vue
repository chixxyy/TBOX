<script setup lang="ts">
import { ref, nextTick, computed, onMounted, watch } from 'vue'
import { 
  chatMessages, addChatMessage, removeChatMessage, 
  globalNews, chatUser, chatSession, chatLoading, 
  isAdmin, goToLogin, userProfile, isChatConnected, initSupabaseChat 
} from '../store'

const currentUser = chatUser
const currentAvatar = computed(() => userProfile.value?.avatar_url || `https://ui-avatars.com/api/?name=${currentUser.value}&background=3b82f6&color=fff&rounded=true`)

const inputText = ref('')
const chatContainer = ref<HTMLElement | null>(null)
const visibleCount = ref(15)

const confirmDeleteId = ref<string | null>(null)
const confirmDelete = async () => {
  if (confirmDeleteId.value) {
    await removeChatMessage(confirmDeleteId.value)
    confirmDeleteId.value = null
  }
}

// News Sharing Confirmation
const showShareConfirm = ref(false)
const newsToShare = ref<any>(null)
const triggerShare = (news: any) => {
  newsToShare.value = news
  showShareConfirm.value = true
}
const executeShare = async () => {
  if (!newsToShare.value) return
  await addChatMessage({
    user: userProfile.value?.full_name || currentUser.value,
    avatar: userProfile.value?.avatar_url || currentAvatar.value,
    text: '快看這則重要新聞！',
    newsShare: {
      headline: newsToShare.value.headline,
      url: newsToShare.value.url,
      source: newsToShare.value.source
    }
  })
  showShareConfirm.value = false
  newsToShare.value = null
}

// Collapsible News Card Logic
const expandedMessages = ref<Set<string>>(new Set())
const toggleExpand = (id: string) => {
  if (expandedMessages.value.has(id)) {
    expandedMessages.value.delete(id)
  } else {
    expandedMessages.value.add(id)
  }
}

// Mobile Sidebar Toggle
const showNewsSidebar = ref(window.innerWidth >= 768)

// News Translation Logic
const translatedNews = ref<Record<string, string>>({})
const translatingIds = ref<Set<string>>(new Set())

const translateNews = async (news: any) => {
  if (translatedNews.value[news.id]) {
    delete translatedNews.value[news.id]
    return
  }

  translatingIds.value.add(news.id)
  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(news.headline)}&langpair=en|zh-TW`)
    const data = await response.json()
    if (data.responseData?.translatedText) {
      translatedNews.value[news.id] = data.responseData.translatedText
    }
  } catch (error) {
    console.error('Translation failed:', error)
  } finally {
    translatingIds.value.delete(news.id)
  }
}

const visibleMessages = computed(() => {
  if (!Array.isArray(chatMessages.value)) return []
  return chatMessages.value.slice(Math.max(0, chatMessages.value.length - visibleCount.value))
})

const onScroll = async (e: Event) => {
  const el = e.target as HTMLElement
  if (el.scrollTop <= 5) {
    if (visibleCount.value < chatMessages.value.length) {
      const oldScrollHeight = el.scrollHeight
      visibleCount.value += 15
      await nextTick()
      const newScrollHeight = el.scrollHeight
      el.scrollTop = newScrollHeight - oldScrollHeight
    }
  }
}

const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

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

const sendMessage = async () => {
  if (!inputText.value.trim()) return
  
  await addChatMessage({
    user: userProfile.value?.full_name || currentUser.value,
    avatar: userProfile.value?.avatar_url || currentAvatar.value,
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

const handleRefresh = () => {
  window.location.reload()
}

const hotNews = computed(() => globalNews.value.slice(0, 20))
</script>

<template>
  <div class="flex flex-col md:flex-row w-full h-full bg-[#05080f] text-slate-300">
    
    <!-- Main Chat Area -->
    <div class="flex-1 flex flex-col min-h-0 border-r border-slate-800 relative z-10">
      
      <!-- Chat Header -->
      <div class="h-12 border-b border-slate-800 bg-[#0a0f1c] flex items-center px-4 shrink-0 shadow-sm">
        <h2 class="font-bold text-slate-200 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          討論區
        </h2>
        <div class="ml-auto flex items-center gap-2">
          <span class="hidden xs:block text-[10px] text-slate-500 bg-slate-800/50 px-2 py-1 rounded font-mono">{{ chatMessages.length }} 留言</span>
          
          <!-- Mobile Toggle Sidebar -->
          <button 
            @click="showNewsSidebar = !showNewsSidebar"
            class="md:hidden flex items-center gap-1 px-2 py-1 rounded bg-blue-600/10 border border-blue-500/30 text-[10px] font-bold text-blue-400 active:scale-95 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            {{ showNewsSidebar ? '關閉新聞' : '開啟新聞' }}
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

        <!-- Connection Failure Warning -->
        <div v-if="!chatLoading && !isChatConnected" class="mb-4 bg-red-950/40 border border-red-900/60 p-3 rounded-xl flex items-center justify-between animate-pulse">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div class="flex flex-col">
              <div class="text-[10px] md:text-sm text-red-200 font-bold">討論區連線中斷</div>
              <div class="text-[8px] md:text-xs text-red-400 opacity-80">無法接收即時更新，請嘗試手動重新整理</div>
            </div>
          </div>
          <button @click="handleRefresh" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] md:text-xs font-black rounded-lg transition-all shadow-lg shadow-red-600/20 active:scale-95 whitespace-nowrap ml-2">重新整理</button>
        </div>

        <div v-else-if="chatMessages.length === 0" class="flex items-center justify-center h-full text-slate-500">
          目前沒有任何留言，來做第一個發言的人吧！
        </div>
        
        <div v-if="!chatLoading && visibleCount < chatMessages.length" class="text-center text-[10px] text-slate-500 font-mono py-2">
          ↑ 向上滑動載入較早紀錄
        </div>

        <div v-for="msg in visibleMessages" :key="msg.id" class="flex gap-3 group animate-fade-in-up">
          <img :src="(msg.userId === chatSession?.user?.id ? userProfile?.avatar_url : msg.avatar) || `https://ui-avatars.com/api/?name=U&background=random`" class="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 shrink-0 shadow-sm border border-slate-700" loading="lazy" />
          <div class="flex flex-col min-w-0 flex-1">
            <div class="flex items-baseline gap-2 mb-1">
              <span class="font-bold text-slate-200 text-xs md:text-sm shadow-sm">{{ msg.userId === chatSession?.user?.id ? userProfile?.full_name : (msg.user || '匿名使用者') }}</span>
              <span class="text-[10px] text-slate-500 font-mono">{{ formatTime(msg.timestamp || Date.now()) }}</span>
              <button 
                v-if="msg.userId === chatSession?.user?.id || isAdmin"
                @click.stop="confirmDeleteId = msg.id"
                class="ml-auto flex items-center gap-1 text-[10px] transition-colors px-2 py-0.5 rounded bg-slate-800/30 hover:bg-slate-800"
                :class="isAdmin && msg.user !== chatUser ? 'text-amber-500 hover:text-amber-400' : 'text-slate-500 hover:text-red-500'"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                刪除
              </button>
            </div>
            
            <div class="bg-[#0a0f1c] border border-slate-800/80 rounded-b-xl rounded-tr-xl px-3 py-2 text-xs md:text-sm text-slate-300 w-fit max-w-[92%] md:max-w-[80%] shadow hover:border-slate-700 transition-colors">
              <span class="leading-relaxed whitespace-pre-wrap" v-html="formatMessage(msg.text)"></span>
              
              <div v-if="msg.newsShare" class="mt-2 w-full overflow-hidden">
                <!-- Collapsible News Card -->
                <div class="bg-[#111827] border border-blue-900/40 rounded-lg overflow-hidden transition-all duration-300">
                  <div class="flex items-center justify-between p-2 md:p-3 bg-blue-900/5 group/news">
                    <div class="flex items-center gap-1.5 opacity-80 min-w-0">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-400 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clip-rule="evenodd" /></svg>
                      <span class="text-[9px] text-blue-400 font-bold uppercase tracking-wider truncate">{{ msg.newsShare.source }}</span>
                    </div>
                    <button @click="toggleExpand(msg.id)" class="text-[9px] text-slate-500 hover:text-white flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-800">
                      {{ expandedMessages.has(msg.id) ? '收起' : '展開新聞' }}
                      <svg :class="{'rotate-180': expandedMessages.has(msg.id)}" class="h-2.5 w-2.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  
                  <transition name="chat-news-expand">
                    <div v-if="expandedMessages.has(msg.id)" class="p-3 border-t border-slate-800/50 space-y-3">
                      <h4 class="text-xs md:text-sm font-bold text-white leading-tight">
                        {{ translatedNews[msg.id] || msg.newsShare.headline }}
                      </h4>
                      <div class="flex items-center gap-3">
                        <button 
                          @click.stop="translateNews({ id: msg.id, headline: msg.newsShare.headline })"
                          class="flex items-center gap-1.5 text-[9px] font-bold py-1 px-2 rounded border transition-all"
                          :class="translatedNews[msg.id] ? 'text-blue-400 border-blue-900/40 bg-blue-950/20 shadow-sm' : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:bg-slate-800'"
                          :disabled="translatingIds.has(msg.id)"
                        >
                          <svg v-if="translatingIds.has(msg.id)" class="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.198 15.297 5 18" /></svg>
                          {{ translatedNews[msg.id] ? 'ORIGINAL' : '翻譯' }}
                        </button>
                        <a :href="msg.newsShare.url" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300 py-1 transition-colors">
                          閱讀完整原文
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                        </a>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <div class="h-14 md:h-16 px-4 flex items-center bg-[#05080f] border-t border-slate-800">
        <template v-if="chatSession">
          <input 
            v-model="inputText"
            type="text" 
            placeholder="與大家分享您的看法..." 
            class="flex-1 bg-[#05080f] border border-slate-700 rounded-lg px-4 py-2 text-[16px] md:text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
            @keyup.enter="sendMessage"
          >
          <button 
            @click="sendMessage"
            class="ml-3 p-2 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </template>
        <template v-else>
          <div @click="goToLogin" class="flex-1 flex items-center justify-center gap-2 cursor-pointer bg-[#0a0f1c] hover:bg-slate-800 rounded-lg border border-slate-800 py-2 transition-all">
            <span class="text-xs md:text-sm text-slate-400">登入後即可參與討論</span>
            <span class="text-xs md:text-sm font-bold text-blue-400 hover:underline">去登入</span>
          </div>
        </template>
      </div>
    </div>

    <!-- Hot News Sidebar -->
    <div v-show="showNewsSidebar" class="w-full md:w-[320px] lg:w-[380px] bg-[#0a0f1c] flex flex-col h-[40vh] md:h-auto shrink-0 border-t md:border-t-0 border-slate-800 transition-all">
      <div class="h-12 border-b border-slate-800 flex items-center px-4 shrink-0 bg-[#070b14]/50">
        <h3 class="font-bold text-slate-300 text-xs md:text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd" /></svg>
          新聞分享
        </h3>
        <button @click="showNewsSidebar = false" class="md:hidden ml-auto p-1.5 text-slate-500 hover:text-white bg-slate-800/50 rounded-lg">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-700">
        <div v-if="hotNews.length === 0" class="text-center text-slate-500 text-xs py-8">
          目前沒有新聞可分享
        </div>
        
        <div v-for="news in hotNews" :key="news.id" class="mb-2 p-3 bg-[#111827] rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group/item">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded text-white tracking-wider" :class="news.accentColor">{{ news.cat.toUpperCase() }}</span>
                <span class="text-[10px] text-slate-500 font-mono">{{ news.time }}</span>
              </div>
              <h4 class="text-xs font-bold text-slate-200 leading-snug line-clamp-2 md:line-clamp-3 mb-2">
                {{ translatedNews[news.id] || news.headline }}
              </h4>
            </div>
          </div>
          <div class="flex justify-between items-center border-t border-slate-800/80 pt-2 mt-1">
            <button 
              @click="translateNews(news)"
              class="flex items-center gap-1.5 text-[10px] md:text-xs transition-colors px-2 py-1.5 rounded font-bold"
              :class="translatedNews[news.id] ? 'text-blue-400 bg-blue-900/20' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'"
              :disabled="translatingIds.has(news.id)"
            >
              <svg v-if="translatingIds.has(news.id)" class="animate-spin h-3.5 w-3.5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 11.37 9.198 15.297 5 18" /></svg>
              {{ translatingIds.has(news.id) ? '翻譯中...' : (translatedNews[news.id] ? 'ORIGINAL' : '翻譯') }}
            </button>
            <button 
              @click="triggerShare(news)" 
              class="flex items-center gap-1.5 text-[10px] md:text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 px-2 py-1.5 rounded transition-colors font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              分享至討論
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Share Confirmation Modal -->
    <transition name="fade">
      <div v-if="showShareConfirm" class="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-[#111827] border border-blue-900/50 rounded-xl p-6 w-full max-w-sm shadow-2xl relative">
          <!-- Close button -->
          <button @click="showShareConfirm = false" class="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>

          <template v-if="chatSession">
            <div class="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-white text-center mb-2">確定要分享到討論區嗎？</h3>
            <p class="text-xs text-slate-400 text-center mb-6 line-clamp-2">「{{ newsToShare?.headline }}」</p>
            <div class="flex gap-3">
              <button @click="showShareConfirm = false" class="flex-1 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold">
                取消
              </button>
              <button @click="executeShare" class="flex-1 py-2.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-bold">
                確定分享
              </button>
            </div>
          </template>
          
          <template v-else>
            <div class="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 class="text-lg font-bold text-white text-center mb-2">請先註冊或登入</h3>
            <p class="text-xs text-slate-400 text-center mb-6 leading-relaxed">
              分析與分享功能僅限會員使用。<br>登入後即可與全球投資者參與討論！
            </p>
            <div class="flex gap-3">
              <button @click="showShareConfirm = false" class="flex-1 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold">
                取消
              </button>
              <button @click="goToLogin(); showShareConfirm = false" class="flex-1 py-2.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors text-sm font-bold shadow-lg shadow-blue-600/20">
                前往登入
              </button>
            </div>
          </template>
        </div>
      </div>
    </transition>

    <!-- Delete Confirmation Modal Overlay -->
    <transition name="fade">
      <div v-if="confirmDeleteId !== null" class="fixed inset-0 z-[200] flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
        <div class="bg-[#111827] border border-red-900/50 rounded-xl p-6 w-full max-w-sm shadow-2xl text-center">
          <div class="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 class="text-lg font-bold text-white mb-2">確定要刪除這則留言嗎？</h3>
          <p class="text-xs text-slate-400 mb-6">此動作無法復原，其他人將無法再看到此留言。</p>
          <div class="flex gap-3">
            <button @click="confirmDeleteId = null" class="flex-1 py-2.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm font-bold">
              取消
            </button>
            <button @click="confirmDelete" class="flex-1 py-2.5 rounded bg-red-600 text-white hover:bg-red-500 transition-colors text-sm font-bold">
              確定刪除
            </button>
          </div>
        </div>
      </div>
    </transition>

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

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* News Expand Animation */
.chat-news-expand-enter-active, .chat-news-expand-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 200px;
}
.chat-news-expand-enter-from, .chat-news-expand-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-5px);
}
</style>
