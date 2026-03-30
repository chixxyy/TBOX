// Centralized Audio Engine for TradingBox - Pure Utility
let audioCtx: AudioContext | null = null
let isUnlocked = false

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return audioCtx
}

// Global user interaction listener to permanently unlock AudioContext on iOS/Safari and strict browsers
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    if (isUnlocked) return
    const ctx = getAudioCtx()
    
    // Play a silent oscillator for 1ms to safely unlock mobile Safari
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.001)

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isUnlocked = true
        removeListeners()
      }).catch(e => console.warn('[TBOX] Audio unlock blocked:', e))
    } else {
      isUnlocked = true
      removeListeners()
    }
  }

  const removeListeners = () => {
    document.removeEventListener('click', unlockAudio)
    document.removeEventListener('touchstart', unlockAudio)
    document.removeEventListener('keydown', unlockAudio)
  }

  document.addEventListener('click', unlockAudio)
  document.addEventListener('touchstart', unlockAudio, { passive: true })
  document.addEventListener('keydown', unlockAudio)
}

/**
 * News Chime: Three rising notes (Rising Info pattern)
 */
export function playNewsChime() {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    const notes = [
      { freq: 880, delay: 0 },
      { freq: 1320, delay: 0.13 },
      { freq: 1760, delay: 0.26 }
    ]
    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + delay)
      gainNode.gain.setValueAtTime(0, now + delay)
      gainNode.gain.linearRampToValueAtTime(0.4, now + delay + 0.03)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4)
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + 0.5)
    })
    console.log("🔊 [TBOX] News Alert Chime Played")
  } catch (e) { /* silent fail */ }
}

// Expose to window for console testing
if (typeof window !== 'undefined') {
  const w = window as any
  w.testNewsSound = playNewsChime
}
