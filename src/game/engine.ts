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
  carveObstacles,
} from './grid.ts'
import { EMPTY, WALL } from './types.ts'
import type { Bonus, FreeEnemy, BorderEnemy, Bullet, GamePhase, LevelDef } from './types.ts'
import { levelDef, TOTAL_STAGES } from './levels.ts'
import { spawnEnemy, updateFreeEnemy, updateBorderEnemy, borderCellAt } from './enemies.ts'

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
  shootCd: number
}

export interface EngineEvents {
  onCutClose: (newlyFilled: number, pct: number, trapped: number) => void
  onDeath: (livesLeft: number) => void
  onLevelClear: (level: number, bonus: number) => void
  onGameOver: (score: number) => void
  onBonus: (kind: string, points: number) => void
  onPlayerShoot: () => void
  onEnemyKilled: (kind: string, points: number) => void
  onBossDown: (name: string) => void
  onVictory: (score: number) => void
}

const PLAYER_BULLET_SPEED = 42
const SHOOT_CD = 0.26

export class Engine {
  grid: Uint8Array = createGrid()
  player: PlayerState = Engine.freshPlayer()
  free: FreeEnemy[] = []
  border: BorderEnemy[] = []
  bonuses: Bonus[] = []
  pBullets: Bullet[] = []
  eBullets: Bullet[] = []
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
  bossDown = false
  events: EngineEvents | null = null

