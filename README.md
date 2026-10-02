# Volfied-Web

Pixel-art Volfied (Qix clone) — Vite + TypeScript + Canvas.

Duvar üzerinde ilerle, boşluğa dalıp iz bırak, duvara dönerek alanı kapat. İzi düşman keserse yanarsın.

## Oyna

- Dev: `npm install` → `npm run dev`
- Build: `npm run build` → `npm run preview`
- Canlı (Pages): `https://Rodinyamert48.github.io/Volfied-Web/`

## Kontroller

- Oklar / WASD: hareket
- SPACE (basılı): hızlı kesim (2x puan)
- P: duraklat, M: ses, ENTER: başlat
- Mobil: canvas üzerinde kaydır

## Kurallar

- Hedef doluluk: Level 1 %68, her level +2 (max %88)
- Kapatılan her hücre 10 puan (hızlı kesim x2)
- Düşmanı kapana kıstır: +1000
- Bonus: yeşil +500, mavi 8sn yavaşlatma, pembe +1 can
- 3 can. Turuncu duvar düşmanına (L2+) dikkat.

## Yapı

```
src/main.ts          # boot, loop, input, HUD
src/game/grid.ts     # WALL/EMPTY/TRAIL + flood-fill
src/game/engine.ts   # player, kesim, skor, level
src/game/enemies.ts  # serbest + duvar düşmanları
src/game/levels.ts   # level tanımları
src/render/pixel.ts  # canvas pixel render
src/audio/sfx.ts     # WebAudio retro SFX
```

## Deploy

`main`'e push → `.github/workflows/pages.yml` → GitHub Pages.
`vite.config.ts` içinde `base: '/Volfied-Web/'` ayarlı.
