import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'
import { playNewsChime } from '../utils/audio'

interface ToastItem {
  id: string
  title: string
  message: string
}

interface NotificationLog {
  id: string
  title: string
  message: string
  timestamp: number
  isRead: boolean
}

export const useToastStore = defineStore('toast', () => {
  const toasts = ref<ToastItem[]>([])
  const notificationHistory = useStorage<NotificationLog[]>('tbox-notification-history', [])
  const isNotificationsEnabled = useStorage('tbox-notifications-enabled', false)
  const hasClickedNotifications = useStorage('tbox-has-clicked-notifications', false)

  const showToast = (title: string, message: string, silent: boolean = false, force: boolean = false) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7)

    // Show popup if enabled OR if forced by debug command
    if (isNotificationsEnabled.value || force) {
      toasts.value.push({ id, title, message })
      
      if (!silent && isNotificationsEnabled.value) {
        playNewsChime()
      }
    }

    // Always record in history
    notificationHistory.value.unshift({
      id,
      title,
      message,
      timestamp: Date.now(),
      isRead: false
    })

    if (notificationHistory.value.length > 50) {
      notificationHistory.value.pop()
    }
  }

  const removeToast = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  const markAllNotificationsRead = () => {
    notificationHistory.value.forEach(n => n.isRead = true)
  }

  const clearNotifications = () => {
    notificationHistory.value = []
  }

  const removeNotificationLog = (id: string) => {
    notificationHistory.value = notificationHistory.value.filter(n => n.id !== id)
  }

  const unreadNotificationsCount = computed(() => {
    return notificationHistory.value.filter(n => !n.isRead).length
  })

  return {
    toasts,
    notificationHistory,
    isNotificationsEnabled,
    hasClickedNotifications,
    showToast,
    removeToast,
    markAllNotificationsRead,
    clearNotifications,
    removeNotificationLog,
    unreadNotificationsCount
  }
})
