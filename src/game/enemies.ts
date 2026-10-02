import { COLS, ROWS, getCell, idx } from './grid.ts'
import { EMPTY } from './types.ts'
import type { FreeEnemy, BorderEnemy, EnemyKind } from './types.ts'

export interface EnemyEnv {
  px: number // player cell coords (float center)
  py: number
  playerCutting: boolean
  slow: number // 1 normal, <1 slowed
  time: number
  spawnEnemyBullet: (x: number, y: number, vx: number, vy: number) => void
  trail: Uint8Array
}

function baseStats(kind: EnemyKind): { hp: number; score: number; size: number } {
  switch (kind) {
    case 'hunter': return { hp: 2, score: 400, size: 1 }
    case 'gunner': return { hp: 2, score: 600, size: 1 }
    case 'weaver': return { hp: 1, score: 500, size: 0.8 }
    case 'boss': return { hp: 30, score: 5000, size: 2.4 }
    default: return { hp: 1, score: 200, size: 1 }
  }
}

export function spawnEnemy(kind: EnemyKind, speed: number, grid: Uint8Array, hpOverride?: number, name?: string): FreeEnemy {
  const st = baseStats(kind)
  for (let t = 0; t < 120; t++) {
    const x = 5 + Math.random() * (COLS - 10)
    const y = 6 + Math.random() * (ROWS - 12)
    if (grid[idx(Math.floor(x), Math.floor(y))] !== EMPTY) continue
    const a = Math.random() * Math.PI * 2
    const spd = kind === 'weaver' ? speed * 1.25 : kind === 'boss' ? speed : kind === 'hunter' ? speed * 0.95 : speed * 0.8
    return {
      kind, x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      alive: true, respawnIn: 0,
      hp: hpOverride ?? st.hp, maxHp: hpOverride ?? st.hp,
      fireCd: 1 + Math.random() * 2, stateT: Math.random() * 4,
      bossName: name ?? '', size: st.size, scoreValue: st.score,
    }
  }
  return {
    kind, x: COLS / 2, y: ROWS / 2, vx: speed, vy: speed * 0.6,
    alive: true, respawnIn: 0, hp: hpOverride ?? st.hp, maxHp: hpOverride ?? st.hp,
    fireCd: 2, stateT: 0, bossName: name ?? '', size: st.size, scoreValue: st.score,
  }
}

/** Back-compat for old saves: plain drifter. */
export function spawnFreeEnemy(speed: number, grid: Uint8Array): FreeEnemy {
  return spawnEnemy('drifter', speed, grid)
}

function bounceMove(e: FreeEnemy, dt: number, grid: Uint8Array, slow: number): void {
  let nx = e.x + e.vx * slow * dt
  let ny = e.y + e.vy * slow * dt
  if (getCell(grid, Math.floor(nx), Math.floor(e.y)) !== EMPTY) {
    e.vx = -e.vx
    nx = e.x + e.vx * slow * dt
  }
  if (getCell(grid, Math.floor(e.x), Math.floor(ny)) !== EMPTY) {
    e.vy = -e.vy
    ny = e.y + e.vy * slow * dt
  }
  e.x = Math.max(1.2, Math.min(COLS - 2.2, nx))
  e.y = Math.max(1.2, Math.min(ROWS - 2.2, ny))
}

function steer(e: FreeEnemy, tx: number, ty: number, accel: number, maxSpeed: number, dt: number): void {
  const dx = tx - e.x
  const dy = ty - e.y
  const len = Math.hypot(dx, dy) || 1
  e.vx += (dx / len) * accel * dt
  e.vy += (dy / len) * accel * dt
  const sp = Math.hypot(e.vx, e.vy) || 1
  const cap = maxSpeed
  if (sp > cap) {
    e.vx = (e.vx / sp) * cap
    e.vy = (e.vy / sp) * cap
  }
}

function nearestTrail(e: FreeEnemy, trail: Uint8Array, maxR: number): { x: number; y: number } | null {
  const ecx = Math.floor(e.x)
  const ecy = Math.floor(e.y)
  let best: { x: number; y: number } | null = null
  let bestD = maxR * maxR
  for (let y = Math.max(1, ecy - maxR); y <= Math.min(ROWS - 2, ecy + maxR); y++) {
    for (let x = Math.max(1, ecx - maxR); x <= Math.min(COLS - 2, ecx + maxR); x++) {
      if (trail[y * COLS + x] !== 2) continue
      const d = (x - ecx) * (x - ecx) + (y - ecy) * (y - ecy)
      if (d < bestD) {
        bestD = d
        best = { x: x + 0.5, y: y + 0.5 }
      }
    }
  }
  return best
}

