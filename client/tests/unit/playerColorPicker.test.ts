import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerColorPicker from '@/components/PlayerColorPicker.vue'
import { PLAYER_COLORS } from '@/types/game'

describe('PlayerColorPicker', () => {
  it('shows the palette, marks the active color and disables taken colors', async () => {
    const wrapper = mount(PlayerColorPicker, {
      props: { modelValue: 'coral', taken: ['cyan'] },
    })

    const options = wrapper.findAll('.color-picker__option')
    expect(options).toHaveLength(PLAYER_COLORS.length)
    expect(options[0].attributes('aria-pressed')).toBe('true')
    expect(options[1].attributes('disabled')).toBeDefined()

    await options[2].trigger('click')
    expect(wrapper.emitted('select')).toEqual([['magenta']])
  })
})
