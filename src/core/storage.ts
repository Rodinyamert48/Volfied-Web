// localStorage tabanlı kayıt: rekorlar, açılan stage'ler, galeri, ses tercihi.

export interface Save {
  hi: number[] // zorluk başına rekor
  reached: number[] // zorluk başına ulaşılan en yüksek stage (0 tabanlı)
  gallery: number[] // açılmış resimler
  muted: boolean
  diff: number
}

const KEY = 'volfied-web-save-v2'

function blank(): Save {
  return { hi: [0, 0, 0, 0], reached: [0, 0, 0, 0], gallery: [], muted: false, diff: 1 }
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return blank()
    const s = { ...blank(), ...(JSON.parse(raw) as Partial<Save>) }
    return s
  } catch {
    return blank()
  }
}

export function writeSave(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* gizli sekme vb. — yok say */
  }
}
