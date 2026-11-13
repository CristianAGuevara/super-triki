import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Size } from '@/types/game'

export type SfxName =
  | 'click'
  | 'select'
  | 'move'
  | 'error'
  | 'turn'
  | 'tick'
  | 'win'
  | 'lose'
  | 'draw'
  | 'join'
  | 'leave'
  | 'start'
  | 'freeze'
  | 'heartbeat'
  | 'riser'
  | 'impact'
  | 'chord'
  | 'chime'
  | 'whoosh'
  | 'fanfare'

interface SfxOptions {
  size?: Size
  /** Position in a sequence (cinematic chimes climb the scale). */
  step?: number
  /** Length in seconds for sounds that stretch (the suspense riser). */
  duration?: number
}

const VOLUME_KEY = 'st_audio_volume'
const MUTED_KEY = 'st_audio_muted'
const MUSIC_KEY = 'st_audio_music'

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readVolume(): number {
  const raw = storage()?.getItem(VOLUME_KEY)
  const stored = raw === null || raw === undefined ? NaN : Number(raw)
  return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 0.6
}

function readMuted(): boolean {
  return storage()?.getItem(MUTED_KEY) === 'true'
}

function readMusic(): boolean {
  return storage()?.getItem(MUSIC_KEY) !== 'false'
}

function save(key: string, value: string) {
  try {
    storage()?.setItem(key, value)
  } catch {
    // Storage may be unavailable (private mode, some TV browsers).
  }
}

const SIZE_PITCH: Record<Size, number> = { large: 0.62, medium: 0.85, small: 1.18 }

/* D major-ish lo-fi loop: Dmaj7 · Bm7 · Gmaj7 · A6 */
const CHORDS = [
  [146.83, 185.0, 220.0, 277.18],
  [123.47, 146.83, 185.0, 220.0],
  [98.0, 146.83, 196.0, 246.94],
  [110.0, 138.59, 164.81, 185.0],
]
const MELODY_SCALE = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66]
const BEAT = 60 / 82
const MUSIC_LEVEL = 0.62
const MUSIC_DUCKED = 0.1
/* D major, so the cinematic chimes sit in the music's key. */
const CHIME_SCALE = [587.33, 739.99, 880.0, 1174.66, 1479.98, 1760.0]

