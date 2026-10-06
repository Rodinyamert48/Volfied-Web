// Oyun alanı ızgarası: boş / kapatılmış / iz hücreleri, kenar haritası ve flood-fill ile alan kapatma.

export const FW = 300
export const FH = 200
export const EMPTY = 0
export const CLAIMED = 1
export const TRAIL = 2

export class Field {
  readonly cells = new Uint8Array(FW * FH)
  readonly edge = new Uint8Array(FW * FH)
  readonly flash = new Float32Array(FW * FH)
  private readonly stack = new Int32Array(FW * FH)
  private readonly mark = new Uint8Array(FW * FH)
  claimed = 0
  private base = 0

  reset(): void {
    this.cells.fill(EMPTY)
    this.flash.fill(0)
    for (let x = 0; x < FW; x++) {
      this.cells[x] = CLAIMED
      this.cells[x + (FH - 1) * FW] = CLAIMED
    }
    for (let y = 0; y < FH; y++) {
      this.cells[y * FW] = CLAIMED
      this.cells[FW - 1 + y * FW] = CLAIMED
    }
    this.claimed = 0
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i] === CLAIMED) this.claimed++
    this.base = this.claimed
    this.computeEdges()
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < FW && y < FH
  }

  at(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= FW || y >= FH) return CLAIMED
    return this.cells[x + y * FW]
  }

  isEdge(x: number, y: number): boolean {
    return this.inside(x, y) && this.edge[x + y * FW] === 1
  }

  /** Kapatılmış ve 8-komşusunda boş hücre olan hücreler oyuncunun yürüyebileceği kenardır. */
  computeEdges(): void {
    const c = this.cells
    this.edge.fill(0)
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const i = x + y * FW
        if (c[i] !== CLAIMED) continue
        let e = 0
        for (let dy = -1; dy <= 1 && !e; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue
            if (c[nx + ny * FW] !== CLAIMED) {
              e = 1
              break
            }
          }
        this.edge[i] = e
      }
  }

  percent(): number {
    return ((this.claimed - this.base) / (FW * FH - this.base)) * 100
  }

  /**
   * İzi kapatır; tohum noktalarından (boss) ulaşılamayan tüm boş bölgeleri doldurur.
   * Yeni kapatılan hücre sayısını döndürür.
   */
  capture(trail: number[], seeds: number[]): number {
    const c = this.cells
    let gained = 0
    for (const i of trail) {
      if (c[i] !== CLAIMED) {
        c[i] = CLAIMED
        this.flash[i] = 1
        gained++
      }
    }
    this.mark.fill(0)
    let sp = 0
    for (const s of seeds) {
      if (c[s] === EMPTY && !this.mark[s]) {
        this.mark[s] = 1
        this.stack[sp++] = s
      }
    }
    while (sp > 0) {
      const i = this.stack[--sp]
      const x = i % FW
      if (x > 0 && c[i - 1] === EMPTY && !this.mark[i - 1]) {
        this.mark[i - 1] = 1
        this.stack[sp++] = i - 1
      }
      if (x < FW - 1 && c[i + 1] === EMPTY && !this.mark[i + 1]) {
        this.mark[i + 1] = 1
        this.stack[sp++] = i + 1
      }
      if (i >= FW && c[i - FW] === EMPTY && !this.mark[i - FW]) {
        this.mark[i - FW] = 1
        this.stack[sp++] = i - FW
      }
      if (i < FW * (FH - 1) && c[i + FW] === EMPTY && !this.mark[i + FW]) {
        this.mark[i + FW] = 1
        this.stack[sp++] = i + FW
      }
    }
    for (let i = 0; i < c.length; i++) {
      if (c[i] === EMPTY && !this.mark[i]) {
        c[i] = CLAIMED
        this.flash[i] = 1
        gained++
      }
    }
    this.claimed += gained
    this.computeEdges()
    return gained
  }

  /** Stage bitince kalan her şeyi açığa çıkar. */
  fillAll(): void {
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] !== CLAIMED) {
        this.cells[i] = CLAIMED
        this.flash[i] = 1
        this.claimed++
      }
    }
    this.edge.fill(0)
  }

  /** (x,y)'ye en yakın kenar hücresini BFS ile bulur. */
  nearestEdge(x: number, y: number): [number, number] {
    if (this.isEdge(x, y)) return [x, y]
    this.mark.fill(0)
    let head = 0
    let tail = 0
    const start = Math.max(0, Math.min(FW - 1, x)) + Math.max(0, Math.min(FH - 1, y)) * FW
    this.stack[tail++] = start
    this.mark[start] = 1
    while (head < tail) {
      const i = this.stack[head++]
      if (this.edge[i]) return [i % FW, Math.floor(i / FW)]
      const ix = i % FW
      const nb = [ix > 0 ? i - 1 : -1, ix < FW - 1 ? i + 1 : -1, i - FW, i + FW]
      for (const n of nb) {
        if (n < 0 || n >= FW * FH || this.mark[n]) continue
        this.mark[n] = 1
        this.stack[tail++] = n
      }
    }
    return [0, 0]
  }

  /** Boş hücrelerden rastgele birini seçer (koşula uyan). */
  randomEmpty(rand: () => number, ok: (x: number, y: number) => boolean, margin = 4): [number, number] | null {
    for (let k = 0; k < 400; k++) {
      const x = margin + Math.floor(rand() * (FW - margin * 2))
      const y = margin + Math.floor(rand() * (FH - margin * 2))
      if (this.cells[x + y * FW] === EMPTY && ok(x, y)) return [x, y]
    }
    return null
  }
}
