// Deterministik, tohumlu rastgele sayı üreteci (mulberry32).
export class Rng {
  private s: number
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next()
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1))
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
  chance(p: number): boolean {
    return this.next() < p
  }
}

/** 1 boyutlu, yumuşak değer gürültüsü (fbm) — dağ sırtları için. */
export function noise1(seed: number, octaves = 4): (x: number) => number {
  const r = new Rng(seed)
  const lat = Array.from({ length: 512 }, () => r.next())
  const base = (x: number) => {
    const i = Math.floor(x)
    const f = x - i
    const a = lat[i & 511]
    const b = lat[(i + 1) & 511]
    const u = (1 - Math.cos(f * Math.PI)) / 2
    return a + (b - a) * u
  }
  return (x: number) => {
    let v = 0
    let amp = 1
    let freq = 1
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      v += base(x * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return v / norm
  }
}

/** 2 boyutlu değer gürültüsü (fbm) — bulut, nebula, kıta. */
export function noise2(seed: number, octaves = 4): (x: number, y: number) => number {
  const r = new Rng(seed)
  const lat = Array.from({ length: 256 * 256 }, () => r.next())
  const at = (x: number, y: number) => lat[(x & 255) + ((y & 255) << 8)]
  const base = (x: number, y: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const fx = x - xi
    const fy = y - yi
    const ux = fx * fx * (3 - 2 * fx)
    const uy = fy * fy * (3 - 2 * fy)
    const a = at(xi, yi)
    const b = at(xi + 1, yi)
    const c = at(xi, yi + 1)
    const d = at(xi + 1, yi + 1)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
  }
  return (x: number, y: number) => {
    let v = 0
    let amp = 1
    let freq = 1
    let norm = 0
    for (let o = 0; o < octaves; o++) {
      v += base(x * freq, y * freq) * amp
      norm += amp
      amp *= 0.5
      freq *= 2
    }
    return v / norm
  }
}
