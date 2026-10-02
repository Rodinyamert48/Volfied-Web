export class Sfx {
  private ctx: AudioContext | null = null
  muted = false

  private ac(): AudioContext | null {
    if (this.muted) return null
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        this.ctx = new AC()
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return this.ctx
    } catch {
      return null
    }
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.12, slide = 0): void {
    const ctx = this.ac()
    if (!ctx) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, ctx.currentTime)
    if (slide !== 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur)
    g.gain.setValueAtTime(vol, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur + 0.02)
  }

  cut(): void {
    this.blip(700, 0.05, 'square', 0.05)
  }
  fill(): void {
    this.blip(300, 0.18, 'square', 0.12, 500)
  }
  death(): void {
    this.blip(400, 0.5, 'sawtooth', 0.14, -350)
  }
  clear(): void {
    this.blip(500, 0.12, 'square', 0.1, 200)
    setTimeout(() => this.blip(750, 0.12, 'square', 0.1, 200), 110)
    setTimeout(() => this.blip(1000, 0.2, 'square', 0.1), 220)
  }
  bonus(): void {
    this.blip(900, 0.1, 'triangle', 0.12, 400)
  }
  start(): void {
    this.blip(440, 0.1, 'square', 0.1, 440)
  }
}
