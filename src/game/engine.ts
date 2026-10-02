import {
  COLS,
  ROWS,
  createGrid,
  getCell,
  idx,
  clearTrail,
  closeCut,
  filledPct,
  randomEmptyCell,
} from './grid.ts'
import { EMPTY, WALL } from './types.ts'
import type { Bonus, FreeEnemy, BorderEnemy, GamePhase, LevelDef } from './types.ts'
import { levelDef } from './levels.ts'
import { spawnFreeEnemy, updateFreeEnemy, updateBorderEnemy, makeBorderEnemy, borderCellAt } from './enemies.ts'

export interface PlayerState {
  cx: number
  cy: number
  dirX: number
  dirY: number
  wantX: number
  wantY: number
  cutting: boolean
  fast: boolean
  moveAcc: number
  invuln: number
  trailCells: number
}

export interface EngineEvents {
  onCutClose: (newlyFilled: number, pct: number, trapped: number) => void
  onDeath: (livesLeft: number) => void
  onLevelClear: (level: number, bonus: number) => void
  onGameOver: (score: number) => void
  onBonus: (kind: string, points: number) => void
}

export class Engine {
  grid: Uint8Array = createGrid()
  player: PlayerState = Engine.freshPlayer()
  free: FreeEnemy[] = []
  border: BorderEnemy[] = []
  bonuses: Bonus[] = []
  score = 0
  lives = 3
  level = 1
  def: LevelDef = levelDef(1)
  phase: GamePhase = 'title'
  pct = 0
  slowTimer = 0
  bonusTimer = 8
  dieTimer = 0
  clearTimer = 0
  time = 0
  high = 0
  events: EngineEvents | null = null

  constructor() {
    this.high = Number(localStorage.getItem('volfied-high') ?? 0) || 0
    this.resetLevel(1, false)
  }

  static freshPlayer(): PlayerState {
    return {
      cx: Math.floor(COLS / 2),
      cy: 0,
      dirX: 1,
      dirY: 0,
      wantX: 1,
      wantY: 0,
      cutting: false,
      fast: false,
      moveAcc: 0,
      invuln: 0,
      trailCells: 0,
    }
  }

  resetLevel(level: number, keepScore: boolean): void {
    this.level = level
    this.def = levelDef(level)
    this.grid = createGrid()
    this.player = Engine.freshPlayer()
    this.free = []
    for (let i = 0; i < this.def.freeEnemies; i++) {
      this.free.push(spawnFreeEnemy(this.def.freeSpeed, this.grid))
    }
    this.border = []
    for (let i = 0; i < this.def.borderEnemies; i++) {
      this.border.push(makeBorderEnemy(this.def.borderSpeed))
    }
    this.bonuses = []
    this.pct = 0
    this.slowTimer = 0
    this.bonusTimer = 7
    if (!keepScore) {
      this.score = 0
      this.lives = 3
    }
  }

  start(): void {
    this.resetLevel(1, false)
    this.phase = 'playing'
  }

  setInput(dx: number, dy: number, fast: boolean): void {
    if (dx === 0 && dy === 0) return
    this.player.wantX = dx
    this.player.wantY = dy
    this.player.fast = fast
  }

  private playerSpeed(): number {
    if (this.player.cutting) return this.player.fast ? 12 : 8.5
    return 15
  }

