import { COLS, ROWS } from '../game/grid.ts'
import { borderCellAt } from '../game/enemies.ts'
import type { Engine } from '../game/engine.ts'

export const VIEW_W = 800
export const VIEW_H = 600
export const CELL = 10

interface Star { x: number; y: number; s: number; tw: number }

const stars: Star[] = Array.from({ length: 130 }, () => ({
  x: Math.random() * VIEW_W,
  y: Math.random() * VIEW_H,
  s: Math.random() < 0.8 ? 1 : 2,
  tw: Math.random() * Math.PI * 2,
}))

/** 5 map teması: duvar renkleri + arkaplan tonu */
const THEMES = [
  { a: '#1236d6', b: '#0e2bb0', edge: '#00e5ff', bg: '#02040f' },
  { a: '#0e7ad6', b: '#0a5aa8', edge: '#7df3ff', bg: '#020a14' },
  { a: '#5a18d6', b: '#4310a8', edge: '#c98bff', bg: '#0a0318' },
  { a: '#b06a10', b: '#8a520c', edge: '#ffd24d', bg: '#140a02' },
  { a: '#a8103a', b: '#7c0b2c', edge: '#ff5d8e', bg: '#14020a' },
]

export function drawGame(ctx: CanvasRenderingContext2D, eng: Engine, time: number): void {
  const th = THEMES[eng.def.theme % THEMES.length] as { a: string; b: string; edge: string; bg: string }
  ctx.fillStyle = th.bg
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  for (const st of stars) {
    const a = 0.25 + 0.35 * Math.abs(Math.sin(time * 0.9 + st.tw))
    ctx.fillStyle = `rgba(150,190,255,${a.toFixed(3)})`
    ctx.fillRect(st.x, st.y, st.s, st.s)
  }

  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const v = eng.grid[cy * COLS + cx]
      const px = cx * CELL
      const py = cy * CELL
      if (v === 1) {
        const checker = (cx + cy) % 2 === 0
        ctx.fillStyle = checker ? th.a : th.b
        ctx.fillRect(px, py, CELL, CELL)
        ctx.fillStyle = th.edge
        ctx.fillRect(px, py, CELL, 1)
        ctx.fillRect(px, py, 1, CELL)
        if (cx === 0 || cy === 0 || cx === COLS - 1 || cy === ROWS - 1) {
          ctx.fillStyle = '#ffffff'
          ctx.globalAlpha = 0.5
          ctx.fillRect(px, py + CELL - 1, CELL, 1)
          ctx.globalAlpha = 1
        }
      } else if (v === 2) {
        const blink = Math.sin(time * 14) > 0 ? '#ffe14d' : '#ff9d00'
        ctx.fillStyle = blink
        ctx.fillRect(px, py, CELL, CELL)
        ctx.fillStyle = '#fff6c2'
        ctx.fillRect(px + 3, py + 3, 4, 4)
      }
    }
  }

  for (const b of eng.bonuses) {
    const px = b.cx * CELL
    const py = b.cy * CELL
    const pulse = 1 + Math.sin(time * 6) * 0.12
    ctx.save()
    ctx.translate(px + CELL / 2, py + CELL / 2)
    ctx.scale(pulse, pulse)
    if (b.kind === 'points') {
      ctx.fillStyle = '#3dff8e'
      ctx.fillRect(-4, -4, 8, 8)
      ctx.fillStyle = '#062b16'
      ctx.fillRect(-2, -1, 4, 2)
      ctx.fillRect(-1, -2, 2, 4)
    } else if (b.kind === 'slow') {
      ctx.fillStyle = '#00e5ff'
      ctx.fillRect(-4, -4, 8, 8)
      ctx.fillStyle = '#03252c'
      ctx.fillRect(-3, -1, 6, 2)
    } else {
      ctx.fillStyle = '#ff2fb3'
      ctx.fillRect(-4, -4, 8, 8)
      ctx.fillStyle = '#fff'
      ctx.fillRect(-1, -3, 2, 6)
      ctx.fillRect(-3, -1, 6, 2)
    }
    ctx.restore()
  }

  // düşmanlar: türe göre sprite
  for (const e of eng.free) {
    if (!e.alive) continue
    const px = e.x * CELL
    const py = e.y * CELL
    if (e.kind === 'drifter') {
      ctx.fillStyle = '#ff4d5e'
      ctx.fillRect(px - 5, py - 5, 10, 10)
      ctx.fillStyle = '#7a0e1a'
      ctx.fillRect(px - 5, py + 3, 10, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - 3, py - 2, 3, 3)
      ctx.fillRect(px + 1, py - 2, 3, 3)
      ctx.fillStyle = '#0a0a20'
      ctx.fillRect(px - 2, py - 1, 1, 1)
      ctx.fillRect(px + 2, py - 1, 1, 1)
    } else if (e.kind === 'hunter') {
      // mor avcı: ok başı + tek göz
      ctx.fillStyle = '#b14dff'
      ctx.fillRect(px - 5, py - 5, 10, 10)
      ctx.fillStyle = '#3d0a5e'
      ctx.fillRect(px - 5, py - 5, 10, 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - 2, py - 1, 4, 4)
      ctx.fillStyle = '#ff0000'
      ctx.fillRect(px - 1, py, 2, 2)
      // hp pip
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#ffe14d'
        ctx.fillRect(px - 5, py - 8, 10 * (e.hp / e.maxHp), 2)
      }
    } else if (e.kind === 'gunner') {
      // turkuaz nişancı: kare + namlu
      ctx.fillStyle = '#00c8a0'
      ctx.fillRect(px - 5, py - 5, 10, 10)
      ctx.fillStyle = '#04332a'
      ctx.fillRect(px - 3, py - 3, 6, 6)
      ctx.fillStyle = '#fffa'
      ctx.fillRect(px - 1, py - 7, 2, 4)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - 3, py + 1, 2, 2)
      ctx.fillRect(px + 1, py + 1, 2, 2)
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#ffe14d'
        ctx.fillRect(px - 5, py - 8, 10 * (e.hp / e.maxHp), 2)
      }
    } else if (e.kind === 'weaver') {
      // sarı weaver: küçük elmas, hızlı
      ctx.fillStyle = '#ffe14d'
      ctx.fillRect(px - 4, py - 4, 8, 8)
      ctx.fillStyle = '#7a5b00'
      ctx.fillRect(px - 2, py - 2, 4, 4)
      ctx.fillStyle = '#000'
      ctx.fillRect(px - 1, py - 1, 2, 2)
    } else {
      // BOSS: büyük yengeç/göz
      const s = 22
      const pulse = 1 + Math.sin(time * 5) * 0.04
      ctx.save()
      ctx.translate(px, py)
      ctx.scale(pulse, pulse)
      ctx.fillStyle = '#1a0210'
      ctx.fillRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2)
      ctx.fillStyle = '#ff2fb3'
      ctx.fillRect(-s, -s, s * 2, s * 2)
      ctx.fillStyle = '#7a0e2e'
      ctx.fillRect(-s, -s, s * 2, 5)
      ctx.fillRect(-s, s - 5, s * 2, 5)
      // kıskaçlar
      ctx.fillStyle = '#ff9d00'
      ctx.fillRect(-s - 8, -10, 8, 10)
      ctx.fillRect(s, -10, 8, 10)
      ctx.fillRect(-s - 8, 4, 8, 10)
      ctx.fillRect(s, 4, 8, 10)
      // göz
      ctx.fillStyle = '#fff'
      ctx.fillRect(-9, -7, 18, 14)
      const lookX = Math.max(-3, Math.min(3, (eng.player.cx + 0.5 - e.x) * 1.2))
      const lookY = Math.max(-2, Math.min(2, (eng.player.cy + 0.5 - e.y) * 1.2))
      ctx.fillStyle = '#c00'
      ctx.fillRect(-4 + lookX, -3 + lookY, 8, 8)
      ctx.fillStyle = '#000'
      ctx.fillRect(-1 + lookX, 0 + lookY, 3, 3)
      ctx.restore()
      // boss hp bar (canvas üstü)
      const w = 120
      const bx = px - w / 2
      const by = py - 34
      ctx.fillStyle = '#000'
      ctx.fillRect(bx - 1, by - 1, w + 2, 7)
      ctx.fillStyle = '#ff2fb3'
      ctx.fillRect(bx, by, w * Math.max(0, e.hp / e.maxHp), 5)
    }
  }

  for (const b of eng.border) {
    const c = borderCellAt(b.dist)
    const px = c.cx * CELL
    const py = c.cy * CELL
    ctx.fillStyle = b.frozen > 0 ? '#4a5a8a' : '#ff9d00'
    ctx.fillRect(px - 1, py - 1, CELL + 2, CELL + 2)
    ctx.fillStyle = '#201000'
    ctx.fillRect(px + 2, py + 2, 3, 3)
    ctx.fillRect(px + 5, py + 2, 3, 3)
    ctx.fillRect(px + 2, py + 6, 6, 2)
  }

  // mermiler
  for (const m of eng.pBullets) {
    const mx = m.x * CELL
    const my = m.y * CELL
    ctx.fillStyle = '#7df3ff'
    ctx.fillRect(mx - 1, my - 4, 3, 8)
    ctx.fillStyle = '#fff'
    ctx.fillRect(mx, my - 2, 1, 4)
  }
  for (const m of eng.eBullets) {
    const mx = m.x * CELL
    const my = m.y * CELL
    const bl = Math.sin(time * 20) > 0
    ctx.fillStyle = bl ? '#ff2fb3' : '#ff7d00'
    ctx.fillRect(mx - 2, my - 2, 5, 5)
    ctx.fillStyle = '#fff'
    ctx.fillRect(mx - 1, my - 1, 2, 2)
  }

  const p = eng.player
  const ppx = p.cx * CELL + CELL / 2
  const ppy = p.cy * CELL + CELL / 2
  const flicker = p.invuln > 0 && Math.sin(time * 20) > 0
  if (!flicker) {
    ctx.fillStyle = '#00e5ff'
    ctx.fillRect(ppx - 5, ppy - 4, 10, 8)
    ctx.fillStyle = '#e8feff'
    ctx.fillRect(ppx - 2, ppy - 2, 5, 4)
    ctx.fillStyle = p.cutting ? '#ffe14d' : '#ff2fb3'
    if (p.dirX === 1) ctx.fillRect(ppx + 5, ppy - 2, 3, 4)
    if (p.dirX === -1) ctx.fillRect(ppx - 8, ppy - 2, 3, 4)
    if (p.dirY === 1) ctx.fillRect(ppx - 2, ppy + 4, 4, 3)
    if (p.dirY === -1) ctx.fillRect(ppx - 2, ppy - 7, 4, 3)
    const fl = 3 + Math.floor(Math.abs(Math.sin(time * 30)) * 3)
    ctx.fillStyle = '#ff9d00'
    if (p.dirX === 1) ctx.fillRect(ppx - 5 - fl, ppy - 1, fl, 2)
    if (p.dirX === -1) ctx.fillRect(ppx + 5, ppy - 1, fl, 2)
    if (p.dirY === 1) ctx.fillRect(ppx - 1, ppy - 4 - fl, 2, fl)
    if (p.dirY === -1) ctx.fillRect(ppx - 1, ppy + 4, 2, fl)
  }

  if (eng.phase === 'dying') {
    ctx.fillStyle = 'rgba(255,60,80,0.18)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
}
