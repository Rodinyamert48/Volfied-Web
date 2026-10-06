// Elle çizilmiş pixel sprite'lar ve prosedürel boss üreticisi.
import { Rng } from '../core/rng.ts'
import { C, Pix, mix } from './pix.ts'
import type { Col } from './pix.ts'

export type Frames = HTMLCanvasElement[]

function fromMap(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const h = rows.length
  const w = rows[0].length
  const p = new Pix(w, h, 0)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x]
      if (ch !== '.' && pal[ch]) p.set(x, y, C(pal[ch]))
    }
  return p.toCanvas()
}

const SHIP = ['...a...', '..aba..', '..aca..', '.abbba.', 'aabbbaa', 'a.a.a.a', '..d.d..']

export const shipFrames: Frames = [
  fromMap(SHIP, { a: '#3ae8ff', b: '#ffffff', c: '#ff3af0', d: '#ffb030' }),
  fromMap(SHIP, { a: '#3ae8ff', b: '#ffffff', c: '#ff3af0', d: '#ff4a1a' }),
]
export const shipShield: Frames = [
  fromMap(SHIP, { a: '#ffe03a', b: '#ffffff', c: '#ff3af0', d: '#ffb030' }),
  fromMap(SHIP, { a: '#ffffff', b: '#ffe03a', c: '#ff3af0', d: '#ff4a1a' }),
]

export type MinionKind = 'bouncer' | 'wander' | 'chaser' | 'shooter' | 'seeker'

const MAPS: Record<MinionKind, string[]> = {
  bouncer: ['...a...', '.a.b.a.', '..bcb..', 'abcdcba', '..bcb..', '.a.b.a.', '...a...'],
  wander: ['.aaaaa.', 'abbbbba', 'abcbcba', 'abbbbba', 'abbbbba', 'a.a.a.a', '.a.a.a.'],
  chaser: ['a.....a', 'aa...aa', 'abaaaba', '.acaca.', '..aaa..', '...a...', '.......'],
  shooter: ['..aaa..', '.abbba.', 'abbcbba', 'abcdcba', 'abbcbba', '.abbba.', '..aaa..'],
  seeker: ['...a...', '..aba..', '.abcba.', 'abcdcba', '.abcba.', '..aba..', '...a...'],
}
const MAPS_B: Record<MinionKind, string[]> = {
  bouncer: ['a.....a', '...b...', '.abcba.', '.bcdcb.', '.abcba.', '...b...', 'a.....a'],
  wander: ['.......', '.aaaaa.', 'abcbcba', 'abbbbba', 'abbbbba', '.a.a.a.', 'a.a.a.a'],
  chaser: ['.......', 'a.....a', 'abaaaba', 'aacacaa', '..aaa..', '...a...', '.......'],
  shooter: ['..aaa..', '.abbba.', 'abcccba', 'abcdcba', 'abcccba', '.abbba.', '..aaa..'],
  seeker: ['...a...', '..aba..', '.abdba.', 'abdcdba', '.abdba.', '..aba..', '...a...'],
}
const MPAL: Record<MinionKind, Record<string, string>> = {
  bouncer: { a: '#ffb03a', b: '#ff3a3a', c: '#ff8a8a', d: '#ffffff' },
  wander: { a: '#1a9a3a', b: '#4af06a', c: '#101010', d: '#ffffff' },
  chaser: { a: '#b04aff', b: '#ff3a3a', c: '#ffe03a', d: '#ffffff' },
  shooter: { a: '#b88a1a', b: '#ffe03a', c: '#ff3a3a', d: '#ffffff' },
  seeker: { a: '#1a8ab8', b: '#3af0ff', c: '#b8ffff', d: '#ffffff' },
}

export const minionFrames: Record<MinionKind, Frames> = {
  bouncer: [fromMap(MAPS.bouncer, MPAL.bouncer), fromMap(MAPS_B.bouncer, MPAL.bouncer)],
  wander: [fromMap(MAPS.wander, MPAL.wander), fromMap(MAPS_B.wander, MPAL.wander)],
  chaser: [fromMap(MAPS.chaser, MPAL.chaser), fromMap(MAPS_B.chaser, MPAL.chaser)],
  shooter: [fromMap(MAPS.shooter, MPAL.shooter), fromMap(MAPS_B.shooter, MPAL.shooter)],
  seeker: [fromMap(MAPS.seeker, MPAL.seeker), fromMap(MAPS_B.seeker, MPAL.seeker)],
}

const SPARK = ['a.b.a', '.bcb.', 'bcdcb', '.bcb.', 'a.b.a']
const SPARK_B = ['..b..', '.aca.', 'bcdcb', '.aca.', '..b..']
export const sparkFrames: Frames = [
  fromMap(SPARK, { a: '#ff5a1a', b: '#ffb030', c: '#ffe8a0', d: '#ffffff' }),
  fromMap(SPARK_B, { a: '#ff5a1a', b: '#ffb030', c: '#ffe8a0', d: '#ffffff' }),
]

const BOX = ['aaaaaaa', 'abcccba', 'abbbcba', 'abbcbba', 'abbbbba', 'abbcbba', 'aaaaaaa']
export const boxFrames: Frames = ['#ff3af0', '#ffe03a', '#3af0ff', '#4af06a'].map((a) => fromMap(BOX, { a, b: '#1a1030', c: '#ffffff' }))

// ---------- prosedürel boss ----------

export interface BossArt {
  frames: Frames
  hit: HTMLCanvasElement
  size: number
}

export interface BossPalette {
  body: string
  accent: string
  eye: string
}

