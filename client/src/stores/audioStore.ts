import { defineStore } from 'pinia'
import { ref } from 'vue'

type SfxName = 'click' | 'move' | 'win' | 'draw' | 'join' | 'leave'

const VOLUME_KEY = 'st_audio_volume'
const MUTED_KEY = 'st_audio_muted'

function readVolume(): number {
  if (typeof window === 'undefined') return 0.55
  const stored = Number(window.localStorage.getItem(VOLUME_KEY))
  return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 0.55
}

function readMuted(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(MUTED_KEY) === 'true'
}

export const useAudioStore = defineStore('audio', () => {
  const volume = ref(readVolume())
  const muted = ref(readMuted())
  const musicPlaying = ref(false)

  let context: AudioContext | null = null
  let masterGain: GainNode | null = null
  let musicGain: GainNode | null = null
  let sfxGain: GainNode | null = null
  let musicTimer: number | null = null
  let musicStep = 0

  function ensureAudio(): AudioContext | null {
    if (typeof window === 'undefined' || !window.AudioContext) return null
    if (context) return context

    context = new window.AudioContext()
    masterGain = context.createGain()
    musicGain = context.createGain()
    sfxGain = context.createGain()
    musicGain.gain.value = 0.34
    sfxGain.gain.value = 0.9
    masterGain.connect(context.destination)
    musicGain.connect(masterGain)
    sfxGain.connect(masterGain)
    syncVolume()
    return context
  }

  function syncVolume() {
    if (masterGain) masterGain.gain.value = muted.value ? 0 : volume.value
  }

  function setVolume(value: number) {
    volume.value = Math.min(1, Math.max(0, value))
    if (volume.value > 0 && muted.value) muted.value = false
    window.localStorage.setItem(VOLUME_KEY, String(volume.value))
    syncVolume()
    if (volume.value > 0) startMusic()
  }

  function toggleMute() {
    muted.value = !muted.value
    window.localStorage.setItem(MUTED_KEY, String(muted.value))
    syncVolume()
    if (!muted.value) startMusic()
  }

  function playTone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
    destination: GainNode,
    delay = 0,
  ) {
    const audio = ensureAudio()
    if (!audio) return

    const oscillator = audio.createOscillator()
    const envelope = audio.createGain()
    const start = audio.currentTime + delay
    const end = start + duration
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, start)
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(gainValue, start + 0.04)
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)
    oscillator.connect(envelope)
    envelope.connect(destination)
    oscillator.start(start)
    oscillator.stop(end + 0.05)
  }

  function scheduleAmbient() {
    if (!musicPlaying.value || muted.value) {
      musicTimer = null
      return
    }

    const audio = ensureAudio()
    if (!audio || !musicGain) return
    const destination = musicGain
    const chords = [
      [146.83, 220, 277.18],
      [130.81, 196, 246.94],
      [164.81, 246.94, 329.63],
      [146.83, 220, 293.66],
    ]
    const chord = chords[musicStep % chords.length]
    chord.forEach((frequency, index) => {
      playTone(frequency, 2.8, index === 1 ? 'triangle' : 'sine', 0.045, destination, index * 0.08)
    })
    musicStep++
    musicTimer = window.setTimeout(scheduleAmbient, 3_000)
  }

  function startMusic() {
    const audio = ensureAudio()
    if (!audio || muted.value) return
    musicPlaying.value = true
    void audio.resume()
    if (musicTimer === null) scheduleAmbient()
  }

  function stopMusic() {
    musicPlaying.value = false
    if (musicTimer !== null) {
      window.clearTimeout(musicTimer)
      musicTimer = null
    }
  }

  function playSfx(name: SfxName) {
    const audio = ensureAudio()
    if (!audio || muted.value || !sfxGain) return
    const destination = sfxGain
    void audio.resume()

    if (name === 'click') {
      playTone(620, 0.06, 'sine', 0.06, destination)
    } else if (name === 'move') {
      playTone(220, 0.1, 'triangle', 0.09, destination)
      playTone(330, 0.12, 'sine', 0.045, destination, 0.05)
    } else if (name === 'win') {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        playTone(frequency, 0.3, 'triangle', 0.11, destination, index * 0.12)
      })
    } else if (name === 'draw') {
      playTone(330, 0.22, 'sine', 0.08, destination)
      playTone(277.18, 0.35, 'sine', 0.07, destination, 0.18)
    } else if (name === 'join') {
      playTone(440, 0.12, 'sine', 0.07, destination)
      playTone(659.25, 0.2, 'sine', 0.07, destination, 0.1)
    } else {
      playTone(220, 0.18, 'sine', 0.06, destination)
      playTone(164.81, 0.25, 'sine', 0.06, destination, 0.12)
    }
  }

  return {
    volume,
    muted,
    musicPlaying,
    setVolume,
    toggleMute,
    startMusic,
    stopMusic,
    playSfx,
  }
})
