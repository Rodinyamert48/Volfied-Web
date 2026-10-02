import './style.css'
import { Engine } from './game/engine.ts'
import { drawGame, VIEW_W, VIEW_H } from './render/pixel.ts'
import { Sfx } from './audio/sfx.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('#app missing')

app.innerHTML = `
<div class="cabinet">
  <div class="topbar">
    <div class="logo">VOLFIED<span>-WEB</span></div>
    <div class="hud">
      <div>SKOR <b id="hud-score">0</b></div>
      <div>REKOR <b id="hud-high">0</b></div>
      <div>LV <b id="hud-level">1</b></div>
      <div>CAN <span class="lives" id="hud-lives">♥♥♥</span></div>
      <div>DOLULUK <b id="hud-pct">0%</b> / <b id="hud-target">68%</b></div>
    </div>
  </div>
  <div class="stage-wrap">
    <canvas id="game" width="${VIEW_W}" height="${VIEW_H}"></canvas>
    <div class="overlay" id="ov-title">
      <div class="card">
        <h1>VOLFIED-WEB</h1>
        <h2>ALANI KAPAT • DÜŞMANDAN KAÇ</h2>
        <p>Duvar üzerinde ilerle, boşluğa dalıp iz bırak ve duvara dönerek alanı kapat. İzi düşman keserse yanarsın.</p>
        <p class="keys">OKLAR / WASD: hareket • SPACE (basılı): hızlı kesim x2<br/>P: duraklat • M: ses • ENTER: başlat</p>
        <div class="row">
          <button class="pixel" id="btn-start">OYNA</button>
          <button class="pixel ghost" id="btn-how">NASIL OYNANIR?</button>
        </div>
        <p class="keys" id="how" hidden>• Duvar = güvenli • İz = savunmasız • %70 doldur = level atlarsın • Yeşil +500, Mavi yavaşlatır, Pembe +1 can • Köşedeki turuncu duvar düşmanına dikkat.</p>
      </div>
    </div>
    <div class="overlay" id="ov-pause" hidden>
      <div class="card"><h1>DURAKLATILDI</h1><p>P veya devam düğmesine bas.</p><div class="row"><button class="pixel" id="btn-resume">DEVAM</button></div></div>
    </div>
    <div class="overlay" id="ov-over" hidden>
      <div class="card"><h1>OYUN BİTTİ</h1><p id="over-text">SKOR 0</p><div class="row"><button class="pixel" id="btn-retry">TEKRAR</button></div></div>
    </div>
    <div class="overlay" id="ov-clear" hidden>
      <div class="card"><h1>LEVEL TEMİZ!</h1><p id="clear-text">BONUS</p></div>
    </div>
  </div>
  <div class="fillbar"><div id="fill"></div></div>
  <div class="controls">
    <small>SPACE hızlı kesim = 2x puan ama hızlı ölüm riski.<br/>Mobil: canvas üzerinde kaydır.</small>
    <div class="btns">
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
const elFill = document.querySelector('#fill') as HTMLElement
const ovTitle = document.querySelector('#ov-title') as HTMLElement
const ovPause = document.querySelector('#ov-pause') as HTMLElement
const ovOver = document.querySelector('#ov-over') as HTMLElement
const ovClear = document.querySelector('#ov-clear') as HTMLElement
const overText = document.querySelector('#over-text') as HTMLElement
const clearText = document.querySelector('#clear-text') as HTMLElement

eng.events = {
  onCutClose: (n, pct, trapped) => {
    void n
    void pct
    sfx.fill()
    if (trapped > 0) sfx.bonus()
  },
  onDeath: () => sfx.death(),
  onLevelClear: (lv, bonus) => {
    sfx.clear()
    clearText.textContent = `LEVEL ${lv} • BONUS +${bonus}`
  },
  onGameOver: (score) => {
    overText.textContent = `SKOR ${score} • REKOR ${eng.high}`
  },
  onBonus: () => sfx.bonus(),
}

function hearts(n: number): string {
  return n <= 0 ? '—' : '♥'.repeat(Math.min(8, n))
}

function syncHud(): void {
  elScore.textContent = String(eng.score)
  elHigh.textContent = String(eng.high)
  elLevel.textContent = String(eng.level)
  elLives.textContent = hearts(eng.lives)
  elPct.textContent = `${eng.pct.toFixed(1)}%`
  elTarget.textContent = `${eng.def.targetPct}%`
  elFill.style.width = `${Math.min(100, (eng.pct / eng.def.targetPct) * 100).toFixed(1)}%`
  ovTitle.hidden = eng.phase !== 'title'
  ovPause.hidden = eng.phase !== 'paused'
  ovOver.hidden = eng.phase !== 'over'
  ovClear.hidden = eng.phase !== 'clear'
}

// input
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
  if (k === 'enter' && eng.phase === 'title') {
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

// touch swipe
let touchStart: { x: number; y: number } | null = null
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0]
  if (t) touchStart = { x: t.clientX, y: t.clientY }
}, { passive: true })
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault()
  if (!touchStart) return
  const t = e.touches[0]
  if (!t) return
  const dx = t.clientX - touchStart.x
  const dy = t.clientY - touchStart.y
  if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return
  if (Math.abs(dx) > Math.abs(dy)) eng.setInput(dx > 0 ? 1 : -1, 0, false)
  else eng.setInput(0, dy > 0 ? 1 : -1, false)
  touchStart = { x: t.clientX, y: t.clientY }
}, { passive: false })

function startGame(): void {
  sfx.start()
  eng.start()
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
document.querySelector('#btn-resume')?.addEventListener('click', togglePause)
document.querySelector('#btn-pause')?.addEventListener('click', togglePause)
document.querySelector('#btn-mute')?.addEventListener('click', toggleMute)
document.querySelector('#btn-how')?.addEventListener('click', () => {
  const h = document.querySelector('#how') as HTMLElement
  h.hidden = !h.hidden
})

// default drift on title screen so background looks alive
eng.phase = 'title'

// main loop
let last = performance.now()
let cutTick = 0
function frame(now: number): void {
  const dt = (now - last) / 1000
  last = now
  if (eng.phase === 'playing' || eng.phase === 'dying' || eng.phase === 'clear') {
    eng.update(dt)
    if (eng.player.cutting) {
      cutTick += dt
      if (cutTick > 0.09) {
        cutTick = 0
        sfx.cut()
      }
    }
  } else if (eng.phase === 'title') {
    // idle animation: drift enemies
    eng.updateEnemiesIdle(dt)
  }
  drawGame(ctx, eng, now / 1000)
  syncHud()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