export function updateFreeEnemy(
  e: FreeEnemy,
  dt: number,
  grid: Uint8Array,
  env: EnemyEnv,
  baseSpeed: number,
): void {
  if (!e.alive) return
  const slow = env.slow
  e.stateT += dt
  e.fireCd -= dt

  switch (e.kind) {
    case 'drifter': {
      bounceMove(e, dt, grid, slow)
      break
    }
    case 'hunter': {
      // Avcı: oyuncuyu (ya da kesim yapıyorsa izin ucunu) kovalar
      steer(e, env.px, env.py, baseSpeed * 3.2, baseSpeed * 1.02, dt)
      bounceMove(e, dt, grid, slow)
      break
    }
    case 'weaver': {
      // Weaver: önce TRAIL'i hedefler, yoksa oyuncuya dalar
      const t = nearestTrail(e, env.trail, 26)
      if (t) steer(e, t.x, t.y, baseSpeed * 5, baseSpeed * 1.3, dt)
      else steer(e, env.px, env.py, baseSpeed * 3.5, baseSpeed * 1.15, dt)
      bounceMove(e, dt, grid, slow)
      break
    }
    case 'gunner': {
      // Gunner: mesafeyi korur, straf yapar, nişan alıp ateş eder
      const dx = e.x - env.px
      const dy = e.y - env.py
      const dist = Math.hypot(dx, dy) || 1
      const want = 16
      const radial = dist < want - 3 ? 1 : dist > want + 4 ? -1 : 0
      if (radial !== 0) {
        steer(e, e.x + (dx / dist) * radial * 5, e.y + (dy / dist) * radial * 5, baseSpeed * 2.5, baseSpeed * 0.85, dt)
      } else {
        // strafe: dikey yönde dolan
        steer(e, e.x - dy / dist * 4, e.y + dx / dist * 4, baseSpeed * 1.6, baseSpeed * 0.7, dt)
      }
      bounceMove(e, dt, grid, slow)
      if (e.fireCd <= 0 && dist < 34) {
        e.fireCd = 2.1 + Math.random() * 1.2
        const bs = 15
        env.spawnEnemyBullet(e.x, e.y, (env.px - e.x) / dist * bs, (env.py - e.y) / dist * bs)
      }
      break
    }
    case 'boss': {
      updateBoss(e, dt, grid, env, baseSpeed)
      break
    }
  }
}

function updateBoss(e: FreeEnemy, dt: number, grid: Uint8Array, env: EnemyEnv, baseSpeed: number): void {
  // pattern: süzül + periyodik charge + mermi yağmuru
  const chargeCycle = e.stateT % 9
  if (chargeCycle > 7.2 && chargeCycle < 8.2) {
    // charge! oyuncuya kilitlen
    steer(e, env.px, env.py, baseSpeed * 6, baseSpeed * 2.1, dt)
  } else {
    // sine wander
    const wx = COLS / 2 + Math.sin(e.stateT * 0.7) * (COLS / 3)
    const wy = ROWS / 2 + Math.cos(e.stateT * 0.5) * (ROWS / 4)
    steer(e, wx, wy, baseSpeed * 1.8, baseSpeed, dt)
  }
  // duvarlardan sek (büyük gövde: 2 hücre yarıçap kontrolü)
  let nx = e.x + e.vx * env.slow * dt
  let ny = e.y + e.vy * env.slow * dt
  if (getCell(grid, Math.floor(nx), Math.floor(e.y)) !== EMPTY) e.vx = -e.vx
  if (getCell(grid, Math.floor(e.x), Math.floor(ny)) !== EMPTY) e.vy = -e.vy
  nx = e.x + e.vx * env.slow * dt
  ny = e.y + e.vy * env.slow * dt
  e.x = Math.max(3, Math.min(COLS - 4, nx))
  e.y = Math.max(3, Math.min(ROWS - 4, ny))

  // ateş patternleri
  const dist = Math.hypot(env.px - e.x, env.py - e.y) || 1
  // aimed burst her 1.7sn
  if (e.fireCd <= 0) {
    e.fireCd = 1.7
    const bs = 14
    const n = 3
    const baseA = Math.atan2(env.py - e.y, env.px - e.x)
    for (let i = 0; i < n; i++) {
      const a = baseA + (i - 1) * 0.16
      env.spawnEnemyBullet(e.x, e.y, Math.cos(a) * bs, Math.sin(a) * bs)
    }
  }
  // radial her ~5sn (stateT tabanlı)
  const radialPhase = e.stateT % 5
  if (radialPhase < dt) {
    const m = 10
    for (let i = 0; i < m; i++) {
      const a = (i / m) * Math.PI * 2 + e.stateT
      env.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 11, Math.sin(a) * 11)
    }
  }
  void dist
}

// ---- border ----

export function perimeterLength(): number {
  return 2 * (COLS + ROWS) - 4
}

export function borderCellAt(dist: number): { cx: number; cy: number } {
  const per = perimeterLength()
  let d = ((dist % per) + per) % per
  if (d < COLS) return { cx: Math.floor(d), cy: 0 }
  d -= COLS
  if (d < ROWS - 1) return { cx: COLS - 1, cy: 1 + Math.floor(d) }
  d -= ROWS - 1
  if (d < COLS) return { cx: COLS - 1 - Math.floor(d), cy: ROWS - 1 }
  d -= COLS
  return { cx: 0, cy: ROWS - 2 - Math.floor(d) }
}

export function updateBorderEnemy(
  b: BorderEnemy,
  dt: number,
  env?: { px: number; py: number; spawn: (x: number, y: number, vx: number, vy: number) => void },
): void {
  if (b.frozen > 0) {
    b.frozen -= dt
    return
  }
  b.dist += b.dir * b.speed * dt
  b.fireCd -= dt
  if (env && b.fireCd <= 0) {
    const c = borderCellAt(b.dist)
    const dx = env.px - (c.cx + 0.5)
    const dy = env.py - (c.cy + 0.5)
    const dist = Math.hypot(dx, dy)
    if (dist < 30 && dist > 2) {
      b.fireCd = 3.4 + Math.random()
      const bs = 13
      env.spawn(c.cx + 0.5, c.cy + 0.5, (dx / dist) * bs, (dy / dist) * bs)
    }
  }
}

export function makeBorderEnemy(speed: number): BorderEnemy {
  return {
    dist: Math.random() * perimeterLength(),
    dir: Math.random() < 0.5 ? 1 : -1,
    speed,
    frozen: 0,
    hp: 2,
    fireCd: 2 + Math.random() * 2,
  }
}
