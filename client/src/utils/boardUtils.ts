import type { Line, WinResult } from '@/types/game'

export function getAllLines(size = 3): Line[] {
  const lines: Line[] = []

  for (let r = 0; r < size; r++) {
    lines.push(Array.from({ length: size }, (_, c): [number, number] => [r, c]))
  }

  for (let c = 0; c < size; c++) {
    lines.push(Array.from({ length: size }, (_, r): [number, number] => [r, c]))
  }

  lines.push(Array.from({ length: size }, (_, i): [number, number] => [i, i]))
  lines.push(Array.from({ length: size }, (_, i): [number, number] => [i, size - 1 - i]))

  return lines
}

export function emptyCell() {
  return { large: null, medium: null, small: null }
}

export function emptyBoard(size = 3) {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => emptyCell())
  )
}

/**
 * End points of the gold win line in a 318×318 box where each cell is 100
 * units and each gap 9 (the CSS ratio used by the board). Returns null for
 * wins that are not a line (complete cell, timeout).
 */
export function winLineEndpoints(result: WinResult | null, overshoot = 34) {
  if (!result || result.condition === 'complete-cell' || result.condition === 'timeout') return null
  const coords = Array.from(
    new Map(result.highlights.map(({ coord }) => [`${coord[0]},${coord[1]}`, coord])).values(),
  ).sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (coords.length < 2) return null
  const center = [50, 159, 268]
  const [r1, c1] = coords[0]
  const [r2, c2] = coords[coords.length - 1]
  const x1 = center[c1], y1 = center[r1], x2 = center[c2], y2 = center[r2]
  const length = Math.hypot(x2 - x1, y2 - y1)
  const ux = (x2 - x1) / length, uy = (y2 - y1) / length
  return {
    x1: x1 - ux * overshoot,
    y1: y1 - uy * overshoot,
    x2: x2 + ux * overshoot,
    y2: y2 + uy * overshoot,
  }
}
