# Station Zero — Art Brief

Bu dosya, oyunun görsel varlıklarını harici bir araçla (ChatGPT görsel üretimi) üretmek için hazır prompt setidir.
Üretilen kaynak PNG'ler `art-source/` altına bırakılır; `npm run art:build` bunları kırpıp küçültüp
`assets/art/runtime/` altına paketler. Oyun yalnızca runtime çıktısını yükler, kaynak atlasları yüklemez.

## Kurallar (her prompt için geçerli)

- **Stil:** Geç 70'ler / erken 80'ler endüstriyel retro-fütürizm. Paslı çelik, çıplak beton, korozyonlu ızgara,
  soğuk floresan ışığı. "Penal Colony-Null" maden kolonisi.
- **Teknik:** Düşük çözünürlüklü pixel art. Sert kenarlar, anti-aliasing yok, blur yok, parlama (bloom) yok.
  Perspektif yok — ortografik/dimetrik. Fotogerçekçilik, 3D render, suluboya, anime, çizgi film stili yok.
- **Palet:** Aşağıdaki hex değerlerine sadık kal. Doygun renk minimumda.
  - `#050505` void, `#0b0d0c` near black, `#14181a` shadow, `#1f2629` steel dark
  - `#2e3a3d` steel, `#46595c` steel light, `#6f807f` bone, `#c9c4b4` bone light
  - `#8a8f7a` concrete, `#b0a27a` amber dim, `#d9a441` amber, `#ff6b1a` signal
  - `#8c3b2a` rust, `#5a1f1a` blood, `#6b4a7a` violet, `#2a5b6b` cyan
- **Yasaklar:** Yazı/harf/logo/watermark, UI, çerçeve, imza, insan yüzü detayı, drop shadow, yerleşik ışık/gölge.
- **Şeffaflık:** Karakter ve prop PNG'leri şeffaf arka planlı olmalı. ChatGPT şeffaflık vermezse düz
  `#ff00ff` (magenta) zemin iste; arka planı ben temizlerim.
- Her varlığı **tek tek** üret. Aynı sohbette üretmeye devam et ki stil tutarlı kalsın.
- Sonuç 512–1024 px gelirse sorun değil; ben hedef boyuta nearest-neighbor ile indirip hizalayacağım.

## 1. Oyuncu (Exile) — 8 yön

Dosyalar: `assets/art/entities/player_N.png`, `player_NE.png`, `player_E.png`, `player_SE.png`,
`player_S.png`, `player_SW.png`, `player_W.png`, `player_NW.png`
Hedef: **32×48 px**, şeffaf zemin, ayaklar alt kenarda, yatayda ortalanmış, gölge yok (gölge kodla çiziliyor).

Yönler ekran yönüdür (izometrik):

| Dosya | Anlamı | Poz |
| --- | --- | --- |
| `player_N` | Yukarı (sırtı dönük) | arka, düz |
| `player_NE` | Sağ yukarı | arka üç çeyrek, sağa dönük |
| `player_E` | Sağ | sağ profil |
| `player_SE` | Sağ aşağı | ön üç çeyrek, sağa dönük |
| `player_S` | Aşağı (izleyiciye dönük) | ön, düz |
| `player_SW` | Sol aşağı | ön üç çeyrek, sola dönük |
| `player_W` | Sol | sol profil |
| `player_NW` | Sol yukarı | arka üç çeyrek, sola dönük |

> Prompt (S için; diğerlerinde yön/poz cümlesini değiştir):

```text
16-bit pixel art game sprite of a lone prisoner-miner, single character, front view facing the viewer.
Hooded figure, face completely hidden in shadow behind a crude breathing mask, no visible skin or eyes.
Worn dark steel-grey prison fatigues with faint amber shoulder lamp on the left pauldron, scuffed rust
stains, heavy boots, thin oxygen hose. Silhouette must read clearly at 32x48 pixels. Limited palette:
#0b0d0c, #14181a, #1f2629, #2e3a3d, #46595c, #6f807f, #c9c4b4, #d9a441, #8c3b2a. Hard pixel edges,
no anti-aliasing, no drop shadow, no ground shadow. Transparent background. Character centered
horizontally, feet touching the bottom edge of the canvas. Orthographic dimetric game art, late-1970s
industrial retro-futurism, oppressive and melancholic. No text, no UI, no border, no watermark.
```

Yön varyasyonları için cümleyi şöyle değiştir:

- `N`: `back view, facing away from the viewer, hood and backpack visible, shoulder lamp barely visible`
- `NE`: `back three-quarter view, turned toward the upper-right of the screen, right shoulder forward`
- `E`: `side profile view facing the right edge of the screen, lantern arm visible in front`
- `SE`: `front three-quarter view turned toward the lower-right of the screen, face partly visible`
- `SW`: `front three-quarter view turned toward the lower-left of the screen, face partly visible`
- `W`: `side profile view facing the left edge of the screen, lantern arm visible in front`
- `NW`: `back three-quarter view, turned toward the upper-left of the screen, left shoulder forward`

