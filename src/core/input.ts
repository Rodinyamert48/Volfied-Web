// Klavye + dokunmatik giriş. Yön tuşları "son basılan kazanır" mantığıyla çalışır.

export type Dir = 'up' | 'down' | 'left' | 'right'
export type Action = Dir | 'confirm' | 'back' | 'pause' | 'mute' | 'fire'

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'fire',
  KeyZ: 'fire',
  KeyJ: 'fire',
  Escape: 'back',
  Backspace: 'back',
  KeyP: 'pause',
  KeyM: 'mute',
}

export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
}

export class Input {
  private held = new Set<Action>()
  private dirStack: Dir[] = []
  private pressedQ: Action[] = []
  slowHeld = false
  onFirstGesture: (() => void) | null = null

  constructor() {
    window.addEventListener('keydown', (e) => {
      this.gesture()
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') {
        this.slowHeld = true
        return
      }
      const a = KEYMAP[e.code]
      if (!a) return
      e.preventDefault()
      if (e.repeat) return
      this.down(a)
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') {
        this.slowHeld = false
        return
      }
      const a = KEYMAP[e.code]
      if (a) this.up(a)
    })
    window.addEventListener('blur', () => {
      this.held.clear()
      this.dirStack = []
      this.slowHeld = false
    })
  }

  private gesture(): void {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture
      this.onFirstGesture = null
      f()
    }
  }

  down(a: Action): void {
    this.gesture()
    if (!this.held.has(a)) this.pressedQ.push(a)
    this.held.add(a)
    if (a in DIRS) {
      const d = a as Dir
      this.dirStack = this.dirStack.filter((x) => x !== d)
      this.dirStack.push(d)
    }
  }

  up(a: Action): void {
    this.held.delete(a)
    if (a in DIRS) this.dirStack = this.dirStack.filter((x) => x !== a)
  }

  isHeld(a: Action): boolean {
    return this.held.has(a)
  }

  /** Şu an basılı olan en son yön. */
  dir(): Dir | null {
    return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null
  }

  /** Bu kare içinde basılan tek seferlik eylemleri döndürür ve kuyruğu boşaltır. */
  consume(): Action[] {
    const q = this.pressedQ
    this.pressedQ = []
    return q
  }

  /** Dokunmatik kontrolleri DOM üzerine kurar. */
  bindTouch(root: HTMLElement): void {
    const bind = (el: Element, a: Action) => {
      const on = (e: Event) => {
        e.preventDefault()
        el.classList.add('on')
        this.down(a)
      }
      const off = (e: Event) => {
        e.preventDefault()
        el.classList.remove('on')
        this.up(a)
      }
      el.addEventListener('pointerdown', on)
      el.addEventListener('pointerup', off)
      el.addEventListener('pointercancel', off)
      el.addEventListener('pointerleave', off)
    }
    root.querySelectorAll<HTMLElement>('[data-act]').forEach((el) => bind(el, el.dataset.act as Action))
    const pad = root.querySelector<HTMLElement>('[data-dpad]')
    if (pad) {
      let cur: Dir | null = null
      let pid = -1
      const set = (d: Dir | null) => {
        if (d === cur) return
        if (cur) this.up(cur)
        cur = d
        if (d) this.down(d)
        pad.dataset.dir = d ?? ''
      }
      const track = (e: PointerEvent) => {
        const b = pad.getBoundingClientRect()
        const dx = e.clientX - (b.left + b.width / 2)
        const dy = e.clientY - (b.top + b.height / 2)
        if (Math.hypot(dx, dy) < b.width * 0.12) return set(null)
        set(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up')
      }
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        pid = e.pointerId
        pad.setPointerCapture(e.pointerId)
        track(e)
      })
      pad.addEventListener('pointermove', (e) => {
        if (e.pointerId === pid) track(e)
      })
      const end = (e: PointerEvent) => {
        if (e.pointerId !== pid) return
        pid = -1
        set(null)
      }
      pad.addEventListener('pointerup', end)
      pad.addEventListener('pointercancel', end)
    }
    const slow = root.querySelector('[data-slow]')
    if (slow) {
      slow.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        this.slowHeld = true
        slow.classList.add('on')
      })
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave'])
        slow.addEventListener(ev, () => {
          this.slowHeld = false
          slow.classList.remove('on')
        })
    }
  }
}
