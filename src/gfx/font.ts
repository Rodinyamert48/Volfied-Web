// 5x7 pixel bitmap font (Türkçe karakter destekli). Her satır 5 bit; bit4 = en sol.
// Glif kutusu 5x9: satır 0 = şapka/nokta, satır 1-7 = gövde, satır 8 = çengel.

const G: Record<string, number[]> = {
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 17, 25, 21, 19, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [31, 2, 4, 2, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [6, 8, 16, 30, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '.': [0, 0, 0, 0, 0, 12, 12],
  ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0],
  ';': [0, 12, 12, 0, 12, 4, 8],
  '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4],
  '-': [0, 0, 0, 31, 0, 0, 0],
  '+': [0, 4, 4, 31, 4, 4, 0],
  '/': [1, 1, 2, 4, 8, 16, 16],
  '%': [24, 25, 2, 4, 8, 19, 3],
  "'": [4, 4, 8, 0, 0, 0, 0],
  '"': [10, 10, 0, 0, 0, 0, 0],
  '(': [2, 4, 8, 8, 8, 4, 2],
  ')': [8, 4, 2, 2, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2],
  '>': [8, 4, 2, 1, 2, 4, 8],
  '=': [0, 0, 31, 0, 31, 0, 0],
  '*': [0, 4, 21, 14, 21, 4, 0],
  '_': [0, 0, 0, 0, 0, 0, 31],
  '#': [10, 10, 31, 10, 31, 10, 10],
  '@': [0, 10, 31, 31, 14, 4, 0], // kalp
  '^': [4, 14, 31, 4, 4, 4, 4], // yukarı ok
  '~': [4, 4, 4, 4, 31, 14, 4], // aşağı ok
  '{': [2, 6, 14, 30, 14, 6, 2], // sol üçgen
  '}': [8, 12, 14, 15, 14, 12, 8], // sağ üçgen
  '$': [4, 14, 31, 31, 31, 14, 4], // elmas
}

// Türkçe karakterler: taban harf + şapka (üst satır) / çengel (alt satır)
const TR: Record<string, [string, number, number]> = {
  Ç: ['C', 0, 4],
  Ş: ['S', 0, 4],
  Ğ: ['G', 14, 0],
  Ö: ['O', 10, 0],
  Ü: ['U', 10, 0],
  İ: ['I', 4, 0],
}

const LOWER: Record<string, string> = { ç: 'Ç', ş: 'Ş', ğ: 'Ğ', ö: 'Ö', ü: 'Ü', i: 'İ', ı: 'I' }

export const GLYPH_W = 6
export const LINE_H = 10

function glyphRows(ch: string): number[] {
  if (LOWER[ch]) ch = LOWER[ch]
  else ch = ch.toUpperCase()
  const tr = TR[ch]
  if (tr) {
    const base = G[tr[0]]
    return [tr[1], ...base, tr[2]]
  }
  const g = G[ch] ?? G['?']
  return [0, ...g, 0]
}

export function textWidth(s: string, scale = 1): number {
  return s.length === 0 ? 0 : (s.length * GLYPH_W - 1) * scale
}

const cache = new Map<string, HTMLCanvasElement>()

function render(s: string, color: string, scale: number): HTMLCanvasElement {
  const key = s + '\u0000' + color + '\u0000' + scale
  let cv = cache.get(key)
  if (cv) return cv
  if (cache.size > 600) cache.clear()
  cv = document.createElement('canvas')
  cv.width = Math.max(1, textWidth(s, scale))
  cv.height = 9 * scale
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = color
  for (let i = 0; i < s.length; i++) {
    const rows = glyphRows(s[i])
    for (let r = 0; r < 9; r++) {
      const bits = rows[r]
      if (!bits) continue
      for (let c = 0; c < 5; c++) if (bits & (16 >> c)) ctx.fillRect((i * GLYPH_W + c) * scale, (r - 0) * scale, scale, scale)
    }
  }
  cache.set(key, cv)
  return cv
}

export interface TextOpts {
  align?: 'left' | 'center' | 'right'
  scale?: number
  shadow?: string | null
}

/** Yazıyı (x,y) noktasına çizer; y gövdenin üst satırıdır (şapkalar bir pixel yukarı taşar). */
export function drawText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = '#ffffff', opts: TextOpts = {}): void {
  const scale = opts.scale ?? 1
  const w = textWidth(s, scale)
  let dx = x
  if (opts.align === 'center') dx = x - Math.floor(w / 2)
  else if (opts.align === 'right') dx = x - w
  dx = Math.round(dx)
  const dy = Math.round(y - scale)
  const shadow = opts.shadow === undefined ? '#000000' : opts.shadow
  if (shadow) ctx.drawImage(render(s, shadow, scale), dx + scale, dy + scale)
  ctx.drawImage(render(s, color, scale), dx, dy)
}
