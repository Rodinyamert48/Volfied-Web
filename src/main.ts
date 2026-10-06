import './style.css'
import { Input } from './core/input.ts'
import type { Action } from './core/input.ts'
import { audio, makeSong } from './core/audio.ts'
import { loadSave, writeSave } from './core/storage.ts'
import { Game, SCREEN_W, SCREEN_H } from './game/game.ts'
import { DIFFS, STAGES, STAGE_COUNT } from './game/stages.ts'
import { drawText } from './gfx/font.ts'
import { getPictureCanvas, PIC_W, PIC_H } from './gfx/pictures.ts'
import { shipFrames, minionFrames, sparkFrames, boxFrames, makeBoss } from './gfx/sprites.ts'
import type { BossArt } from './gfx/sprites.ts'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
<div id="wrap">
  <canvas id="screen" width="${SCREEN_W}" height="${SCREEN_H}"></canvas>
  <div id="touch">
    <div class="dpad" data-dpad><span class="u"></span><span class="d"></span><span class="l"></span><span class="r"></span></div>
    <div class="btns">
      <button data-act="pause" class="small">II</button>
      <button data-slow class="b">YAVAŞ</button>
      <button data-act="fire" class="a">ATEŞ</button>
      <button data-act="confirm" class="c">TAMAM</button>
    </div>
  </div>
