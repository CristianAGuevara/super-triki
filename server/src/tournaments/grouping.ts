/**
 * Fills as many groups of 4 as possible, then uses groups of 3. A group of 2
 * is only used when unavoidable, which in practice is the 5-player case.
 */
export function distributeGroupSizes(count: number): number[] {
  if (count <= 0) return []
  if (count === 5) return [3, 2]
  if (count < 3) return [count]

  let fours = Math.floor(count / 4)
  while (fours >= 0 && (count - fours * 4) % 3 !== 0) {
    fours--
  }
  if (fours < 0) return [count]

  const threes = (count - fours * 4) / 3
  return [
    ...Array.from({ length: fours }, () => 4),
    ...Array.from({ length: threes }, () => 3),
  ]
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
