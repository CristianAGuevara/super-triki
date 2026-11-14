import { describe, expect, it } from 'vitest'
import { createPointerDpad, type PointerSignal } from '@/utils/pointerDpad'

/** Feeds a list of [dx, dy, dt] moves and collects the signals. */
function play(moves: Array<[number, number, number]>): PointerSignal[] {
  const dpad = createPointerDpad()
  let x = 500
  let y = 400
  let time = 1_000
  dpad.feed(x, y, time)
  const signals: PointerSignal[] = []
  for (const [dx, dy, dt] of moves) {
    x += dx
    y += dy
    time += dt
    const signal = dpad.feed(x, y, time)
    if (signal) signals.push(signal)
  }
  return signals
}

const steps = (signals: PointerSignal[]) =>
  signals.map(signal => (signal?.type === 'step' ? signal.direction : signal?.type))

describe('pointer D-pad recogniser', () => {
  it('turns one straight nudge of the cursor into one step', () => {
    expect(steps(play([[4, 0, 16], [4, 0, 16], [4, 0, 16], [4, 0, 16]]))).toEqual(['right'])
    expect(steps(play([[0, -20, 16]]))).toEqual(['up'])
  })

  it('ignores movement too small to be a press', () => {
    expect(play([[2, 0, 16], [2, 0, 16]])).toEqual([])
  })

  it('treats separate nudges as separate presses', () => {
    const tap: Array<[number, number, number]> = [[0, 5, 16], [0, 5, 16], [0, 5, 16]]
    const pause: [number, number, number] = [0, 5, 400]
    expect(steps(play([...tap, pause, ...tap.slice(1)]))).toEqual(['down', 'down'])
  })

  it('repeats while the cursor keeps gliding, like a held arrow', () => {
    const glide = Array.from({ length: 60 }, () => [-6, 0, 16] as [number, number, number])
    const result = steps(play(glide))
    expect(result.length).toBeGreaterThanOrEqual(3)
    expect(result.length).toBeLessThanOrEqual(5)
    expect(new Set(result)).toEqual(new Set(['left']))
  })

  it('follows a change of arrow without waiting for a pause', () => {
    expect(steps(play([[8, 0, 16], [8, 0, 16], [0, 8, 16], [0, 8, 16]]))).toEqual(['right', 'down'])
  })

  it('reports hand-held movement as a free pointer and takes no steps from it', () => {
    const wobble: Array<[number, number, number]> = [[3, 1, 16], [4, 2, 16], [5, 1, 16], [9, 0, 16], [9, 0, 16]]
    expect(steps(play(wobble))).toEqual(['free'])
  })

  it('reports a pointer that zigzags between axes as free', () => {
    const zigzag: Array<[number, number, number]> = [[1, 0, 16], [0, 1, 16], [1, 0, 16], [0, 1, 16], [1, 0, 16]]
    expect(steps(play(zigzag))).toEqual(['free'])
  })
})
