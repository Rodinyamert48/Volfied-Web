import './style.css'
import { Engine } from './game/engine.ts'
import { drawGame, VIEW_W, VIEW_H } from './render/pixel.ts'
import { Sfx } from './audio/sfx.ts'
import { TOTAL_STAGES } from './game/levels.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `
<div class="cabinet">
  <div class="topbar">
    <div class="logo">VOLFIED<span>-WEB</span></div>
    <div class="hud">
      <div>SKOR <b id="hud-score">0</b></div>
      <div>REKOR <b id="hud-high">0</b></div>
      <div>STAGE <b id="hud-level">1/15</b></div>
      <div>CAN <span class="lives" id="hud-lives">♥♥♥</span></div>
      <div>DOLULUK <b id="hud-pct">0%</b> / <b id="hud-target">68%</b></div>
    </div>
    <div class="stage-line"><span id="hud-stage">STAGE 1 — YEŞİL BAŞLANGIÇ</span><span id="hud-boss" class="boss-tag" hidden>BOSS</span></div>
  </div>
  <div class="stage-wrap">
    <canvas id="game" width="${VIEW_W}" height="${VIEW_H}"></canvas>
    <div id="banner" class="banner" hidden></div>
    <div id="bossbar" class="bossbar" hidden><label id="boss-name">BOSS</label><div class="track"><div id="boss-fill"></div></div></div>
    <div class="overlay" id="ov-title">
      <div class="card">
        <h1>VOLFIED-WEB</h1>
        <h2>15 STAGE • 3 BOSS • GERÇEK VOLFIED</h2>
        <p>Duvar üstünde gez, boşluğa dalıp iz bırak, duvara dönüp kapat. Artık geminde TOP var: düşmanları vur, boss'ları hapset ya da delik deşik et.</p>
        <p class="keys">OKLAR/WASD: hareket • SPACE: hızlı kesim x2 • J / X / TIK: ateş<br/>P: duraklat • M: ses • ENTER: başlat</p>
        <div class="row">
          <button class="pixel" id="btn-start">OYNA</button>
          <button class="pixel ghost" id="btn-how">DÜŞMANLAR?</button>
        </div>
        <p class="keys" id="how" hidden>• DRIFTER (kırmızı): serseri mayın • HUNTER (mor): seni kovalar, 2 can • GUNNER (yeşil): uzaktan ateş eder, 2 can • WEAVER (sarı): İZİNİ koklar, izi keser! • BOSS (5/10/15): halka mermi + charge, hapsetmek 12 hasar.</p>
      </div>
    </div>
    <div class="overlay" id="ov-pause" hidden>
      <div class="card"><h1>DURAKLATILDI</h1><p>P veya devam düğmesine bas.</p><div class="row"><button class="pixel" id="btn-resume">DEVAM</button></div></div>
    </div>
    <div class="overlay" id="ov-over" hidden>
      <div class="card"><h1>OYUN BİTTİ</h1><p id="over-text">SKOR 0</p><div class="row"><button class="pixel" id="btn-retry">TEKRAR</button></div></div>
    </div>
    <div class="overlay" id="ov-clear" hidden>
      <div class="card"><h1>STAGE TEMİZ!</h1><p id="clear-text">BONUS</p></div>
    </div>
    <div class="overlay" id="ov-win" hidden>
      <div class="card"><h1>TEBRİKLER, PİLOT!</h1><p id="win-text">15 stage bitti</p><div class="row"><button class="pixel" id="btn-again">BAŞTAN</button></div></div>
    </div>
  </div>
  <div class="fillbar"><div id="fill"></div></div>
  <div class="controls">
    <small>J / X / tık = ateş (en yakın düşmana kilitlenir). SPACE = hızlı kesim.<br/>Mobil: kaydır = hareket, dokun = ateş.</small>
    <div class="btns">
      <button class="pixel secondary" id="btn-fire">ATEŞ</button>
      <button class="pixel secondary" id="btn-pause">DURAKLAT</button>
      <button class="pixel ghost" id="btn-mute">SES: AÇIK</button>
    </div>
  </div>