export const useAudioStore = defineStore('audio', () => {
  const volume = ref(readVolume())
  const muted = ref(readMuted())
  const musicEnabled = ref(readMusic())
  const musicPlaying = ref(false)
  /** 'chip' swaps every voice for square/triangle waves (pixel theme). */
  const style = ref<'soft' | 'chip'>('soft')

  function setStyle(value: 'soft' | 'chip') {
    style.value = value
  }

  let context: AudioContext | null = null
  let masterGain: GainNode | null = null
  let musicGain: GainNode | null = null
  let sfxGain: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let musicTimer: number | null = null
  let musicBar = 0
  let nextBarTime = 0

  function ensureAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    if (context) return context

    context = new Ctor()
    masterGain = context.createGain()
    musicGain = context.createGain()
    sfxGain = context.createGain()
    musicGain.gain.value = MUSIC_LEVEL
    sfxGain.gain.value = 0.9

    // A soft echo gives the music some room without a reverb impulse.
    const lowpass = context.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 3400
    const delay = context.createDelay(1)
    delay.delayTime.value = BEAT * 0.75
    const feedback = context.createGain()
    feedback.gain.value = 0.28
    const wet = context.createGain()
    wet.gain.value = 0.22
    musicGain.connect(lowpass)
    lowpass.connect(masterGain)
    lowpass.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(masterGain)

    sfxGain.connect(masterGain)
    masterGain.connect(context.destination)

    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.5, context.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

    syncVolume()
    return context
  }

  function syncVolume() {
    if (!masterGain || !context) return
    masterGain.gain.setTargetAtTime(muted.value ? 0 : volume.value, context.currentTime, 0.02)
  }

  function setVolume(value: number) {
    volume.value = Math.min(1, Math.max(0, value))
    if (volume.value > 0 && muted.value) muted.value = false
    save(VOLUME_KEY, String(volume.value))
    save(MUTED_KEY, String(muted.value))
    syncVolume()
    if (volume.value > 0) startMusic()
  }

  function toggleMute() {
    muted.value = !muted.value
    save(MUTED_KEY, String(muted.value))
    syncVolume()
    if (!muted.value) startMusic()
  }

  function toggleMusic() {
    musicEnabled.value = !musicEnabled.value
    save(MUSIC_KEY, String(musicEnabled.value))
    if (musicEnabled.value) startMusic()
    else stopMusic()
  }

  interface ToneSpec {
    freq: number
    to?: number
    dur: number
    type?: OscillatorType
    gain: number
    delay?: number
    attack?: number
    dest: AudioNode
    detune?: number
  }

  function tone({ freq, to, dur, type = 'sine', gain, delay = 0, attack = 0.008, dest, detune = 0 }: ToneSpec) {
    const audio = context
    if (!audio) return
    const start = audio.currentTime + delay
    const end = start + dur
    const osc = audio.createOscillator()
    const env = audio.createGain()
    if (style.value === 'chip') {
      // Console sound chip: pulse leads, triangle bass, no detune.
      const bass = freq < 180
      osc.type = bass ? 'triangle' : 'square'
      gain *= bass ? 1.25 : 0.42
      detune = 0
      attack = Math.min(attack, 0.02)
    } else {
      osc.type = type
    }
    osc.detune.value = detune
    osc.frequency.setValueAtTime(freq, start)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, end)
    env.gain.setValueAtTime(0.0001, start)
    env.gain.exponentialRampToValueAtTime(gain, start + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(env)
    env.connect(dest)
    osc.start(start)
    osc.stop(end + 0.05)
  }

  interface NoiseExtra {
    /** Sweep the filter to this frequency over the duration. */
    to?: number
    type?: BiquadFilterType
    /** Swell in over this many seconds instead of starting at full gain. */
    attack?: number
  }

  function noise(dur: number, gain: number, filterFreq: number, q: number, delay = 0, dest?: AudioNode, extra: NoiseExtra = {}) {
    const audio = context
    if (!audio || !noiseBuffer) return
    const start = audio.currentTime + delay
    const src = audio.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = dur > 0.45
    const filter = audio.createBiquadFilter()
    filter.type = extra.type ?? 'bandpass'
    filter.frequency.setValueAtTime(filterFreq, start)
    if (extra.to) filter.frequency.exponentialRampToValueAtTime(extra.to, start + dur)
    filter.Q.value = q
    const env = audio.createGain()
    if (extra.attack) {
      env.gain.setValueAtTime(0.0001, start)
      env.gain.exponentialRampToValueAtTime(gain, start + extra.attack)
    } else {
      env.gain.setValueAtTime(gain, start)
    }
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    src.connect(filter)
    filter.connect(env)
    env.connect(dest ?? sfxGain!)
    src.start(start, Math.random() * 0.3)
    src.stop(start + dur + 0.02)
  }

  /* ── Music ─────────────────────────────────────────────────────── */

  function scheduleBar(time: number) {
    const audio = context
    if (!audio || !musicGain) return
    const dest = musicGain
    const chord = CHORDS[musicBar % CHORDS.length]
    const offset = time - audio.currentTime

    chord.forEach((freq, index) => {
      tone({ freq, dur: BEAT * 4.2, type: index === 0 ? 'triangle' : 'sine', gain: index === 0 ? 0.09 : 0.05, delay: offset + index * 0.02, attack: 0.5, dest, detune: index % 2 ? 6 : -6 })
    })
    // Bass pulse on beats 1 and 3.
    tone({ freq: chord[0] / 2, dur: BEAT * 1.6, type: 'sine', gain: 0.13, delay: offset, attack: 0.02, dest })
    tone({ freq: chord[0] / 2, dur: BEAT * 1.4, type: 'sine', gain: 0.09, delay: offset + BEAT * 2, attack: 0.02, dest })

    // Sparse pentatonic plucks: different on each pass, never busy.
    for (let step = 0; step < 8; step++) {
      if (Math.random() > (step % 2 === 0 ? 0.42 : 0.18)) continue
      const note = MELODY_SCALE[Math.floor(Math.random() * MELODY_SCALE.length)]
      tone({ freq: note, dur: 0.5, type: 'triangle', gain: 0.05, delay: offset + step * (BEAT / 2), attack: 0.005, dest })
    }
    // Brushed hat on the off-beats.
    for (let beat = 0; beat < 4; beat++) {
      noise(0.05, 0.02, 7000, 0.8, offset + beat * BEAT + BEAT / 2, dest)
    }
    musicBar++
  }

  function musicLoop() {
    const audio = context
    if (!audio || !musicPlaying.value) {
      musicTimer = null
      return
    }
    while (nextBarTime < audio.currentTime + BEAT * 4.5) {
      scheduleBar(nextBarTime)
      nextBarTime += BEAT * 4
    }
    musicTimer = window.setTimeout(musicLoop, 1000)
  }

  function startMusic() {
    if (!musicEnabled.value || muted.value) return
    const audio = ensureAudio()
    if (!audio) return
    void audio.resume()
    if (musicPlaying.value && musicTimer !== null) return
    musicPlaying.value = true
    nextBarTime = audio.currentTime + 0.15
    musicLoop()
  }

  /** Lower the music while a cinematic plays its own score. */
  function duckMusic(ducked: boolean) {
    if (!musicGain || !context) return
    musicGain.gain.setTargetAtTime(ducked ? MUSIC_DUCKED : MUSIC_LEVEL, context.currentTime, ducked ? 0.08 : 0.6)
  }

  /** Short brass-like stab: sawtooth through a closing lowpass. */
  function brass(freq: number, dur: number, gain: number, delay: number, dest: AudioNode) {
    const audio = context
    if (!audio) return
    const start = audio.currentTime + delay
    const filter = audio.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 2
    filter.frequency.setValueAtTime(600, start)
    filter.frequency.exponentialRampToValueAtTime(3200, start + 0.06)
    filter.frequency.exponentialRampToValueAtTime(1200, start + dur)
    filter.connect(dest)
    ;[-7, 7].forEach(detune => {
      const osc = audio.createOscillator()
      const env = audio.createGain()
      osc.type = 'sawtooth'
      osc.detune.value = detune
      osc.frequency.value = freq
      env.gain.setValueAtTime(0.0001, start)
      env.gain.exponentialRampToValueAtTime(gain, start + 0.025)
      env.gain.setValueAtTime(gain, start + dur * 0.6)
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(env)
      env.connect(filter)
      osc.start(start)
      osc.stop(start + dur + 0.05)
    })
  }

  function stopMusic() {
    musicPlaying.value = false
    if (musicTimer !== null) {
      window.clearTimeout(musicTimer)
      musicTimer = null
    }
  }

  /* ── Effects ───────────────────────────────────────────────────── */

  function playSfx(name: SfxName, options: SfxOptions = {}) {
    const audio = ensureAudio()
    if (!audio || muted.value || !sfxGain) return
    const dest = sfxGain
    void audio.resume()
    const pitch = options.size ? SIZE_PITCH[options.size] : 1

    switch (name) {
      case 'click':
        tone({ freq: 880, to: 620, dur: 0.06, gain: 0.06, dest })
        noise(0.025, 0.05, 3200, 2)
        break
      case 'select':
        noise(0.03, 0.08, 2600 * pitch, 3)
        tone({ freq: 440 * pitch, dur: 0.12, type: 'triangle', gain: 0.09, dest })
        tone({ freq: 660 * pitch, dur: 0.16, type: 'sine', gain: 0.06, delay: 0.05, dest })
        break
      case 'move':
        // Acrylic ring landing on a wooden tray: a click plus a thump.
        noise(0.07, 0.22, 2200 * pitch, 1.6)
        tone({ freq: 210 * pitch, to: 120 * pitch, dur: 0.16, type: 'sine', gain: 0.22, dest })
        tone({ freq: 1320 * pitch, dur: 0.09, type: 'triangle', gain: 0.035, delay: 0.01, dest })
        break
      case 'error':
        tone({ freq: 240, to: 200, dur: 0.11, type: 'square', gain: 0.035, dest })
        tone({ freq: 190, to: 150, dur: 0.16, type: 'square', gain: 0.035, delay: 0.1, dest })
        break
      case 'turn':
        ;[659.25, 830.61, 987.77].forEach((freq, index) => {
          tone({ freq, dur: 0.38, type: 'triangle', gain: 0.07, delay: index * 0.08, dest })
          tone({ freq: freq * 2, dur: 0.3, type: 'sine', gain: 0.02, delay: index * 0.08 + 0.01, dest })
        })
        break
      case 'tick':
        tone({ freq: 1250, dur: 0.05, type: 'sine', gain: 0.08, dest })
        noise(0.02, 0.05, 5000, 4)
        break
      case 'start':
        ;[392, 523.25, 659.25, 783.99].forEach((freq, index) => {
          tone({ freq, dur: 0.22, type: 'triangle', gain: 0.08, delay: index * 0.07, dest })
        })
        break
      case 'win': {
        const notes = [523.25, 659.25, 783.99, 1046.5]
        notes.forEach((freq, index) => {
          tone({ freq, dur: 0.28, type: 'triangle', gain: 0.1, delay: index * 0.11, dest })
        })
        ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(freq => {
          tone({ freq, dur: 1.4, type: 'sine', gain: 0.045, delay: 0.46, attack: 0.03, dest })
        })
        for (let i = 0; i < 6; i++) noise(0.12, 0.05, 6000 + i * 600, 6, 0.46 + i * 0.07)
        break
      }
      case 'freeze':
        // Time slows down: everything sinks in pitch.
        tone({ freq: 1200, to: 90, dur: 0.75, type: 'sawtooth', gain: 0.07, dest })
        tone({ freq: 600, to: 45, dur: 0.9, type: 'sine', gain: 0.2, dest })
        noise(0.8, 0.2, 6000, 1.2, 0, undefined, { to: 200 })
        break
      case 'heartbeat':
        tone({ freq: 62, to: 40, dur: 0.16, type: 'sine', gain: 0.5, dest })
        tone({ freq: 56, to: 36, dur: 0.2, type: 'sine', gain: 0.38, delay: 0.19, dest })
        noise(0.08, 0.12, 120, 0.8, 0, undefined, { type: 'lowpass' })
        break
      case 'riser': {
        // Suspense: rising filtered noise, a climbing drone and a snare roll
        // that starts sparse and ends as a buzz.
        const dur = options.duration ?? 1.5
        noise(dur, 0.2, 250, 1.2, 0, undefined, { to: 5200, attack: dur * 0.9 })
        tone({ freq: 55, to: 110, dur, type: 'sawtooth', gain: 0.06, attack: dur * 0.85, dest })
        tone({ freq: 110, to: 330, dur, type: 'sine', gain: 0.08, attack: dur * 0.85, dest })
        tone({ freq: 220, to: 880, dur, type: 'triangle', gain: 0.04, attack: dur * 0.9, dest })
        let t = 0
        let gap = Math.min(0.34, dur / 9)
        while (t < dur - 0.04) {
          const progress = t / dur
          noise(0.05, 0.04 + progress * 0.16, 1700 + progress * 900, 1, t)
          t += gap
          gap = Math.max(0.03, gap * 0.9)
        }
        break
      }
      case 'impact':
        tone({ freq: 170, to: 32, dur: 1.1, type: 'sine', gain: 0.7, dest })
        tone({ freq: 85, to: 28, dur: 1.3, type: 'triangle', gain: 0.32, dest })
        noise(0.5, 0.55, 900, 0.7, 0, undefined, { type: 'lowpass', to: 110 })
        noise(0.09, 0.35, 2400, 1.4)
        // Crash cymbal tail.
        noise(1.6, 0.16, 6500, 0.5, 0, undefined, { type: 'highpass' })
        tone({ freq: 1320, dur: 0.12, type: 'triangle', gain: 0.07, delay: 0.01, dest })
        break
      case 'chord':
        // The whole winning line rings together.
        ;[587.33, 739.99, 880, 1174.66].forEach((freq, index) => {
          tone({ freq, dur: 1.1, type: 'triangle', gain: 0.07, delay: index * 0.02, dest })
          tone({ freq: freq * 2, dur: 0.7, type: 'sine', gain: 0.02, delay: index * 0.02, dest })
        })
        break
      case 'chime': {
        const step = Math.min(options.step ?? 0, CHIME_SCALE.length - 1)
        const freq = CHIME_SCALE[step]
        tone({ freq, dur: 0.7, type: 'triangle', gain: 0.12, dest })
        tone({ freq: freq * 2, dur: 0.5, type: 'sine', gain: 0.04, delay: 0.01, dest })
        tone({ freq: freq * 3, dur: 0.25, type: 'sine', gain: 0.015, delay: 0.02, dest })
        noise(0.18, 0.05, 7000 + step * 800, 5, 0.01)
        break
      }
      case 'whoosh':
        noise(0.5, 0.18, 5000, 1.5, 0, undefined, { to: 500, attack: 0.18 })
        break
      case 'fanfare': {
        // Da-da-da-DAAA, then the full D major chord with a sparkle tail.
        const lead = [[587.33, 0, 0.13], [587.33, 0.15, 0.13], [587.33, 0.3, 0.13], [880, 0.45, 0.9]] as const
        lead.forEach(([freq, delay, dur]) => brass(freq, dur, 0.07, delay, dest))
        ;[293.66, 369.99, 440, 587.33].forEach(freq => brass(freq, 1.5, 0.045, 0.45, dest))
        tone({ freq: 73.42, dur: 1.6, type: 'sine', gain: 0.22, delay: 0.45, dest })
        noise(0.5, 0.3, 700, 0.8, 0.45, undefined, { type: 'lowpass', to: 150 })
        for (let i = 0; i < 10; i++) {
          tone({ freq: CHIME_SCALE[i % CHIME_SCALE.length] * 2, dur: 0.3, type: 'sine', gain: 0.025, delay: 0.6 + i * 0.07, dest })
        }
        break
      }
      case 'lose':
        ;[392, 311.13, 261.63].forEach((freq, index) => {
          tone({ freq, dur: 0.42, type: 'triangle', gain: 0.08, delay: index * 0.2, dest })
        })
        tone({ freq: 130.81, dur: 1, type: 'sine', gain: 0.06, delay: 0.6, dest })
        break
      case 'draw':
        tone({ freq: 440, dur: 0.24, type: 'triangle', gain: 0.07, dest })
        tone({ freq: 392, dur: 0.24, type: 'triangle', gain: 0.07, delay: 0.16, dest })
        tone({ freq: 440, dur: 0.5, type: 'sine', gain: 0.05, delay: 0.32, dest })
        break
      case 'join':
        tone({ freq: 523.25, dur: 0.14, type: 'sine', gain: 0.07, dest })
        tone({ freq: 783.99, dur: 0.22, type: 'sine', gain: 0.07, delay: 0.09, dest })
        break
      case 'leave':
        tone({ freq: 392, dur: 0.18, type: 'sine', gain: 0.06, dest })
        tone({ freq: 261.63, dur: 0.26, type: 'sine', gain: 0.06, delay: 0.12, dest })
        break
    }
  }

  return {
    volume,
    muted,
    musicEnabled,
    musicPlaying,
    style,
    setStyle,
    setVolume,
    toggleMute,
    toggleMusic,
    startMusic,
    stopMusic,
    duckMusic,
    playSfx,
  }
})
