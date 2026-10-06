// 25 stage ve 4 zorluk seviyesi tanımı.
import type { MinionKind } from '../gfx/sprites.ts'

export type Ability = 'hunt' | 'aim' | 'ring' | 'dash' | 'spawn' | 'spiral'

export interface StageDef {
  name: string
  pic: number
  hue: string
  boss: { name: string; size: number; speed: number; abil: Ability[]; body: string; accent: string; eye: string }
  minions: Partial<Record<MinionKind, number>>
  sparks: number
  boxes: number
  time: number
}

export interface Difficulty {
  name: string
  desc: string
  lives: number
  target: number
  enemySpeed: number
  minionMul: number
  sparkAdd: number
  fireMul: number
  timeMul: number
  scoreMul: number
  boxAdd: number
}

export const DIFFS: Difficulty[] = [
  { name: 'KOLAY', desc: '5 CAN  HEDEF %70  YAVAŞ DÜŞMAN', lives: 5, target: 70, enemySpeed: 0.75, minionMul: 0.6, sparkAdd: -1, fireMul: 0.6, timeMul: 1.4, scoreMul: 0.5, boxAdd: 2 },
  { name: 'NORMAL', desc: '3 CAN  HEDEF %80  KLASİK VOLFIED', lives: 3, target: 80, enemySpeed: 1, minionMul: 1, sparkAdd: 0, fireMul: 1, timeMul: 1, scoreMul: 1, boxAdd: 0 },
  { name: 'ZOR', desc: '3 CAN  HEDEF %85  HIZLI VE SALDIRGAN', lives: 3, target: 85, enemySpeed: 1.2, minionMul: 1.35, sparkAdd: 1, fireMul: 1.4, timeMul: 0.85, scoreMul: 1.5, boxAdd: -1 },
  { name: 'EFSANE', desc: '2 CAN  HEDEF %90  SADECE USTALAR', lives: 2, target: 90, enemySpeed: 1.4, minionMul: 1.6, sparkAdd: 2, fireMul: 1.8, timeMul: 0.75, scoreMul: 2.5, boxAdd: -2 },
]

const B = (name: string, size: number, speed: number, abil: Ability[], body: string, accent: string, eye = '#ff2a2a') => ({ name, size, speed, abil, body, accent, eye })

