/**
 * Reads D-pad presses out of pointer movement.
 *
 * Most TV browsers keep the remote's arrow keys for themselves: they move an
 * on-screen cursor and the page never sees a keydown. What the page does see
 * is the cursor moving — in straight, single-axis runs, because one arrow
 * moves one axis. A hand-held pointer (mouse, air remote) wobbles on both
 * axes instead. This recogniser tells the two apart: a straight run becomes
 * one step (and repeats while the run continues, like a held key); wobbly
 * movement is reported as a free pointer.
 */
export type Direction = 'up' | 'down' | 'left' | 'right'

export type PointerSignal =
  | { type: 'step'; direction: Direction }
  | { type: 'free' }
  | null

/** Silence that ends a run of movement. */
const GAP_MS = 160
/** Travel along one axis before a run counts as a press. */
const MIN_TRAVEL_PX = 6
/** Held arrow: delay before the first repeat, then between repeats. */
const FIRST_REPEAT_MS = 450
const REPEAT_MS = 190
/** Evidence of a hand-held pointer within one run. */
const FREE_DIAGONAL_SAMPLES = 2
const FREE_TURNS = 3
/** After hand-held movement, straight runs are ignored for this long. */
const FREE_QUIET_MS = 700

interface Run {
  axis: 'x' | 'y'
  sign: 1 | -1
  travel: number
  steps: number
  lastStepAt: number
}

export function createPointerDpad() {
  let last: { x: number; y: number; time: number } | null = null
  let run: Run | null = null
  let diagonals = 0
  let turns = 0
  let lastFreeAt = Number.NEGATIVE_INFINITY

  function free(time: number): PointerSignal {
    run = null
    diagonals = 0
    turns = 0
    lastFreeAt = time
    return { type: 'free' }
  }

  function feed(x: number, y: number, time: number): PointerSignal {
    if (!last) {
      last = { x, y, time }
      return null
    }
    const dx = x - last.x
    const dy = y - last.y
    const gap = time - last.time
    last = { x, y, time }
    if (dx === 0 && dy === 0) return null

    if (gap > GAP_MS) {
      run = null
      diagonals = 0
      turns = 0
    }

    if (dx !== 0 && dy !== 0) {
      run = null
      diagonals += 1
      return diagonals >= FREE_DIAGONAL_SAMPLES ? free(time) : null
    }

    const axis = dx !== 0 ? 'x' : 'y'
    const delta = dx !== 0 ? dx : dy
    const sign = delta > 0 ? 1 : -1

    if (run && (run.axis !== axis || run.sign !== sign)) {
      run = null
      turns += 1
      if (turns >= FREE_TURNS) return free(time)
    }
    if (!run) run = { axis, sign, travel: 0, steps: 0, lastStepAt: 0 }
    run.travel += Math.abs(delta)

    // A diagonal sample in this run, or recent hand-held movement: not a D-pad.
    if (diagonals > 0 || time - lastFreeAt < FREE_QUIET_MS) return null

    const due = run.steps === 0
      ? run.travel >= MIN_TRAVEL_PX
      : time - run.lastStepAt >= (run.steps === 1 ? FIRST_REPEAT_MS : REPEAT_MS)
    if (!due) return null

    run.steps += 1
    run.lastStepAt = time
    const direction: Direction = axis === 'x'
      ? (sign > 0 ? 'right' : 'left')
      : (sign > 0 ? 'down' : 'up')
    return { type: 'step', direction }
  }

  function reset() {
    last = null
    run = null
    diagonals = 0
    turns = 0
  }

  return { feed, reset }
}