  update(dt: number): void {
    const d = Math.min(dt, 0.05)
    this.time += d
    if (this.phase === 'dying') {
      this.dieTimer -= d
      if (this.dieTimer <= 0) {
        if (this.lives <= 0) {
          this.phase = 'over'
          this.saveHigh()
          this.events?.onGameOver(this.score)
        } else {
          // respawn
          clearTrail(this.grid)
          this.player = Engine.freshPlayer()
          this.player.invuln = 2
          this.phase = 'playing'
        }
      }
      // enemies still drift while dying for effect
      this.updateEnemies(d)
      return
    }
    if (this.phase === 'clear') {
      this.clearTimer -= d
      if (this.clearTimer <= 0) {
        this.resetLevel(this.level + 1, true)
        this.phase = 'playing'
      }
      return
    }
    if (this.phase !== 'playing') return

    if (this.player.invuln > 0) this.player.invuln -= d
    if (this.slowTimer > 0) this.slowTimer -= d
    this.bonusTimer -= d
    if (this.bonusTimer <= 0) {
      this.bonusTimer = 10 + Math.random() * 8
      this.spawnBonus()
    }
    for (const b of this.bonuses) b.ttl -= d
    this.bonuses = this.bonuses.filter((b) => b.ttl > 0 && !b.taken)

    this.updatePlayer(d)
    this.updateEnemies(d)
    this.checkCollisions()
    this.checkBonuses()

    this.pct = filledPct(this.grid)
    if (this.pct >= this.def.targetPct) {
      const timeBonus = 500 + this.level * 250
      this.score += timeBonus
      this.saveHigh()
      this.phase = 'clear'
      this.clearTimer = 2.2
      this.events?.onLevelClear(this.level, timeBonus)
    }
  }

  updateEnemiesIdle(dt: number): void {
    const d = Math.min(dt, 0.05)
    this.updateEnemies(d)
  }

