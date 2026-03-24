import { useWebNotification } from '@vueuse/core'

const { isSupported, show, permissionGranted } = useWebNotification({
  requestPermissions: false,
})

export async function initDesktopNotifications() {
  if (isSupported.value && !permissionGranted.value && 'Notification' in window) {
    await Notification.requestPermission()
  }
}

export function sendDesktopNotification(title: string, body: string, icon?: string) {
  if (isSupported.value && permissionGranted.value) {
    show({ title, body, icon: icon || '/vite.svg' }) // 使用預設 icon
  }
}