export const STAGES: StageDef[] = [
  { name: 'YEŞİL VADİ', pic: 0, hue: '#3af06a', boss: B('BLOBO', 24, 30, [], '#4ad04a', '#c8ff4a'), minions: { bouncer: 2 }, sparks: 0, boxes: 4, time: 200 },
  { name: 'GÜN BATIMI', pic: 1, hue: '#ff7a3a', boss: B('KRAB-O', 24, 32, [], '#ff6a3a', '#ffd03a'), minions: { bouncer: 2, wander: 1 }, sparks: 1, boxes: 4, time: 200 },
  { name: 'NEON ŞEHİR', pic: 2, hue: '#ff3af0', boss: B('NEONİX', 26, 34, ['hunt'], '#c03aff', '#3af0ff', '#3af0ff'), minions: { bouncer: 2, chaser: 1 }, sparks: 1, boxes: 4, time: 200 },
  { name: 'ÇÖL PİRAMİTLERİ', pic: 3, hue: '#ffb03a', boss: B('SKARAB', 26, 34, ['aim'], '#d0a03a', '#3a8aff'), minions: { wander: 2, bouncer: 1 }, sparks: 1, boxes: 4, time: 200 },
  { name: 'KUZEY IŞIKLARI', pic: 4, hue: '#3affc0', boss: B('BOREALİS', 28, 36, ['ring'], '#3ac0d0', '#b8ff9a'), minions: { bouncer: 2, seeker: 1 }, sparks: 2, boxes: 4, time: 210 },
  { name: 'MERCAN RESİFİ', pic: 5, hue: '#3ac0ff', boss: B('AHTAPOT', 28, 36, ['spawn'], '#ff5a8a', '#ffd0e0', '#ffe03a'), minions: { wander: 3 }, sparks: 1, boxes: 4, time: 210 },
  { name: 'VOLKAN', pic: 6, hue: '#ff4a1a', boss: B('MAGMOR', 28, 38, ['dash', 'ring'], '#d03a1a', '#ffb030', '#ffe03a'), minions: { bouncer: 3 }, sparks: 2, boxes: 4, time: 210 },
  { name: 'HALKALI GEZEGEN', pic: 7, hue: '#e0a060', boss: B('SATÜRNA', 28, 38, ['aim', 'hunt'], '#e0a060', '#7a4a2a'), minions: { chaser: 2, bouncer: 1 }, sparks: 2, boxes: 4, time: 210 },
  { name: 'GECE ORMANI', pic: 8, hue: '#4a7aff', boss: B('GÖLGE', 28, 40, ['hunt', 'spawn'], '#3a4a8a', '#c8ff4a', '#c8ff4a'), minions: { seeker: 2, wander: 1 }, sparks: 2, boxes: 4, time: 220 },
  { name: 'KRİSTAL MAĞARA', pic: 9, hue: '#b07aff', boss: B('KRİSTALOS', 30, 40, ['ring', 'aim'], '#7af0ff', '#ff7af0', '#ff3af0'), minions: { shooter: 1, bouncer: 2 }, sparks: 2, boxes: 4, time: 220 },
  { name: 'SAKURA DAĞI', pic: 10, hue: '#ff9ac0', boss: B('ONİ', 30, 40, ['dash', 'aim'], '#d02a3a', '#ffd03a', '#ffe03a'), minions: { chaser: 1, wander: 2 }, sparks: 2, boxes: 4, time: 220 },
  { name: 'FIRTINA KALESİ', pic: 11, hue: '#8aa0ff', boss: B('VOLTAR', 30, 42, ['spiral'], '#5a6a9a', '#ffe03a', '#ffe03a'), minions: { shooter: 1, seeker: 1, bouncer: 1 }, sparks: 3, boxes: 4, time: 220 },
  { name: 'MANTAR ORMANI', pic: 12, hue: '#c05aff', boss: B('SPORUS', 30, 42, ['spawn', 'ring'], '#ff7a3a', '#fff0c0'), minions: { wander: 3, chaser: 1 }, sparks: 2, boxes: 4, time: 230 },
  { name: 'MİYAV ADASI', pic: 13, hue: '#ffc0d8', boss: B('MİYAVZOR', 30, 44, ['dash', 'hunt'], '#3a3a4a', '#f0a040', '#7ad03a'), minions: { bouncer: 3, seeker: 1 }, sparks: 3, boxes: 4, time: 230 },
  { name: 'FIRTINALI FENER', pic: 14, hue: '#fff3a0', boss: B('LEVİATAN', 32, 44, ['aim', 'spiral'], '#2a6a8a', '#7affd0'), minions: { shooter: 2, wander: 1 }, sparks: 3, boxes: 4, time: 230 },
  { name: 'NEBULA', pic: 15, hue: '#ff7ac0', boss: B('NEBULON', 32, 44, ['ring', 'spawn', 'hunt'], '#8a2a9a', '#7ad0ff', '#7ad0ff'), minions: { seeker: 2, bouncer: 2 }, sparks: 3, boxes: 4, time: 240 },
  { name: 'ROBOT FABRİKASI', pic: 16, hue: '#3af6ff', boss: B('MEKA-9', 32, 46, ['aim', 'dash'], '#8a9aaa', '#ff3a3a', '#3af0ff'), minions: { shooter: 2, chaser: 1 }, sparks: 3, boxes: 4, time: 240 },
  { name: 'EJDERHA YUVASI', pic: 17, hue: '#ff5a3a', boss: B('DRAKON', 32, 46, ['spiral', 'dash'], '#8a1a2a', '#ffb030', '#ffe03a'), minions: { chaser: 2, bouncer: 2 }, sparks: 3, boxes: 4, time: 240 },
  { name: 'GÖKKUŞAĞI ŞELALESİ', pic: 18, hue: '#6ac0ff', boss: B('HİDRA', 32, 48, ['spawn', 'aim', 'hunt'], '#2a9a6a', '#b8ff9a'), minions: { wander: 2, seeker: 2 }, sparks: 3, boxes: 4, time: 240 },
  { name: 'YÖRÜNGE İSTASYONU', pic: 19, hue: '#7ac8ff', boss: B('ORBİTRON', 34, 48, ['ring', 'aim', 'dash'], '#aab4c0', '#3a6aff', '#ff3a3a'), minions: { shooter: 2, bouncer: 2 }, sparks: 4, boxes: 4, time: 250 },
  { name: 'BAYKUŞ TEPESİ', pic: 20, hue: '#ffb000', boss: B('GECEKUŞU', 34, 50, ['hunt', 'spiral'], '#7a5030', '#e0c8a0', '#ffb000'), minions: { chaser: 3, seeker: 1 }, sparks: 4, boxes: 4, time: 250 },
  { name: 'SYNTHWAVE', pic: 21, hue: '#ff3af0', boss: B('RETROX', 34, 50, ['spiral', 'aim', 'spawn'], '#ff3af0', '#3af0ff', '#fff36a'), minions: { bouncer: 3, shooter: 1 }, sparks: 4, boxes: 4, time: 250 },
  { name: 'BUZ GEZEGENİ', pic: 22, hue: '#c8f0ff', boss: B('KRİYO', 34, 52, ['ring', 'dash', 'hunt'], '#9acdf0', '#ffffff', '#3a6aff'), minions: { seeker: 2, chaser: 2 }, sparks: 4, boxes: 4, time: 260 },
  { name: 'İSTİLA', pic: 23, hue: '#7aff8a', boss: B('ANA GEMİ', 36, 52, ['spawn', 'spiral', 'aim'], '#5a667a', '#7aff8a', '#7aff8a'), minions: { shooter: 2, chaser: 2, bouncer: 1 }, sparks: 5, boxes: 4, time: 260 },
  { name: 'EVE DÖNÜŞ', pic: 24, hue: '#ffe83a', boss: B('KARA İMPARATOR', 38, 54, ['ring', 'spiral', 'dash', 'aim', 'hunt', 'spawn'], '#6a2a8a', '#ff3a3a', '#ff3a3a'), minions: { bouncer: 2, chaser: 2, seeker: 1, shooter: 1 }, sparks: 5, boxes: 5, time: 280 },
]

export const STAGE_COUNT = STAGES.length