  private updatePlayer(d: number): void {
    const p = this.player
    // allow reversing / turning instantly
    if (p.wantX !== 0 || p.wantY !== 0) {
      p.dirX = p.wantX
      p.dirY = p.wantY
    }
    p.moveAcc += d * this.playerSpeed()
    while (p.moveAcc >= 1) {
      p.moveAcc -= 1
      const nx = p.cx + p.dirX
      const ny = p.cy + p.dirY
      // clamp to board; bump into wall = stay
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) break
      const curCell = getCell(this.grid, p.cx, p.cy)
      const nextCell = getCell(this.grid, nx, ny)
      void curCell

      if (!p.cutting) {
        // on wall: can walk on wall, or step into empty to start cut
        if (nextCell === WALL) {
          p.cx = nx
          p.cy = ny
        } else if (nextCell === EMPTY) {
          p.cutting = true
          p.trailCells = 0
          p.cx = nx
          p.cy = ny
          this.grid[idx(nx, ny)] = 2 // TRAIL
          p.trailCells++
        } else {
          // trail cell while not cutting: just step (shouldn't happen)
          p.cx = nx
          p.cy = ny
        }
      } else {
        // cutting
        if (nx === p.cx && ny === p.cy) break
        if (nextCell === WALL) {
          // close cut
          p.cx = nx
          p.cy = ny
          p.cutting = false
          this.finishCut()
        } else if (nextCell === EMPTY) {
          p.cx = nx
          p.cy = ny
          this.grid[idx(nx, ny)] = 2
          p.trailCells++
        } else {
          // hit own trail -> death
          this.killPlayer()
          return
        }
      }
    }
  }

  private finishCut(): void {
    const enemyCells = this.free
      .filter((e) => e.alive)
      .map((e) => ({ cx: Math.floor(e.x), cy: Math.floor(e.y) }))
    const beforePct = filledPct(this.grid)
    const res = closeCut(this.grid, enemyCells)
    const afterPct = filledPct(this.grid)
    void beforePct
    // trapped enemies: now on wall
    let trapped = 0
    for (const e of this.free) {
      if (!e.alive) continue
      const c = getCell(this.grid, Math.floor(e.x), Math.floor(e.y))
      if (c === WALL) {
        e.alive = false
        e.respawnIn = 3
        trapped++
        this.score += 1000
      }
    }
    const mult = this.player.fast ? 2 : 1
    const gained = res.newlyFilled * 10 * mult + trapped * 0 // trapped already added
    this.score += gained
    this.pct = afterPct
    this.saveHigh()
    this.events?.onCutClose(res.newlyFilled, afterPct, trapped)
  }

  private updateEnemies(d: number): void {
    const slow = this.slowTimer > 0 ? 0.35 : 1
    for (const e of this.free) {
      if (!e.alive) {
        e.respawnIn -= d
        if (e.respawnIn <= 0 && this.phase === 'playing') {
          const n = spawnFreeEnemy(this.def.freeSpeed, this.grid)
          e.x = n.x
          e.y = n.y
          e.vx = n.vx
          e.vy = n.vy
          e.alive = true
        }
        continue
      }
      updateFreeEnemy(e, d, this.grid, slow)
    }
    for (const b of this.border) updateBorderEnemy(b, d)
  }

  private checkCollisions(): void {
    const p = this.player
    if (p.invuln > 0) return
    // free enemy vs trail or player
    for (const e of this.free) {
      if (!e.alive) continue
      const ecx = Math.floor(e.x)
      const ecy = Math.floor(e.y)
      if (ecx === p.cx && ecy === p.cy) {
        this.killPlayer()
        return
      }
      // enemy touching any trail cell
      // check 3x3 around enemy for speed
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (getCell(this.grid, ecx + ox, ecy + oy) === 2) {
            // only matters if player is cutting
            if (p.cutting) {
              this.killPlayer()
              return
            }
          }
        }
      }
      // precise: enemy center on trail cell
      if (getCell(this.grid, ecx, ecy) === 2) {
        this.killPlayer()
        return
      }
    }
    // border enemy vs player (only dangerous on wall / near player)
    for (const b of this.border) {
      if (b.frozen > 0) continue
      const c = borderCellAt(b.dist)
      if (c.cx === p.cx && c.cy === p.cy) {
        this.killPlayer()
        return
      }
    }
  }

  private checkBonuses(): void {
    const p = this.player
    for (const b of this.bonuses) {
      if (b.taken) continue
      if (b.cx === p.cx && b.cy === p.cy) {
        b.taken = true
        if (b.kind === 'points') {
          this.score += 500
          this.events?.onBonus('bonus', 500)
        } else if (b.kind === 'slow') {
          this.slowTimer = 8
          this.score += 200
          this.events?.onBonus('slow', 200)
        } else {
          this.lives += 1
          this.score += 300
          this.events?.onBonus('life', 300)
        }
      } else if (getCell(this.grid, b.cx, b.cy) === WALL && !b.taken) {
        // enclosed bonus: auto-collect
        b.taken = true
        this.score += b.kind === 'life' ? 800 : 350
        this.events?.onBonus(b.kind, 350)
      }
    }
    this.bonuses = this.bonuses.filter((b) => !b.taken && b.ttl > 0)
  }

  private spawnBonus(): void {
    const cell = randomEmptyCell(this.grid, 3)
    if (!cell) return
    const r = Math.random()
    const kind: Bonus['kind'] = r < 0.6 ? 'points' : r < 0.9 ? 'slow' : 'life'
    // don't spawn on enemy
    for (const e of this.free) {
      if (!e.alive) continue
      if (Math.abs(e.x - cell.cx) < 3 && Math.abs(e.y - cell.cy) < 3) return
    }
    this.bonuses.push({ cx: cell.cx, cy: cell.cy, kind, ttl: 14, taken: false })
  }

  private killPlayer(): void {
    if (this.phase !== 'playing' || this.player.invuln > 0) return
    this.lives -= 1
    this.phase = 'dying'
    this.dieTimer = 1.4
    this.saveHigh()
    this.events?.onDeath(this.lives)
  }

  private saveHigh(): void {
    if (this.score > this.high) {
      this.high = this.score
      try {
        localStorage.setItem('volfied-high', String(this.high))
      } catch {
        // ignore
      }
    }
  }

  get slowActive(): boolean {
    return this.slowTimer > 0
  }

  get startCell(): { cx: number; cy: number } {
    return { cx: Math.floor(COLS / 2), cy: 0 }
  }

  get wallCoverage(): number {
    return this.pct
  }

  get interiorEmpty(): number {
    void EMPTY
    void WALL
    return 0
  }
}
