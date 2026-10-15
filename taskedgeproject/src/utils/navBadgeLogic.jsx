export function didCountIncrease(previousCount, nextCount) {
  const previous = Number(previousCount || 0)
  const next = Number(nextCount || 0)

  return Number.isFinite(previous) && Number.isFinite(next) && next > previous
}
