// --- DECOUPLING DEBUG BRIDGE (MUST BE FIRST) ---
if (typeof window !== 'undefined') {
  const w = window as any;
  w.__TBOX_DEBUG__ = true;

  // --- 警告過濾器：靜音 Vercel Snowplow 的無用警告 ---
  const originalWarn = console.warn;
  console.warn = (...args) => {
    // 攔截並丟棄特定的無效環境警告
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Invalid environment')) {
      return; 
    }
    originalWarn(...args);
  };

  w.testSound = () => {
    console.log('🎵 [BRIDGE] Sound Test signal sent');
    if (w.__PLAY_CHIME__) w.__PLAY_CHIME__();
    else console.warn('⚠️ Audio engine not yet loaded');
  };
  w.testNotify = (title: string = '測試', msg: string = '系統通知') => {
    console.log('🚀 [BRIDGE] Notify Test signal sent');
    if (w.__SHOW_TOAST__) w.__SHOW_TOAST__(title, msg, false, true);
    else console.warn('⚠️ Toast engine not yet loaded');
  };
}

import { createApp } from 'vue'
import './styles/main.css'
import App from './App.vue'
import { showToast } from './stores'
import { playNewsChime } from './utils/audio'

// Attach REAL implementations after they are imported
if (typeof window !== 'undefined') {
  const w = window as any;
  w.__SHOW_TOAST__ = showToast;
  w.__PLAY_CHIME__ = playNewsChime;
}

const app = createApp(App)
app.mount('#app')
