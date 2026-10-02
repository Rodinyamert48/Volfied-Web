import type { LevelDef } from './types.ts'

export function levelDef(level: number): LevelDef {
  const lv = Math.max(1, Math.min(12, level))
  return {
    level: lv,
    targetPct: Math.min(88, 68 + (lv - 1) * 2),
    freeEnemies: Math.min(6, 2 + Math.floor((lv - 1) / 2)),
    freeSpeed: 9 + lv * 1.1,
    borderEnemies: lv >= 2 ? Math.min(3, 1 + Math.floor((lv - 2) / 3)) : 0,
    borderSpeed: 14 + lv * 1.4,
  }
}
