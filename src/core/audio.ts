// WebAudio ile sentezlenen retro ses efektleri ve basit chiptune müzik sıralayıcısı.

type Wave = OscillatorType

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

export type Sfx =
  | 'blip'
  | 'select'
  | 'cut'
  | 'capture'
  | 'bigcapture'
  | 'die'
  | 'box'
  | 'laser'
  | 'hit'
  | 'kill'
  | 'bossShot'
  | 'fuse'
  | 'life'
  | 'clear'
  | 'gameover'
  | 'bossdie'
  | 'warn'

export class Audio {
  ctx: AudioContext | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private musBus: GainNode | null = null
  private noiseBuf: AudioBuffer | null = null
  muted = false
  private seqTimer = 0
  private song: Song | null = null
  private step = 0
  private nextTime = 0

  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.55
    this.master.connect(this.ctx.destination)
    this.sfxBus = this.ctx.createGain()
    this.sfxBus.gain.value = 0.5
    this.sfxBus.connect(this.master)
    this.musBus = this.ctx.createGain()
    this.musBus.gain.value = 0.22
    this.musBus.connect(this.master)
    const len = this.ctx.sampleRate
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const d = this.noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    if (this.song) this.startSeq()
  }

  setMuted(m: boolean): void {
    this.muted = m
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02)
  }

  private tone(freq: number, dur: number, type: Wave, vol: number, t0: number, slideTo?: number, bus?: GainNode | null): void {
    if (!this.ctx) return
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    o.connect(g)
    g.connect(bus ?? this.sfxBus!)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  private noise(dur: number, vol: number, t0: number, hp = 800, bus?: GainNode | null): void {
    if (!this.ctx || !this.noiseBuf) return
    const s = this.ctx.createBufferSource()
    s.buffer = this.noiseBuf
    const f = this.ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur)
    s.connect(f)
    f.connect(g)
    g.connect(bus ?? this.sfxBus!)
    s.start(t0, Math.random() * 0.5)
    s.stop(t0 + dur + 0.02)
  }

  play(name: Sfx, amount = 0): void {
    if (!this.ctx || this.muted) return
    const t = this.ctx.currentTime
    switch (name) {
      case 'blip':
        this.tone(880, 0.05, 'square', 0.15, t)
        break
      case 'select':
        this.tone(660, 0.06, 'square', 0.18, t)
        this.tone(990, 0.1, 'square', 0.18, t + 0.06)
        break
      case 'cut':
        this.tone(300, 0.08, 'square', 0.08, t, 500)
        break
      case 'capture': {
        const n = Math.min(6, 2 + Math.floor(amount / 4))
        for (let i = 0; i < n; i++) this.tone(NOTE(72 + [0, 4, 7, 12, 16, 19][i]), 0.09, 'square', 0.14, t + i * 0.045)
        break
      }
      case 'bigcapture':
        for (let i = 0; i < 8; i++) this.tone(NOTE(72 + [0, 4, 7, 12, 7, 12, 16, 24][i]), 0.1, 'square', 0.16, t + i * 0.05)
        this.noise(0.4, 0.12, t, 3000)
        break
      case 'die':
        this.noise(0.7, 0.4, t, 200)
        this.tone(440, 0.6, 'sawtooth', 0.22, t, 40)
        break
      case 'box':
        for (let i = 0; i < 5; i++) this.tone(NOTE(79 + i * 3), 0.07, 'triangle', 0.25, t + i * 0.05)
        break
      case 'laser':
        this.tone(1400, 0.07, 'square', 0.06, t, 500)
        break
      case 'hit':
        this.tone(200, 0.08, 'square', 0.15, t, 90)
        this.noise(0.06, 0.12, t, 1500)
        break
      case 'kill':
        this.noise(0.25, 0.25, t, 600)
        this.tone(600, 0.2, 'square', 0.12, t, 80)
        break
      case 'bossShot':
        this.tone(220, 0.15, 'sawtooth', 0.07, t, 110)
        break
      case 'fuse':
        this.noise(0.05, 0.06, t, 4000)
        break
      case 'life':
        for (let i = 0; i < 6; i++) this.tone(NOTE(76 + [0, 4, 7, 12, 16, 19][i]), 0.08, 'square', 0.18, t + i * 0.07)
        break
      case 'warn':
        this.tone(880, 0.12, 'square', 0.12, t)
        this.tone(660, 0.12, 'square', 0.12, t + 0.15)
        break
      case 'bossdie':
        for (let i = 0; i < 6; i++) this.noise(0.3, 0.3, t + i * 0.12, 200 + i * 150)
        this.tone(300, 1.2, 'sawtooth', 0.2, t, 30)
        break
      case 'clear': {
        const mel = [72, 76, 79, 84, 79, 84, 88]
        mel.forEach((m, i) => this.tone(NOTE(m), i === mel.length - 1 ? 0.6 : 0.12, 'square', 0.18, t + i * 0.12))
        mel.forEach((m, i) => this.tone(NOTE(m - 12), 0.12, 'triangle', 0.25, t + i * 0.12))
        break
      }
      case 'gameover': {
        const mel = [67, 66, 65, 64, 60]
        mel.forEach((m, i) => this.tone(NOTE(m), i === mel.length - 1 ? 0.9 : 0.25, 'square', 0.18, t + i * 0.28))
        break
      }
    }
  }

  // ---------- müzik ----------

  music(song: Song | null): void {
    this.song = song
    this.step = 0
    if (this.seqTimer) {
      clearInterval(this.seqTimer)
      this.seqTimer = 0
    }
    if (song && this.ctx) this.startSeq()
  }

  private startSeq(): void {
    if (!this.ctx || this.seqTimer) return
    this.nextTime = this.ctx.currentTime + 0.1
    this.seqTimer = window.setInterval(() => this.schedule(), 25)
  }

  private schedule(): void {
    if (!this.ctx || !this.song) return
    const s = this.song
    const stepDur = 60 / s.bpm / 4
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      if (!this.muted) {
        const i = this.step % s.length
        const t = this.nextTime
        const b = s.bass[i]
        if (b) this.tone(NOTE(b), stepDur * 1.8, 'triangle', 0.5, t, undefined, this.musBus)
        const a = s.arp[i]
        if (a) this.tone(NOTE(a), stepDur * 0.9, 'square', 0.12, t, undefined, this.musBus)
        const l = s.lead[i]
        if (l) this.tone(NOTE(l), stepDur * 2.6, 'square', 0.16, t, undefined, this.musBus)
        if (s.drums[i] === 1) this.noise(0.04, 0.12, t, 6000, this.musBus)
        if (s.drums[i] === 2) {
          this.tone(150, 0.12, 'sine', 0.6, t, 40, this.musBus)
        }
        if (s.drums[i] === 3) this.noise(0.12, 0.2, t, 1500, this.musBus)
      }
      this.nextTime += stepDur
      this.step++
    }
  }
}