/** Tohumdan simetrik, gölgeli, iki kareli bir uzaylı boss sprite'ı üretir. */
export function makeBoss(seed: number, size: number, pal: BossPalette): BossArt {
  const r = new Rng(seed)
  const W = size
  const H = size
  const half = Math.ceil(W / 2)
  let g: boolean[][] = []
  for (let y = 0; y < H; y++) {
    g.push([])
    for (let x = 0; x < half; x++) {
      const nx = (half - x - 0.5) / half
      const ny = ((y + 0.5) / H) * 2 - 1.1
      const d = Math.sqrt(nx * nx * 0.85 + ny * ny)
      const p = d < 0.45 ? 1 : d < 0.98 ? 0.6 - (d - 0.45) * 0.7 : 0
      g[y].push(r.next() < p)
    }
  }
  const at = (gr: boolean[][], x: number, y: number) => {
    if (y < 0 || y >= H) return false
    if (x >= half) x = W - 1 - x
    if (x < 0) return false
    return gr[y][x]
  }
  for (let it = 0; it < 2; it++) {
    const ng: boolean[][] = []
    for (let y = 0; y < H; y++) {
      ng.push([])
      for (let x = 0; x < half; x++) {
        let n = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && at(g, x + dx, y + dy)) n++
        ng[y].push(g[y][x] ? n >= 3 : n >= 5)
      }
    }
    g = ng
  }
  // uzantılar: dokunaçlar / boynuzlar
  const tentacles = r.int(1, 3)
  for (let t = 0; t < tentacles; t++) {
    let x = r.int(Math.floor(half * 0.3), half - 2)
    let y = Math.floor(H * r.range(0.55, 0.7))
    const len = r.int(Math.floor(H * 0.2), Math.floor(H * 0.35))
    const drift = r.range(-0.6, 0.2)
    for (let i = 0; i < len && y < H - 1; i++) {
      y++
      x = Math.round(x + drift + Math.sin(i * 0.9) * 0.6)
      if (x >= 0 && x < half) g[y][x] = true
    }
  }
  if (r.chance(0.7)) {
    let x = r.int(Math.floor(half * 0.35), half - 3)
    let y = Math.floor(H * 0.25)
    for (let i = 0; i < Math.floor(H * 0.2) && y > 0; i++) {
      y--
      x -= r.chance(0.5) ? 1 : 0
      if (x >= 0) g[y][x] = true
    }
  }
  // gözlerin oturacağı bölgeyi doldur
  for (let y = Math.floor(H * 0.3); y < Math.floor(H * 0.55); y++) for (let x = Math.floor(half * 0.35); x < half; x++) g[y][x] = true

  const body = C(pal.body)
  const light = mix(body, C('#ffffff'), 0.45)
  const dark = mix(body, C('#000000'), 0.45)
  const accent = C(pal.accent)
  const outline = C('#12061a')
  const eyeC = C(pal.eye)
  const stripe = r.int(0, 2)
  const eyeStyle = r.int(0, 2)

  const build = (wiggle: number, white: boolean): HTMLCanvasElement => {
    const P = new Pix(W + 2, H + 2, 0)
    const filled = (x: number, y: number) => {
      if (y >= H * 0.62 && wiggle) {
        const shift = (y & 1 ? 1 : -1) * wiggle
        const sx = x < half ? x - shift : x + shift
        return at(g, sx, y)
      }
      return at(g, x, y)
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!filled(x, y)) continue
        let c: Col = body
        if (white) c = C('#ffffff')
        else {
          if (!filled(x, y - 1) || !filled(x - 1, y)) c = light
          else if (!filled(x, y + 1) || !filled(x + 1, y)) c = dark
          else if (stripe === 1 && y % 4 === 0) c = accent
          else if (stripe === 2 && (x + y) % 5 === 0) c = accent
          else if (stripe === 0 && Math.abs(x - W / 2 + 0.5) < 1.5 && y > H * 0.55) c = accent
        }
        P.set(x + 1, y + 1, c)
      }
    if (!white) {
      for (let y = -1; y <= H; y++)
        for (let x = -1; x <= W; x++) {
          if (filled(x, y)) continue
          if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) P.set(x + 1, y + 1, outline)
        }
      const ey = Math.floor(H * 0.4) + 1
      const eye = (cx: number, rad: number) => {
        P.disc(cx + 0.5, ey + 0.5, rad + 0.6, outline)
        P.disc(cx + 0.5, ey + 0.5, rad, C('#ffffff'))
        P.disc(cx + 0.5, ey + 1, Math.max(1, rad * 0.6), eyeC)
        P.set(cx, ey + 1, C('#000000'))
      }
      const mid = Math.floor(W / 2) + 1
      if (eyeStyle === 0) {
        eye(mid - Math.floor(W * 0.18), Math.max(1.5, W * 0.08))
        eye(mid + Math.floor(W * 0.18) - 1, Math.max(1.5, W * 0.08))
      } else if (eyeStyle === 1) eye(mid - 1, Math.max(2.5, W * 0.15))
      else {
        eye(mid - 1, Math.max(1.5, W * 0.09))
        eye(mid - Math.floor(W * 0.26), Math.max(1, W * 0.06))
        eye(mid + Math.floor(W * 0.26) - 1, Math.max(1, W * 0.06))
      }
      // ağız
      const my = Math.floor(H * 0.58) + 1
      for (let x = mid - Math.floor(W * 0.12); x < mid + Math.floor(W * 0.12); x++) {
        P.set(x, my, outline)
        if (x % 2) P.set(x, my + 1, C('#ffffff'))
      }
    }
    return P.toCanvas()
  }

  return { frames: [build(0, false), build(1, false)], hit: build(0, true), size: W + 2 }
}

/** Tek renkli küçük ikon (HUD/menü). */
export function iconCanvas(rows: string[], color: string): HTMLCanvasElement {
  return fromMap(rows, { a: color, b: '#ffffff' })
}
