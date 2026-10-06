// Oyun motoru: oyuncu, kesim/kapatma, boss, düşmanlar, güçlendirmeler, stage akışı ve çizim.
import { Field, FW, FH, EMPTY, CLAIMED, TRAIL } from './field.ts'
import { STAGES, DIFFS, STAGE_COUNT } from './stages.ts'
import type { Ability, Difficulty, StageDef } from './stages.ts'
import { Rng } from '../core/rng.ts'
import { DIRS } from '../core/input.ts'
import type { Input, Action } from '../core/input.ts'
import { audio, makeSong } from '../core/audio.ts'
import type { Save } from '../core/storage.ts'
import { writeSave } from '../core/storage.ts'
import { getPicture } from '../gfx/pictures.ts'
import { C, mix, bayer, css } from '../gfx/pix.ts'
import type { Col } from '../gfx/pix.ts'
import { drawText } from '../gfx/font.ts'
import { shipFrames, shipShield, minionFrames, sparkFrames, boxFrames, makeBoss } from '../gfx/sprites.ts'
import type { BossArt, MinionKind } from '../gfx/sprites.ts'

export const SCREEN_W = 320
export const SCREEN_H = 240
export const OX = 10
export const OY = 21

const PLAYER_SPEED = 64
const FUSE_DELAY = 0.6
const FUSE_SPEED = 45

type GState = 'intro' | 'play' | 'dying' | 'clear' | 'gameover' | 'ending'
type PowerKind = 'speed' | 'laser' | 'freeze' | 'shield' | 'slow' | 'life' | 'bonus'

const POWER_INFO: Record<PowerKind, { label: string; color: string; dur: number; weight: number }> = {
  speed: { label: 'HIZ', color: '#3af0ff', dur: 12, weight: 2 },
  laser: { label: 'LAZER', color: '#ff3af0', dur: 12, weight: 2.2 },
  freeze: { label: 'DONDUR', color: '#9ad8ff', dur: 6, weight: 1.6 },
  shield: { label: 'KALKAN', color: '#ffe03a', dur: 10, weight: 1.8 },
  slow: { label: 'YAVAŞLAT', color: '#7aff8a', dur: 10, weight: 1.5 },
  life: { label: '+1 CAN', color: '#ff5a7a', dur: 0, weight: 0.7 },
  bonus: { label: '+5000', color: '#ffb030', dur: 0, weight: 1.8 },
}
const TIMED: PowerKind[] = ['speed', 'laser', 'freeze', 'shield', 'slow']

interface Body {
  x: number
  y: number
  dx: number
  dy: number
  r: number
  stuck: number
}

interface Boss extends Body {
  speed: number
  hp: number
  maxHp: number
  art: BossArt
  abil: Ability[]
  abilIdx: number
  shootT: number
  dashT: number
  dashing: number
  spiral: number
  spiralA: number
  flash: number
  alive: boolean
  anim: number
}

interface Mob extends Body {
  kind: MinionKind
  speed: number
  t: number
  shootT: number
  target: number
}

interface Spark {
  x: number
  y: number
  dx: number
  dy: number
  acc: number
  speed: number
  hand: 1 | -1
}

interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  friendly: boolean
  life: number
}

interface BoxItem {
  x: number
  y: number
  kind: PowerKind
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  col: string
}

interface Popup {
  x: number
  y: number
  text: string
  col: string
  life: number
}

export interface GameHost {
  save: Save
  exitToTitle(): void
}

export class Game {
  readonly diffIdx: number
  readonly diff: Difficulty
  stageIdx: number
  stage!: StageDef
  score = 0
  lives: number
  nextLifeAt = 100000
  state: GState = 'intro'
  paused = false
  stateT = 0
  time = 0
  timeLeft = 0
  enraged = false

  readonly field = new Field()
  private pic!: Uint32Array
  private cover = new Uint32Array(32 * 32)
  private edgeA: Col = 0
  private edgeB: Col = 0
  private trailA: Col = C('#ffffff')
  private trailB: Col = C('#ff3af0')
  private readonly fieldCanvas: HTMLCanvasElement
  private readonly fieldCtx: CanvasRenderingContext2D
  private readonly fieldImg: ImageData
  private readonly fieldBuf: Uint32Array
  private flashLeft = 0

  // oyuncu
  px = 0
  py = 0
  drawing = false
  trail: number[] = []
  sx = 0
  sy = 0
  acc = 0
  facing: [number, number] = [0, -1]
  still = 0
  fuse = 0
  invuln = 0
  slowCut = true
  fireCd = 0

  boss!: Boss
  mobs: Mob[] = []
  sparks: Spark[] = []
  bullets: Bullet[] = []
  boxes: BoxItem[] = []
  particles: Particle[] = []
  popups: Popup[] = []
  power: Record<string, number> = {}
  shake = 0

  private rng = new Rng(Date.now() & 0xffffffff)
  private tally: [string, number][] = []
  private clearScore = 0
  private bossKilled = false
  private finalPct = 0
  private continueT = 0

  private host: GameHost

  constructor(host: GameHost, diffIdx: number, startStage: number) {
    this.host = host
    this.diffIdx = diffIdx
    this.diff = DIFFS[diffIdx]
    this.lives = this.diff.lives
    this.stageIdx = startStage
    this.fieldCanvas = document.createElement('canvas')
    this.fieldCanvas.width = FW
    this.fieldCanvas.height = FH
    this.fieldCtx = this.fieldCanvas.getContext('2d')!
    this.fieldImg = this.fieldCtx.createImageData(FW, FH)
    this.fieldBuf = new Uint32Array(this.fieldImg.data.buffer)
    this.loadStage(startStage)
  }

  // ---------------- stage kurulumu ----------------