> Turnaround referansı (sadece tutarlılık için, oyuna girmez):

```text
Character turnaround sheet of the same hooded prisoner-miner: eight views in one row, in this order:
back, back-right three-quarter, right profile, front-right three-quarter, front, front-left
three-quarter, left profile, back-left three-quarter. Identical proportions and palette, flat neutral
#101010 background, no shadow, no text, no labels, pixel art, 32x48 character scale.
```

### 1b. Oyuncu yürüyüş döngüsü — tek görsel, 8 sütun × 4 satır

Dosya: `art-source/entities/walk/Hooded Wanderer Walking Sprite Sheet.png`
Hedef: **8 sütun × 4 satır**. Genişlik 1536 px; satır yüksekliği serbest (768 veya 1024 ikisi de
çalışır, kesici hücreleri `genişlik/8` ve `yükseklik/4` olarak hesaplar). Düz `#0a0a09` zemin.

**Tek görsel.** Yönleri ayrı ayrı üretme; 32 karenin tamamı tek sheet'te olsun.

Sütun eşlemesi (kodla aynı): **1 N, 2 NE, 3 E, 4 SE, 5 S, 6 SW, 7 W, 8 NW.** Standart sıra; her yönün
kendi sütunu var, aynalama yok.

#### Prompt

```text
8-direction walking sprite sheet, pixel art, 8 columns and 4 rows, 32 equal cells, flat #0a0a09 background.

Character: a hooded prisoner in a worn dark coat, coat open at the front, both boots visible.
Same character, same size and same colors in every cell.

Columns left to right: north, north-east, east, south-east, south, south-west, west, north-west.
Rows top to bottom: the four frames of the walking animation.

No text, no numbers, no grid lines, no shadow, no border.
```

#### Kritik noktalar

- İlk kelime `walking`. Modele yürüyüşü tarif etmek gerekmiyor; "walking sprite sheet" standart kalıbı
  tetikliyor. Kareleri tek tek anlatmak promptu uzatıp modeli şaşırtıyor.
- `coat open at the front, both boots visible` karakter tarifi olarak kalıyor. Uzun pelerin ön ve 3/4
  görünümlerde bacakları yutuyor; N ve E'nin düzgün olmasının sebebi bacakların görünmesi.
- Satırları `contact / passing / contact / passing` diye açıklama. Sadece "dört kare, walking" yeter.
- Model yine aynı pozu tekrarlarsa tek satır ekle: `natural walking cycle, feet alternate, arms swing`.
  Başka açıklama ekleme.
- Mümkünse mevcut idle sprite'ı referans görsel olarak ekle; karakter, palet ve oranlar tutarlı kalsın.

#### Kontrol

- Sheet tam 8 sütun × 4 satır; her hücre dolu, boşluk veya kayma yok.
- Sütunlar yukarıdaki sırayla. 3. sütun gerçek profil (E), 7. sütun onun tersi (W); ikisi aynı çizim
  olmamalı.
- Her sütunda 4 satır gerçekten farklı; 1. ve 3. satırda öndeki bacak zıt.
- Bacaklar her görünümde görünüyor (pelerin altında kaybolmuyor).
- Aynı sütundaki 4 karede boy, pozisyon ve taban çizgisi sabit.
- `npm run art:build` sonrası `player_walk.png` 32 kare olmalı.

## 2. Zemin ve duvar dokuları — 5 adet

Dosyalar: `assets/art/textures/tex_floor_a.png`, `tex_floor_b.png`, `tex_grate.png`,
`tex_wall_a.png`, `tex_wall_b.png`
Hedef: **512×512 px, seamless/tileable, düz (top-down) doku**. İzometrik elmas değil — elmas maskesi kodda.
Dokuda ışık/gölge/ambiyans olmasın; sadece malzeme ve aşınma.

Ortak ek: `seamless tileable texture, perfectly repeating at the edges, orthographic top-down flat material
swatch, even flat lighting, no perspective, no vignette, no border, no text.`

| Dosya | Prompt özü |
| --- | --- |
| `tex_floor_a` | Ağır çelik zemin plakaları, kaynak dikişleri, paslı cıvatalar, hafif çizikler |
| `tex_floor_b` | Çatlak beton, kumlu yüzey, küçük moloz lekeleri |
| `tex_grate` | Korozyonlu metal ızgara, koyu boşluklar, ıslak leke |
| `tex_wall_a` | Dikey çelik panel, perçinler, boya dökülmesi, pas akıntısı |
| `tex_wall_b` | Hasarlı panel, çökük göçük, açıkta kalan kablo, soluk uyarı bandı kalıntısı |

> Örnek prompt (`tex_floor_a`):