export interface Song {
  bpm: number
  length: number
  bass: number[]
  arp: number[]
  lead: number[]
  drums: number[]
}

const PROGS = [
  [0, 5, 3, 4],
  [0, 3, 4, 4],
  [0, 4, 5, 3],
  [5, 3, 0, 4],
  [0, 0, 3, 4],
]
const MINOR = [0, 2, 3, 5, 7, 8, 10]
const MAJOR = [0, 2, 4, 5, 7, 9, 11]

/** Tohumdan 4 ölçülük döngüsel bir chiptune üretir. */
export function makeSong(seed: number, opts: { bpm?: number; minor?: boolean; root?: number } = {}): Song {
  let s = seed >>> 0
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  const scale = (opts.minor ?? rnd() < 0.6) ? MINOR : MAJOR
  const root = opts.root ?? 45 + Math.floor(rnd() * 7)
  const prog = PROGS[Math.floor(rnd() * PROGS.length)]
  const bpm = opts.bpm ?? 118 + Math.floor(rnd() * 30)
  const length = 64 * 2
  const bass: number[] = []
  const arp: number[] = []
  const lead: number[] = []
  const drums: number[] = []
  const deg = (d: number) => root + Math.floor(d / 7) * 12 + scale[((d % 7) + 7) % 7]
  const arpPat = rnd() < 0.5 ? [0, 2, 4, 7] : [0, 4, 2, 4]
  let melodyDeg = 7 + 4
  const motif: number[] = []
  for (let i = 0; i < 16; i++) motif.push(rnd() < 0.55 ? Math.floor(rnd() * 5) - 2 : 99)
  for (let i = 0; i < length; i++) {
    const bar = Math.floor(i / 16) % 4
    const chord = prog[bar]
    const st = i % 16
    bass.push(st % 4 === 0 || st === 14 ? deg(chord) - 12 : st % 4 === 2 ? deg(chord) : 0)
    arp.push(st % 2 === 0 ? deg(chord + arpPat[(st / 2) % 4]) + 12 : 0)
    const half = Math.floor(i / 64)
    const m = motif[st]
    if (m !== 99 && (st % 2 === 0 || half === 1)) {
      melodyDeg = Math.max(chord + 5, Math.min(chord + 12, melodyDeg + m))
      lead.push(deg(melodyDeg) + 12)
    } else lead.push(0)
    drums.push(st % 8 === 0 ? 2 : st % 8 === 4 ? 3 : st % 2 === 0 ? 1 : 0)
  }
  return { bpm, length, bass, arp, lead, drums }
}

export const audio = new Audio()
