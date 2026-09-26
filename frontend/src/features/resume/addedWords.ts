export function addedWordMask(before: string, after: string): boolean[] {
  const a = before.match(/\S+/g) ?? []
  const b = after.match(/\S+/g) ?? []
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0))
  const normalize = (word: string) => word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = normalize(a[i]) === normalize(b[j])
        ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const added = b.map(() => true)
  let i = 0; let j = 0
  while (i < a.length && j < b.length) {
    if (normalize(a[i]) === normalize(b[j])) {
      added[j] = false; i++; j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return added
}