```text
Seamless tileable pixel art texture of heavy industrial steel floor plates, 512x512. Welded seams,
bolted corners, scuffed and scratched surface, faint rust bleeding from the bolts, dust and grit in
the grooves. Muted palette: #1f2629, #2e3a3d, #46595c, #8c3b2a, #14181a, #050505. Even flat lighting,
no baked shadows, no highlights, orthographic top-down material swatch, perfectly repeating at the edges.
Late-1970s penal mining colony. Hard pixel edges, no anti-aliasing, no text, no border, no watermark.
```

> Not: `tex_wall_a` / `tex_wall_b` için aynı promptu "vertical steel wall panels, rivets, paint peeling,
rust streaks" ve "damaged panel, dented plating, exposed cable, faded hazard stripe remnant" olarak değiştir.
Doku dikeyde de tekrar edebilir olmalı (duvar yüksekliği kodda 46 px).

## 3. Prop'lar — 4 adet

Dosyalar: `assets/art/props/prop_barrel.png`, `prop_crate.png`, `prop_terminal.png`, `prop_pipe.png`
Hedef: **64×96 px**, şeffaf zemin, taban alt kenarda ortalanmış, gölge yok, ışık yok.

> Ortak prompt iskeleti:

```text
Pixel art isometric game prop on a 64x96 transparent canvas: <NESNE>. Single object, dimetric 2:1
projection consistent with a 64x32 floor tile, base centered and touching the bottom edge, no ground
shadow, no drop shadow, no text, no UI. Worn industrial materials, rust, grime, muted palette
#1f2629 #2e3a3d #46595c #6f807f #8c3b2a #d9a441. Late-1970s penal mining colony, oppressive mood.
Hard pixel edges, no anti-aliasing.
```

| Dosya | `<NESNE>` |
| --- | --- |
| `prop_barrel` | a dented chemical barrel with faded hazard band |
| `prop_crate` | a stacked pair of scuffed supply crates with stencilled marks (no readable letters) |
| `prop_terminal` | a dead wall terminal on a short pedestal, cracked screen, dangling cable |
| `prop_pipe` | a broken floor pipe stub with leaking valve wheel and rubble |

## 4. Decal'ler — 2 adet

Dosyalar: `assets/art/decals/decal_stain.png`, `decal_scorch.png`
Hedef: **64×32 px**, şeffaf zemin, zemine yapışık (yükseklik yok), keskin kenar.

```text
Pixel art floor decal, 64x32 pixels, transparent background, viewed at the same dimetric 2:1 angle as a
64x32 isometric floor tile, flat on the ground, no height, no shadow, no text: <LEKE>. Subtle, dark,
weathered. Palette #14181a #1f2629 #5a1f1a #8c3b2a #050505. Hard pixel edges, no anti-aliasing.
```

| Dosya | `<LEKE>` |
| --- | --- |
| `decal_stain` | an old dark oil and blood stain spreading into the tile seams |
| `decal_scorch` | a scorched blast mark with cracked, blackened edges |

## 5. Drone (VS-03 için, sonra)

Dosyalar: `assets/art/enemies/drone_N.png`, `drone_NE.png`, `drone_E.png`, `drone_SE.png`,
`drone_S.png`, `drone_SW.png`, `drone_W.png`, `drone_NW.png` — **40×40 px**, şeffaf, gölge yok, 8 yön.
Yön mantığı oyuncuyla aynı. Prompt:

```text
Pixel art game sprite of a rogue maintenance drone, single object, <YÖN> view, 40x40 pixels. Rusted
industrial hover unit, single cold cyan sensor eye, exposed wiring, dented chassis, no legs, hovering
just above the ground. Reads clearly at small size. Palette #1f2629 #2e3a3d #46595c #2a5b6b #8c3b2a
#d9a441. Hard pixel edges, no anti-aliasing, no ground shadow, transparent background, centered.
Late-1970s retro-futurist penal colony. No text, no UI, no watermark.
```

## Teslim ve entegrasyon

1. PNG'leri yukarıdaki **tam dosya adlarıyla** `assets/art/...` klasörlerine bırak.
2. Bana "art hazır" de; `manifest.ts`'te ilgili kayıtları `enabled: true` yapıp yükleyeceğim.
3. Boyut/şeffaflık/hizalama düzeltmelerini (kırpma, nearest-neighbor küçültme, magenta key) ben yapacağım.
4. İlk entegrasyondan sonra `TileShaper` gerçek dokuları otomatik olarak 64×32 elmasa ve 64×78 duvara çevirir.

### Kalite kontrol listesi

- [ ] Doğru dosya adı ve klasör
- [ ] Şeffaf arka plan (karakter/prop/decal)
- [ ] Işık/gölge dokuda yok (kod ekliyor)
- [ ] Yazı, logo, watermark yok
- [ ] Palet yukarıdaki hex'lere yakın
- [ ] Karakterin ayakları alt kenarda, yatayda ortada
- [ ] 8 yön birbiriyle aynı oran ve renklerde
- [ ] Yönler tablodaki pozlarla eşleşiyor (N=arka, S=ön, E/W=profil, çaprazlar üç çeyrek)
