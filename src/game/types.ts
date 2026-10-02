export const EMPTY = 0 as const
export const WALL = 1 as const
export const TRAIL = 2 as const

export type Cell = typeof EMPTY | typeof WALL | typeof TRAIL

export type Vec = { x: number; y: number }

export type GamePhase =
  | 'title'
  | 'playing'
  | 'paused'
  | 'dying'
  | 'clear'
  | 'over'

export interface LevelDef {
  level: number
  targetPct: number
  freeEnemies: number
  freeSpeed: number
  borderEnemies: number
  borderSpeed: number
}

export interface FreeEnemy {
  // cell-space float position
  x: number
  y: number
  vx: number
  vy: number
  alive: boolean
  respawnIn: number
}

export interface BorderEnemy {
  // distance along outer perimeter in cells
  dist: number
  dir: 1 | -1
  speed: number
  frozen: number
}

export interface Bonus {
  cx: number
  cy: number
  kind: 'points' | 'slow' | 'life'
  ttl: number
  taken: boolean
}
