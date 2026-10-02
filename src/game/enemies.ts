import { COLS, ROWS, getCell, idx } from './grid.ts'
import { EMPTY } from './types.ts'
import type { FreeEnemy, BorderEnemy } from './types.ts'

export function spawnFreeEnemy(speed: number, grid: Uint8Array): FreeEnemy {
  for (let t = 0; t < 100; t++) {
    const x = 4 + Math.random() * (COLS - 8)
    const y = 4 + Math.random() * (ROWS - 8)
    if (grid[idx(Math.floor(x), Math.floor(y))] !== EMPTY) continue
    const a = Math.random() * Math.PI * 2
    return {
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      alive: true,
      respawnIn: 0,
    }
  }
  return { x: COLS / 2, y: ROWS / 2, vx: speed, vy: speed * 0.6, alive: true, respawnIn: 0 }
}

export function updateFreeEnemy(e: FreeEnemy, dt: number, grid: Uint8Array, slowFactor: number): void {
  if (!e.alive) {
    e.respawnIn -= dt
    return
  }
  const s = slowFactor
  let nx = e.x + e.vx * s * dt
  let ny = e.y + e.vy * s * dt

  const cx = Math.floor(nx)
  const cy = Math.floor(ny)
  // bounce off walls/trail/outside-empty
  if (getCell(grid, cx, Math.floor(e.y)) !== EMPTY) {
    e.vx = -e.vx
    nx = e.x + e.vx * s * dt
  }
  if (getCell(grid, Math.floor(e.x), cy) !== EMPTY) {
    e.vy = -e.vy
    ny = e.y + e.vy * s * dt
  }
  // clamp inside
  e.x = Math.max(1.2, Math.min(COLS - 2.2, nx))
  e.y = Math.max(1.2, Math.min(ROWS - 2.2, ny))
}

export function perimeterLength(): number {
  return 2 * (COLS + ROWS) - 4
}

/** Convert border distance -> cell coords on outer ring. */
export function borderCellAt(dist: number): { cx: number; cy: number } {
  const per = perimeterLength()
  let d = ((dist % per) + per) % per
  // top row left->right
  if (d < COLS) return { cx: Math.floor(d), cy: 0 }
  d -= COLS
  // right col top+1 -> bottom-1
  if (d < ROWS - 1) return { cx: COLS - 1, cy: 1 + Math.floor(d) }
  d -= ROWS - 1
  // bottom row right->left
  if (d < COLS) return { cx: COLS - 1 - Math.floor(d), cy: ROWS - 1 }
  d -= COLS
  // left col bottom-1 -> top+1
  return { cx: 0, cy: ROWS - 2 - Math.floor(d) }
}

export function updateBorderEnemy(b: BorderEnemy, dt: number): void {
  if (b.frozen > 0) {
    b.frozen -= dt
    return
  }
  b.dist += b.dir * b.speed * dt
}

export function makeBorderEnemy(speed: number): BorderEnemy {
  return {
    dist: Math.random() * perimeterLength(),
    dir: Math.random() < 0.5 ? 1 : -1,
    speed,
    frozen: 0,
  }
}
