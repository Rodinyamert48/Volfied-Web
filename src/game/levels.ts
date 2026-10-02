import type { LevelDef } from './types.ts'

/**
 * 15 el, Volfied tarzı: isim + tema + engel adaları + düşman kadrosu + boss.
 * Tema 0..4 arasında döner (render paleti).
 * Boss: 5 / 10 / 15. Boss stage'inde boss'u vurmak da level'ı bitirir.
 */
export const TOTAL_STAGES = 15

const L: LevelDef[] = [
  {
    level: 1, name: 'YEŞİL BAŞLANGIÇ', briefing: 'Isınma turu. 2 serseri, %68 doldur.',
    theme: 0, targetPct: 68,
    roster: [{ kind: 'drifter', count: 2 }],
    freeSpeed: 9, borderEnemies: 0, borderSpeed: 14, boss: null, obstacles: [],
  },
  {
    level: 2, name: 'İKİZ GÖLET', briefing: 'Ortada ada var. Avcı seni kovalar!',
    theme: 1, targetPct: 68,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'hunter', count: 1 }],
    freeSpeed: 9.5, borderEnemies: 0, borderSpeed: 15, boss: null,
    obstacles: [{ x: 33, y: 24, w: 14, h: 10 }],
  },
  {
    level: 3, name: 'ÇAPRAZ ATEŞ', briefing: '2 avcı aktif. İzi kesmeye gelirler.',
    theme: 2, targetPct: 70,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'hunter', count: 2 }],
    freeSpeed: 10, borderEnemies: 1, borderSpeed: 15, boss: null,
    obstacles: [{ x: 10, y: 10, w: 10, h: 8 }, { x: 60, y: 42, w: 10, h: 8 }],
  },
  {
    level: 4, name: 'NİŞANCI SOKAĞI', briefing: 'Gunnerlar uzaktan ateş eder. Yaklaşma!',
    theme: 3, targetPct: 70,
    roster: [{ kind: 'hunter', count: 2 }, { kind: 'gunner', count: 2 }],
    freeSpeed: 10.5, borderEnemies: 1, borderSpeed: 16, boss: null,
    obstacles: [{ x: 33, y: 8, w: 14, h: 6 }, { x: 33, y: 46, w: 14, h: 6 }],
  },
  {
    level: 5, name: 'BOSS: YENGEÇ YUVASI', briefing: 'İLK BOSS! Kıskaç mermilere dikkat. HAPSET ya da VUR!',
    theme: 4, targetPct: 60,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'weaver', count: 1 }],
    freeSpeed: 11, borderEnemies: 1, borderSpeed: 17,
    boss: { hp: 24, speed: 8, name: 'KISKAÇ' },
    obstacles: [{ x: 8, y: 24, w: 8, h: 12 }, { x: 64, y: 24, w: 8, h: 12 }],
  },
  {
    level: 6, name: 'BUZ MAĞARASI', briefing: 'Weaver izini koklar ve keser. Hızlı kapat!',
    theme: 1, targetPct: 72,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'weaver', count: 2 }, { kind: 'hunter', count: 1 }],
    freeSpeed: 11.5, borderEnemies: 1, borderSpeed: 18, boss: null,
    obstacles: [{ x: 20, y: 20, w: 40, h: 4 }],
  },
  {
    level: 7, name: 'KUM TUZAĞI', briefing: '3 gunner çapraz ateş. Duvar arkası güvenlidir.',
    theme: 0, targetPct: 72,
    roster: [{ kind: 'gunner', count: 3 }, { kind: 'hunter', count: 2 }],
    freeSpeed: 12, borderEnemies: 2, borderSpeed: 18, boss: null,
    obstacles: [{ x: 33, y: 24, w: 14, h: 12 }],
  },
  {
    level: 8, name: 'LABİRENT', briefing: '4 ada. Avcılar köşelerde pusuda.',
    theme: 2, targetPct: 74,
    roster: [{ kind: 'hunter', count: 3 }, { kind: 'weaver', count: 2 }],
    freeSpeed: 12.5, borderEnemies: 2, borderSpeed: 19, boss: null,
    obstacles: [
      { x: 12, y: 12, w: 12, h: 12 }, { x: 56, y: 12, w: 12, h: 12 },
      { x: 12, y: 36, w: 12, h: 12 }, { x: 56, y: 36, w: 12, h: 12 },
    ],
  },
  {
    level: 9, name: 'FIRTINA ÖNCESİ', briefing: 'Karışık sürü + hızlı duvar devriyeleri.',
    theme: 3, targetPct: 75,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'hunter', count: 2 }, { kind: 'gunner', count: 2 }, { kind: 'weaver', count: 1 }],
    freeSpeed: 13, borderEnemies: 2, borderSpeed: 20, boss: null,
    obstacles: [{ x: 8, y: 26, w: 20, h: 8 }, { x: 52, y: 26, w: 20, h: 8 }],
  },
  {
    level: 10, name: 'BOSS: GÖZ KÜMESİ', briefing: '2. BOSS! Halka mermi yağmuru. Adaların arkasına saklan!',
    theme: 4, targetPct: 60,
    roster: [{ kind: 'gunner', count: 2 }, { kind: 'weaver', count: 2 }],
    freeSpeed: 13.5, borderEnemies: 2, borderSpeed: 21,
    boss: { hp: 40, speed: 9, name: 'TEK GÖZ' },
    obstacles: [{ x: 33, y: 20, w: 14, h: 8 }, { x: 33, y: 36, w: 14, h: 8 }],
  },
  {
    level: 11, name: 'VOLKAN KALBİ', briefing: 'Her şey hızlı. Weaver sürüsü iz avında.',
    theme: 4, targetPct: 76,
    roster: [{ kind: 'weaver', count: 3 }, { kind: 'hunter', count: 3 }],
    freeSpeed: 14, borderEnemies: 2, borderSpeed: 22, boss: null,
    obstacles: [{ x: 30, y: 10, w: 20, h: 6 }, { x: 30, y: 44, w: 20, h: 6 }, { x: 10, y: 26, w: 12, h: 8 }, { x: 58, y: 26, w: 12, h: 8 }],
  },
  {
    level: 12, name: 'GECE AVCISI', briefing: 'Gunner + hunter koordineli saldırır.',
    theme: 2, targetPct: 78,
    roster: [{ kind: 'gunner', count: 3 }, { kind: 'hunter', count: 3 }, { kind: 'drifter', count: 2 }],
    freeSpeed: 14.5, borderEnemies: 3, borderSpeed: 23, boss: null,
    obstacles: [{ x: 36, y: 6, w: 8, h: 48 }],
  },
  {
    level: 13, name: 'DEMİR ORMAN', briefing: 'Dar koridorlar. Mermiler duvarlarda patlar.',
    theme: 3, targetPct: 78,
    roster: [{ kind: 'weaver', count: 3 }, { kind: 'gunner', count: 3 }],
    freeSpeed: 15, borderEnemies: 3, borderSpeed: 24, boss: null,
    obstacles: [
      { x: 16, y: 8, w: 6, h: 44 }, { x: 32, y: 8, w: 6, h: 44 },
      { x: 48, y: 8, w: 6, h: 44 }, { x: 60, y: 8, w: 6, h: 44 },
    ],
  },
  {
    level: 14, name: 'SON EŞİK', briefing: 'Final öncesi katliam. Her türden 2şer.',
    theme: 0, targetPct: 80,
    roster: [{ kind: 'drifter', count: 2 }, { kind: 'hunter', count: 3 }, { kind: 'gunner', count: 3 }, { kind: 'weaver', count: 3 }],
    freeSpeed: 15.5, borderEnemies: 3, borderSpeed: 25, boss: null,
    obstacles: [{ x: 12, y: 12, w: 8, h: 8 }, { x: 60, y: 12, w: 8, h: 8 }, { x: 12, y: 40, w: 8, h: 8 }, { x: 60, y: 40, w: 8, h: 8 }, { x: 34, y: 25, w: 12, h: 10 }],
  },
  {
    level: 15, name: 'FİNAL BOSS: KARA GIRDAP', briefing: 'SON BOSS! Öldür ya da %70 kapat. Bol şans, pilot.',
    theme: 4, targetPct: 70,
    roster: [{ kind: 'hunter', count: 2 }, { kind: 'gunner', count: 2 }, { kind: 'weaver', count: 2 }],
    freeSpeed: 16, borderEnemies: 3, borderSpeed: 26,
    boss: { hp: 60, speed: 10, name: 'KARA GIRDAP' },
    obstacles: [{ x: 8, y: 8, w: 10, h: 10 }, { x: 62, y: 8, w: 10, h: 10 }, { x: 8, y: 42, w: 10, h: 10 }, { x: 62, y: 42, w: 10, h: 10 }],
  },
]

export function levelDef(level: number): LevelDef {
  const lv = Math.max(1, Math.min(TOTAL_STAGES, level))
  const found = L.find((d) => d.level === lv)
  if (found) return found
  return L[0] as LevelDef
}
