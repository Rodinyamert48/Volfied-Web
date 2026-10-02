# Volfied-Web

Pixel-art Volfied (Qix clone) — Vite + TypeScript + Canvas.
**15 stage • 4 düşman AI + 3 boss • ateş etme • harita adaları.**

Duvar üzerinde ilerle, boşluğa dalıp iz bırak, duvara dönerek alanı kapat. Düşmanlar artık saldırıyor: kovan, ateş eden, izini kesen türler var. Geminde top var — vur ya da hapset.

## Oyna

- Dev: `npm install` → `npm run dev`
- Build: `npm run build` → `npm run preview`
- Canlı (Pages): `https://Rodinyamert48.github.io/Volfied-Web/`

## Kontroller

- Oklar / WASD: hareket
- SPACE (basılı): hızlı kesim (2x puan)
- J / X / K veya TIK: ateş (en yakın düşmana kilitlenir)
- P: duraklat, M: ses, ENTER: başlat
- Mobil: kaydır = hareket, dokun = ateş

## Düşman AI

- DRIFTER (kırmızı, 1 can, 200p): klasik serseri mayın, seker
- HUNTER (mor, 2 can, 400p): seni kovalar
- GUNNER (yeşil, 2 can, 600p): mesafeyi korur, nişan alıp ateş eder
- WEAVER (sarı, 1 can, 500p): TRAIL'ini koklar, izi kesmeye gelir
- Duvar devriyesi (turuncu, 2 can, 300p): duvar üstünde gezer, ateş eder
- BOSS (5/10/15): KISKAÇ, TEK GÖZ, KARA GIRDAP — halka mermi + charge, hapsedersen 12 hasar, vurursan canı azalır. Boss'u öldürmek stage'i bitirir (+5000).

## Stage'ler (15)

1 Yeşil Başlangıç → 2 İkiz Gölet → 3 Çapraz Ateş → 4 Nişancı Sokağı → **5 BOSS Yengeç** → 6 Buz Mağarası → 7 Kum Tuzağı → 8 Labirent → 9 Fırtına Öncesi → **10 BOSS Göz** → 11 Volkan → 12 Gece Avcısı → 13 Demir Orman → 14 Son Eşik → **15 FİNAL Kara Girdap**.

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
