// 25 adet prosedürel pixel-art resim. Her stage'de kapatılan alan bu resmi açığa çıkarır.
import { Pix, C, bayer, pickBand, mix } from './pix.ts'
import type { Col } from './pix.ts'
import { Rng, noise1, noise2 } from '../core/rng.ts'

export const PIC_W = 300
export const PIC_H = 200

type Scene = (p: Pix, r: Rng) => void

// ---------- yardımcılar ----------

function glow(p: Pix, cx: number, cy: number, r: number, col: Col, strength = 0.6): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, y - cy) / r
      if (d >= 1) continue
      if (bayer(x, y) < (1 - d) * (1 - d) * strength) p.set(x, y, col)
    }
}

function stars(p: Pix, r: Rng, n: number, yMax: number, cols: Col[]): void {
  for (let i = 0; i < n; i++) {
    const x = r.int(0, p.w - 1)
    const y = r.int(0, yMax)
    const c = r.pick(cols)
    p.set(x, y, c)
    if (r.chance(0.06)) {
      p.set(x - 1, y, c)
      p.set(x + 1, y, c)
      p.set(x, y - 1, c)
      p.set(x, y + 1, c)
    }
  }
}

function cloud(p: Pix, x: number, y: number, w: number, light: Col, shade: Col, r: Rng): void {
  const k = Math.max(3, Math.round(w / 9))
  const puffs: [number, number, number][] = []
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1)
    const rad = (Math.sin(t * Math.PI) * 0.6 + 0.4) * w * 0.22 + r.range(-1, 2)
    puffs.push([x + t * w, y - rad * 0.4 + r.range(-2, 2), rad])
  }
  for (const [cx, cy, rad] of puffs) p.disc(cx, cy + 2, rad, shade)
  for (const [cx, cy, rad] of puffs) p.disc(cx, cy, rad - 1, light)
  p.rect(x, y + 1, w, 3, shade)
}

function pine(p: Pix, x: number, base: number, h: number, col: Col, trunk: Col = col): void {
  p.rect(x - 1, base - h * 0.2, 2, h * 0.2 + 1, trunk)
  const layers = 3
  for (let i = 0; i < layers; i++) {
    const top = base - h + (i * h) / (layers + 0.5)
    const bot = top + h * 0.45
    const hw = (h * 0.18 + i * h * 0.07) | 0
    p.poly([x, top, x + hw + 1, bot, x - hw, bot], col)
  }
}

function roundTree(p: Pix, x: number, base: number, rad: number, cols: Col[], trunk: Col): void {
  p.rect(x - 1, base - rad - 2, 3, rad + 3, trunk)
  p.sphere(x, base - rad * 1.6, rad, cols)
}

function palm(p: Pix, x: number, base: number, h: number, col: Col): void {
  for (let i = 0; i < h; i++) {
    const t = i / h
    p.rect(x + Math.sin(t * 2) * 6 - 1, base - i, 3, 1, col)
  }
  const tx = x + Math.sin(2) * 6
  const ty = base - h
  for (const a of [-2.6, -2, -1.2, -0.5, 0.2]) {
    for (let i = 0; i < 18; i++) {
      const xx = tx + Math.cos(a) * i
      const yy = ty + Math.sin(a) * i * 0.5 + (i * i) / 30
      p.rect(xx, yy, 2, 2, col)
    }
  }
}

/** Eğime göre aydınlatılan dağ silsilesi. */
function mountains(p: Pix, f: (x: number) => number, light: Col, dark: Col, snow: Col | null, snowLine: number, toY = p.h): void {
  p.ridge(f, (x, y, top) => {
    const slope = f(x + 1) - f(x - 1)
    const lit = slope > 0.2
    if (snow !== null && top < snowLine && y - top < (snowLine - top) * 0.6 + 2) return lit ? snow : mix(snow, dark, 0.35)
    if (y - top < 2) return mix(lit ? light : dark, C('#ffffff'), 0.15)
    return lit ? light : bayer(x, y) < 0.2 ? light : dark
  }, toY)
}

function reflect(p: Pix, horizon: number, tint: Col, amt: number): void {
  for (let y = horizon; y < p.h; y++) {
    const sy = 2 * horizon - y - 1
    const wob = Math.round(Math.sin(y * 0.9) * 1.5)
    for (let x = 0; x < p.w; x++) {
      const src = sy >= 0 ? p.get(x + wob, sy) : tint
      p.set(x, y, mix(src, tint, amt + (y - horizon) / (p.h - horizon) * 0.25))
    }
  }
}

function crystal(p: Pix, x: number, base: number, w: number, h: number, lean: number, light: Col, dark: Col, hi: Col): void {
  const tx = x + lean * h
  const pts = [x - w / 2, base, tx - w / 2, base - h, tx, base - h - w * 0.9, tx + w / 2, base - h, x + w / 2, base]
  p.poly(pts, (px, py) => {
    const t = (base - py) / h
    const cx = x + (tx - x) * Math.min(1, t)
    return px < cx ? light : dark
  })
  p.line(tx - w / 2, base - h, tx, base - h - w * 0.9, hi)
  p.line(x - w / 2 + 1, base - 2, tx - w / 2 + 1, base - h + 1, hi)
}

function house(p: Pix, x: number, base: number, w: number, h: number, wall: Col, roof: Col, win: Col): void {
  p.rect(x, base - h, w, h, wall)
  p.poly([x - 2, base - h, x + w / 2, base - h - w * 0.5, x + w + 2, base - h], roof)
  p.rect(x + 2, base - h + 3, 3, 3, win)
  p.rect(x + w - 5, base - h + 3, 3, 3, win)
  p.rect(x + w / 2 - 1, base - 5, 3, 5, mix(wall, C('#000000'), 0.5))
}

function fish(p: Pix, x: number, y: number, s: number, body: Col, fin: Col, dir: 1 | -1): void {
  p.ellipse(x, y, s, s * 0.55, body)
  p.poly([x - dir * s * 0.8, y, x - dir * s * 1.6, y - s * 0.6, x - dir * s * 1.6, y + s * 0.6], fin)
  p.rect(x + dir * s * 0.5 - 0.5, y - 1, 1, 1, C('#000000'))
  p.line(x, y - s * 0.55, x - dir * s * 0.3, y - s * 0.9, fin)
}

// ---------- 25 sahne ----------

