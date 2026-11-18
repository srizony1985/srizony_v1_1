/** Pure layout maths for the growth tree (no imports, easy to test). */
export interface TreePoint { x: number; y: number }

export function layoutTree(n: number, compact: boolean) {
  const W = compact ? 400 : 700
  const H = compact ? 440 : 720
  const cx = W / 2
  const base = H - (compact ? 36 : 46)
  const cy = compact ? 186 : 290
  const a = compact ? 172 : 300
  const b = compact ? 148 : 245
  const golden = 2.39996323
  const points: TreePoint[] = Array.from({ length: n }, (_, i) => {
    const r = 0.2 + 0.8 * Math.sqrt(i / Math.max(1, n - 1))
    const th = i * golden + 0.6
    return { x: cx + a * r * Math.cos(th), y: cy + b * r * Math.sin(th) }
  })
  return { W, H, cx, cy, base, a, b, points }
}