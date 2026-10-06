// Uint32 tabanlı pixel tamponu ve pixel-art çizim yardımcıları.
// Renkler 0xAABBGGRR (little-endian ImageData) formatındadır.

export type Col = number

export function C(hex: string): Col {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function rgbOf(c: Col): [number, number, number] {
  return [c & 255, (c >>> 8) & 255, (c >>> 16) & 255]
}

export function mix(a: Col, b: Col, t: number): Col {
  const [ar, ag, ab] = rgbOf(a)
  const [br, bg, bb] = rgbOf(b)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return ((255 << 24) | (bl << 16) | (g << 8) | r) >>> 0
}

export function css(c: Col): string {
  const [r, g, b] = rgbOf(c)
  return `rgb(${r},${g},${b})`
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)

/** Sıralı dithering eşiği (4x4 Bayer). */
export function bayer(x: number, y: number): number {
  return BAYER[(x & 3) + ((y & 3) << 2)]
}

export class Pix {
  readonly w: number
  readonly h: number
  readonly d: Uint32Array
  constructor(w: number, h: number, fill: Col = C('#000000')) {
    this.w = w
    this.h = h
    this.d = new Uint32Array(w * h).fill(fill)
  }

  set(x: number, y: number, c: Col): void {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    this.d[x + y * this.w] = c
  }

  get(x: number, y: number): Col {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.d[x + y * this.w]
  }

  rect(x: number, y: number, w: number, h: number, c: Col): void {
    const x0 = Math.max(0, Math.round(x))
    const y0 = Math.max(0, Math.round(y))
    const x1 = Math.min(this.w, Math.round(x + w))
    const y1 = Math.min(this.h, Math.round(y + h))
    for (let yy = y0; yy < y1; yy++) this.d.fill(c, x0 + yy * this.w, x1 + yy * this.w)
  }

  /** Bayer dithering ile iki renk arasında yarı saydam dolgu. */
  ditherRect(x: number, y: number, w: number, h: number, c: Col, t: number): void {
    for (let yy = Math.round(y); yy < y + h; yy++)
      for (let xx = Math.round(x); xx < x + w; xx++) if (bayer(xx, yy) < t) this.set(xx, yy, c)
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: Col | ((x: number, y: number, nx: number, ny: number) => Col | -1)): void {
    const fn = typeof c === 'function' ? c : null
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        if (nx * nx + ny * ny > 1) continue
        if (fn) {
          const v = fn(x, y, nx, ny)
          if (v !== -1) this.set(x, y, v)
        } else this.set(x, y, c as Col)
      }
    }
  }

  disc(cx: number, cy: number, r: number, c: Col): void {
    this.ellipse(cx, cy, r, r, c)
  }

  /** Işık yönüne göre dithered gölgeli küre. cols: koyu → açık. */
  sphere(cx: number, cy: number, r: number, cols: Col[], lx = -0.6, ly = -0.6): void {
    const ll = Math.hypot(lx, ly, 0.6)
    this.ellipse(cx, cy, r, r, (x, y, nx, ny) => {
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const s = Math.max(0, (nx * lx + ny * ly + nz * 0.6) / ll)
      return pickBand(cols, s, x, y)
    })
  }

  /** Dikey dithered gradyan (tam genişlik veya aralık). */
  gradV(y0: number, y1: number, cols: Col[], x0 = 0, x1 = this.w): void {
    for (let y = Math.round(y0); y < y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0 - 1)
      for (let x = x0; x < x1; x++) this.set(x, y, pickBand(cols, t, x, y))
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Col): void {
    x0 = Math.round(x0)
    y0 = Math.round(y0)
    x1 = Math.round(x1)
    y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.set(x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }

  thick(x0: number, y0: number, x1: number, y1: number, w: number, c: Col): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      this.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c)
    }
  }

  /** Scanline ile çokgen doldurma. pts: [x0,y0,x1,y1,...] */
  poly(pts: number[], c: Col | ((x: number, y: number) => Col | -1)): void {
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 1; i < pts.length; i += 2) {
      minY = Math.min(minY, pts[i])
      maxY = Math.max(maxY, pts[i])
    }
    const n = pts.length / 2
    const fn = typeof c === 'function' ? c : null
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5
      const xs: number[] = []
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2]
        const ay = pts[i * 2 + 1]
        const bx = pts[((i + 1) % n) * 2]
        const by = pts[((i + 1) % n) * 2 + 1]
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax))
      }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) {
          if (fn) {
            const v = fn(x, y)
            if (v !== -1) this.set(x, y, v)
          } else this.set(x, y, c as Col)
        }
      }
    }
  }

  /** f(x) yüksekliğinden aşağıya (toY'ye kadar) dolgu. */
  ridge(f: (x: number) => number, c: Col | ((x: number, y: number, top: number) => Col | -1), toY = this.h): void {
    const fn = typeof c === 'function' ? c : null
    for (let x = 0; x < this.w; x++) {
      const top = Math.round(f(x))
      for (let y = Math.max(0, top); y < toY; y++) {
        if (fn) {
          const v = fn(x, y, top)
          if (v !== -1) this.set(x, y, v)
        } else this.set(x, y, c as Col)
      }
    }
  }

  /** Elips halka (gezegen halkası). front: sadece ön yarı / arka yarı. */
  ring(cx: number, cy: number, rx: number, ry: number, th: number, c: Col, part: 'all' | 'front' | 'back' = 'all'): void {
    for (let y = Math.floor(cy - ry - th); y <= cy + ry + th; y++) {
      for (let x = Math.floor(cx - rx - th); x <= cx + rx + th; x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        const d = Math.sqrt(nx * nx + ny * ny)
        if (Math.abs(d - 1) * Math.min(rx, ry) > th / 2) continue
        if (part === 'front' && y < cy) continue
        if (part === 'back' && y >= cy) continue
        this.set(x, y, c)
      }
    }
  }

  forEach(fn: (x: number, y: number, c: Col) => Col | -1): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const v = fn(x, y, this.d[x + y * this.w])
        if (v !== -1) this.d[x + y * this.w] = v
      }
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas')
    cv.width = this.w
    cv.height = this.h
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(this.w, this.h)
    new Uint32Array(img.data.buffer).set(this.d)
    ctx.putImageData(img, 0, 0)
    return cv
  }
}

/** 0..1 değerini renk bantlarına dithering ile eşler. */
export function pickBand(cols: Col[], t: number, x: number, y: number): Col {
  t = Math.min(1, Math.max(0, t)) * (cols.length - 1)
  const i = Math.floor(t)
  if (i >= cols.length - 1) return cols[cols.length - 1]
  return bayer(x, y) < t - i ? cols[i + 1] : cols[i]
}
