/**
 * Splits players into as many groups as possible while keeping every group at
 * 3+ players. The only exception is 5 players, which can only be split 3 + 2.
 */
export function distributeGroupSizes(count: number): number[] {
  if (count <= 0) return []
  if (count === 5) return [3, 2]
  if (count < 3) return [count]

  const groupCount = Math.floor(count / 3)
  const base = Math.floor(count / groupCount)
  const largerGroups = count % groupCount
  const smallerGroups = groupCount - largerGroups

  return [
    ...Array.from({ length: smallerGroups }, () => base),
    ...Array.from({ length: largerGroups }, () => base + 1),
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
