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
  | 'victory'

export type EnemyKind = 'drifter' | 'hunter' | 'gunner' | 'weaver' | 'boss'

export interface RosterEntry {
  kind: Exclude<EnemyKind, 'boss'>
  count: number
}

export interface ObstacleRect {
  x: number
  y: number
  w: number
  h: number
}

export interface BossDef {
  hp: number
  speed: number
  name: string
}

export interface LevelDef {
  level: number
  name: string
  briefing: string
  theme: number
  targetPct: number
  roster: RosterEntry[]
  freeSpeed: number
  borderEnemies: number
  borderSpeed: number
  boss: BossDef | null
  obstacles: ObstacleRect[]
}

export interface FreeEnemy {
  kind: EnemyKind
  x: number
  y: number
  vx: number
  vy: number
  alive: boolean
  respawnIn: number
  hp: number
  maxHp: number
  fireCd: number
  stateT: number
  // boss extras
  bossName: string
  size: number
  scoreValue: number
}

export interface BorderEnemy {
  dist: number
  dir: 1 | -1
  speed: number
  frozen: number
  hp: number
  fireCd: number
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  from: 'player' | 'enemy'
  alive: boolean
  ttl: number
}

export interface Bonus {
  cx: number
  cy: number
  kind: 'points' | 'slow' | 'life'
  ttl: number
  taken: boolean
}