  loadStage(idx: number): void {
    this.stageIdx = idx
    const st = (this.stage = STAGES[idx])
    const d = this.diff
    this.field.reset()
    this.pic = getPicture(st.pic).d
    this.buildCover(st.hue)
    this.edgeA = mix(C(st.hue), C('#ffffff'), 0.55)
    this.edgeB = C('#ffffff')
    this.trailB = C(st.hue)
    this.state = 'intro'
    this.stateT = 0
    this.timeLeft = Math.round(st.time * d.timeMul)
    this.enraged = false
    this.bossKilled = false
    this.drawing = false
    this.trail = []
    this.px = Math.floor(FW / 2)
    this.py = FH - 1
    this.facing = [0, -1]
    this.acc = 0
    this.fuse = 0
    this.still = 0
    this.invuln = 0
    this.power = {}
    this.bullets = []
    this.particles = []
    this.popups = []
    this.mobs = []
    this.sparks = []
    this.boxes = []
    this.flashLeft = 0

    const b = st.boss
    const art = makeBoss(7919 * (idx + 1) + 17, b.size, { body: b.body, accent: b.accent, eye: b.eye })
    const a = this.rng.range(0, Math.PI * 2)
    const hp = 24 + idx * 3
    this.boss = {
      x: FW / 2,
      y: FH / 2 - 10,
      dx: Math.cos(a),
      dy: Math.sin(a),
      r: Math.floor(b.size * 0.38),
      stuck: 0,
      speed: b.speed,
      hp,
      maxHp: hp,
      art,
      abil: b.abil,
      abilIdx: 0,
      shootT: 3,
      dashT: 4,
      dashing: 0,
      spiral: 0,
      spiralA: 0,
      flash: 0,
      alive: true,
      anim: 0,
    }

    for (const [kind, n] of Object.entries(st.minions) as [MinionKind, number][]) {
      const count = Math.max(kind === 'bouncer' ? 1 : 0, Math.round(n * d.minionMul))
      for (let i = 0; i < count; i++) this.spawnMob(kind)
    }
    const sparks = Math.max(0, st.sparks + d.sparkAdd)
    for (let i = 0; i < sparks; i++) {
      const left = i % 2 === 0
      this.sparks.push({ x: left ? 0 : FW - 1, y: 0, dx: left ? 1 : -1, dy: 0, acc: 0, speed: 34 + idx * 0.8, hand: left ? 1 : -1 })
    }
    const boxes = Math.max(2, st.boxes + d.boxAdd)
    for (let i = 0; i < boxes; i++) {
      const pos = this.field.randomEmpty(
        () => this.rng.next(),
        (x, y) => Math.hypot(x - this.boss.x, y - this.boss.y) > 30 && this.boxes.every((bx) => Math.hypot(bx.x - x, bx.y - y) > 30),
        12,
      )
      if (pos) this.boxes.push({ x: pos[0], y: pos[1], kind: this.rollPower() })
    }
    audio.music(makeSong(idx * 977 + 31, { bpm: 120 + Math.min(30, idx * 1.5) }))
  }

