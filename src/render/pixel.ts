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

export function drawGame(ctx: CanvasRenderingContext2D, eng: Engine, time: number): void {
  ctx.fillStyle = '#02040f'
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // starfield
  for (const st of stars) {
    const a = 0.25 + 0.35 * Math.abs(Math.sin(time * 0.9 + st.tw))
    ctx.fillStyle = `rgba(150,190,255,${a.toFixed(3)})`
    ctx.fillRect(st.x, st.y, st.s, st.s)
  }

  // cells
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const v = eng.grid[cy * COLS + cx]
      const px = cx * CELL
      const py = cy * CELL
      if (v === 1) {
        // wall: neon block with checker pixel shading
        const checker = (cx + cy) % 2 === 0
        ctx.fillStyle = checker ? '#1236d6' : '#0e2bb0'
        ctx.fillRect(px, py, CELL, CELL)
        ctx.fillStyle = '#00e5ff'
        ctx.fillRect(px, py, CELL, 1)
        ctx.fillRect(px, py, 1, CELL)
        if (cx === 0 || cy === 0 || cx === COLS - 1 || cy === ROWS - 1) {
          ctx.fillStyle = '#5df3ff'
          ctx.fillRect(px, py + CELL - 1, CELL, 1)
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

  // bonuses
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

  // free enemies: pixel balls with eyes
  for (const e of eng.free) {
    if (!e.alive) continue
    const px = e.x * CELL
    const py = e.y * CELL
    ctx.fillStyle = '#ff4d5e'
    ctx.fillRect(px - 5, py - 5, 10, 10)
    ctx.fillStyle = '#7a0e1a'
    ctx.fillRect(px - 5, py + 3, 10, 2)
    ctx.fillRect(px - 5, py - 5, 2, 10)
    ctx.fillStyle = '#fff'
    ctx.fillRect(px - 3, py - 2, 3, 3)
    ctx.fillRect(px + 1, py - 2, 3, 3)
    ctx.fillStyle = '#0a0a20'
    ctx.fillRect(px - 2, py - 1, 1, 1)
    ctx.fillRect(px + 2, py - 1, 1, 1)
  }

  // border enemies
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

  // player ship
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
    // direction nose
    if (p.dirX === 1) ctx.fillRect(ppx + 5, ppy - 2, 3, 4)
    if (p.dirX === -1) ctx.fillRect(ppx - 8, ppy - 2, 3, 4)
    if (p.dirY === 1) ctx.fillRect(ppx - 2, ppy + 4, 4, 3)
    if (p.dirY === -1) ctx.fillRect(ppx - 2, ppy - 7, 4, 3)
    // engine flame
    const fl = 3 + Math.floor(Math.abs(Math.sin(time * 30)) * 3)
    ctx.fillStyle = '#ff9d00'
    if (p.dirX === 1) ctx.fillRect(ppx - 5 - fl, ppy - 1, fl, 2)
    if (p.dirX === -1) ctx.fillRect(ppx + 5, ppy - 1, fl, 2)
    if (p.dirY === 1) ctx.fillRect(ppx - 1, ppy - 4 - fl, 2, fl)
    if (p.dirY === -1) ctx.fillRect(ppx - 1, ppy + 4, 2, fl)
  }

  // dying flash
  if (eng.phase === 'dying') {
    ctx.fillStyle = 'rgba(255,60,80,0.18)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
  }
}
