# Volfied Web

Klasik **Volfied** (Qix türü) arcade oyununun pixel-art web versiyonu. Vite + TypeScript + Canvas, harici görsel/ses dosyası yok: tüm resimler, sprite'lar, font ve müzik kodla üretilir.

- **25 stage**: her stage'in kendi resmi, boss'u, düşman dizilimi ve müziği var
- **Alan kapattıkça resim açılır**: kapattığın her bölge altındaki pixel-art resmi gösterir
- **4 zorluk**: KOLAY, NORMAL, ZOR, EFSANE (can sayısı, hedef yüzde, düşman hızı ve ateş sıklığı değişir)
- **Stage seçimi**: geçtiğin stage'ler her zorlukta ayrı ayrı açılır
- **Galeri**: açtığın 25 resmi tam boy izleyebilirsin
- Gizemli güçlendirme kutuları, lazer ile boss avı, chiptune müzik, mobil dokunmatik kontroller

## Oyna

```bash
npm install
npm run dev      # geliştirme sunucusu
npm run build    # üretim derlemesi (dist/)
npm run preview
```

Canlı (GitHub Pages): `https://Rodinyamert48.github.io/Volfied-Web/`

## Kurallar

1. Geminle alanın kenarında dolaş.
2. Boşluğa girince arkanda iz kalır. Tekrar kenara ulaştığında, **boss'un olmadığı taraf** kapanır ve resim açılır.
3. Hedef yüzdeye ulaşınca (NORMAL'de %80) stage biter.
4. Bir düşman izine ya da sana değerse can gider. Çizerken durursan **fitil** izin boyunca yanmaya başlar.
5. Kenarda dolaşan **kıvılcımlar** kenarda da tehlikelidir.
6. Küçük düşmanları kapattığın alanda hapsedersen +500 puan.
7. Süre biterse boss öfkelenir ve hızlanır.

### Kontroller

| Tuş | Eylem |
| --- | --- |
| Oklar / WASD | Hareket |
| Shift / X (basılı) | Yavaş kesim (x2 puan) |
| Space / Z | Lazer ateşi (LAZER kutusu alınınca) |
| P | Duraklat |
| Esc | Menü / geri |
| M | Ses aç/kapa |
| Enter | Onayla |

Mobilde ekranın altında D-pad ve ATEŞ / YAVAŞ / TAMAM tuşları çıkar.

### Gizemli kutular (?)

Kutuyu kapattığın alanın içinde bırakınca içinden rastgele biri çıkar:
**HIZ**, **LAZER**, **DONDUR**, **KALKAN**, **YAVAŞLAT**, **+1 CAN**, **+5000**.
Lazerle boss'un canını bitirirsen stage anında biter (+10000).

### Zorluklar

| Zorluk | Can | Hedef | Not |
| --- | --- | --- | --- |
| KOLAY | 5 | %70 | Yavaş düşmanlar, daha çok kutu |
| NORMAL | 3 | %80 | Klasik Volfied |
| ZOR | 3 | %85 | Hızlı ve saldırgan |
| EFSANE | 2 | %90 | Puan x2.5 |

## Stage'ler

1 Yeşil Vadi · 2 Gün Batımı · 3 Neon Şehir · 4 Çöl Piramitleri · 5 Kuzey Işıkları · 6 Mercan Resifi · 7 Volkan · 8 Halkalı Gezegen · 9 Gece Ormanı · 10 Kristal Mağara · 11 Sakura Dağı · 12 Fırtına Kalesi · 13 Mantar Ormanı · 14 Miyav Adası · 15 Fırtınalı Fener · 16 Nebula · 17 Robot Fabrikası · 18 Ejderha Yuvası · 19 Gökkuşağı Şelalesi · 20 Yörünge İstasyonu · 21 Baykuş Tepesi · 22 Synthwave · 23 Buz Gezegeni · 24 İstila · 25 Eve Dönüş

Boss'lar stage ilerledikçe yeni yetenekler kazanır: kovalama, nişanlı atış, halka atış, spiral atış, hücum ve yavru üretme.

## Yapı

```
src/main.ts            # döngü, menü, zorluk/stage seçimi, galeri, nasıl oynanır
src/game/game.ts       # oyun motoru: oyuncu, kesim, boss, düşmanlar, kutular, HUD
src/game/field.ts      # ızgara, kenar haritası, flood-fill ile alan kapatma
src/game/stages.ts     # 25 stage + 4 zorluk tanımı
src/gfx/pictures.ts    # 25 prosedürel pixel-art resim
src/gfx/sprites.ts     # gemi/düşman sprite'ları + prosedürel boss üreticisi
src/gfx/pix.ts         # pixel tamponu, dithering, çizim yardımcıları
src/gfx/font.ts        # Türkçe karakterli 5x7 bitmap font
src/core/audio.ts      # WebAudio efektleri + chiptune üretici
src/core/input.ts      # klavye + dokunmatik
src/core/storage.ts    # rekor, açılan stage'ler, galeri (localStorage)
```

Test için `?debug` parametresiyle açıp oyunda **N** tuşuna basarak stage'i anında bitirebilirsin.

## Deploy

`main`'e push → `.github/workflows/pages.yml` → GitHub Pages. `vite.config.ts` içinde `base: '/Volfied-Web/'` ayarlı.
