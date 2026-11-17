import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAudioStore } from '@/stores/audioStore'

beforeEach(() => {
  window.localStorage.clear()
  setActivePinia(createPinia())
})

describe('audio mix', () => {
  it('keeps music and effects volumes independent', () => {
    const store = useAudioStore()

    store.setMusicVolume(0.25)
    store.setSfxVolume(0.8)

    expect(store.musicVolume).toBe(0.25)
    expect(store.sfxVolume).toBe(0.8)
    expect(window.localStorage.getItem('st_audio_music_volume')).toBe('0.25')
    expect(window.localStorage.getItem('st_audio_sfx_volume')).toBe('0.8')
  })

  it('migrates the old shared volume to both channels', () => {
    window.localStorage.setItem('st_audio_volume', '0.4')
    const store = useAudioStore()

    expect(store.musicVolume).toBe(0.4)
    expect(store.sfxVolume).toBe(0.4)
  })

  it('migrates the old global mute as both channels at zero', () => {
    window.localStorage.setItem('st_audio_volume', '0.7')
    window.localStorage.setItem('st_audio_muted', 'true')
    const store = useAudioStore()

    expect(store.musicVolume).toBe(0)
    expect(store.sfxVolume).toBe(0)
  })
})