  private buildCover(hue: string): void {
    const base = C(hue)
    const bg0 = mix(base, C('#000000'), 0.9)
    const bg1 = mix(base, C('#000000'), 0.82)
    const line = mix(base, C('#000000'), 0.62)
    const dot = mix(base, C('#000000'), 0.4)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        let c = bayer(x, y) < 0.35 ? bg1 : bg0
        if ((x + y) % 16 === 0 || (x - y + 32) % 16 === 0) c = line
        if ((x % 16 === 8 && y % 16 === 0) || (x % 16 === 0 && y % 16 === 8)) c = dot
        this.cover[x + y * 32] = c
      }
  }

  private rollPower(): PowerKind {
    const kinds = Object.keys(POWER_INFO) as PowerKind[]
    const total = kinds.reduce((s, k) => s + POWER_INFO[k].weight, 0)
    let v = this.rng.next() * total
    for (const k of kinds) {
      v -= POWER_INFO[k].weight
      if (v <= 0) return k
    }
    return 'bonus'
  }

  private spawnMob(kind: MinionKind, at?: [number, number]): void {
    const pos =
      at ??
      this.field.randomEmpty(
        () => this.rng.next(),
        (x, y) => Math.hypot(x - this.boss.x, y - this.boss.y) > 25 && Math.hypot(x - this.px, y - this.py) > 50,
        10,
      )
    if (!pos) return
    const a = this.rng.range(0, Math.PI * 2)
    const speeds: Record<MinionKind, number> = { bouncer: 46, wander: 34, chaser: 40, shooter: 30, seeker: 42 }
    this.mobs.push({
      kind,
      x: pos[0] + 0.5,
      y: pos[1] + 0.5,
      dx: Math.cos(a),
      dy: Math.sin(a),
      r: 3,
      stuck: 0,
      speed: speeds[kind] * (1 + this.stageIdx * 0.012),
      t: this.rng.range(0, 2),
      shootT: this.rng.range(1.5, 3.5),
      target: -1,
    })
  }

  // ---------------- güncelleme ----------------

  update(dt: number, input: Input, actions: Action[]): void {
    this.time += dt
    this.stateT += dt
    if (this.state === 'play' && actions.includes('pause')) this.paused = !this.paused
    if (this.paused) {
      if (actions.includes('confirm')) this.paused = false
      if (actions.includes('back')) {
        this.paused = false
        this.host.exitToTitle()
      }
      return
    }
    if (this.state === 'play' && actions.includes('back')) {
      this.paused = true
      return
    }
    this.shake = Math.max(0, this.shake - dt * 12)
    this.updateParticles(dt)
    this.updateFlash(dt)

    switch (this.state) {
      case 'intro':
        if (this.stateT > 3.2 || (this.stateT > 0.4 && (actions.includes('confirm') || actions.includes('fire')))) {
          this.state = 'play'
          this.stateT = 0
          this.invuln = 1.5
        }
        return
      case 'play':
        this.updatePlay(dt, input)
        return
      case 'dying':
        if (this.stateT > 1.4) {
          if (this.lives <= 0) {
            this.state = 'gameover'
            this.stateT = 0
            this.continueT = 10
            this.recordScore()
            audio.music(null)
            audio.play('gameover')
          } else {
            this.state = 'play'
            this.stateT = 0
            this.invuln = 2.5
          }
        }
        return
      case 'clear':
        if (this.stateT > 2.6 && (actions.includes('confirm') || actions.includes('fire'))) this.nextStage()
        return
      case 'gameover':
        this.continueT -= dt
        if (actions.includes('confirm') && this.stateT > 0.8) {
          this.score = 0
          this.nextLifeAt = 100000
          this.lives = this.diff.lives
          this.loadStage(this.stageIdx)
        } else if (actions.includes('back') || this.continueT <= 0) this.host.exitToTitle()
        return
      case 'ending':
        if (this.stateT > 3 && (actions.includes('confirm') || actions.includes('back'))) this.host.exitToTitle()
        return
    }
  }

  private updatePlay(dt: number, input: Input): void {
    for (const k of TIMED) if (this.power[k] > 0) this.power[k] = Math.max(0, this.power[k] - dt)
    this.timeLeft -= dt
    if (this.timeLeft <= 0 && !this.enraged) {
      this.enraged = true
      this.timeLeft = 0
      this.popup(FW / 2, FH / 2, 'ACELE ET! BOSS ÖFKELİ', '#ff3a3a', 2)
      audio.play('warn')
    }
    this.invuln = Math.max(0, this.invuln - dt)
    this.updatePlayer(dt, input)
    if (this.state !== 'play') return
    const frozen = this.power.freeze > 0
    const espeed = this.diff.enemySpeed * (this.power.slow > 0 ? 0.5 : 1)
    if (!frozen) {
      this.updateBoss(dt, espeed)
      for (const m of this.mobs) this.updateMob(m, dt, espeed)
      for (const s of this.sparks) this.updateSpark(s, dt, espeed)
    }
    this.boss.flash = Math.max(0, this.boss.flash - dt)
    this.updateBullets(dt, frozen)
    if (this.state !== 'play') return
    this.checkHits(frozen)
  }

  private updatePlayer(dt: number, input: Input): void {
    const d = input.dir()
    let speed = PLAYER_SPEED * (this.power.speed > 0 ? 1.6 : 1)
    const slow = this.drawing && input.slowHeld
    if (slow) speed *= 0.5
    let moved = false
    if (d) {
      const [dx, dy] = DIRS[d]
      this.facing = [dx, dy]
      this.acc += speed * dt
      let guard = 0
      while (this.acc >= 1 && guard++ < 6) {
        this.acc -= 1
        const wasDrawing = this.drawing
        if (this.stepPlayer(dx, dy)) {
          moved = true
          if (wasDrawing && this.drawing && !input.slowHeld) this.slowCut = false
          if (!this.drawing || this.state !== 'play') break
        } else {
          this.acc = 0
          break
        }
      }
    } else this.acc = 0

    if (this.drawing) {
      if (moved) {
        this.still = 0
        this.fuse = Math.max(0, this.fuse - FUSE_SPEED * 2 * dt)
      } else {
        this.still += dt
        if (this.still > FUSE_DELAY) {
          this.fuse += FUSE_SPEED * dt
          if (Math.floor(this.time * 20) % 2 === 0) audio.play('fuse')
          if (this.fuse >= this.trail.length) this.killPlayer()
        }
      }
    }

    // lazer
    this.fireCd = Math.max(0, this.fireCd - dt)
    if (this.power.laser > 0 && input.isHeld('fire') && this.fireCd <= 0) {
      this.fireCd = 0.11
      const [fx, fy] = this.facing
      const sp = 230
      this.bullets.push({ x: this.px + 0.5, y: this.py + 0.5, vx: fx * sp, vy: fy * sp, friendly: true, life: 1.2 })
      audio.play('laser')
    }
  }

  /** Oyuncuyu bir hücre hareket ettirir. Hareket edebildiyse true. */
  private stepPlayer(dx: number, dy: number): boolean {
    const nx = this.px + dx
    const ny = this.py + dy
    const f = this.field
    if (!f.inside(nx, ny)) return false
    const i = nx + ny * FW
    const c = f.cells[i]
    if (!this.drawing) {
      if (c === CLAIMED) {
        if (!f.edge[i]) return false
        this.px = nx
        this.py = ny
        return true
      }
      if (c === EMPTY) {
        this.drawing = true
        this.sx = this.px
        this.sy = this.py
        this.trail = [i]
        this.slowCut = true
        this.fuse = 0
        this.still = 0
        f.cells[i] = TRAIL
        this.px = nx
        this.py = ny
        audio.play('cut')
        return true
      }
      return false
    }
    if (c === TRAIL) return false
    if (c === EMPTY) {
      f.cells[i] = TRAIL
      this.trail.push(i)
      this.px = nx
      this.py = ny
      return true
    }
    this.px = nx
    this.py = ny
    this.closeTrail()
    return true
  }

  private closeTrail(): void {
    const f = this.field
    const b = this.boss
    const seeds: number[] = []
    for (let y = Math.floor(b.y - b.r); y <= b.y + b.r; y += 2)
      for (let x = Math.floor(b.x - b.r); x <= b.x + b.r; x += 2) if (f.inside(x, y)) seeds.push(x + y * FW)
    const before = f.percent()
    const gained = f.capture(this.trail, seeds)
    this.flashLeft = 1
    const slowBonus = this.slowCut && this.trail.length > 8
    this.drawing = false
    this.trail = []
    this.fuse = 0
    this.still = 0
    const gainPct = f.percent() - before
    let pts = gained * (slowBonus ? 2 : 1)
    const big = gainPct >= 15
    if (big) pts *= 2
    this.addScore(pts)
    let label = '+' + Math.round(pts * this.diff.scoreMul)
    if (slowBonus) label += ' X2'
    this.popup(this.px, this.py - 6, label, slowBonus ? '#7aff8a' : '#ffffff', 1.2)
    if (big) {
      this.popup(this.px, this.py - 16, 'BÜYÜK KESİM!', '#ffe03a', 1.5)
      audio.play('bigcapture')
      this.shake = 3
    } else audio.play('capture', gainPct)

    // hapsolan düşmanlar
    for (const m of this.mobs) {
      if (f.at(Math.floor(m.x), Math.floor(m.y)) === CLAIMED) {
        m.r = -1
        this.addScore(500)
        this.explode(m.x, m.y, 14, '#ffb030')
        this.popup(m.x, m.y, 'TUZAK +500', '#ffb030', 1.2)
        audio.play('kill')
      }
    }
    this.mobs = this.mobs.filter((m) => m.r >= 0)
    // kutular
    for (const bx of this.boxes) {
      if (f.at(bx.x, bx.y) === CLAIMED) {
        this.applyPower(bx.kind, bx.x, bx.y)
        bx.x = -999
      }
    }
    this.boxes = this.boxes.filter((bx) => bx.x > -999)
    // kenar düşmanlarını ve oyuncuyu geçerli kenara taşı
    for (const s of this.sparks) {
      if (!f.isEdge(s.x, s.y)) [s.x, s.y] = f.nearestEdge(s.x, s.y)
    }
    if (!f.isEdge(this.px, this.py)) [this.px, this.py] = f.nearestEdge(this.px, this.py)
    // düşman mermileri kapatılan alanda yok olsun
    this.bullets = this.bullets.filter((bl) => bl.friendly || f.at(Math.floor(bl.x), Math.floor(bl.y)) !== CLAIMED)

    if (f.percent() >= this.diff.target) this.stageClear(false)
  }

  private applyPower(kind: PowerKind, x: number, y: number): void {
    const info = POWER_INFO[kind]
    this.popup(x, y, info.label, info.color, 1.6)
    this.explode(x, y, 12, info.color)
    if (kind === 'life') {
      this.lives++
      audio.play('life')
      return
    }
    if (kind === 'bonus') {
      this.addScore(5000)
      audio.play('box')
      return
    }
    this.power[kind] = info.dur
    audio.play('box')
  }

  private addScore(base: number): void {
    this.score += Math.round(base * this.diff.scoreMul)
    while (this.score >= this.nextLifeAt) {
      this.nextLifeAt += 100000
      this.lives++
      this.popup(this.px, this.py - 12, '1UP!', '#ff5a7a', 1.5)
      audio.play('life')
    }
  }

  // ---------------- düşmanlar ----------------

  /** Gövdeyi kapatılmış hücrelerden sekerek hareket ettirir. */
  private moveBody(e: Body, dist: number): void {
    const n = Math.max(1, Math.ceil(dist / 0.8))
    const st = dist / n
    const f = this.field
    for (let k = 0; k < n; k++) {
      let bx = false
      let by = false
      const nx = e.x + e.dx * st
      const lead = e.dx > 0 ? Math.floor(nx + e.r) : Math.floor(nx - e.r)
      const cur = e.dx > 0 ? Math.floor(e.x + e.r) : Math.floor(e.x - e.r)
      if (lead !== cur) {
        for (let y = Math.floor(e.y - e.r); y <= Math.floor(e.y + e.r); y++)
          if (f.at(lead, y) === CLAIMED) {
            bx = true
            break
          }
      }
      if (bx) e.dx = -e.dx
      else e.x = nx
      const ny = e.y + e.dy * st
      const leadY = e.dy > 0 ? Math.floor(ny + e.r) : Math.floor(ny - e.r)
      const curY = e.dy > 0 ? Math.floor(e.y + e.r) : Math.floor(e.y - e.r)
      if (leadY !== curY) {
        for (let x = Math.floor(e.x - e.r); x <= Math.floor(e.x + e.r); x++)
          if (f.at(x, leadY) === CLAIMED) {
            by = true
            break
          }
      }
      if (by) e.dy = -e.dy
      else e.y = ny
      if (bx || by) {
        const a = Math.atan2(e.dy, e.dx) + this.rng.range(-0.25, 0.25)
        const ndx = Math.cos(a)
        const ndy = Math.sin(a)
        // yansıma yönünü koru
        e.dx = Math.sign(e.dx) === Math.sign(ndx) || ndx === 0 ? ndx : -ndx
        e.dy = Math.sign(e.dy) === Math.sign(ndy) || ndy === 0 ? ndy : -ndy
        this.fixAngle(e)
        e.stuck += bx && by ? 1 : 0
        if (e.stuck > 20) {
          const ra = this.rng.range(0, Math.PI * 2)
          e.dx = Math.cos(ra)
          e.dy = Math.sin(ra)
          e.stuck = 0
          if (e.r > 2) e.r -= 1
        }
      } else e.stuck = Math.max(0, e.stuck - 1)
    }
  }

  /** Neredeyse yatay/dikey yörüngeleri engelle. */
  private fixAngle(e: Body): void {
    const min = 0.25
    if (Math.abs(e.dx) < min) e.dx = (e.dx < 0 ? -1 : 1) * min
    if (Math.abs(e.dy) < min) e.dy = (e.dy < 0 ? -1 : 1) * min
    const l = Math.hypot(e.dx, e.dy)
    e.dx /= l
    e.dy /= l
  }

  private steer(e: Body, tx: number, ty: number, rate: number): void {
    const want = Math.atan2(ty - e.y, tx - e.x)
    const cur = Math.atan2(e.dy, e.dx)
    let diff = want - cur
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    const a = cur + Math.max(-rate, Math.min(rate, diff))
    e.dx = Math.cos(a)
    e.dy = Math.sin(a)
  }

  private updateBoss(dt: number, espeed: number): void {
    const b = this.boss
    if (!b.alive) return
    b.anim += dt
    const has = (a: Ability) => b.abil.includes(a)
    if (has('hunt') && this.drawing) this.steer(b, this.px, this.py, 1.1 * dt)
    if (has('dash')) {
      b.dashT -= dt
      if (b.dashT <= 0 && b.dashing <= 0) {
        b.dashing = 0.7
        b.dashT = this.rng.range(3.5, 6)
        if (this.drawing) this.steer(b, this.px, this.py, Math.PI)
      }
    }
    b.dashing = Math.max(0, b.dashing - dt)
    const sp = b.speed * espeed * (this.enraged ? 1.45 : 1) * (b.dashing > 0 ? 2.6 : 1)
    this.moveBody(b, sp * dt)

    const attacks = b.abil.filter((a) => a === 'aim' || a === 'ring' || a === 'spiral' || a === 'spawn')
    if (attacks.length) {
      b.shootT -= dt * this.diff.fireMul * (this.enraged ? 1.5 : 1)
      if (b.shootT <= 0) {
        b.shootT = this.rng.range(2.4, 3.8)
        const atk = attacks[b.abilIdx++ % attacks.length]
        this.bossAttack(atk)
      }
    }
    if (b.spiral > 0) {
      b.spiral -= dt
      b.spiralA += dt * 7
      if (Math.floor(b.spiral * 14) !== Math.floor((b.spiral + dt) * 14)) {
        for (const off of [0, Math.PI]) this.enemyShot(b.x, b.y, b.spiralA + off, 52)
      }
    }
  }

  private bossAttack(atk: Ability): void {
    const b = this.boss
    switch (atk) {
      case 'aim': {
        const a = Math.atan2(this.py - b.y, this.px - b.x)
        for (const off of [-0.25, 0, 0.25]) this.enemyShot(b.x, b.y, a + off, 72)
        audio.play('bossShot')
        break
      }
      case 'ring': {
        const n = 12
        const a0 = this.rng.range(0, 1)
        for (let i = 0; i < n; i++) this.enemyShot(b.x, b.y, a0 + (i / n) * Math.PI * 2, 55)
        audio.play('bossShot')
        break
      }
      case 'spiral':
        b.spiral = 1.6
        audio.play('bossShot')
        break
      case 'spawn':
        if (this.mobs.length < 7) {
          this.spawnMob(this.rng.pick(['bouncer', 'chaser', 'seeker'] as MinionKind[]), [Math.floor(b.x), Math.floor(b.y)])
          this.explode(b.x, b.y, 8, '#ffffff')
        }
        break
      default:
        break
    }
  }

  private enemyShot(x: number, y: number, a: number, sp: number): void {
    if (this.bullets.length > 160) return
    this.bullets.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, friendly: false, life: 6 })
  }

  private updateMob(m: Mob, dt: number, espeed: number): void {
    m.t += dt
    switch (m.kind) {
      case 'wander':
        if (m.t > 1.6) {
          m.t = this.rng.range(0, 0.8)
          const a = this.rng.range(0, Math.PI * 2)
          m.dx = Math.cos(a)
          m.dy = Math.sin(a)
          this.fixAngle(m)
        }
        break
      case 'chaser':
        if (this.drawing) this.steer(m, this.px, this.py, 2.4 * dt)
        break
      case 'seeker':
        if (this.drawing && this.trail.length > 4) {
          if (m.target < 0 || m.t > 1.2) {
            m.target = this.trail[Math.floor(this.rng.next() * this.trail.length)]
            m.t = 0
          }
          this.steer(m, (m.target % FW) + 0.5, Math.floor(m.target / FW) + 0.5, 2.8 * dt)
        } else m.target = -1
        break
      case 'shooter':
        m.shootT -= dt * this.diff.fireMul
        if (m.shootT <= 0) {
          m.shootT = this.rng.range(2.2, 3.4)
          if (this.drawing) {
            this.enemyShot(m.x, m.y, Math.atan2(this.py - m.y, this.px - m.x), 80)
            audio.play('bossShot')
          }
        }
        break
      default:
        break
    }
    this.moveBody(m, m.speed * espeed * (this.enraged ? 1.2 : 1) * dt)
  }

  private updateSpark(s: Spark, dt: number, espeed: number): void {
    const f = this.field
    s.acc += s.speed * espeed * dt
    while (s.acc >= 1) {
      s.acc -= 1
      const opts: [number, number][] = [
        [s.dx, s.dy],
        s.hand === 1 ? [s.dy, -s.dx] : [-s.dy, s.dx],
        s.hand === 1 ? [-s.dy, s.dx] : [s.dy, -s.dx],
        [-s.dx, -s.dy],
      ]
      for (const [dx, dy] of opts) {
        if (f.isEdge(s.x + dx, s.y + dy)) {
          s.x += dx
          s.y += dy
          s.dx = dx
          s.dy = dy
          break
        }
      }
      // ara sıra yön değiştir (sonsuz küçük döngüleri kır)
      if (this.rng.chance(0.004)) s.hand = s.hand === 1 ? -1 : 1
    }
  }

  private updateBullets(dt: number, frozen: boolean): void {
    const f = this.field
    const b = this.boss
    for (const bl of this.bullets) {
      if (!bl.friendly && frozen) continue
      bl.life -= dt
      const steps = Math.max(1, Math.ceil((Math.hypot(bl.vx, bl.vy) * dt) / 1.5))
      for (let k = 0; k < steps && bl.life > 0; k++) {
        bl.x += (bl.vx * dt) / steps
        bl.y += (bl.vy * dt) / steps
        const cx = Math.floor(bl.x)
        const cy = Math.floor(bl.y)
        if (!f.inside(cx, cy)) {
          bl.life = 0
          break
        }
        const c = f.cells[cx + cy * FW]
        if (bl.friendly) {
          if (c === CLAIMED && !f.edge[cx + cy * FW]) {
            bl.life = 0
            break
          }
          if (b.alive && Math.abs(bl.x - b.x) <= b.r + 1 && Math.abs(bl.y - b.y) <= b.r + 1) {
            bl.life = 0
            b.hp--
            b.flash = 0.08
            this.addScore(50)
            audio.play('hit')
            this.explode(bl.x, bl.y, 3, '#ffffff')
            if (b.hp <= 0) {
              this.bossKilled = true
              this.stageClear(true)
              return
            }
            break
          }
          for (const m of this.mobs) {
            if (m.r >= 0 && Math.abs(bl.x - m.x) <= m.r + 1 && Math.abs(bl.y - m.y) <= m.r + 1) {
              m.r = -1
              bl.life = 0
              this.addScore(300)
              this.popup(m.x, m.y, '+300', '#ff3af0', 1)
              this.explode(m.x, m.y, 10, '#ff3af0')
              audio.play('kill')
              break
            }
          }
        } else if (c === CLAIMED) {
          bl.life = 0
          break
        }
      }
    }
    this.mobs = this.mobs.filter((m) => m.r >= 0)
    this.bullets = this.bullets.filter((bl) => bl.life > 0)
  }

  /** Bir gövdenin kutusu iz hücresine ya da çizim yapan oyuncuya değiyor mu? */
  private touchesTrail(e: Body): boolean {
    const f = this.field
    const r = Math.max(1, e.r)
    if (this.drawing && Math.abs(this.px + 0.5 - e.x) <= r + 0.5 && Math.abs(this.py + 0.5 - e.y) <= r + 0.5) return true
    if (!this.drawing) return false
    for (let y = Math.floor(e.y - r); y <= Math.floor(e.y + r); y++)
      for (let x = Math.floor(e.x - r); x <= Math.floor(e.x + r); x++) if (f.at(x, y) === TRAIL) return true
    return false
  }

  private checkHits(frozen: boolean): void {
    if (this.invuln > 0 || this.power.shield > 0) return
    if (!frozen) {
      if (this.boss.alive && this.touchesTrail(this.boss)) return this.killPlayer()
      for (const m of this.mobs) if (this.touchesTrail(m)) return this.killPlayer()
      for (const s of this.sparks) if (Math.abs(s.x - this.px) <= 2 && Math.abs(s.y - this.py) <= 2) return this.killPlayer()
    }
    if (this.drawing)
      for (const bl of this.bullets) if (!bl.friendly && Math.abs(bl.x - this.px - 0.5) < 2.5 && Math.abs(bl.y - this.py - 0.5) < 2.5) return this.killPlayer()
  }

  private killPlayer(): void {
    if (this.state !== 'play') return
    this.lives--
    this.state = 'dying'
    this.stateT = 0
    this.shake = 4
    this.explode(this.px, this.py, 40, '#3ae8ff')
    this.explode(this.px, this.py, 20, '#ffffff')
    audio.play('die')
    for (const i of this.trail) if (this.field.cells[i] === TRAIL) this.field.cells[i] = EMPTY
    if (this.drawing) {
      this.px = this.sx
      this.py = this.sy
    }
    this.drawing = false
    this.trail = []
    this.fuse = 0
    this.still = 0
    this.bullets = this.bullets.filter((b) => b.friendly)
    this.power.laser = 0
    this.power.speed = 0
  }

  // ---------------- stage sonu ----------------

  /** Test amaçlı: ?debug modunda stage'i anında bitirir. */
  debugClear(): void {
    if (this.state === 'play') this.stageClear(false)
  }

  private stageClear(byKill: boolean): void {
    this.state = 'clear'
    this.stateT = 0
    this.finalPct = this.field.percent()
    this.field.fillAll()
    this.flashLeft = 1.2
    this.drawing = false
    this.trail = []
    const b = this.boss
    b.alive = false
    this.explode(b.x, b.y, 80, '#ffe03a')
    this.explode(b.x, b.y, 60, '#ff5a1a')
    this.explode(b.x, b.y, 40, '#ffffff')
    for (const m of this.mobs) this.explode(m.x, m.y, 12, '#ffb030')
    for (const sp of this.sparks) this.explode(sp.x, sp.y, 8, '#ffb030')
    this.mobs = []
    this.sparks = []
    this.boxes = []
    this.bullets = []
    this.shake = 6
    audio.music(null)
    audio.play('bossdie')
    window.setTimeout(() => audio.play('clear'), 900)

    const m = this.diff.scoreMul
    const pct = Math.floor(this.finalPct)
    this.tally = [
      ['ALAN %' + pct, Math.round(pct * 100 * m)],
      ['HEDEF ÜSTÜ', Math.round(Math.max(0, pct - this.diff.target) * 1000 * m)],
      ['KALAN SÜRE', Math.round(Math.floor(this.timeLeft) * 20 * m)],
    ]
    if (byKill) this.tally.push(['BOSS YOK EDİLDİ', Math.round(10000 * m)])
    this.clearScore = this.tally.reduce((s, [, v]) => s + v, 0)
    this.score += this.clearScore
    while (this.score >= this.nextLifeAt) {
      this.nextLifeAt += 100000
      this.lives++
    }
    const save = this.host.save
    if (!save.gallery.includes(this.stage.pic)) save.gallery.push(this.stage.pic)
    save.reached[this.diffIdx] = Math.max(save.reached[this.diffIdx], Math.min(STAGE_COUNT - 1, this.stageIdx + 1))
    this.recordScore()
  }

  private nextStage(): void {
    if (this.stageIdx + 1 >= STAGE_COUNT) {
      this.state = 'ending'
      this.stateT = 0
      this.recordScore()
      audio.music(makeSong(4242, { bpm: 132, minor: false }))
      return
    }
    this.loadStage(this.stageIdx + 1)
  }

  private recordScore(): void {
    const s = this.host.save
    s.hi[this.diffIdx] = Math.max(s.hi[this.diffIdx], this.score)
    writeSave(s)
  }

  // ---------------- efektler ----------------

  private explode(x: number, y: number, n: number, col: string): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2)
      const s = this.rng.range(15, 70)
      const life = this.rng.range(0.4, 1.1)
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, col })
    }
  }

  private popup(x: number, y: number, text: string, col: string, life: number): void {
    this.popups.push({ x, y, text, col, life })
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 0.96
      p.vy *= 0.96
      p.life -= dt
    }
    this.particles = this.particles.filter((p) => p.life > 0)
    for (const p of this.popups) {
      p.y -= 12 * dt
      p.life -= dt
    }
    this.popups = this.popups.filter((p) => p.life > 0)
  }

  private updateFlash(dt: number): void {
    if (this.flashLeft <= 0) return
    this.flashLeft -= dt
    const fl = this.field.flash
    const dec = dt * 1.6
    for (let i = 0; i < fl.length; i++) if (fl[i] > 0) fl[i] = Math.max(0, fl[i] - dec)
  }

  // ---------------- çizim ----------------

  private renderField(): void {
    const f = this.field
    const cells = f.cells
    const edge = f.edge
    const flash = f.flash
    const buf = this.fieldBuf
    const pic = this.pic
    const cov = this.cover
    const t = this.time
    const ox = Math.floor(t * 6) & 31
    const oy = Math.floor(t * 3) & 31
    const run = Math.floor(t * 30)
    const white = C('#ffffff')
    const trailOn = Math.floor(t * 12) & 1
    const fuseIdx = this.drawing && this.fuse > 0 ? Math.floor(this.fuse) : -1
    for (let y = 0; y < FH; y++) {
      const row = y * FW
      const cy = ((y + oy) & 31) << 5
      for (let x = 0; x < FW; x++) {
        const i = row + x
        const c = cells[i]
        let col: Col
        if (c === CLAIMED) {
          if (edge[i]) col = (x + y + run) % 24 < 3 ? this.edgeB : this.edgeA
          else col = pic[i]
          const fv = flash[i]
          if (fv > 0 && fv > bayer(x, y)) col = fv > 0.75 ? white : mix(col, white, 0.5)
        } else if (c === TRAIL) col = ((x + y) >> 1) & 1 ? (trailOn ? this.trailA : this.trailB) : trailOn ? this.trailB : this.trailA
        else col = cov[((x + ox) & 31) + cy]
        buf[i] = col
      }
    }
    if (fuseIdx >= 0) {
      for (let k = 0; k < Math.min(fuseIdx, this.trail.length); k++) buf[this.trail[k]] = C('#ff5a1a')
    }
    this.fieldCtx.putImageData(this.fieldImg, 0, 0)
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#05030c'
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
    const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0
    const sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake) : 0
    this.renderField()
    // çerçeve
    ctx.fillStyle = css(mix(C(this.stage.hue), C('#000000'), 0.5))
    ctx.fillRect(OX - 2 + sx, OY - 2 + sy, FW + 4, FH + 4)
    ctx.fillStyle = '#000000'
    ctx.fillRect(OX - 1 + sx, OY - 1 + sy, FW + 2, FH + 2)
    ctx.drawImage(this.fieldCanvas, OX + sx, OY + sy)

    ctx.save()
    ctx.translate(OX + sx, OY + sy)
    ctx.beginPath()
    ctx.rect(-4, -4, FW + 8, FH + 8)
    ctx.clip()
    const t = this.time
    const anim = Math.floor(t * 6) & 1
    // kutular
    for (const b of this.boxes) ctx.drawImage(boxFrames[Math.floor(t * 8) % boxFrames.length], b.x - 3, b.y - 3)
    // boss
    const b = this.boss
    if (b.alive) {
      const img = b.flash > 0 ? b.art.hit : b.art.frames[Math.floor(b.anim * 4) & 1]
      const half = Math.floor(b.art.size / 2)
      if (this.power.freeze > 0) ctx.globalAlpha = 0.7
      ctx.drawImage(img, Math.round(b.x) - half, Math.round(b.y) - half)
      ctx.globalAlpha = 1
    }
    for (const m of this.mobs) ctx.drawImage(minionFrames[m.kind][anim], Math.round(m.x) - 3, Math.round(m.y) - 3)
    for (const s of this.sparks) ctx.drawImage(sparkFrames[Math.floor(t * 10) & 1], s.x - 2, s.y - 2)
    // mermiler
    for (const bl of this.bullets) {
      if (bl.friendly) {
        ctx.fillStyle = '#ff3af0'
        ctx.fillRect(Math.floor(bl.x) - 1, Math.floor(bl.y) - 1, 2, 2)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.floor(bl.x), Math.floor(bl.y), 1, 1)
      } else {
        ctx.fillStyle = anim ? '#ff3a3a' : '#ffe03a'
        ctx.fillRect(Math.floor(bl.x) - 1, Math.floor(bl.y) - 1, 3, 3)
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.floor(bl.x), Math.floor(bl.y), 1, 1)
      }
    }
    // oyuncu
    if (this.state === 'play' || this.state === 'intro' || this.state === 'clear') {
      const blink = this.invuln > 0 && Math.floor(t * 16) % 2 === 0
      if (!blink) {
        const frames = this.power.shield > 0 ? shipShield : shipFrames
        ctx.drawImage(frames[Math.floor(t * 10) & 1], this.px - 3, this.py - 3)
      }
      if (this.power.shield > 0) {
        ctx.strokeStyle = Math.floor(t * 8) & 1 ? '#ffe03a' : '#ffffff'
        ctx.strokeRect(this.px - 5.5, this.py - 5.5, 12, 12)
      }
    }
    for (const p of this.particles) {
      ctx.fillStyle = p.col
      const s = p.life / p.max > 0.5 ? 2 : 1
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s)
    }
    for (const p of this.popups) drawText(ctx, p.text, Math.round(p.x), Math.round(p.y) - 4, p.col, { align: 'center' })
    ctx.restore()

    this.renderHud(ctx)
    this.renderOverlay(ctx)
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    const hi = Math.max(this.host.save.hi[this.diffIdx], this.score)
    drawText(ctx, 'SKOR ' + String(this.score).padStart(7, '0'), 10, 2, '#ffffff')
    drawText(ctx, 'REKOR ' + String(hi).padStart(7, '0'), 160, 2, '#ffe03a', { align: 'center' })
    const lifeStr = this.lives <= 5 ? '@'.repeat(Math.max(0, this.lives)) : '@X' + this.lives
    drawText(ctx, lifeStr, 310, 2, '#ff5a7a', { align: 'right' })
    drawText(ctx, 'STAGE ' + String(this.stageIdx + 1).padStart(2, '0') + ' ' + this.stage.name, 10, 11, this.stage.hue)
    const tl = Math.ceil(this.timeLeft)
    drawText(ctx, this.enraged ? 'ÖFKE!' : 'ZAMAN ' + tl, 310, 11, this.enraged || tl < 20 ? (Math.floor(this.time * 4) & 1 ? '#ff3a3a' : '#ffffff') : '#9ad8ff', { align: 'right' })

    // alt çubuk
    const pct = this.state === 'clear' ? this.finalPct : this.field.percent()
    const pctStr = '%' + Math.floor(pct) + '/' + this.diff.target
    drawText(ctx, pctStr, 10, 228, pct >= this.diff.target ? '#7aff8a' : '#ffffff')
    const bx = 62
    const bw = 150
    ctx.fillStyle = '#1a1030'
    ctx.fillRect(bx, 225, bw, 6)
    ctx.fillStyle = '#3af06a'
    ctx.fillRect(bx, 225, Math.round((bw * Math.min(100, pct)) / 100), 6)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx + Math.round((bw * this.diff.target) / 100), 223, 1, 10)
    // boss canı
    const b = this.boss
    ctx.fillStyle = '#1a1030'
    ctx.fillRect(bx, 234, bw, 4)
    ctx.fillStyle = '#ff3a3a'
    ctx.fillRect(bx, 234, Math.round((bw * Math.max(0, b.hp)) / b.maxHp), 4)
    for (let i = 1; i < 10; i++) {
      ctx.fillStyle = '#05030c'
      ctx.fillRect(bx + Math.round((bw * i) / 10), 234, 1, 4)
    }
    // güçlendirmeler
    let ix = 218
    for (const k of TIMED) {
      const v = this.power[k] ?? 0
      if (v <= 0) continue
      const info = POWER_INFO[k]
      if (v < 2.5 && Math.floor(this.time * 8) & 1) {
        ix += 20
        continue
      }
      ctx.fillStyle = info.color
      ctx.fillRect(ix, 224, 18, 14)
      ctx.fillStyle = '#05030c'
      ctx.fillRect(ix + 1, 225, 16, 12)
      drawText(ctx, info.label[0], ix + 3, 226, info.color, { shadow: null })
      drawText(ctx, String(Math.ceil(v)), ix + 9, 229, '#ffffff', { shadow: null })
      ix += 20
    }
  }

  private panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: string): void {
    ctx.fillStyle = 'rgba(5,3,12,0.86)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = edge
    ctx.fillRect(x, y, w, 1)
    ctx.fillRect(x, y + h - 1, w, 1)
    ctx.fillRect(x, y, 1, h)
    ctx.fillRect(x + w - 1, y, 1, h)
  }

  private renderOverlay(ctx: CanvasRenderingContext2D): void {
    const t = this.time
    const blink = Math.floor(t * 3) & 1
    const hue = this.stage.hue
    if (this.paused) {
      this.panel(ctx, 70, 80, 180, 70, '#ffffff')
      drawText(ctx, 'DURAKLATILDI', 160, 92, '#ffe03a', { align: 'center', scale: 2 })
      drawText(ctx, 'ENTER / P : DEVAM', 160, 120, '#ffffff', { align: 'center' })
      drawText(ctx, 'ESC : ANA MENÜ', 160, 134, '#9ad8ff', { align: 'center' })
      return
    }
    switch (this.state) {
      case 'intro': {
        this.panel(ctx, 40, 62, 240, 108, hue)
        drawText(ctx, 'STAGE ' + (this.stageIdx + 1), 160, 72, '#ffffff', { align: 'center', scale: 3 })
        drawText(ctx, this.stage.name, 160, 102, hue, { align: 'center' })
        drawText(ctx, 'HEDEF: %' + this.diff.target + ' ALAN KAPAT', 160, 116, '#ffffff', { align: 'center' })
        const art = this.boss.art
        ctx.drawImage(art.frames[Math.floor(t * 4) & 1], 70 - art.size / 2, 140 - art.size / 2)
        drawText(ctx, 'BOSS: ' + this.stage.boss.name, 100, 134, '#ff5a7a')
        if (blink) drawText(ctx, 'HAZIR OL!', 100, 148, '#ffe03a')
        break
      }
      case 'dying':
        if (this.lives > 0) drawText(ctx, 'VURULDUN!', 160, 110, '#ff3a3a', { align: 'center', scale: 2 })
        break
      case 'clear': {
        if (this.stateT < 1.6) {
          drawText(ctx, this.bossKilled ? 'BOSS YOK EDİLDİ!' : 'STAGE TAMAM!', 160, 110, '#ffe03a', { align: 'center', scale: 2 })
          break
        }
        this.panel(ctx, 50, 128, 220, 90, hue)
        drawText(ctx, 'STAGE ' + (this.stageIdx + 1) + ' TAMAM  ' + this.stage.name, 160, 134, hue, { align: 'center' })
        const shown = Math.min(this.tally.length, Math.floor((this.stateT - 1.6) * 4))
        for (let i = 0; i < shown; i++) {
          const [label, v] = this.tally[i]
          drawText(ctx, label, 64, 150 + i * 11, '#ffffff')
          drawText(ctx, String(v), 256, 150 + i * 11, '#ffe03a', { align: 'right' })
        }
        if (this.stateT > 2.6) {
          drawText(ctx, 'TOPLAM +' + this.clearScore, 160, 196, '#7aff8a', { align: 'center' })
          if (blink) drawText(ctx, 'ENTER: DEVAM', 160, 207, '#ffffff', { align: 'center' })
        }
        break
      }
      case 'gameover':
        this.panel(ctx, 50, 66, 220, 100, '#ff3a3a')
        drawText(ctx, 'OYUN BİTTİ', 160, 76, '#ff3a3a', { align: 'center', scale: 3 })
        drawText(ctx, 'SKOR ' + this.score, 160, 106, '#ffffff', { align: 'center' })
        drawText(ctx, 'DEVAM? ' + Math.max(0, Math.ceil(this.continueT)), 160, 122, '#ffe03a', { align: 'center', scale: 2 })
        drawText(ctx, 'ENTER: DEVAM (SKOR SIFIRLANIR)', 160, 142, '#ffffff', { align: 'center' })
        drawText(ctx, 'ESC: ANA MENÜ', 160, 153, '#9ad8ff', { align: 'center' })
        break
      case 'ending':
        this.panel(ctx, 30, 40, 260, 150, '#ffe03a')
        drawText(ctx, 'TEBRİKLER', 160, 52, '#ffe03a', { align: 'center', scale: 3 })
        drawText(ctx, 'PİLOT!', 160, 80, '#ffffff', { align: 'center', scale: 2 })
        drawText(ctx, '25 STAGE TAMAMLANDI.', 160, 104, '#ffffff', { align: 'center' })
        drawText(ctx, 'GEZEGEN İSTİLACILARDAN KURTULDU', 160, 116, '#7aff8a', { align: 'center' })
        drawText(ctx, 'ZORLUK: ' + this.diff.name, 160, 134, '#9ad8ff', { align: 'center' })
        drawText(ctx, 'FİNAL SKOR ' + this.score, 160, 148, '#ffe03a', { align: 'center', scale: 1 })
        drawText(ctx, 'GALERİDEN TÜM RESİMLERE BAK!', 160, 162, '#ff9ac0', { align: 'center' })
        if (this.stateT > 3 && blink) drawText(ctx, 'ENTER: ANA MENÜ', 160, 176, '#ffffff', { align: 'center' })
        break
      default:
        break
    }
  }
}