</div>
`

const canvas = document.querySelector<HTMLCanvasElement>('#game') as HTMLCanvasElement
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
ctx.imageSmoothingEnabled = false

const eng = new Engine()
const sfx = new Sfx()

const elScore = document.querySelector('#hud-score') as HTMLElement
const elHigh = document.querySelector('#hud-high') as HTMLElement
const elLevel = document.querySelector('#hud-level') as HTMLElement
const elLives = document.querySelector('#hud-lives') as HTMLElement
const elPct = document.querySelector('#hud-pct') as HTMLElement
const elTarget = document.querySelector('#hud-target') as HTMLElement
const elStage = document.querySelector('#hud-stage') as HTMLElement
const elBossTag = document.querySelector('#hud-boss') as HTMLElement
const elFill = document.querySelector('#fill') as HTMLElement
const ovTitle = document.querySelector('#ov-title') as HTMLElement
const ovPause = document.querySelector('#ov-pause') as HTMLElement
const ovOver = document.querySelector('#ov-over') as HTMLElement
const ovClear = document.querySelector('#ov-clear') as HTMLElement
const ovWin = document.querySelector('#ov-win') as HTMLElement
const overText = document.querySelector('#over-text') as HTMLElement
const clearText = document.querySelector('#clear-text') as HTMLElement
const winText = document.querySelector('#win-text') as HTMLElement
const banner = document.querySelector('#banner') as HTMLElement
const bossbar = document.querySelector('#bossbar') as HTMLElement
const bossName = document.querySelector('#boss-name') as HTMLElement
const bossFill = document.querySelector('#boss-fill') as HTMLElement

let bannerTimer = 0
function showBanner(text: string, ms = 2400): void {
  banner.textContent = text
  banner.hidden = false
  bannerTimer = ms / 1000
}

eng.events = {
  onCutClose: (n, pct, trapped) => {
    void n
    void pct
    sfx.fill()
    if (trapped > 0) sfx.explode()
  },
  onDeath: () => sfx.death(),
  onLevelClear: (lv, bonus) => {
    sfx.clear()
    clearText.textContent = `STAGE ${lv} • BONUS +${bonus}`
  },
  onGameOver: (score) => {
    overText.textContent = `SKOR ${score} • REKOR ${eng.high}`
  },
  onBonus: () => sfx.bonus(),
  onPlayerShoot: () => sfx.shoot(),
  onEnemyKilled: (kind, points) => {
    void points
    if (kind === 'boss') sfx.explode()
    else sfx.hit()
  },
  onBossDown: (name) => {
    sfx.explode()
    showBanner(`${name} DÜŞTÜ! +5000`, 2600)
  },
  onVictory: (score) => {
    winText.textContent = `15 STAGE TEMİZ • SKOR ${score} • REKOR ${eng.high}`
  },
}

function hearts(n: number): string {
  return n <= 0 ? '—' : '♥'.repeat(Math.min(8, n))
}

function syncHud(): void {
  elScore.textContent = String(eng.score)
  elHigh.textContent = String(eng.high)
  elLevel.textContent = `${eng.level}/${TOTAL_STAGES}`
  elLives.textContent = hearts(eng.lives)
  elPct.textContent = `${eng.pct.toFixed(1)}%`
  elTarget.textContent = `${eng.def.targetPct}%`
  elStage.textContent = `STAGE ${eng.level} — ${eng.def.name}`
  elBossTag.hidden = eng.def.boss === null
  elFill.style.width = `${Math.min(100, (eng.pct / eng.def.targetPct) * 100).toFixed(1)}%`
  ovTitle.hidden = eng.phase !== 'title'
  ovPause.hidden = eng.phase !== 'paused'
  ovOver.hidden = eng.phase !== 'over'
  ovClear.hidden = eng.phase !== 'clear'
  ovWin.hidden = eng.phase !== 'victory'
  const b = eng.boss()
  if (b && eng.phase === 'playing') {
    bossbar.hidden = false
    bossName.textContent = `☠ ${b.bossName} ${Math.max(0, b.hp)}/${b.maxHp}`
    bossFill.style.width = `${Math.max(0, (b.hp / b.maxHp) * 100).toFixed(1)}%`
  } else {
    bossbar.hidden = true
  }
}

const keys = new Set<string>()
let fastHeld = false

function currentDir(): { x: number; y: number } {
  if (keys.has('arrowleft') || keys.has('a')) return { x: -1, y: 0 }
  if (keys.has('arrowright') || keys.has('d')) return { x: 1, y: 0 }
  if (keys.has('arrowup') || keys.has('w')) return { x: 0, y: -1 }
  if (keys.has('arrowdown') || keys.has('s')) return { x: 0, y: 1 }
  return { x: eng.player.dirX, y: eng.player.dirY }
}

function pushInput(): void {
  const d = currentDir()
  eng.setInput(d.x, d.y, fastHeld || keys.has(' '))
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase()
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault()
  if (k === 'enter' && (eng.phase === 'title' || eng.phase === 'over' || eng.phase === 'victory')) {
    startGame()
    return
  }
  if (k === 'p') {
    togglePause()
    return
  }
  if (k === 'm') {
    toggleMute()
    return
  }
  if (k === 'j' || k === 'x' || k === 'k') {
    eng.tryShoot()
    return
  }
  if (k === ' ') fastHeld = true
  keys.add(k === ' ' ? ' ' : k)
  pushInput()
})

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase()
  if (k === ' ') fastHeld = false
  keys.delete(k === ' ' ? ' ' : k)
  pushInput()
})

canvas.addEventListener('mousedown', () => eng.tryShoot())

let touchStart: { x: number; y: number } | null = null
let touchMoved = false
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0]
  if (t) {
    touchStart = { x: t.clientX, y: t.clientY }
    touchMoved = false
  }
}, { passive: true })
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  if (!touchStart) return
  const t = e.touches[0]
  if (!t) return
  const dx = t.clientX - touchStart.x
  const dy = t.clientY - touchStart.y
  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return
  touchMoved = true
  if (Math.abs(dx) > Math.abs(dy)) eng.setInput(dx > 0 ? 1 : -1, 0, false)
  else eng.setInput(0, dy > 0 ? 1 : -1, false)
  touchStart = { x: t.clientX, y: t.clientY }
}, { passive: false })
canvas.addEventListener('touchend', (e) => {
  e.preventDefault()
  if (!touchMoved) eng.tryShoot()
  touchStart = null
}, { passive: false })

let lastLevel = 1
let lastBossHp = -1
function startGame(): void {
  sfx.start()
  eng.start()
  lastLevel = 1
  lastBossHp = -1
  showBanner(`STAGE 1 — ${eng.def.name}: ${eng.def.briefing}`, 3000)
  syncHud()
}

function togglePause(): void {
  if (eng.phase === 'playing') eng.phase = 'paused'
  else if (eng.phase === 'paused') eng.phase = 'playing'
  syncHud()
}

function toggleMute(): void {
  sfx.muted = !sfx.muted
  const b = document.querySelector('#btn-mute') as HTMLElement
  b.textContent = sfx.muted ? 'SES: KAPALI' : 'SES: AÇIK'
}

document.querySelector('#btn-start')?.addEventListener('click', startGame)
document.querySelector('#btn-retry')?.addEventListener('click', startGame)
document.querySelector('#btn-again')?.addEventListener('click', startGame)
document.querySelector('#btn-resume')?.addEventListener('click', togglePause)
document.querySelector('#btn-pause')?.addEventListener('click', togglePause)
document.querySelector('#btn-mute')?.addEventListener('click', toggleMute)
document.querySelector('#btn-fire')?.addEventListener('click', () => eng.tryShoot())
document.querySelector('#btn-how')?.addEventListener('click', () => {
  const h = document.querySelector('#how') as HTMLElement
  h.hidden = !h.hidden
})

eng.phase = 'title'

let last = performance.now()
let cutTick = 0
function frame(now: number): void {
  const dt = (now - last) / 1000
  last = now
  if (eng.phase === 'playing' || eng.phase === 'dying' || eng.phase === 'clear' || eng.phase === 'victory') {
    eng.update(dt)
    if (eng.player.cutting) {
      cutTick += dt
      if (cutTick > 0.09) {
        cutTick = 0
        sfx.cut()
      }
    }
    if (eng.level !== lastLevel) {
      lastLevel = eng.level
      showBanner(`STAGE ${eng.level} — ${eng.def.name}: ${eng.def.briefing}`, 3000)
      if (eng.def.boss) sfx.bossWarn()
    }
    const bb = eng.boss()
    const hp = bb ? bb.hp : -1
    if (bb && hp !== lastBossHp) {
      lastBossHp = hp
      if (hp <= Math.ceil(bb.maxHp / 2) && hp > 0) showBanner(`${bb.bossName} ÖFKELENDİ!`, 1600)
    }
  } else if (eng.phase === 'title') {
    eng.updateEnemiesIdle(dt)
  }
  if (!banner.hidden) {
    bannerTimer -= dt
    if (bannerTimer <= 0) banner.hidden = true
  }
  drawGame(ctx, eng, now / 1000)
  syncHud()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
