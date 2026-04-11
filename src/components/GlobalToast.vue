<script setup lang="ts">
import { watch } from 'vue'
import { toasts, removeToast } from '../store'

// To handle multiple timers securely by their ID
const timers = new Map<string, ReturnType<typeof setTimeout>>()

watch(toasts, (newVal) => {
  newVal.forEach(toast => {
    if (!timers.has(toast.id)) {
      resumeTimer(toast.id)
    }
  })
}, { deep: true, immediate: true })

const pauseTimer = (id: string) => {
  if (timers.has(id)) {
    clearTimeout(timers.get(id)!)
    timers.delete(id)
  }
}

const resumeTimer = (id: string) => {
  pauseTimer(id) // clear existing if any
  const timerId = setTimeout(() => {
    removeToast(id)
    timers.delete(id)
  }, 1500) // Restored to 1.5 seconds
  timers.set(id, timerId)
}

const handleClose = (id: string) => {
  pauseTimer(id)
  removeToast(id)
}
</script>

<template>
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-[90%] md:max-w-[400px]">
    <transition-group name="toast">
      <div 
        v-for="toast in toasts" :key="toast.id" 
        class="bg-[#0a0f1c]/95 border border-blue-500/50 shadow-[0_4px_24px_rgba(59,130,246,0.2)] rounded-lg p-3 md:p-4 text-white pointer-events-auto flex items-start justify-between relative overflow-hidden backdrop-blur-md"
        @mouseenter="pauseTimer(toast.id)"
        @mouseleave="resumeTimer(toast.id)"
        @touchstart="pauseTimer(toast.id)"
        @touchend="resumeTimer(toast.id)"
      >
        <div class="flex flex-col pr-2">
          <span class="font-bold text-sm md:text-base text-blue-400">{{ toast.title }}</span>
          <span class="text-xs md:text-sm text-slate-300 mt-1 leading-relaxed">{{ toast.message }}</span>
        </div>
        <button @click="handleClose(toast.id)" class="text-slate-500 hover:text-white shrink-0 p-1">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 md:h-5 md:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
</style>