  constructor() {
    try {
      this.high = Number(localStorage.getItem('volfied-high') ?? 0) || 0
    } catch {
      this.high = 0
    }
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
      shootCd: 0,
    }
  }

  resetLevel(level: number, keepScore: boolean): void {
    this.level = level
    this.def = levelDef(level)
    this.grid = createGrid()
    carveObstacles(this.grid, this.def.obstacles)
    this.player = Engine.freshPlayer()
    this.free = []
    for (const r of this.def.roster) {
      for (let i = 0; i < r.count; i++) {
        this.free.push(spawnEnemy(r.kind, this.def.freeSpeed, this.grid))
      }
    }
    if (this.def.boss) {
      const b = spawnEnemy('boss', this.def.boss.speed, this.grid, this.def.boss.hp, this.def.boss.name)
      this.free.push(b)
    }
    this.border = []
    for (let i = 0; i < this.def.borderEnemies; i++) {
      const { makeBorderEnemy } = borderFactory()
      this.border.push(makeBorderEnemy(this.def.borderSpeed))
    }
    this.bonuses = []
    this.pBullets = []
    this.eBullets = []
    this.pct = filledPct(this.grid)
    this.slowTimer = 0
    this.bonusTimer = 7
    this.bossDown = false
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

  /** Ateş: en yakın düşmana aim-assist, yoksa bakış yönü. */
  tryShoot(): void {
    if (this.phase !== 'playing') return
    const p = this.player
    if (p.shootCd > 0) return
    p.shootCd = SHOOT_CD
    const px = p.cx + 0.5
    const py = p.cy + 0.5
    // en yakın canlı düşman
    let best: FreeEnemy | null = null
    let bestD = 28 * 28
    for (const e of this.free) {
      if (!e.alive) continue
      const d = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    let dx: number
    let dy: number
    if (best) {
      const b = best as FreeEnemy
      const len = Math.hypot(b.x - px, b.y - py) || 1
      dx = (b.x - px) / len
      dy = (b.y - py) / len
    } else {
      dx = p.dirX
      dy = p.dirY
    }
    this.pBullets.push({
      x: px, y: py,
      vx: dx * PLAYER_BULLET_SPEED,
      vy: dy * PLAYER_BULLET_SPEED,
      from: 'player', alive: true, ttl: 1.6,
    })
    this.events?.onPlayerShoot()
  }

  boss(): FreeEnemy | null {
    for (const e of this.free) {
      if (e.kind === 'boss' && e.alive) return e
    }
    return null
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
      this.updateBullets(d)
      this.updateEnemies(d, false)
      if (this.dieTimer <= 0) {
        if (this.lives <= 0) {
          this.phase = 'over'
          this.saveHigh()
          this.events?.onGameOver(this.score)
        } else {
          clearTrail(this.grid)
          this.player = Engine.freshPlayer()
          this.player.invuln = 2
          this.eBullets = []
          this.phase = 'playing'
        }
      }
      return
    }
    if (this.phase === 'clear') {
      this.clearTimer -= d
      this.updateBullets(d)
      if (this.clearTimer <= 0) {
        if (this.level >= TOTAL_STAGES) {
          this.phase = 'victory'
          this.saveHigh()
          this.events?.onVictory(this.score)
        } else {
          this.resetLevel(this.level + 1, true)
          this.phase = 'playing'
        }
      }
      return
    }
    if (this.phase !== 'playing') return

    if (this.player.invuln > 0) this.player.invuln -= d
    if (this.player.shootCd > 0) this.player.shootCd -= d
    if (this.slowTimer > 0) this.slowTimer -= d
    this.bonusTimer -= d
    if (this.bonusTimer <= 0) {
      this.bonusTimer = 10 + Math.random() * 8
      this.spawnBonus()
    }
    for (const b of this.bonuses) b.ttl -= d
    this.bonuses = this.bonuses.filter((b) => b.ttl > 0 && !b.taken)

    this.updatePlayer(d)
    this.updateEnemies(d, true)
    this.updateBullets(d)
    this.checkCollisions()
    this.checkBonuses()

    this.pct = filledPct(this.grid)
    const bossDead = this.def.boss !== null && this.bossGone()
    if (this.pct >= this.def.targetPct || bossDead) {
      const timeBonus = 500 + this.level * 250 + (bossDead ? 2000 : 0)
      this.score += timeBonus
      this.saveHigh()
      this.phase = 'clear'
      this.clearTimer = 2.2
      this.events?.onLevelClear(this.level, timeBonus)
    }
  }

  private bossGone(): boolean {
    if (!this.def.boss) return false
    // boss öldüyse (alive=false ve bossDown bayrağı)
    return this.bossDown
  }

  updateEnemiesIdle(dt: number): void {
    const d = Math.min(dt, 0.05)
    this.updateEnemies(d, false)
    this.updateBullets(d)
  }

  private spawnEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    if (this.eBullets.length > 60) return
    this.eBullets.push({ x, y, vx, vy, from: 'enemy', alive: true, ttl: 4 })
  }

  private updateEnemies(d: number, canFire: boolean): void {
    const slow = this.slowTimer > 0 ? 0.35 : 1
    const env = {
      px: this.player.cx + 0.5,
      py: this.player.cy + 0.5,
      playerCutting: this.player.cutting,
      slow,
      time: this.time,
      spawnEnemyBullet: (x: number, y: number, vx: number, vy: number) => {
        if (canFire) this.spawnEnemyBullet(x, y, vx, vy)
      },
      trail: this.grid,
    }
    for (const e of this.free) {
      if (!e.alive) {
        if (e.kind === 'boss') continue // boss dirilmez
        e.respawnIn -= d
        if (e.respawnIn <= 0 && this.phase === 'playing') {
          const n = spawnEnemy(e.kind, this.def.freeSpeed, this.grid)
          e.x = n.x
          e.y = n.y
          e.vx = n.vx
          e.vy = n.vy
          e.hp = n.hp
          e.maxHp = n.maxHp
          e.alive = true
          e.fireCd = 2
        }
        continue
      }
      updateFreeEnemy(e, d, this.grid, env, e.kind === 'boss' ? (this.def.boss?.speed ?? 9) : this.def.freeSpeed)
    }
    // hafif ayrışma: üst üste binmesinler
    for (let i = 0; i < this.free.length; i++) {
      const a = this.free[i]
      if (!a || !a.alive) continue
      for (let j = i + 1; j < this.free.length; j++) {
        const b = this.free[j]
        if (!b || !b.alive) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dd = Math.hypot(dx, dy)
        if (dd < 1.2 && dd > 0.001) {
          const push = ((1.2 - dd) / 2) * 0.5
          const nx = dx / dd
          const ny = dy / dd
          a.x -= nx * push
          a.y -= ny * push
          b.x += nx * push
          b.y += ny * push
        }
      }
    }
    const benv = {
      px: this.player.cx + 0.5,
      py: this.player.cy + 0.5,
      spawn: (x: number, y: number, vx: number, vy: number) => {
        if (canFire) this.spawnEnemyBullet(x, y, vx, vy)
      },
    }
    for (const b of this.border) updateBorderEnemy(b, d, benv)
  }

  private updateBullets(d: number): void {
    for (const b of this.pBullets) {
      if (!b.alive) continue
      b.ttl -= d
      b.x += b.vx * d
      b.y += b.vy * d
      const cx = Math.floor(b.x)
      const cy = Math.floor(b.y)
      if (b.ttl <= 0 || getCell(this.grid, cx, cy) === WALL) {
        b.alive = false
        continue
      }
      // düşmana çarpma
      for (const e of this.free) {
        if (!e.alive) continue
        const r = e.kind === 'boss' ? 2.2 : 0.9
        if (Math.abs(e.x - b.x) < r && Math.abs(e.y - b.y) < r) {
          b.alive = false
          this.damageEnemy(e, 1)
          break
        }
      }
      if (!b.alive) continue
      // duvar devriyesine çarpma
      for (const bd of this.border) {
        const c = borderCellAt(bd.dist)
        if (Math.abs(c.cx + 0.5 - b.x) < 0.9 && Math.abs(c.cy + 0.5 - b.y) < 0.9) {
          b.alive = false
          bd.hp -= 1
          if (bd.hp <= 0) {
            this.score += 300
            bd.hp = 2
            bd.frozen = 5
            this.events?.onEnemyKilled('border', 300)
          }
          break
        }
      }
    }
    for (const b of this.eBullets) {
      if (!b.alive) continue
      b.ttl -= d
      b.x += b.vx * d
      b.y += b.vy * d
      const cx = Math.floor(b.x)
      const cy = Math.floor(b.y)
      if (b.ttl <= 0 || getCell(this.grid, cx, cy) === WALL) {
        b.alive = false
        continue
      }
      // oyuncuya çarpma
      const p = this.player
      if (p.invuln <= 0 && this.phase === 'playing') {
        if (Math.abs(p.cx + 0.5 - b.x) < 0.8 && Math.abs(p.cy + 0.5 - b.y) < 0.8) {
          b.alive = false
          this.killPlayer()
        }
      }
    }
    this.pBullets = this.pBullets.filter((b) => b.alive)
    this.eBullets = this.eBullets.filter((b) => b.alive)
  }

  private damageEnemy(e: FreeEnemy, dmg: number): void {
    e.hp -= dmg
    if (e.hp <= 0) {
      e.alive = false
      if (e.kind === 'boss') {
        this.bossDown = true
        this.score += e.scoreValue
        this.saveHigh()
        this.events?.onBossDown(e.bossName)
        this.events?.onEnemyKilled('boss', e.scoreValue)
      } else {
        e.respawnIn = 4
        this.score += e.scoreValue
        this.saveHigh()
        this.events?.onEnemyKilled(e.kind, e.scoreValue)
      }
    }
  }

  private updatePlayer(d: number): void {
    const p = this.player
    if (p.wantX !== 0 || p.wantY !== 0) {
      p.dirX = p.wantX
      p.dirY = p.wantY
    }
    p.moveAcc += d * this.playerSpeed()
    while (p.moveAcc >= 1) {
      p.moveAcc -= 1
      const nx = p.cx + p.dirX
      const ny = p.cy + p.dirY
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) break
      const nextCell = getCell(this.grid, nx, ny)

      if (!p.cutting) {
        if (nextCell === WALL) {
          p.cx = nx
          p.cy = ny
        } else if (nextCell === EMPTY) {
          p.cutting = true
          p.trailCells = 0
          p.cx = nx
          p.cy = ny
          this.grid[idx(nx, ny)] = 2
          p.trailCells++
        } else {
          p.cx = nx
          p.cy = ny
        }
      } else {
        if (nextCell === WALL) {
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
    const res = closeCut(this.grid, enemyCells)
    const afterPct = filledPct(this.grid)
    let trapped = 0
    for (const e of this.free) {
      if (!e.alive) continue
      const c = getCell(this.grid, Math.floor(e.x), Math.floor(e.y))
      if (c === WALL) {
        if (e.kind === 'boss') {
          // boss tuzağa düştü: ağır hasar
          this.damageEnemy(e, 12)
          trapped++
        } else {
          e.alive = false
          e.respawnIn = 4
          trapped++
          this.score += 1000
        }
      }
    }
    const mult = this.player.fast ? 2 : 1
    this.score += res.newlyFilled * 10 * mult
    this.pct = afterPct
    this.saveHigh()
    this.events?.onCutClose(res.newlyFilled, afterPct, trapped)
  }

  private checkCollisions(): void {
    const p = this.player
    if (p.invuln > 0) return
    for (const e of this.free) {
      if (!e.alive) continue
      const r = e.kind === 'boss' ? 2.0 : 0.9
      const dx = e.x - (p.cx + 0.5)
      const dy = e.y - (p.cy + 0.5)
      if (Math.abs(dx) < r && Math.abs(dy) < r) {
        this.killPlayer()
        return
      }
      // düşman iz üzerindeyse ve oyuncu kesimdeyse ölüm
      const ecx = Math.floor(e.x)
      const ecy = Math.floor(e.y)
      if (p.cutting) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            if (getCell(this.grid, ecx + ox, ecy + oy) === 2) {
              this.killPlayer()
              return
            }
          }
        }
      }
    }
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
    const kind = r < 0.6 ? 'points' : r < 0.9 ? 'slow' : 'life'
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
}

// border factory (döngüsel import'u önlemek için lokal)
import { makeBorderEnemy } from './enemies.ts'
function borderFactory(): { makeBorderEnemy: typeof makeBorderEnemy } {
  return { makeBorderEnemy }
}