</div>`

const canvas = document.querySelector<HTMLCanvasElement>('#screen')!
const ctx = canvas.getContext('2d')!
ctx.imageSmoothingEnabled = false

const input = new Input()
input.bindTouch(document.querySelector<HTMLElement>('#touch')!)
const save = loadSave()
audio.setMuted(save.muted)
input.onFirstGesture = () => audio.init()

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
document.body.classList.toggle('touch', isTouch)

function resize(): void {
  const touchH = isTouch ? Math.min(220, window.innerHeight * 0.36) : 0
  const availW = window.innerWidth - 8
  const availH = window.innerHeight - touchH - 8
  let s = Math.min(availW / SCREEN_W, availH / SCREEN_H)
  if (s >= 2) s = Math.floor(s * 2) / 2
  canvas.style.width = Math.floor(SCREEN_W * s) + 'px'
  canvas.style.height = Math.floor(SCREEN_H * s) + 'px'
}
window.addEventListener('resize', resize)
resize()

// ---------------- ekranlar ----------------

type Screen = 'title' | 'howto' | 'gallery' | 'game'
let screen: Screen = 'title'
let game: Game | null = null
let menuIdx = 0
let diffIdx = Math.min(3, Math.max(0, save.diff))
let stageSel = 0
let howPage = 0
let galIdx = 0
let galView = false
let t = 0

const titleSong = makeSong(2024, { bpm: 128, minor: true, root: 45 })
audio.music(titleSong)

const host = {
  save,
  exitToTitle(): void {
    game = null
    screen = 'title'
    stageSel = Math.min(stageSel, save.reached[diffIdx])
    audio.music(titleSong)
  },
}

const MENU = ['OYUNA BAŞLA', 'ZORLUK', 'STAGE', 'GALERİ', 'NASIL OYNANIR', 'SES']

const titleBoss: BossArt = makeBoss(7919 * 25 + 17, 38, { body: '#6a2a8a', accent: '#ff3a3a', eye: '#ff3a3a' })
const stars = Array.from({ length: 90 }, () => [Math.random() * SCREEN_W, Math.random() * SCREEN_H, Math.random() * 1.5 + 0.3])

function startGame(): void {
  save.diff = diffIdx
  writeSave(save)
  game = new Game(host, diffIdx, stageSel)
  screen = 'game'
  if (location.search.includes('debug')) (window as unknown as Record<string, unknown>).__game = game
}

function changeOpt(dir: number): void {
  if (menuIdx === 1) {
    diffIdx = (diffIdx + dir + DIFFS.length) % DIFFS.length
    stageSel = Math.min(stageSel, save.reached[diffIdx])
    save.diff = diffIdx
    writeSave(save)
  } else if (menuIdx === 2) {
    const max = save.reached[diffIdx]
    stageSel = (stageSel + dir + max + 1) % (max + 1)
  } else if (menuIdx === 5) toggleMute()
  else return
  audio.play('blip')
}

function toggleMute(): void {
  save.muted = !save.muted
  audio.setMuted(save.muted)
  writeSave(save)
}

function updateTitle(acts: Action[]): void {
  for (const a of acts) {
    if (a === 'up') {
      menuIdx = (menuIdx + MENU.length - 1) % MENU.length
      audio.play('blip')
    } else if (a === 'down') {
      menuIdx = (menuIdx + 1) % MENU.length
      audio.play('blip')
    } else if (a === 'left') changeOpt(-1)
    else if (a === 'right') changeOpt(1)
    else if (a === 'confirm' || a === 'fire') {
      audio.play('select')
      if (menuIdx === 0) return startGame()
      if (menuIdx === 1 || menuIdx === 2) changeOpt(1)
      if (menuIdx === 3) {
        screen = 'gallery'
        galView = false
      }
      if (menuIdx === 4) {
        screen = 'howto'
        howPage = 0
      }
      if (menuIdx === 5) toggleMute()
    }
  }
}

function drawStars(dt: number): void {
  for (const s of stars) {
    s[0] -= s[2] * dt * 20
    if (s[0] < 0) s[0] += SCREEN_W
    ctx.fillStyle = s[2] > 1.4 ? '#ffffff' : s[2] > 0.9 ? '#8a9ad8' : '#3a3a6a'
    ctx.fillRect(Math.floor(s[0]), Math.floor(s[1]), 1, 1)
  }
}

function drawLogo(y: number): void {
  const word = 'VOLFIED'
  const cols = ['#3ae8ff', '#5ad0ff', '#7ab8ff', '#a8a0ff', '#d088ff', '#ff6af0', '#ff3ac0']
  const scale = 5
  const w = word.length * 6 * scale - scale
  let x = 160 - Math.floor(w / 2)
  for (let i = 0; i < word.length; i++) {
    const bob = Math.round(Math.sin(t * 3 + i * 0.6) * 2)
    drawText(ctx, word[i], x + 2, y + bob + 2, '#4a1060', { scale, shadow: null })
    drawText(ctx, word[i], x, y + bob, cols[i], { scale, shadow: null })
    x += 6 * scale
  }
  drawText(ctx, '- WEB -', 160, y + 40, '#ffe03a', { align: 'center' })
}

function renderTitle(dt: number): void {
  ctx.fillStyle = '#05030c'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  drawStars(dt)
  // demo: kenarda dolaşan gemi + boss
  const bx = 260 + Math.sin(t * 0.8) * 20
  const by = 150 + Math.cos(t * 1.1) * 14
  ctx.globalAlpha = 0.9
  ctx.drawImage(titleBoss.frames[Math.floor(t * 4) & 1], Math.round(bx - titleBoss.size / 2), Math.round(by - titleBoss.size / 2))
  ctx.globalAlpha = 1
  const per = 4
  const ph = (t % per) / per
  const rx = 18
  const ry = 112
  const rw = 56
  const rh = 90
  const L = 2 * (rw + rh)
  let d = ph * L
  let sx: number
  let sy: number
  if (d < rw) [sx, sy] = [rx + d, ry]
  else if ((d -= rw) < rh) [sx, sy] = [rx + rw, ry + d]
  else if ((d -= rh) < rw) [sx, sy] = [rx + rw - d, ry + rh]
  else [sx, sy] = [rx, ry + rh - (d - rw)]
  ctx.strokeStyle = '#3a2a6a'
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw, rh)
  ctx.drawImage(shipFrames[Math.floor(t * 10) & 1], Math.round(sx) - 3, Math.round(sy) - 3)
  ctx.drawImage(minionFrames.bouncer[Math.floor(t * 6) & 1], 40 + Math.round(Math.sin(t * 2) * 10), 150 + Math.round(Math.cos(t * 2.4) * 18))

  drawLogo(14)

  const y0 = 82
  for (let i = 0; i < MENU.length; i++) {
    const sel = i === menuIdx
    let label = MENU[i]
    if (i === 1) label = 'ZORLUK  { ' + DIFFS[diffIdx].name + ' }'
    if (i === 2) label = 'STAGE  { ' + String(stageSel + 1).padStart(2, '0') + ' }'
    if (i === 5) label = 'SES: ' + (save.muted ? 'KAPALI' : 'AÇIK')
    const col = sel ? (Math.floor(t * 6) & 1 ? '#ffe03a' : '#ffffff') : '#8a8ab8'
    drawText(ctx, label, 160, y0 + i * 14, col, { align: 'center' })
    if (sel) {
      ctx.drawImage(shipFrames[0], 96, y0 + i * 14)
      ctx.drawImage(shipFrames[0], 218, y0 + i * 14)
    }
  }
  drawText(ctx, DIFFS[diffIdx].desc, 160, 172, '#ff9ac0', { align: 'center' })
  if (menuIdx === 2) drawText(ctx, STAGES[stageSel].name + '  (AÇIK: ' + (save.reached[diffIdx] + 1) + '/' + STAGE_COUNT + ')', 160, 184, '#9ad8ff', { align: 'center' })
  drawText(ctx, 'REKOR ' + String(save.hi[diffIdx]).padStart(7, '0'), 160, 198, '#ffe03a', { align: 'center' })
  drawText(ctx, 'GALERİ ' + save.gallery.length + '/' + STAGE_COUNT, 160, 210, '#7aff8a', { align: 'center' })
  drawText(ctx, isTouch ? 'D-PAD + TAMAM' : 'OKLAR + ENTER', 160, 226, '#5a5a8a', { align: 'center' })
}

// ---------------- nasıl oynanır ----------------

const HOW: string[][] = [
  [
    'AMAÇ',
    '',
    'GEMİNLE ALANIN KENARINDA DOLAŞ.',
    'BOŞLUĞA GİRİNCE ARKANDA İZ KALIR.',
    'TEKRAR KENARA ULAŞINCA, BOSS OLMAYAN',
    'TARAF KAPANIR VE ALTINDAKİ RESİM AÇILIR.',
    '',
    'HEDEF YÜZDEYE ULAŞ: STAGE BİTER!',
    'İZİNE DÜŞMAN DEĞERSE CAN GİDER.',
    'ÇİZERKEN DURURSAN FİTİL YANAR!',
    '',
    'KÜÇÜK DÜŞMANLARI HAPSET: +500',
  ],
  [
    'KONTROLLER',
    '',
    'OKLAR / WASD   HAREKET',
    'SHIFT / X      YAVAŞ KESİM (X2 PUAN)',
    'SPACE / Z      LAZER ATEŞ',
    'P              DURAKLAT',
    'ESC            MENÜ / GERİ',
    'M              SES AÇ/KAPA',
    '',
    'MOBİL: D-PAD, ATEŞ, YAVAŞ, TAMAM',
    '',
    'BÜYÜK KESİM (%15+) PUANI İKİYE KATLAR',
  ],
  [
    'GİZEMLİ KUTULAR',
    '',
    '? KUTUSUNU ALANIN İÇİNE HAPSET:',
    'HIZ      GEMİ HIZLANIR',
    'LAZER    SPACE İLE ATEŞ ET',
    'DONDUR   DÜŞMANLAR DONAR',
    'KALKAN   HASAR ALMAZSIN',
    'YAVAŞLAT DÜŞMANLAR YAVAŞLAR',
    '+1 CAN / +5000 PUAN',
    '',
    'LAZERLE BOSS CANINI BİTİR:',
    'STAGE ANINDA BİTER! (+10000)',
  ],
  [
    'DÜŞMANLAR',
    '',
    '',
    '      MAYIN: DÜZ SEKER',
    '      JÖLE: RASTGELE GEZER',
    '      YARASA: SENİ KOVALAR',
    '      KULE: ATEŞ EDER',
    '      AVCI: İZİNİ KOKLAR',
    '      KIVILCIM: KENARDA GEZER!',
    '',
    'SÜRE BİTERSE BOSS ÖFKELENİR.',
    '100000 PUANDA +1 CAN.',
  ],
]

function updateHowto(acts: Action[]): void {
  for (const a of acts) {
    if (a === 'right' || a === 'confirm' || a === 'fire') {
      if (howPage === HOW.length - 1 && a !== 'right') screen = 'title'
      else howPage = Math.min(HOW.length - 1, howPage + 1)
      audio.play('blip')
    } else if (a === 'left') {
      howPage = Math.max(0, howPage - 1)
      audio.play('blip')
    } else if (a === 'back') screen = 'title'
  }
}

function renderHowto(dt: number): void {
  ctx.fillStyle = '#05030c'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  drawStars(dt)
  const page = HOW[howPage]
  drawText(ctx, page[0], 160, 16, '#ffe03a', { align: 'center', scale: 2 })
  for (let i = 1; i < page.length; i++) drawText(ctx, page[i], 22, 30 + i * 13, '#ffffff')
  if (howPage === 2) {
    ctx.drawImage(boxFrames[Math.floor(t * 8) % boxFrames.length], 10, 55)
  }
  if (howPage === 3) {
    const a = Math.floor(t * 6) & 1
    const ys = [69, 82, 95, 108, 121]
    const kinds = ['bouncer', 'wander', 'chaser', 'shooter', 'seeker'] as const
    kinds.forEach((k, i) => ctx.drawImage(minionFrames[k][a], 26, ys[i]))
    ctx.drawImage(sparkFrames[a], 27, 135)
  }
  drawText(ctx, 'SAYFA ' + (howPage + 1) + '/' + HOW.length + '   { } DEĞİŞTİR   ESC: GERİ', 160, 222, '#8a8ab8', { align: 'center' })
}

// ---------------- galeri ----------------

const thumbs = new Map<number, HTMLCanvasElement>()
function thumb(i: number): HTMLCanvasElement {
  let c = thumbs.get(i)
  if (!c) {
    c = document.createElement('canvas')
    c.width = 50
    c.height = 33
    const x = c.getContext('2d')!
    x.imageSmoothingEnabled = true
    x.imageSmoothingQuality = 'high'
    x.drawImage(getPictureCanvas(i), 0, 0, PIC_W, PIC_H, 0, 0, 50, 33)
    thumbs.set(i, c)
  }
  return c
}

function updateGallery(acts: Action[]): void {
  for (const a of acts) {
    if (galView) {
      if (a === 'back' || a === 'confirm' || a === 'fire') galView = false
      if (a === 'left' || a === 'right') {
        const unlocked = STAGES.map((s) => s.pic).filter((p) => save.gallery.includes(p))
        const cur = unlocked.indexOf(STAGES[galIdx].pic)
        if (unlocked.length) {
          const nxt = unlocked[(cur + (a === 'right' ? 1 : -1) + unlocked.length) % unlocked.length]
          galIdx = STAGES.findIndex((s) => s.pic === nxt)
        }
      }
      continue
    }
    if (a === 'left') galIdx = (galIdx + STAGE_COUNT - 1) % STAGE_COUNT
    if (a === 'right') galIdx = (galIdx + 1) % STAGE_COUNT
    if (a === 'up') galIdx = (galIdx + STAGE_COUNT - 5) % STAGE_COUNT
    if (a === 'down') galIdx = (galIdx + 5) % STAGE_COUNT
    if (a === 'back') screen = 'title'
    if ((a === 'confirm' || a === 'fire') && save.gallery.includes(STAGES[galIdx].pic)) {
      galView = true
      audio.play('select')
    } else if (a !== 'back') audio.play('blip')
  }
}

function renderGallery(dt: number): void {
  ctx.fillStyle = '#05030c'
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H)
  if (galView) {
    const st = STAGES[galIdx]
    ctx.drawImage(getPictureCanvas(st.pic), 10, 20)
    drawText(ctx, 'STAGE ' + (galIdx + 1) + '  ' + st.name, 160, 6, st.hue, { align: 'center' })
    drawText(ctx, '{ } DİĞER RESİM   ESC: GERİ', 160, 226, '#8a8ab8', { align: 'center' })
    return
  }
  drawStars(dt)
  drawText(ctx, 'GALERİ', 160, 6, '#ffe03a', { align: 'center', scale: 2 })
  for (let i = 0; i < STAGE_COUNT; i++) {
    const cx = 25 + (i % 5) * 55
    const cy = 28 + Math.floor(i / 5) * 37
    const open = save.gallery.includes(STAGES[i].pic)
    const sel = i === galIdx
    ctx.fillStyle = sel ? (Math.floor(t * 6) & 1 ? '#ffe03a' : '#ffffff') : '#2a2a4a'
    ctx.fillRect(cx - 2, cy - 2, 54, 37)
    if (open) ctx.drawImage(thumb(STAGES[i].pic), cx, cy)
    else {
      ctx.fillStyle = '#0c0a1a'
      ctx.fillRect(cx, cy, 50, 33)
      drawText(ctx, '?', cx + 25, cy + 9, '#3a3a6a', { align: 'center', scale: 2 })
    }
    drawText(ctx, String(i + 1), cx + 2, cy + 2, '#ffffff')
  }
  const st = STAGES[galIdx]
  const open = save.gallery.includes(st.pic)
  drawText(ctx, open ? st.name : 'KİLİTLİ - STAGE ' + (galIdx + 1) + "'İ GEÇ", 160, 216, open ? st.hue : '#8a8ab8', { align: 'center' })
  drawText(ctx, 'ENTER: BÜYÜT   ESC: GERİ', 160, 228, '#5a5a8a', { align: 'center' })
}

// ---------------- döngü ----------------

let last = performance.now()
let acc = 0
const STEP = 1 / 60

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  acc += dt
  const acts = input.consume()
  if (acts.includes('mute')) toggleMute()
  let first = true
  while (acc >= STEP) {
    acc -= STEP
    t += STEP
    const a = first ? acts : []
    first = false
    if (screen === 'title') updateTitle(a)
    else if (screen === 'howto') updateHowto(a)
    else if (screen === 'gallery') updateGallery(a)
    else if (game) game.update(STEP, input, a)
  }
  if (first && screen !== 'game') {
    // bu karede güncelleme adımı yoksa basılanları kaybetme
    if (screen === 'title') updateTitle(acts)
    else if (screen === 'howto') updateHowto(acts)
    else if (screen === 'gallery') updateGallery(acts)
  } else if (first && game) game.update(0, input, acts)

  if (screen === 'title') renderTitle(dt)
  else if (screen === 'howto') renderHowto(dt)
  else if (screen === 'gallery') renderGallery(dt)
  else if (game) game.render(ctx)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

if (location.search.includes('debug')) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyN' && game) game.debugClear()
  })
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && game.state === 'play') game.paused = true
})