const scenes: Scene[] = [
  // 1 YEŞİL VADİ
  (p, r) => {
    p.gradV(0, 140, [C('#2f6fd0'), C('#58a4ff'), C('#9fd6ff'), C('#e0f6ff')])
    glow(p, 240, 38, 34, C('#fff6c0'), 0.7)
    p.disc(240, 38, 13, C('#fff3a0'))
    p.disc(238, 36, 9, C('#ffffe8'))
    cloud(p, 30, 30, 50, C('#ffffff'), C('#c8dcf0'), r)
    cloud(p, 120, 50, 38, C('#ffffff'), C('#c8dcf0'), r)
    const n = noise1(r.int(1, 1e6))
    mountains(p, (x) => 60 + n(x / 45) * 60, C('#7f9fd4'), C('#5b77b0'), C('#f4fbff'), 85, 160)
    const n2 = noise1(r.int(1, 1e6))
    p.ridge((x) => 112 + Math.sin(x / 31) * 9 + n2(x / 20) * 14, (x, y, top) => pickBand([C('#7fd35a'), C('#4fae3c'), C('#3a8c34')], (y - top) / 40, x, y))
    p.ridge((x) => 150 + Math.sin(x / 47 + 2) * 12, (x, y, top) => pickBand([C('#5cc248'), C('#3d9a38'), C('#2a7430'), C('#1f5a28')], (y - top) / 50, x, y))
    for (let i = 0; i < 9; i++) {
      const x = r.int(10, 290)
      roundTree(p, x, 150 + Math.sin(x / 47 + 2) * 12 + r.int(4, 30), r.int(5, 8), [C('#1d5a24'), C('#2f8a34'), C('#5cc248'), C('#9be07a')], C('#5a3a1a'))
    }
    house(p, 200, 132, 18, 12, C('#f0e0c0'), C('#c83a2a'), C('#ffd84a'))
    house(p, 224, 136, 14, 10, C('#f0e0c0'), C('#c83a2a'), C('#ffd84a'))
    for (let i = 0; i < 140; i++) p.set(r.int(0, 299), r.int(160, 199), r.pick([C('#ff5e7e'), C('#fff35a'), C('#ffffff'), C('#c07aff')]))
  },
  // 2 GÜN BATIMI
  (p, r) => {
    p.gradV(0, 132, [C('#24104e'), C('#6a2475'), C('#c93d6b'), C('#ff7f4f'), C('#ffcf6b')])
    stars(p, r, 40, 40, [C('#ffd8f0'), C('#ffffff')])
    p.ellipse(150, 128, 36, 36, (x, y, _nx, ny) => {
      if (y > 104 && (y - 104) % 6 < Math.floor((y - 100) / 8)) return -1
      return pickBand([C('#fff3a8'), C('#ffd060'), C('#ff9a40')], (ny + 1) / 2, x, y)
    })
    p.gradV(132, 200, [C('#4a1f5a'), C('#2c1450'), C('#140a30')])
    for (let y = 133; y < 200; y += 2) {
      const w = 46 * (1 - (y - 132) / 90) + 4
      for (let k = 0; k < 3; k++) {
        const x0 = 150 + r.range(-w, w)
        p.rect(x0, y, r.int(3, 14), 1, r.chance(0.5) ? C('#ffd060') : C('#ff8a4c'))
      }
      if (r.chance(0.5)) p.rect(r.int(0, 300), y, r.int(4, 12), 1, C('#6a2c6a'))
    }
    p.ellipse(52, 148, 46, 9, C('#1a0a24'))
    p.ellipse(250, 160, 30, 6, C('#1a0a24'))
    palm(p, 40, 146, 50, C('#1a0a24'))
    palm(p, 66, 146, 36, C('#1a0a24'))
    palm(p, 255, 158, 30, C('#1a0a24'))
    for (let i = 0; i < 6; i++) {
      const bx = r.int(90, 260)
      const by = r.int(40, 90)
      p.line(bx - 3, by - 2, bx, by, C('#2a1030'))
      p.line(bx, by, bx + 3, by - 2, C('#2a1030'))
    }
  },
  // 3 NEON ŞEHİR
  (p, r) => {
    p.gradV(0, 200, [C('#05021a'), C('#160a40'), C('#3a1064'), C('#7a1f7a')])
    stars(p, r, 90, 90, [C('#ffffff'), C('#a8b8ff'), C('#ffb8f0')])
    glow(p, 62, 42, 34, C('#4a3a90'), 0.6)
    p.sphere(62, 42, 18, [C('#9a8ac8'), C('#d8ccf4'), C('#fbf6ff')], -0.7, -0.4)
    p.disc(56, 38, 3, C('#c8b8e8'))
    p.disc(68, 50, 2, C('#c8b8e8'))
    let x = -5
    while (x < 300) {
      const w = r.int(12, 26)
      const h = r.int(50, 110)
      p.rect(x, 190 - h, w, h, C('#2a1450'))
      for (let wy = 190 - h + 4; wy < 186; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r.chance(0.25)) p.rect(wx, wy, 2, 2, C('#6a4aa8'))
      x += w + r.int(0, 3)
    }
    x = -8
    while (x < 300) {
      const w = r.int(16, 32)
      const h = r.int(30, 85)
      const top = 192 - h
      p.rect(x, top, w, h, C('#0c0620'))
      p.rect(x, top, 1, h, C('#2a1a50'))
      for (let wy = top + 4; wy < 188; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 5) if (r.chance(0.35)) p.rect(wx, wy, 3, 3, r.chance(0.7) ? C('#ffd75e') : C('#5ef2ff'))
      if (r.chance(0.4)) {
        const sc = r.pick([C('#ff3fa4'), C('#3ff2ff'), C('#b8ff3f')])
        const sw = Math.min(w - 4, 18)
        p.rect(x + 2, top + 6, sw, 7, C('#0c0620'))
        p.ring(x + 2 + sw / 2, top + 9.5, sw / 2, 3.5, 1, sc)
        glow(p, x + 2 + sw / 2, top + 9, 14, sc, 0.25)
      }
      if (r.chance(0.3)) {
        p.rect(x + w / 2, top - 10, 1, 10, C('#2a1a50'))
        p.set(x + w / 2, top - 11, C('#ff3030'))
      }
      x += w + r.int(1, 6)
    }
    p.rect(0, 192, 300, 8, C('#08041a'))
    for (let i = 0; i < 300; i += 12) p.rect(i, 196, 6, 1, C('#ff3fa4'))
  },
  // 4 ÇÖL PİRAMİTLERİ
  (p, r) => {
    p.gradV(0, 150, [C('#ff8a4a'), C('#ffb46a'), C('#ffd99a'), C('#fff0c8')])
    glow(p, 70, 52, 40, C('#fff8d8'), 0.7)
    p.disc(70, 52, 18, C('#fffbe8'))
    const n = noise1(r.int(1, 1e6))
    p.ridge((x) => 132 + n(x / 30) * 14, C('#e8a860'))
    const pyr = (cx: number, base: number, hw: number, h: number) => {
      p.poly([cx - hw, base, cx, base - h, cx, base], (x, y) => ((base - y) % 5 === 0 && bayer(x, y) < 0.6 ? C('#d8a058') : C('#f6cc80')))
      p.poly([cx, base - h, cx + hw, base, cx, base], (x, y) => ((base - y) % 5 === 0 && bayer(x, y) < 0.6 ? C('#9a6030') : C('#c4844a')))
    }
    pyr(105, 152, 32, 38)
    pyr(190, 156, 64, 72)
    pyr(262, 154, 26, 30)
    p.ridge((x) => 158 + Math.sin(x / 40) * 7 + n(x / 15 + 50) * 6, (x, y, top) => {
      const ripple = (y + Math.round(Math.sin(x / 9) * 2)) % 6 === 0
      return ripple && bayer(x, y) < 0.5 ? C('#c98a4a') : pickBand([C('#f2c27a'), C('#e0a860'), C('#c88c4c')], (y - top) / 40, x, y)
    })
    const cactus = (x: number, base: number, h: number) => {
      const g = C('#3a8a3a')
      const gd = C('#246024')
      p.rect(x, base - h, 5, h, g)
      p.rect(x + 3, base - h, 2, h, gd)
      p.rect(x - 6, base - h * 0.6, 6, 3, g)
      p.rect(x - 6, base - h * 0.85, 3, h * 0.28, g)
      p.rect(x + 5, base - h * 0.45, 5, 3, gd)
      p.rect(x + 8, base - h * 0.7, 3, h * 0.27, gd)
    }
    cactus(30, 185, 30)
    cactus(275, 178, 22)
    for (let i = 0; i < 3; i++) {
      const bx = 150 + i * 14
      p.line(bx - 3, 90 + i * 4, bx, 92 + i * 4, C('#6a3a20'))
      p.line(bx, 92 + i * 4, bx + 3, 90 + i * 4, C('#6a3a20'))
    }
  },
  // 5 KUZEY IŞIKLARI
  (p, r) => {
    p.gradV(0, 200, [C('#020818'), C('#061c36'), C('#0b3446')])
    stars(p, r, 120, 120, [C('#ffffff'), C('#a8ffe8'), C('#c0d0ff')])
    const n = noise1(r.int(1, 1e6))
    for (let x = 0; x < 300; x++) {
      const c = 40 + Math.sin(x / 34) * 16 + Math.sin(x / 9) * 4 + n(x / 20) * 8
      const flick = 0.55 + 0.45 * Math.sin(x * 0.45 + Math.sin(x * 0.13) * 3)
      for (let y = Math.floor(c - 8); y < c + 70; y++) {
        const t = (y - c) / 70
        const a = (t < 0 ? 1 + t * 8 : 1 - t) * flick * 0.85
        if (bayer(x, y) < a) p.set(x, y, pickBand([C('#b8ff9a'), C('#4af0a0'), C('#30c0d0'), C('#7a5ad8')], Math.max(0, t), x, y))
      }
    }
    const m = noise1(r.int(1, 1e6))
    mountains(p, (x) => 95 + m(x / 40) * 60, C('#cfe4f4'), C('#6a86a8'), C('#ffffff'), 110, 165)
    p.rect(0, 160, 300, 40, C('#0b2238'))
    reflect(p, 160, C('#06182c'), 0.45)
    for (let x = 0; x < 300; x += r.int(4, 9)) pine(p, x, 162, r.int(10, 20), C('#04101c'))
  },
  // 6 MERCAN RESİFİ
  (p, r) => {
    p.gradV(0, 200, [C('#48e4ff'), C('#1aa4dc'), C('#0e62aa'), C('#08306c')])
    for (let k = 0; k < 6; k++) {
      const x0 = r.int(0, 300)
      const w = r.int(10, 22)
      for (let y = 0; y < 170; y++) {
        const off = x0 - y * 0.35
        for (let x = Math.floor(off); x < off + w; x++) if (bayer(x, y) < 0.35 * (1 - y / 170)) p.set(x, y, C('#b8f6ff'))
      }
    }
    const n = noise1(r.int(1, 1e6))
    p.ridge((x) => 176 + n(x / 18) * 10, (x, y) => (bayer(x, y) < 0.3 ? C('#c4a870') : C('#e8d29a')))
    const branch = (x: number, y: number, a: number, len: number, d: number, col: Col) => {
      const x2 = x + Math.cos(a) * len
      const y2 = y + Math.sin(a) * len
      p.thick(x, y, x2, y2, Math.max(1.5, d * 1.2), col)
      if (d <= 0) {
        p.disc(x2, y2, 2, mix(col, C('#ffffff'), 0.4))
        return
      }
      branch(x2, y2, a - r.range(0.3, 0.6), len * 0.75, d - 1, col)
      branch(x2, y2, a + r.range(0.3, 0.6), len * 0.75, d - 1, col)
    }
    for (const [cx, col] of [[40, '#ff5e8a'], [110, '#ff9a3c'], [190, '#c05aff'], [260, '#ff5e5e']] as const) branch(cx, 185, -Math.PI / 2, r.int(14, 20), 3, C(col))
    for (let i = 0; i < 10; i++) {
      const bx = r.int(5, 295)
      const h = r.int(25, 60)
      for (let y = 0; y < h; y++) p.rect(bx + Math.sin((y + bx) / 6) * 3, 186 - y, 2, 1, y % 7 < 4 ? C('#2fae5a') : C('#1f8a44'))
    }
    const fc: [string, string][] = [['#ffb030', '#ff6a20'], ['#ffe04a', '#30a0ff'], ['#ff6aa0', '#ffffff'], ['#5af0ff', '#2060ff']]
    for (let i = 0; i < 9; i++) {
      const [b, f] = r.pick(fc)
      fish(p, r.int(20, 280), r.int(30, 150), r.int(4, 8), C(b), C(f), r.chance(0.5) ? 1 : -1)
    }
    for (let i = 0; i < 18; i++) p.ring(r.int(0, 300), r.int(0, 170), 2, 2, 1, C('#d8fcff'))
  },
  // 7 VOLKAN
  (p, r) => {
    p.gradV(0, 200, [C('#100208'), C('#360a12'), C('#701a12'), C('#b83a14')])
    const sm = noise2(r.int(1, 1e6))
    for (let y = 0; y < 90; y++)
      for (let x = 0; x < 300; x++) {
        const v = sm(x / 40, y / 25) - Math.abs(x - 150) / 400
        if (v > 0.5 && bayer(x, y) < (v - 0.5) * 5) p.set(x, y, v > 0.6 ? C('#5a4a4a') : C('#3a2a2c'))
      }
    p.poly([20, 200, 128, 78, 172, 78, 280, 200], (x, y) => {
      const lit = x < 150 - (y - 78) * 0.1
      return lit ? (bayer(x, y) < 0.25 ? C('#4a2a22') : C('#3a1e18')) : bayer(x, y) < 0.2 ? C('#2a1410') : C('#1e0e0a')
    })
    glow(p, 150, 78, 46, C('#ff6a1a'), 0.55)
    p.ellipse(150, 79, 22, 4, C('#ffb020'))
    p.ellipse(150, 79, 14, 2, C('#fff07a'))
    for (const sx of [134, 146, 158, 168]) {
      let x = sx
      for (let y = 80; y < 200; y++) {
        x += r.range(-0.8, 0.8) + (sx - 150) * 0.004
        p.rect(x, y, 2, 1, y % 9 < 6 ? C('#ff7a1a') : C('#ffc030'))
      }
    }
    for (let i = 0; i < 160; i++) {
      const a = r.range(-Math.PI * 0.85, -Math.PI * 0.15)
      const d = r.range(4, 70)
      p.set(150 + Math.cos(a) * d * 0.9, 76 + Math.sin(a) * d, r.pick([C('#fff07a'), C('#ffb020'), C('#ff5a10')]))
    }
    p.ridge((x) => 186 + Math.sin(x / 13) * 3, (x, y) => pickBand([C('#fff07a'), C('#ff9a20'), C('#d03a10')], ((x * 7 + y * 13) % 17) / 17, x, y))
  },
  // 8 HALKALI GEZEGEN
  (p, r) => {
    p.gradV(0, 200, [C('#000004'), C('#05051a'), C('#0a0624')])
    const nb = noise2(r.int(1, 1e6))
    p.forEach((x, y) => {
      const v = nb(x / 70, y / 70)
      return v > 0.55 && bayer(x, y) < (v - 0.55) * 3 ? C('#2a1050') : -1
    })
    stars(p, r, 220, 199, [C('#ffffff'), C('#ffe8a8'), C('#a8c8ff'), C('#6a6a9a')])
    const cx = 168
    const cy = 106
    const ringCols = [C('#8a6a4a'), C('#d8b080'), C('#f0d8a8'), C('#b08a60')]
    ringCols.forEach((c, i) => p.ring(cx, cy, 86 + i * 6, 20 + i * 1.5, 4, c, 'back'))
    const bands = [C('#e8b070'), C('#c8804a'), C('#f4d0a0'), C('#a86030'), C('#e0a060')]
    const bn = noise1(r.int(1, 1e6))
    p.ellipse(cx, cy, 52, 52, (x, y, nx, ny) => {
      const b = Math.floor((ny + 1) * 5 + bn(nx * 3 + ny * 10) * 1.5) % bands.length
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))
      const s = (-nx * 0.6 - ny * 0.4 + nz * 0.7) / 1.1
      const base = bands[b]
      if (s < 0.25) return bayer(x, y) < 0.7 ? mix(base, C('#000000'), 0.6) : mix(base, C('#000000'), 0.3)
      if (s < 0.45) return bayer(x, y) < 0.5 ? mix(base, C('#000000'), 0.3) : base
      return base
    })
    ringCols.forEach((c, i) => p.ring(cx, cy, 86 + i * 6, 20 + i * 1.5, 4, c, 'front'))
    p.sphere(48, 44, 13, [C('#3a3a4a'), C('#7a7a8a'), C('#c8c8d8')])
    p.sphere(268, 30, 5, [C('#2a4a8a'), C('#5a8ae8'), C('#a8d0ff')])
  },
  // 9 GECE ORMANI
  (p, r) => {
    p.gradV(0, 200, [C('#080c28'), C('#142456'), C('#2a467a')])
    stars(p, r, 100, 100, [C('#ffffff'), C('#c8d8ff')])
    glow(p, 214, 58, 50, C('#5a70b0'), 0.6)
    p.sphere(214, 58, 25, [C('#c8b890'), C('#f0e6c0'), C('#fffbe8')], -0.5, -0.5)
    p.disc(206, 52, 4, C('#d8cca0'))
    p.disc(222, 66, 3, C('#d8cca0'))
    const layers: [number, string, number, number][] = [
      [130, '#1e3460', 22, 34],
      [155, '#122448', 28, 44],
      [182, '#081430', 34, 56],
      [205, '#02060f', 40, 70],
    ]
    for (const [base, col, hmin, hmax] of layers) {
      for (let x = -10; x < 310; x += r.int(5, 11)) pine(p, x, base, r.int(hmin, hmax), C(col))
      p.rect(0, base, 300, 200 - base, C(col))
    }
    for (let i = 0; i < 26; i++) {
      const fx = r.int(0, 300)
      const fy = r.int(120, 195)
      glow(p, fx, fy, 5, C('#c8ff4a'), 0.5)
      p.set(fx, fy, C('#f8ffa0'))
    }
  },
  // 10 KRİSTAL MAĞARA
  (p, r) => {
    p.gradV(0, 200, [C('#0a0416'), C('#1c0c36'), C('#2c1450'), C('#1c0c36')])
    const n = noise1(r.int(1, 1e6))
    const rock = C('#120820')
    const rockL = C('#2a1a40')
    for (let x = 0; x < 300; x++) {
      const spike = Math.max(0, Math.sin(x * 0.7) * Math.sin(x * 0.13)) * 30
      const h = 18 + n(x / 15) * 25 + spike
      for (let y = 0; y < h; y++) p.set(x, y, h - y < 2 ? rockL : rock)
    }
    p.ridge((x) => 165 + n(x / 12 + 40) * 22, (_x, y, top) => (y - top < 2 ? rockL : rock))
    const cl: [number, number, string, string][] = [
      [60, 170, '#7af0ff', '#2a8ab8'],
      [150, 165, '#ff7af0', '#a02a98'],
      [235, 172, '#b89aff', '#5a3ab8'],
      [110, 178, '#7affb0', '#2a9860'],
      [280, 176, '#7af0ff', '#2a8ab8'],
    ]
    for (const [cx, base, l, d] of cl) {
      glow(p, cx, base - 25, 45, C(l), 0.25)
      const k = r.int(3, 5)
      for (let i = 0; i < k; i++) crystal(p, cx + r.range(-14, 14), base + r.int(0, 6), r.int(6, 12), r.int(16, 50), r.range(-0.4, 0.4), C(l), C(d), C('#ffffff'))
    }
    for (let i = 0; i < 40; i++) {
      const sx = r.int(0, 299)
      const sy = r.int(30, 160)
      p.set(sx, sy, C('#ffffff'))
      if (r.chance(0.3)) {
        p.set(sx - 1, sy, C('#b8a8ff'))
        p.set(sx + 1, sy, C('#b8a8ff'))
      }
    }
  },
  // 11 SAKURA DAĞI
  (p, r) => {
    p.gradV(0, 140, [C('#8cc8ff'), C('#c4e4ff'), C('#ffe0ee')])
    p.poly([60, 140, 146, 48, 164, 48, 260, 140], (x, y) => {
      const snow = y < 72 + Math.sin(x * 0.55) * 4 + (bayer(x, y) < 0.5 ? 2 : 0)
      const lit = x < 155 + (y - 48) * 0.05
      if (snow) return lit ? C('#ffffff') : C('#c8d4f0')
      return lit ? C('#6a7cbc') : C('#4a5a98')
    })
    cloud(p, 20, 60, 60, C('#ffffff'), C('#f0d8e8'), r)
    cloud(p, 210, 40, 50, C('#ffffff'), C('#f0d8e8'), r)
    p.rect(0, 140, 300, 60, C('#5a8ad8'))
    reflect(p, 140, C('#4a7ac8'), 0.4)
    p.ridge((x) => 186 + Math.sin(x / 20) * 4, C('#4a8a3a'))
    const trunk = C('#4a2a2a')
    p.thick(36, 200, 52, 130, 9, trunk)
    p.thick(52, 130, 90, 95, 5, trunk)
    p.thick(52, 130, 30, 90, 5, trunk)
    p.thick(70, 112, 120, 110, 4, trunk)
    p.thick(52, 140, 15, 120, 4, trunk)
    const pinks = [C('#d0507a'), C('#f07aa0'), C('#ffb0cc'), C('#ffe0ec')]
    for (const [bx, by] of [[90, 92], [30, 86], [120, 106], [15, 118], [60, 80], [100, 78], [75, 100], [45, 105]]) {
      for (let k = 0; k < 4; k++) p.sphere(bx + r.range(-9, 9), by + r.range(-6, 6), r.int(7, 11), pinks)
    }
    for (let i = 0; i < 90; i++) {
      const px = r.int(0, 300)
      const py = r.int(60, 199)
      p.set(px, py, pinks[r.int(1, 3)])
      if (r.chance(0.4)) p.set(px + 1, py, pinks[2])
    }
  },
  // 12 FIRTINA KALESİ
  (p, r) => {
    p.gradV(0, 200, [C('#14182a'), C('#2a3050'), C('#4a5370')])
    const cn = noise2(r.int(1, 1e6))
    p.forEach((x, y) => {
      if (y > 110) return -1
      const v = cn(x / 45, y / 18)
      if (v > 0.45) return bayer(x, y) < (v - 0.45) * 4 ? C('#5a6280') : C('#3a4060')
      return -1
    })
    let lx = 240
    let ly = 0
    while (ly < 105) {
      const nx = lx + r.range(-8, 8)
      const ny = ly + r.range(6, 14)
      glow(p, nx, ny, 10, C('#8aa0ff'), 0.25)
      p.thick(lx, ly, nx, ny, 2, C('#ffffff'))
      if (r.chance(0.25)) p.line(nx, ny, nx + r.range(-18, 18), ny + r.range(8, 16), C('#c8d4ff'))
      lx = nx
      ly = ny
    }
    p.ridge((x) => 150 - Math.max(0, 30 - Math.abs(x - 150) * 0.35) + Math.sin(x / 15) * 2, (x, y) => (bayer(x, y) < 0.2 ? C('#2a3a2a') : C('#18241a')))
    const wall = C('#2a2a3c')
    const wallL = C('#40405a')
    const tower = (x: number, top: number, w: number) => {
      p.rect(x, top, w, 150 - top, wall)
      p.rect(x, top, 2, 150 - top, wallL)
      for (let i = 0; i < w; i += 6) p.rect(x + i, top - 5, 4, 5, wall)
      p.rect(x + w / 2, top - 22, 1, 17, C('#1a1a24'))
      p.poly([x + w / 2 + 1, top - 22, x + w / 2 + 12, top - 18, x + w / 2 + 1, top - 14], C('#d02a2a'))
    }
    p.rect(118, 88, 64, 40, wall)
    for (let i = 0; i < 64; i += 6) p.rect(118 + i, 83, 4, 5, wall)
    tower(98, 66, 22)
    tower(180, 66, 22)
    tower(140, 52, 20)
    for (const [wx, wy] of [[105, 80], [105, 96], [187, 80], [187, 96], [147, 64], [128, 98], [166, 98]]) p.rect(wx, wy, 3, 5, C('#ffd060'))
    p.ellipse(150, 120, 7, 9, C('#0a0a10'))
    for (let i = 0; i < 220; i++) {
      const rx = r.int(0, 300)
      const ry = r.int(0, 195)
      p.line(rx, ry, rx - 2, ry + 5, C('#7a86a8'))
    }
  },
  // 13 MANTAR ORMANI
  (p, r) => {
    p.gradV(0, 200, [C('#16052e'), C('#46105c'), C('#8a2a78'), C('#d0507a')])
    stars(p, r, 60, 80, [C('#ffffff'), C('#ffb8f0')])
    p.sphere(60, 40, 16, [C('#1a6a4a'), C('#4ad08a'), C('#b8ffd8')])
    p.sphere(96, 26, 6, [C('#6a4a1a'), C('#d0a04a'), C('#ffe8a8')])
    const n = noise1(r.int(1, 1e6))
    p.ridge((x) => 168 + n(x / 20) * 12, (x, y, top) => pickBand([C('#4a1a5a'), C('#2a0f3a'), C('#160622')], (y - top) / 30, x, y))
    const shroom = (x: number, base: number, h: number, cw: number, cap: Col, capD: Col, spot: Col) => {
      p.poly([x - 4, base, x - 3, base - h, x + 3, base - h, x + 4, base], (px) => (px < x ? C('#f0e0c8') : C('#c8b090')))
      glow(p, x, base - h + 6, cw * 0.9, cap, 0.3)
      p.ellipse(x, base - h, cw, cw * 0.6, (px, py, nx, ny) => (ny > 0.25 ? -1 : nx + ny < -0.4 ? mix(cap, C('#ffffff'), 0.3) : nx > 0.4 && bayer(px, py) < 0.6 ? capD : cap))
      p.rect(x - cw * 0.8, base - h + cw * 0.15, cw * 1.6, 1, capD)
      for (let i = 0; i < 4; i++) p.disc(x + r.range(-cw * 0.6, cw * 0.6), base - h - r.range(cw * 0.1, cw * 0.4), r.int(1, 3), spot)
    }
    shroom(60, 182, 60, 34, C('#2ad8d0'), C('#1a8a8a'), C('#e8ffff'))
    shroom(160, 178, 85, 44, C('#ff7a3a'), C('#b8421a'), C('#fff0c0'))
    shroom(250, 180, 50, 28, C('#c05aff'), C('#7a2ab8'), C('#ffe0ff'))
    shroom(115, 186, 26, 14, C('#ffd03a'), C('#b8901a'), C('#ffffff'))
    shroom(210, 188, 20, 11, C('#2ad8d0'), C('#1a8a8a'), C('#e8ffff'))
    for (let i = 0; i < 50; i++) {
      const sx = r.int(0, 300)
      const sy = r.int(60, 180)
      glow(p, sx, sy, 3, C('#b8ffd8'), 0.6)
      p.set(sx, sy, C('#ffffff'))
    }
  },
  // 14 KEDİ
  (p) => {
    p.forEach((x, y) => (Math.floor((x + y) / 10) % 2 ? C('#ffd2e4') : C('#ffc0d8')))
    for (let y = 8; y < 200; y += 24) for (let x = (y / 24) % 2 ? 8 : 20; x < 300; x += 24) p.disc(x, y, 3, C('#fff0f6'))
    const fur = C('#f0a040')
    const furD = C('#c87a28')
    const furL = C('#ffc070')
    p.ellipse(150, 215, 95, 50, (x, y, nx) => (nx > 0.4 && bayer(x, y) < 0.5 ? furD : fur))
    p.poly([72, 95, 92, 18, 132, 60], fur)
    p.poly([228, 95, 208, 18, 168, 60], fur)
    p.poly([88, 80, 96, 34, 120, 62], C('#ff9ab8'))
    p.poly([212, 80, 204, 34, 180, 62], C('#ff9ab8'))
    p.ellipse(150, 112, 86, 70, (x, y, nx, ny) => {
      if (nx + ny * 0.5 > 0.75 && bayer(x, y) < 0.6) return furD
      if (nx + ny < -0.9 && bayer(x, y) < 0.5) return furL
      return fur
    })
    for (const dx of [-16, 0, 16]) p.thick(150 + dx, 46, 150 + dx * 1.3, 66, 4, furD)
    for (const s of [-1, 1]) {
      p.thick(150 + s * 80, 110, 150 + s * 62, 114, 3, furD)
      p.thick(150 + s * 82, 124, 150 + s * 64, 124, 3, furD)
    }
    p.ellipse(150, 150, 46, 30, C('#fff4e8'))
    p.ellipse(132, 140, 18, 13, C('#ffffff'))
    p.ellipse(168, 140, 18, 13, C('#ffffff'))
    for (const ex of [115, 185]) {
      p.ellipse(ex, 104, 18, 19, C('#1a1a1a'))
      p.ellipse(ex, 104, 16, 17, (x, y, _nx, ny) => pickBand([C('#c8f070'), C('#7ad03a'), C('#3a8a1a')], (ny + 1) / 2, x, y))
      p.ellipse(ex, 104, 4, 14, C('#101010'))
      p.rect(ex - 9, 94, 5, 5, C('#ffffff'))
      p.rect(ex + 4, 111, 2, 2, C('#ffffff'))
    }
    p.poly([140, 127, 160, 127, 150, 138], C('#ff7aa0'))
    p.rect(146, 128, 3, 2, C('#ffc0d4'))
    p.line(150, 138, 150, 146, C('#7a3a2a'))
    for (let i = 0; i < 10; i++) {
      p.set(150 - i, 146 + Math.round(Math.sin((i / 10) * Math.PI) * 3), C('#7a3a2a'))
      p.set(150 + i, 146 + Math.round(Math.sin((i / 10) * Math.PI) * 3), C('#7a3a2a'))
    }
    for (const s of [-1, 1]) for (const dy of [-6, 0, 6]) p.line(150 + s * 30, 142 + dy / 2, 150 + s * 88, 136 + dy * 2, C('#ffffff'))
    p.rect(80, 176, 140, 8, C('#d0202a'))
    p.disc(150, 188, 7, C('#ffd030'))
    p.rect(146, 189, 8, 1, C('#a07010'))
  },
  // 15 FENER
  (p, r) => {
    p.gradV(0, 140, [C('#020614'), C('#0a1838'), C('#183054')])
    stars(p, r, 90, 100, [C('#ffffff'), C('#a8c8ff')])
    const cn = noise2(r.int(1, 1e6))
    p.forEach((x, y) => {
      if (y > 120) return -1
      const v = cn(x / 50, y / 16)
      return v > 0.55 && bayer(x, y) < (v - 0.55) * 4 ? C('#24365a') : -1
    })
    p.poly([206, 62, 0, 30, 0, 96], (x, y) => (bayer(x, y) < 0.45 * (x / 206) + 0.05 ? C('#fff3a0') : -1))
    p.poly([206, 62, 300, 52, 300, 74], (x, y) => (bayer(x, y) < 0.35 ? C('#fff3a0') : -1))
    p.rect(0, 140, 300, 60, C('#0a1c36'))
    for (let y = 141; y < 200; y += 3) for (let x = 0; x < 300; x++) if (Math.sin(x / (6 + (y - 140) * 0.2) + y) > 0.75) p.set(x, y, y % 2 ? C('#3a5a8a') : C('#24406a'))
    p.poly([160, 160, 175, 128, 196, 118, 236, 120, 258, 134, 280, 160], (x, y) => (x < 200 && bayer(x, y) < 0.4 ? C('#4a4a5a') : C('#2a2a36')))
    p.poly([189, 124, 196, 66, 216, 66, 223, 124], (_x, y) => (Math.floor((y - 66) / 10) % 2 ? C('#e8e8f0') : C('#d02a2a')))
    p.poly([214, 66, 223, 124, 218, 124, 211, 66], (_x, y) => (Math.floor((y - 66) / 10) % 2 ? C('#a8a8b8') : C('#8a1a1a')))
    p.rect(192, 62, 28, 4, C('#2a2a36'))
    p.rect(198, 50, 16, 12, C('#fff3a0'))
    glow(p, 206, 56, 22, C('#fff3a0'), 0.6)
    p.rect(198, 50, 1, 12, C('#2a2a36'))
    p.rect(213, 50, 1, 12, C('#2a2a36'))
    p.poly([195, 50, 206, 40, 217, 50], C('#d02a2a'))
    for (let i = 0; i < 120; i++) {
      const a = r.range(Math.PI, Math.PI * 2)
      const d = r.range(4, 30)
      p.set(220 + Math.cos(a) * d * 2, 150 + Math.sin(a) * d * 0.6, C('#e8f4ff'))
    }
    p.ditherRect(160, 155, 120, 8, C('#c8e0ff'), 0.4)
  },
  // 16 NEBULA
  (p, r) => {
    p.gradV(0, 200, [C('#000003'), C('#04020e')])
    const a = noise2(r.int(1, 1e6))
    const b = noise2(r.int(1, 1e6))
    const magenta = [C('#2a0838'), C('#6a1060'), C('#c02a8a'), C('#ff7ac0'), C('#ffe0f0')]
    const blue = [C('#06103a'), C('#10307a'), C('#2a70c8'), C('#7ad0ff'), C('#e8fbff')]
    p.forEach((x, y) => {
      const va = a(x / 55, y / 55) * 1.3 - 0.35 - Math.abs(y - 100 - (x - 150) * 0.3) / 260
      const vb = b(x / 45 + 10, y / 45) * 1.3 - 0.4 - Math.abs(x - 90) / 400
      if (va > vb && va > 0.2) return pickBand(magenta, (va - 0.2) * 2.2, x, y)
      if (vb > 0.2) return pickBand(blue, (vb - 0.2) * 2.2, x, y)
      return -1
    })
    for (let i = 0; i < 1400; i++) {
      const arm = i % 2
      const t = r.range(0, 4.2)
      const rr = 3 + t * 9 + r.range(-2, 2)
      const ang = t * 1.4 + arm * Math.PI
      const x = 236 + Math.cos(ang) * rr
      const y = 48 + Math.sin(ang) * rr * 0.55
      p.set(x, y, t < 1 ? C('#fff8e0') : r.chance(0.5) ? C('#c8d8ff') : C('#8a9ad8'))
    }
    glow(p, 236, 48, 10, C('#fff8e0'), 0.9)
    stars(p, r, 200, 199, [C('#ffffff'), C('#ffd8a8'), C('#a8c8ff')])
    for (let i = 0; i < 6; i++) {
      const sx = r.int(10, 290)
      const sy = r.int(10, 190)
      glow(p, sx, sy, 6, C('#ffffff'), 0.4)
      p.line(sx - 6, sy, sx + 6, sy, C('#e8f4ff'))
      p.line(sx, sy - 6, sx, sy + 6, C('#e8f4ff'))
    }
  },
  // 17 ROBOT
  (p) => {
    p.gradV(0, 200, [C('#04222a'), C('#0a3a44'), C('#04222a')])
    for (let i = 0; i < 300; i += 12) p.rect(i, 0, 1, 200, C('#0e4a56'))
    for (let i = 0; i < 200; i += 12) p.rect(0, i, 300, 1, C('#0e4a56'))
    const metal = [C('#4a5a6a'), C('#7a8a9a'), C('#aebccc'), C('#dce6f0')]
    p.rect(110, 168, 80, 32, C('#3a4a5a'))
    p.rect(60, 182, 180, 18, C('#5a6a7a'))
    p.rect(60, 182, 180, 2, C('#aebccc'))
    p.poly([150, 184, 142, 194, 150, 194, 146, 200, 158, 190, 150, 190, 156, 184], C('#ffd030'))
    p.rect(64, 70, 14, 50, C('#5a6a7a'))
    p.rect(222, 70, 14, 50, C('#5a6a7a'))
    for (let y = 36; y < 170; y++)
      for (let x = 76; x < 224; x++) {
        const cx = Math.max(0, Math.abs(x - 150) - 62)
        const cy = Math.max(0, Math.abs(y - 103) - 55)
        if (cx * cx + cy * cy > 144) continue
        p.set(x, y, pickBand(metal, 1 - (x - 76) / 148 + (bayer(x, y) - 0.5) * 0.15, x, y))
      }
    for (const [bx, by] of [[86, 46], [214, 46], [86, 160], [214, 160]]) {
      p.disc(bx, by, 3, C('#3a4a5a'))
      p.set(bx - 1, by - 1, C('#ffffff'))
    }
    p.thick(150, 36, 150, 14, 3, C('#5a6a7a'))
    glow(p, 150, 12, 14, C('#ff3a3a'), 0.5)
    p.sphere(150, 12, 5, [C('#8a0a0a'), C('#ff3a3a'), C('#ffc0c0')])
    for (const ex of [118, 182]) {
      p.disc(ex, 88, 21, C('#2a3440'))
      glow(p, ex, 88, 28, C('#3af0ff'), 0.35)
      p.ellipse(ex, 88, 16, 16, (x, y, nx, ny) => pickBand([C('#e8ffff'), C('#7af6ff'), C('#20a8d0'), C('#0a5070')], Math.hypot(nx, ny), x, y))
      p.rect(ex - 8, 79, 5, 4, C('#ffffff'))
    }
    p.rect(108, 128, 84, 24, C('#2a3440'))
    for (let x = 112; x < 190; x += 6) p.rect(x, 131, 3, 18, C('#7af6ff'))
  },
  // 18 EJDERHA
  (p, r) => {
    p.gradV(0, 200, [C('#2a0412'), C('#701022'), C('#c83c28'), C('#ff9a40')])
    glow(p, 160, 118, 80, C('#ffb060'), 0.6)
    p.disc(160, 118, 48, C('#ffcc66'))
    p.disc(160, 118, 40, C('#ffe08a'))
    const n = noise1(r.int(1, 1e6))
    p.ridge((x) => 140 + n(x / 30) * 30, C('#4a0e24'))
    p.ridge((x) => 165 + n(x / 20 + 99) * 25, C('#2a0614'))
    const dk = C('#10030a')
    const md = C('#2a0a18')
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 60; i++) {
      const t = i / 60
      const x = 92 + t * 170
      const y = 88 + Math.sin(t * 5) * 10 * t + t * 6 - (t > 0.8 ? (t - 0.8) * 120 : 0)
      const w = t < 0.12 ? 5 + t * 40 : 10 * (1 - t) + 1.5
      pts.push([x, y, w])
    }
    for (const [x, y, w] of pts) p.disc(x, y, w, dk)
    p.poly([258, 70, 270, 60, 266, 76], dk)
    p.poly([135, 92, 105, 22, 128, 38, 150, 10, 162, 42, 186, 30, 180, 92], md)
    for (const [tx, ty] of [[105, 22], [150, 10], [186, 30]]) p.line(158, 92, tx, ty, dk)
    p.poly([150, 96, 128, 140, 160, 128, 182, 140, 175, 96], md)
    p.poly([96, 82, 70, 80, 56, 86, 70, 90, 96, 96], dk)
    p.line(84, 82, 96, 66, dk)
    p.line(90, 82, 104, 68, dk)
    p.set(76, 84, C('#ffd030'))
    p.thick(120, 98, 116, 112, 3, dk)
    p.thick(170, 100, 176, 114, 3, dk)
    p.poly([56, 86, 6, 70, 0, 110], (x, y) => (bayer(x, y) < 0.3 + (x / 56) * 0.5 ? (bayer(y, x) < 0.5 ? C('#ffe040') : C('#ff7a20')) : -1))
    for (let i = 0; i < 30; i++) p.set(r.int(0, 60), r.int(70, 110), C('#fff8c0'))
  },
  // 19 ŞELALE
  (p, r) => {
    p.gradV(0, 120, [C('#6ac0ff'), C('#b8e8ff'), C('#e8f8ff')])
    const rb = ['#ff3a3a', '#ff9a2a', '#ffe83a', '#4ae04a', '#3aa0ff', '#5a4ae8', '#b04ae0']
    rb.forEach((c, i) => {
      for (let y = 0; y < 120; y++)
        for (let x = 0; x < 300; x++) {
          const d = Math.hypot(x - 150, (y - 170) * 1.1)
          if (d >= 132 - i * 3 && d < 135 - i * 3 && bayer(x, y) < 0.6) p.set(x, y, C(c))
        }
    })
    cloud(p, 20, 30, 44, C('#ffffff'), C('#d8ecf8'), r)
    cloud(p, 230, 24, 50, C('#ffffff'), C('#d8ecf8'), r)
    const rn = noise2(r.int(1, 1e6))
    const rockFn = (x: number, y: number): Col => {
      const v = rn(x / 14, y / 10)
      return pickBand([C('#3a2a1e'), C('#5a4430'), C('#7a6044'), C('#9a805a')], v, x, y)
    }
    p.poly([0, 50, 70, 46, 112, 54, 120, 200, 0, 200], rockFn)
    p.poly([300, 44, 230, 48, 184, 54, 180, 200, 300, 200], rockFn)
    p.ridge((x) => (x < 116 ? 46 + Math.sin(x / 8) * 2 : x > 184 ? 46 + Math.sin(x / 7) * 2 : 300), (x, y, top) => (y - top < 6 ? (bayer(x, y) < 0.5 ? C('#3aa03a') : C('#2a802a')) : -1))
    for (const tx of [14, 40, 76, 206, 240, 276]) roundTree(p, tx, 50, r.int(7, 10), [C('#1a5a1a'), C('#2a8a2a'), C('#4ac04a'), C('#9ae07a')], C('#4a3020'))
    const wn = noise1(r.int(1, 1e6), 2)
    for (let x = 112; x < 188; x++) {
      const v = wn(x / 3)
      for (let y = 54; y < 172; y++) {
        const s = v + Math.sin((y + x * 13) * 0.2) * 0.12
        p.set(x, y, s > 0.62 ? C('#ffffff') : s > 0.45 ? C('#b8e8ff') : C('#5ab8f0'))
      }
    }
    p.rect(0, 172, 300, 28, C('#2a80d0'))
    for (let y = 172; y < 200; y += 2) for (let x = 0; x < 300; x++) if (Math.sin(x / 5 + y * 3) > 0.8) p.set(x, y, C('#6ac0f0'))
    for (let i = 0; i < 400; i++) {
      const a = r.range(0, Math.PI)
      const d = r.range(0, 1)
      p.set(150 + Math.cos(a) * d * 60, 172 - Math.sin(a) * d * 14 + r.range(0, 6), C('#ffffff'))
    }
    for (const [fx, fy] of [[10, 190], [290, 190], [30, 196], [270, 196]]) p.sphere(fx, fy, 14, [C('#0a3a14'), C('#1a6a24'), C('#3aa040')])
  },
  // 20 YÖRÜNGE
  (p, r) => {
    p.rect(0, 0, 300, 200, C('#000006'))
    stars(p, r, 220, 199, [C('#ffffff'), C('#c8d8ff'), C('#ffe8c8')])
    const cx = 150
    const cy = 470
    const R = 330
    const land = noise2(r.int(1, 1e6))
    const clouds = noise2(r.int(1, 1e6))
    for (let y = 120; y < 200; y++)
      for (let x = 0; x < 300; x++) {
        const d = Math.hypot(x - cx, y - cy)
        if (d > R + 7) continue
        if (d > R) {
          if (bayer(x, y) < (R + 7 - d) / 7) p.set(x, y, d > R + 3 ? C('#2a6aff') : C('#7ac8ff'))
          continue
        }
        const lv = land(x / 40, y / 22)
        const cv = clouds(x / 25 + 5, y / 9)
        let c = lv > 0.55 ? (lv > 0.68 ? C('#c8a860') : C('#3a9a4a')) : lv > 0.5 ? C('#2a8ad0') : C('#1a5ab0')
        if (cv > 0.55 && bayer(x, y) < (cv - 0.55) * 5) c = C('#ffffff')
        const edge = (R - d) / 40
        if (edge < 1 && bayer(x, y) > edge) c = mix(c, C('#7ac8ff'), 0.5)
        if (x > 230 && bayer(x, y) < (x - 230) / 90) c = mix(c, C('#000010'), 0.6)
        p.set(x, y, c)
      }
    glow(p, 262, 32, 40, C('#fff8e0'), 0.6)
    p.disc(262, 32, 8, C('#ffffff'))
    p.line(232, 32, 292, 32, C('#fff8e0'))
    p.line(262, 4, 262, 60, C('#fff8e0'))
    const sx = 130
    const sy = 70
    p.rect(sx - 70, sy - 1, 140, 3, C('#9aa4b0'))
    for (const px of [sx - 70, sx + 34]) {
      p.rect(px, sy - 18, 36, 14, C('#1a3a8a'))
      p.rect(px, sy + 6, 36, 14, C('#1a3a8a'))
      for (let gx = px; gx <= px + 36; gx += 6) {
        p.rect(gx, sy - 18, 1, 14, C('#5a8ae8'))
        p.rect(gx, sy + 6, 1, 14, C('#5a8ae8'))
      }
      p.rect(px, sy - 12, 36, 1, C('#5a8ae8'))
      p.rect(px, sy + 12, 36, 1, C('#5a8ae8'))
      p.rect(px + 17, sy - 4, 2, 10, C('#9aa4b0'))
    }
    p.gradV(sy - 8, sy + 10, [C('#ffffff'), C('#c8ccd8'), C('#7a808e')], sx - 22, sx + 22)
    p.gradV(sy - 5, sy + 7, [C('#ffffff'), C('#d0a050'), C('#8a6020')], sx - 32, sx - 22)
    p.disc(sx + 26, sy + 1, 7, C('#c8ccd8'))
    p.disc(sx + 24, sy - 1, 4, C('#ffffff'))
    p.set(sx - 20, sy - 8, C('#ff3a3a'))
    p.set(sx + 20, sy - 8, C('#3aff6a'))
  },
  // 21 BAYKUŞ
  (p, r) => {
    p.gradV(0, 200, [C('#060a24'), C('#14204a'), C('#26346a')])
    stars(p, r, 100, 199, [C('#ffffff'), C('#c8d8ff')])
    glow(p, 150, 82, 80, C('#4a5a9a'), 0.5)
    p.sphere(150, 82, 62, [C('#d8c890'), C('#f4e8b8'), C('#fffbe0')], -0.3, -0.5)
    for (const [mx, my, mr] of [[120, 60, 8], [176, 100, 10], [132, 112, 5], [180, 50, 6]]) p.disc(mx, my, mr, C('#e0d4a0'))
    const br = C('#7a5030')
    const brD = C('#5a3820')
    const brL = C('#b08050')
    p.ellipse(150, 132, 44, 52, (x, y, nx) => (nx > 0.5 && bayer(x, y) < 0.6 ? brD : br))
    p.ellipse(150, 140, 28, 36, (x, y) => ((y + Math.abs(x - 150)) % 7 === 0 ? brD : C('#e0c8a0')))
    p.ellipse(114, 138, 14, 38, brD)
    p.ellipse(186, 138, 14, 38, brD)
    p.poly([108, 76, 104, 44, 126, 66], br)
    p.poly([192, 76, 196, 44, 174, 66], br)
    p.ellipse(150, 86, 46, 34, (x, y, nx, ny) => (nx + ny > 0.8 && bayer(x, y) < 0.5 ? brD : br))
    for (const ex of [130, 170]) {
      p.disc(ex, 88, 19, brL)
      p.disc(ex, 88, 16, C('#e8d4b0'))
      p.disc(ex, 88, 11, C('#ffb000'))
      p.disc(ex, 88, 8, C('#ff8000'))
      p.disc(ex, 88, 6, C('#101010'))
      p.rect(ex - 3, 84, 3, 3, C('#ffffff'))
    }
    p.poly([145, 100, 155, 100, 150, 114], C('#3a2a1a'))
    p.poly([145, 100, 150, 100, 150, 114], C('#6a4a2a'))
    p.thick(0, 184, 300, 176, 9, C('#4a2a14'))
    p.thick(0, 181, 300, 173, 2, C('#6a4020'))
    for (const fx of [134, 144, 156, 166]) p.rect(fx, 172, 3, 8, C('#ffc030'))
    for (const [lx, ly] of [[30, 176], [60, 172], [240, 168], [270, 172]]) p.ellipse(lx, ly - 4, 8, 4, C('#2a6a2a'))
  },
  // 22 SYNTHWAVE
  (p, r) => {
    p.gradV(0, 122, [C('#0d0221'), C('#2a0845'), C('#6a1b6a'), C('#c2296b'), C('#ff6f61')])
    stars(p, r, 70, 60, [C('#ffffff'), C('#ffb8e8')])
    p.ellipse(150, 86, 50, 50, (x, y, _nx, ny) => {
      if (y > 80 && (y - 80) % 7 < Math.floor((y - 74) / 9)) return -1
      return pickBand([C('#fff36a'), C('#ffb03a'), C('#ff5a8a'), C('#d02aa0')], (ny + 1) / 2, x, y)
    })
    const n = noise1(r.int(1, 1e6))
    const mt = (x: number) => 122 - Math.max(0, n(x / 18) * 60 - 18) * (Math.abs(x - 150) > 60 ? 1 : 0.35)
    p.ridge(mt, (x, y, top) => (y === top ? C('#ff3af0') : bayer(x, y) < 0.15 ? C('#4a1070') : C('#22063a')), 122)
    p.rect(0, 122, 300, 78, C('#12002a'))
    for (let i = 1; i < 14; i++) {
      const y = 122 + Math.pow(i / 13, 2.2) * 78
      p.rect(0, y, 300, 1, C('#ff3af0'))
    }
    for (let k = -20; k <= 20; k++) p.line(150 + k * 6, 122, 150 + k * 40, 200, C('#ff3af0'))
    p.ditherRect(0, 122, 300, 6, C('#ff6fd0'), 0.5)
  },
  // 23 BUZ GEZEGENİ
  (p, r) => {
    p.gradV(0, 140, [C('#060c2a'), C('#14306a'), C('#4a7ab8'), C('#9ac8f0')])
    stars(p, r, 120, 90, [C('#ffffff'), C('#c8e8ff')])
    const bands = [C('#3a6ab0'), C('#5a9ad0'), C('#2a4a8a'), C('#7ac0e8')]
    p.ellipse(44, 34, 74, 74, (x, y, nx, ny) => {
      const b = bands[Math.floor((ny + nx * 0.3 + 1) * 6) % 4]
      return nx + ny > 0.5 && bayer(x, y) < 0.6 ? mix(b, C('#000010'), 0.5) : b
    })
    for (const [cx, cy, len] of [[200, 30, 50], [260, 70, 35], [120, 90, 25]]) {
      for (let i = 0; i < len; i++) {
        const t = i / len
        if (bayer(cx + i, cy - i * 0.5) < 1 - t) {
          p.set(cx + i, cy - i * 0.5, C('#c8f0ff'))
          p.set(cx + i, cy - i * 0.5 + 1, C('#7ac0ff'))
        }
      }
      glow(p, cx, cy, 5, C('#ffffff'), 0.7)
      p.disc(cx, cy, 2, C('#ffffff'))
    }
    const n = noise1(r.int(1, 1e6))
    mountains(p, (x) => 130 + n(x / 25) * 30, C('#e8f8ff'), C('#8ac0e8'), null, 0)
    p.ridge((x) => 165 + n(x / 10 + 30) * 12, (x, y, top) => pickBand([C('#dff4ff'), C('#a8d4f0'), C('#6aa8d8')], (y - top) / 35, x, y))
    for (let k = 0; k < 6; k++) {
      let x = r.int(10, 290)
      for (let y = 170; y < 200; y++) {
        x += r.range(-1.2, 1.2)
        p.rect(x, y, 2, 1, C('#1a3a7a'))
      }
    }
    for (let i = 0; i < 10; i++) {
      const x = r.int(5, 295)
      const base = 175 + r.int(0, 20)
      const h = r.int(15, 45)
      const w = r.int(3, 7)
      p.poly([x - w, base, x, base - h, x, base], C('#f4fcff'))
      p.poly([x, base - h, x + w, base, x, base], C('#9acdf0'))
    }
  },
  // 24 İSTİLA
  (p, r) => {
    p.gradV(0, 200, [C('#04040e'), C('#0e1830'), C('#1e2e50')])
    stars(p, r, 120, 120, [C('#ffffff'), C('#a8c8ff')])
    p.poly([128, 72, 172, 72, 210, 190, 90, 190], (x, y) => (bayer(x, y) < 0.32 ? C('#7aff8a') : -1))
    p.line(128, 72, 90, 190, C('#b8ffc0'))
    p.line(172, 72, 210, 190, C('#b8ffc0'))
    let x = -4
    while (x < 300) {
      const w = r.int(10, 22)
      const h = r.int(15, 45)
      p.rect(x, 200 - h, w, h, C('#080c18'))
      for (let wy = 204 - h; wy < 196; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r.chance(0.3)) p.rect(wx, wy, 2, 2, C('#ffd060'))
      x += w + r.int(0, 3)
    }
    const cx = 150
    const cy = 120
    p.rect(cx - 8, cy, 16, 7, C('#ffffff'))
    p.rect(cx - 5, cy + 1, 4, 3, C('#101010'))
    p.rect(cx + 3, cy + 3, 3, 3, C('#101010'))
    p.rect(cx + 8, cy - 2, 5, 5, C('#ffffff'))
    p.set(cx + 11, cy - 1, C('#101010'))
    for (const lx of [-7, -3, 3, 6]) p.rect(cx + lx, cy + 7, 1, 4, C('#ffffff'))
    glow(p, cx, cy + 3, 18, C('#b8ffc0'), 0.4)
    p.ellipse(150, 64, 132, 13, C('#2a3040'))
    p.ellipse(150, 52, 136, 20, (px, py, _nx, ny) => pickBand([C('#e8eef8'), C('#a8b4c8'), C('#5a667a'), C('#3a4458')], (ny + 1) / 2 + (bayer(px, py) - 0.5) * 0.1, px, py))
    p.ellipse(150, 38, 40, 18, (px, py, nx, ny) => (ny > 0.5 ? -1 : nx + ny < -0.6 ? C('#e8ffff') : bayer(px, py) < 0.3 ? C('#4ad0e0') : C('#2a90b0')))
    for (let i = -12; i <= 12; i++) {
      const lx = 150 + i * 10
      const ly = 54 + Math.abs(i) * 0.35
      p.rect(lx - 1, ly, 3, 2, i % 2 ? C('#ff3a3a') : C('#ffe03a'))
    }
    for (const [ux, uy] of [[40, 110], [262, 96], [230, 140]]) {
      p.ellipse(ux, uy, 12, 3, C('#a8b4c8'))
      p.ellipse(ux, uy - 3, 5, 3, C('#4ad0e0'))
      p.set(ux - 6, uy, C('#ff3a3a'))
      p.set(ux + 6, uy, C('#ff3a3a'))
    }
  },
  // 25 EVE DÖNÜŞ
  (p, r) => {
    p.gradV(0, 200, [C('#3a98ff'), C('#7ac8ff'), C('#c8ecff')])
    const rb = ['#ff3a3a', '#ff9a2a', '#ffe83a', '#4ae04a', '#3aa0ff', '#5a4ae8', '#b04ae0']
    rb.forEach((c, i) => {
      for (let y = 0; y < 200; y++)
        for (let x = 0; x < 300; x++) {
          const d = Math.hypot(x - 150, y - 210)
          if (d >= 150 - i * 4 && d < 154 - i * 4) p.set(x, y, C(c))
        }
    })
    glow(p, 44, 40, 40, C('#fff6b0'), 0.7)
    p.disc(44, 40, 16, C('#ffe84a'))
    p.disc(44, 40, 12, C('#fff59a'))
    cloud(p, 90, 30, 50, C('#ffffff'), C('#d0e4f4'), r)
    cloud(p, 210, 46, 44, C('#ffffff'), C('#d0e4f4'), r)
    p.ridge((x) => 140 + Math.sin(x / 30) * 10, (x, y, top) => pickBand([C('#8ae06a'), C('#5cc248'), C('#3d9a38')], (y - top) / 40, x, y))
    p.ridge((x) => 168 + Math.sin(x / 40 + 1) * 8, (x, y, top) => pickBand([C('#5cc248'), C('#3d9a38'), C('#2a7430')], (y - top) / 30, x, y))
    for (let i = 0; i < 7; i++) house(p, 20 + i * 40 + r.int(-5, 5), 160 + Math.sin(i) * 4, r.int(12, 18), r.int(9, 13), C('#fff0d8'), r.pick([C('#d03a2a'), C('#2a6ad0'), C('#e08a20')]), C('#ffd84a'))
    p.poly([150, 70, 136, 104, 150, 98, 164, 104], C('#5af0ff'))
    p.poly([150, 70, 150, 98, 164, 104], C('#2aa0d0'))
    p.rect(148, 82, 4, 6, C('#ff3af0'))
    glow(p, 150, 110, 10, C('#ffb030'), 0.7)
    p.poly([145, 102, 155, 102, 150, 116], C('#ffe03a'))
    for (let i = 0; i < 220; i++) p.set(r.int(0, 299), r.int(170, 199), r.pick([C('#ff5e7e'), C('#fff35a'), C('#ffffff'), C('#c07aff'), C('#ff9a2a')]))
  },
]

export const PICTURE_COUNT = scenes.length

const picCache = new Map<number, Pix>()

/** idx'inci resmi üretir (önbellekli). */
export function getPicture(idx: number): Pix {
  let p = picCache.get(idx)
  if (p) return p
  p = new Pix(PIC_W, PIC_H, C('#000000'))
  scenes[idx % scenes.length](p, new Rng(1000 + idx * 7919))
  picCache.set(idx, p)
  return p
}

const thumbCache = new Map<number, HTMLCanvasElement>()
export function getPictureCanvas(idx: number): HTMLCanvasElement {
  let c = thumbCache.get(idx)
  if (!c) {
    c = getPicture(idx).toCanvas()
    thumbCache.set(idx, c)
  }
  return c
}
