// Centralized Audio Engine for TradingBox - Pure Utility
let audioCtx: AudioContext | null = null

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
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

/**
 * Movers Chime: Middle-High-Middle (Alert pattern)
 */
export function playMoversChime() {
  try {
    const ctx = getAudioCtx()
    const now = ctx.currentTime
    const notes = [
      { freq: 1100, delay: 0 },
      { freq: 1500, delay: 0.1 },
      { freq: 1100, delay: 0.25 }
    ]
    notes.forEach(({ freq, delay }) => {
      const osc = ctx.createOscillator()
      const gainNode = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + delay)
      gainNode.gain.setValueAtTime(0, now + delay)
      gainNode.gain.linearRampToValueAtTime(0.4, now + delay + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35)
      osc.connect(gainNode)
      gainNode.connect(ctx.destination)
      osc.start(now + delay)
      osc.stop(now + delay + 0.45)
    })
    console.log("🔊 [TBOX] Movers Alert Chime Played")
  } catch (e) { /* silent fail */ }
}

// Expose to window for console testing
if (typeof window !== 'undefined') {
  const w = window as any
  w.testNewsSound = playNewsChime
  w.testMoversSound = playMoversChime
}
