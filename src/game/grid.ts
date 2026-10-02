import { EMPTY, WALL, TRAIL } from './types.ts'
import type { Cell } from './types.ts'

export const COLS = 80
export const ROWS = 60

export function createGrid(): Uint8Array {
  const g = new Uint8Array(COLS * ROWS)
  // border walls, 1 cell thick
  for (let x = 0; x < COLS; x++) {
    g[x] = WALL
    g[(ROWS - 1) * COLS + x] = WALL
  }
  for (let y = 0; y < ROWS; y++) {
    g[y * COLS] = WALL
    g[y * COLS + (COLS - 1)] = WALL
  }
  return g
}

export function idx(cx: number, cy: number): number {
  return cy * COLS + cx
}

export function inBounds(cx: number, cy: number): boolean {
  return cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS
}

export function getCell(g: Uint8Array, cx: number, cy: number): Cell {
  if (!inBounds(cx, cy)) return WALL
  const v = g[idx(cx, cy)]
  if (v === WALL) return WALL
  if (v === TRAIL) return TRAIL
  return EMPTY
}

export function isWall(g: Uint8Array, cx: number, cy: number): boolean {
  return getCell(g, cx, cy) === WALL
}

export function clearTrail(g: Uint8Array): void {
  for (let i = 0; i < g.length; i++) {
    if (g[i] === TRAIL) g[i] = EMPTY
  }
}

/** Total interior cells (excluding outer border). */
export function interiorTotal(): number {
  return (COLS - 2) * (ROWS - 2)
}

export function countWalls(g: Uint8Array): number {
  let n = 0
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (g[idx(x, y)] === WALL) n++
    }
  }
  return n
}

export function filledPct(g: Uint8Array): number {
  return (countWalls(g) / interiorTotal()) * 100
}

/**
 * Close the current cut:
 * - enemies block flood (their reachable EMPTY stays empty)
 * - everything else EMPTY becomes WALL, TRAIL becomes WALL
 * Returns { filledCells, trappedCount }
 */
export function closeCut(
  g: Uint8Array,
  enemyCells: Array<{ cx: number; cy: number }>,
): { filledCells: number; newlyFilled: number } {
  const before = countWalls(g)
  const visited = new Uint8Array(COLS * ROWS)
  const stack: number[] = []

  for (const e of enemyCells) {
    if (!inBounds(e.cx, e.cy)) continue
    const i = idx(e.cx, e.cy)
    // enemy standing on wall/trail: it is trapped, don't flood from it
    if (g[i] !== EMPTY) continue
    if (!visited[i]) {
      visited[i] = 1
      stack.push(i)
    }
  }

  while (stack.length > 0) {
    const cur = stack.pop() as number
    const cx = cur % COLS
    const cy = Math.floor(cur / COLS)
    const neighbours: Array<[number, number]> = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]
    for (const [nx, ny] of neighbours) {
      if (!inBounds(nx, ny)) continue
      const ni = idx(nx, ny)
      if (visited[ni]) continue
      if (g[ni] !== EMPTY) continue
      visited[ni] = 1
      stack.push(ni)
    }
  }

  let newlyFilled = 0
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      const i = idx(x, y)
      if (g[i] === TRAIL) {
        g[i] = WALL
        newlyFilled++
      } else if (g[i] === EMPTY && !visited[i]) {
        g[i] = WALL
        newlyFilled++
      }
    }
  }

  // outer border trail edge-case: convert any remaining trail to wall
  for (let i = 0; i < g.length; i++) {
    if (g[i] === TRAIL) g[i] = WALL
  }

  return { filledCells: countWalls(g), newlyFilled: newlyFilled + (countWalls(g) - before - newlyFilled) }
}

export function randomEmptyCell(g: Uint8Array, margin = 2): { cx: number; cy: number } | null {
  for (let tries = 0; tries < 200; tries++) {
    const cx = margin + Math.floor(Math.random() * (COLS - margin * 2))
    const cy = margin + Math.floor(Math.random() * (ROWS - margin * 2))
    if (g[idx(cx, cy)] === EMPTY) return { cx, cy }
  }
  return null
}

/** Fill interior rects as WALL islands (map variety). Clamped to interior. */
export function carveObstacles(g: Uint8Array, rects: Array<{ x: number; y: number; w: number; h: number }>): void {
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < 1 || y < 1 || x >= COLS - 1 || y >= ROWS - 1) continue
        g[idx(x, y)] = WALL
      }
    }
  }
}
