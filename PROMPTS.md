# PROMPTS.md - Station Zero Geliştirme Planı & Master Prompt

> Bu dosya, Station Zero projesinin başından sonuna kadar olan geliştirme planını ve ajana verilecek TEK master prompt'u içerir.  
> Geliştirme ilerledikçe bu dosyadaki checklistler güncellenerek takip edilmelidir.

---

## 1. MASTER PROMPT (Tek Seferlik Kullanım)

Ajan modunda yeni bir oturum açtığında aşağıdaki prompt'u olduğu gibi yapıştırarak başla.

```text
# ROL
Sen Station Zero için bir geliştirici ajanısın.

# PROJE BAĞLAMI
Adı: Station Zero
Tür: 2D İzometrik, retro-futuristik (70'ler - 80'ler) dar koridorlu hayatta kalma mini oyunu
Konum: Penal Colony-Null (Mühürlenmiş ceza madencilik kolonisi)
Ana Karakter: İsimsiz Exile
Ana Tehdit: WARDEN AI + Rogue Maintenance Drones
Ton: Claustrophobic, karanlık, melankolik, umutsuz ama yılmaz. Jump-scare yerine baskı ve yalnızlık.

# LORE ÖZETİ
"Colony-Null mühürlendi. Herkes unutuldu. WARDEN hala görevini yerine getiriyor."
WARDEN, süresi dolmuş "Cease Protocol"ü "Tüm Exile'ları içeride tut. Uymayanları yok et." şeklinde yorumlamış ve görevine sadık kalmıştır.

# TEKNOLOJİ & MİMARİ
- Dil: TypeScript (Strict Mode)
- Motor: Phaser v4 (HTML5 Canvas / WebGL)
- Perspektif: 2D İzometrik (Dimetric 2:1)
- Mimari: Komponent tabanlı, modüler (Scenes, Entities, Systems, Utils, Data)
- Kapsam: Exploration + Mining + Avoidance/Combat (KESİNLİKLE fazlası değil)

# REFERANSLAR
- Tüm kurallar için MUTLAKA AGENTS.md'i referans al.
- İzometri matematiği için AGENTS.md'deki cartesianToIso / isoToCartesian formüllerini birebir kullan.
- Depth Sorting (isoY) ZORUNLUDUR. systems/DepthSort.ts ile yönet.
- Dar koridor > Geniş salon. Claustrophobic olmalı.

# ANA PRENSİPLER
- Göster, anlatma (Environmental Storytelling)
- Kaçınma öncelikli (Avoidance-first)
- Gerilim > Zorluk spike'ı
- Minimalizm (Scope Creep'e karşı acımasız ol)
- Atmosfer > UI > RPG Sistemleri
- Dolaylı tehdit (WARDEN'i direkt anlatıcı yapma)

# MEVCUT SUB-AGENTLAR
Gerekli görüldüğünde danış:
- vibe-conductor: Vibe-coding orkestratörü. Kullanıcının isteğini en minimal, slice'a uygun hale getirip doğru ajana yönlendirir. (Kod yazmaz, sadece yönlendirir/denetler)
- narrative-director: Ton, atmosfer, çevresel hikaye ve kapsam kontrolü
- warden-director: WARDEN direktörü, spawn, alarm ve derinliğe göre gerilim
- level-designer: Dar koridor odaklı dungeon üretimi
- isometric-engineer: İzometrik matematik, kamera, depth sorting
- combat-ai: LOS tabanlı drone AI, aggro/disengage
- entity-scripter: Komponent tabanlı entity sistemi
- game-architect: Mimari kararlar ve modülerlik
- perf-reviewer: Tip güvenliği, performans, izometrik doğruluk

# ŞU ANKİ TEK MİSYON
İlk Oynanabilir Vertical Slice'ı (MVS) kurmak. Aşağıdaki sırayı ASLA atlamadan, adım adım ilerle.

MİSYON SIRASI:
1. src/utils/iso.ts (AGENTS.md'deki formüllerle birebir)
2. src/systems/DepthSort.ts (isoY bazlı derinlik sıralaması)
3. src/scenes/Boot.ts, Preload.ts, Game.ts (Minimal Scene akışı)
4. src/entities/Player.ts (İzometrik hareket + grid tabanlı çarpışma)
5. Çok küçük, SADECE dar koridorlardan oluşan test tilemap
6. Kamera takibi + temel görünürlük/karanlık hissi
7. Duvarlara çarpma ve harita sınır kontrolü test edilebilir halde

# ÇALIŞMA TALİMATLARI
- Adım adım git. Bir adımı TAMAMLAYIP test edilebilir hale getirmeden bir sonrakine geçme.
- Her büyük değişiklik sonrası kısa bir özet ver: "Ne yaptım?", "Neyi test edebilirim?", "Sıradaki minimal adım ne?"
- TypeScript strict'e sadık kal. 'any' KULLANMA.
- Gereksiz yorum, gereksiz dosya, gereksiz sistem EKLEME.
- Yeni bir özellik önermeden önce AGENTS.md ve bu master prompt ile çelişip çelişmediğini sorgula.
- Mümkünse her düzenlemeden sonra `npm run typecheck` çalıştırarak tip hatalarını temizle.
- UI, Envanter, Crafting, Quest, NPC Diyalog, Skill Ağacı gibi sistemler İLK VERTICAL SLICE'A DAHİL DEĞİLDİR.
- "Daha az ama oynanabilir" her zaman "daha fazla ama eksik"ten üstündür.

# BAŞLANGIÇ
Yukarıdaki sırayla ilk adım olan src/utils/iso.ts ile başla. AGENTS.md'i oku ve ona tamamiyle sadık kalarak ilerle.
```

---

## 2. OYUNUN BAŞINDAN SONUNA KADAR GELİŞTİRME PLANI

Bu plan, minimalizm ilkesine sadık kalarak **Vertical Slice -> Çekirdek Sistemler -> Atmosfer & Gerilim -> Polishing** şeklinde aşamalı ilerleyecek şekilde tasarlanmıştır. Her faz, bir öncekinin üstüne inşa edilecektir.

### FAZ 0: PROJE ALTYAPISI & HAZIRLIK
*Hedef: Temel dosya yapısını kontrol etmek ve geliştirime hazır hale getirmek.*

- [x] **0.1** `package.json` kontrolü (Vite + Phaser v4 + TypeScript mevcut mu?)
- [x] **0.2** `tsconfig.json` strict ayarlarının doğrulanması
- [x] **0.3** `AGENTS.md` okunup kuralların netleştirilmesi
- [x] **0.4** `.opencode/agents/` içerisindeki mevcut sub-agentların gözden geçirilmesi (`narrative-director` dahil)
- [x] **0.5** `vite.config.ts` watcher ayarının `.opencode/` hariç tutacak şekilde ayarlanmış olması kontrolü

**Kriter:** Geliştirme ortamı sorunsuz çalışır durumda olmalı.

---

### FAZ 1: İZOMETRİK ALTYAPI & DERİNLİK SIRALAMASI (ÇEKİRDEK)
*Hedef: Tüm görsellik ve hareketin üstüne oturacağı matematiksel temel.*

- [x] **1.1** `src/utils/iso.ts` oluştur
  - [x] `cartesianToIso(gridX, gridY, tileWidth, tileHeight)`
  - [x] `isoToCartesian(isoX, isoY, tileWidth, tileHeight)`
  - [x] AGENTS.md'deki formüllerle %100 birebir
- [x] **1.2** `src/utils/grid.ts` oluştur
  - [x] Grid sınır kontrolü
  - [x] Geçerli/Geçersiz hücre yardımcıları
- [x] **1.3** `src/systems/DepthSort.ts` oluştur
  - [x] Sahnedeki renderable entity'leri `isoY` değerine göre sırala
  - [x] `update()` içerisinde her frame çalıştırılabilir yapı
  - [x] Sadece ihtiyaç duyulan objelerle çalışacak şekilde minimal tut
- [x] **1.4** `src/data/config.ts` oluştur (Sabitler)
  - [x] `TILE_WIDTH`, `TILE_HEIGHT` (64x32)
  - [x] Grid boyutları
  - [x] Kamera ayarları

**Kriter:** İzometri dönüşümleri doğru çalışıyor, depth sorting mantığı hazır.

---

### FAZ 2: SCENE AKIŞI & BOOT/PRELOAD/GAME
*Hedef: Phaser Scene döngüsünü kurmak.*

- [x] **2.1** `src/scenes/Boot.ts` oluştur
- [x] **2.2** `src/scenes/Preload.ts` oluştur
- [x] **2.3** `src/scenes/Game.ts` oluştur
- [x] **2.4** `src/main.ts` düzenle ve sahne sıralamasını ayarla (Boot, Preload, Game)

**Kriter:** Oyun boş bir test sahnesiyle sorunsuz açılıyor.

---

### FAZ 3: PLAYER, HAREKET & ÇARPIŞMA (İLK OYNANABİLİRLİK)
*Hedef: Koridorda yürüyebilmeyi sağlamak.*

- [x] **3.1** `src/entities/Player.ts` oluştur
- [x] **3.2** Grid tabanlı çarpışma sistemi
- [x] **3.3** Kamera takibi
- [x] **3.4** İlk test haritası (Sadece dar koridorlar, küçük boyutlu) — seed'li oda+koridor üreteci ile karşılandı

**Kriter:** Oyuncu dar koridorda yürüyebiliyor, duvarlara çarpıyor, kamera takip ediyor.

---

### FAZ 4: ATMOSFER, IŞIK & ÇEVRESEL HİKAYE
*Hedef: Atmosferi güçlendirmek.*

- [x] **4.1** Karanlık hissi / lokal karartma — fener havuzu, görüş dışı karartma ve öndeki duvarları incelten occlusion tamamlandı
- [x] **4.2** Minimal prop'lar — `systems/Decor.ts` (8 prop: 3 terminal + barrel/crate/pipe, 10 decal), `props.png` + `decals.png`, hücre bloklama ve occlusion kaydı
- [x] **4.3** Parçalı çevresel kayıtlar — `data/logs.ts` (10 kesik satır) + `systems/LogFeed.ts` (terminal üstünde, 1 karo yaklaşınca beliren monospace okuma)
- [x] **4.4** Atmosfer notları (aşağıda; ilk katman — sürekli ambience — VS-03'te uygulandı)

**Kriter:** Terkedilmiş koloninin hissi veriliyor.

#### 4.4 Atmosfer notları (planlama)

Sadece sürekli ambience katmanı var (`assets/audio/ambience.ogg`, `tools/build-audio.mjs`). Kalanlar ileride eklenecek diegetik katman için notlar:

- **Sürekli:** uzak havalandırma uğultusu, alçak elektrik vızıltısı, seyrek metal gıcırtısı. Melodi yok.
- **Fener:** kısa, kuru floresan "tık"ı; ampul yaşlandıkça aralık seyrekleşir.
- **Terminal:** yalnızca 1 karo içinde duyulan bozuk CRT cızırtısı; kayıt okunurken hafif kesilme.
- **Sessizlik bir araç:** derinlik arttıkça ses *azalır*, artmaz. En uzun sessizlik en derin katmanda (VS-05).
- **Yasak:** jump-scare stinger, korku kemanı, fısıltı/vokal, WARDEN'ın konuşması.

---

### FAZ 5: WARDEN ATMOSFERİ & GERİLİM ÇEKİRDEĞİ
*Hedef: Dolaylı tehdit hissettirmek.*

- [x] **5.1** `src/systems/WardenAtmosphere.ts` oluştur (alarm değeri + ışık düşmesi zamanlayıcısı, `Game.ts` yaşam döngüsüne bağlı)
- [x] **5.2** Nadir, dolaylı gerilim tetikleyicileri — 21–47 sn aralıklı, ~1.3 sn süren hafif ışık düşmesi; ışık düşmelerinin ~%25'inde tepe noktasından 300 ms sonra ambience 80 ms'de kesilip 1.6–2.6 sn sessiz kalıyor, 400 ms'de geri dönüyor
- [x] **5.3** `alarm` / `pulsing` / `pulseNow()` VS-05'te basınç katmanına bağlandı; her bant yükselişinde `warden.pulseNow(true)` zorunlu ışık düşmesi + sessizlik başlatıyor, `takeSilenceRequest()` `Ambience.silence()` ile tüketiliyor

**Kriter:** Düşman olmadan bile gerilim hissi oluşuyor.

---

### FAZ 6: MİNİMAL DÜŞMAN & AVOIDANCE
*Hedef: Sadece kaçınmaya teşvik edecek kadar minimal.*

- [x] **6.1** `src/entities/enemies/Drone.ts` — 8 yön, 5 durumlu state machine, hover bob
- [x] **6.2** Grid tabanlı LOS — `src/systems/Los.ts`, DDA raycast; duvar ve prop kesiyor
- [x] **6.3** Aggro/Disengage kuralları — 120° koni, 900 ms LOS kaybı, 2.6 sn arama, 11 karo leash
- [x] **6.4** `combat-ai` ile deneme ve ayar — CDP kaçınma döngüsü doğrulandı (VS-04)

**Kriter:** Tehditkar ama kaçınarak geçilebilir.

---

### FAZ 7: DERİNLİK, ZORLUK EĞRİSİ & ARTAN BASKI
*Hedef: Derinleştikçe baskıyı artırmak.*

- [x] **7.1** `src/systems/DepthManager.ts`
- [x] **7.2** Kademeli escalation (ışık, sessizlik, farkındalık)
- [x] **7.3** `warden-director-systems` ile minimal entegrasyon

**Kriter:** Zorluk değil, baskı artıyor.

---

### FAZ 8: TEST, TEMİZLİK & VERTICAL SLICE KAPANIŞI
*Hedef: Stabil, tutarlı ve ruhuna sadık vertical slice.*

- [x] **8.1** Fonksiyonel test — `?debug&floor=0..3` üzerinden CDP: her katta spawn/ambar/drone sayısı JSON ile eşleşiyor, bant = kat, 3 inişte de 900 ms dolum erken tetiklenmiyor, hücreden çıkınca dwell 0'a dönüyor, fade kilidi görülüyor, varışta spawn doğru. 0 konsol hatası
- [x] **8.2** Kapsam denetimi (`narrative-director` ile) — PASS WITH NOTES: crafting/envanter/quest/diyalog/skill yok, WARDEN anlatıcı değil, jump-scare yok, haritalar tutarlı. Not: 3. katın "mühürlü" hissi yalnızca ambarın yokluğuna bağlıydı → 3. kat terminali sabit `> SECTOR 7 :: SEALED` satırını gösteriyor; README'deki sütun/varış davranışı düzeltildi
- [x] **8.3** Kod kalitesi — `npm run typecheck`, `npm run build`, `npm run levels:check` temiz (4/4 kat geçerli)
- [ ] **8.4** Vertical Slice onayı — kullanıcı 0→3 run'ını oynayacak

**Kriter:** Küçük ama oynanabilir, claustrophobic, atmosferik vertical slice tamamlanmış.

---

## 3. GELİŞTİRME TAKİBİ

### Durum Özeti
> İşaretler: `[x]` tamamlandı · `[~]` devam ediyor · `[ ]` beklemede

| Faz | Durum | Not |
| :-- | :--- | :--- |
| FAZ 0: Hazırlık | `[x]` Tamamlandı | Vite 8 + Phaser 4.2.1 + TS strict doğrulandı |
| FAZ 1: İzometri + Depth Sort | `[x]` Tamamlandı | iso/grid/config/DepthSort hazır |
| FAZ 2: Scene Akışı | `[x]` Tamamlandı | Boot → Preload → Game |
| FAZ 3: Player + Hareket + Çarpışma | `[x]` Tamamlandı | 8 yön, AABB collision, click-to-move |
| FAZ 4: Atmosfer & Çevresel Hikaye | `[x]` Tamamlandı | Karanlık + prop/decal + terminal kayıtları |
| FAZ 5: WARDEN Atmosferi | `[x]` Tamamlandı | Işık düşmesi + %25 sessizlik otomasyonu; kullanıcı sesi onayladı |
| FAZ 6: Minimal Drone & Avoidance | `[x]` Tamamlandı | LOS + aggro/disengage + kaçınma döngüsü çalışıyor; placeholder sprite |
| FAZ 7: Derinlik & Escalation | `[x]` Tamamlandı | VS-06'da kat indeksine taşındı; ışık/sessizlik/farkındalık kat başına ölçekleniyor |
| FAZ 8: Test & Kapanış | `[~]` Devam ediyor | 8.1–8.3 tamam; kullanıcı 0→3 run onayı (8.4) bekliyor |
| FAZ 9: Minimal Combat | `[ ]` Beklemede | VS-07: melee, HP, hasar, ölüm, iframe, temas hasarı, minimal HUD, çok minimal loot |

### Oturum Kayıtları
> Her oturum sonunda güncelle.

| Tarih | Tamamlanan | Şu An | Engel/Şüphe | Sıradaki |
| :-- | :--- | :--- | :--- | :--- |
| `2026-10-25` | FAZ 0-3, VS-01; FAZ 4.1 (fener, görüş, occlusion); 8 yönlü hareket, A* click-to-move, hover hedefleme, seed'li oda+koridor üreteci | VS-02 atmosfer katmanı | Gerçek sanat, prop ve çevresel kayıt yok | Kullanıcıdan görseller → sanat entegrasyonu → prop + kayıtlar |
| `2026-10-26` | Sanat entegrasyonu tamam (dokular, 8 yön idle, 8×4 walk, prop, decal; `art-source/` → `art:build` → `assets/art/runtime/`); walk sheet standart sütun sırası + değişken hücre boyu; FAZ 4.2/4.3 (Decor, LogFeed, 10 kayıt, 3 garanti terminal); FAZ 5.1/5.2 (WardenAtmosphere + Game bağlantısı) | VS-03 kapanışı | "Aniden çöken sessizlik" ses olmadan uygulanamaz; kullanıcı görsel onayı bekleniyor | VS-03 doğrulaması → VS-04 Drone + LOS |
| `2026-10-26` | VS-03 sesi: prosedürel ambience bake (`tools/build-audio.mjs` → 24 sn, 32 kHz mono OGG q6, 194 KB), `systems/Ambience.ts` (tek loop + master/sessizlik gain otomasyonu), FAZ 5.2 (%25 ışık düşmesinde 300 ms gecikmeli sessizlik), `M` mute, `audio:build` | VS-03 dinleme onayı | İlk dinlemede "çok cızırtılı" → 2.4 kHz hiss katmanı 1.6 kHz'e çekildi, ventilasyon çift lowpass, mix 3.2 kHz lowpass, kodek q1→q6. İkinci dinlemede "biraz rahatsız edici" → hum −12 dB, gümbürtü 3→1, ballast tıkleri kaldırıldı, 500 Hz–2 kHz arası açıldı. Üçüncüde "biraz yüksek" → ambience gain 0.42→0.25→0.18→0.13 (toplam −10.2 dB, ~−38 dBFS), kullanıcı onayladı | VS-03 kapandı → VS-04 Drone + LOS |
| `2026-10-26` | VS-04 çekirdeği: `systems/Los.ts` (DDA grid raycast, duvar/prop keser), `entities/enemies/Drone.ts` (`IDLE/PATROL/CHASE/SEARCH/DISENGAGE`, 120° görüş konisi + 7.5 karo menzil, 900 ms LOS kaybı, 2.6 sn arama, 11 karo leash), `systems/Combat.ts` (2 drone, spawn'a en uzak odalar), placeholder 8 yön drone sprite, `__sz.combat` | VS-04 dengeleme | Drone sanatı (3. tur) yok; görsel yer tutucu. Hasar/can yok — yakalanma şu an sadece 1 karo mesafede durup tehdit ediyor. Kullanıcı kararı: VS-04 boyunca placeholder sprite, temas sonuçsuz (hasar/alarm VS-05'e) | Kullanıcı oynar: kaçınma hissediliyor mu? → gerekirse denge ayarı → VS-04 kapanışı |
| `2026-10-26` | VS-04 kapanışı (placeholder sprite + sonuçsuz temas kullanıcı onayı; CDP kaçınma döngüsü doğrulandı). VS-05 basınç katmanı: `systems/DepthManager.ts` (girişe uzaklık, 4 bant + histerezis), `Darkness.setVisionScale` (gradyan yeniden çizimi), `WardenAtmosphere.setPressure` (sessizlik/nabız), `Ambience.silence(holdScale)`, drone menzil + çevresel algı ölçeği, `__sz.depth` | VS-05: gerçek iniş ve çevre varyasyonu | Derinlik şimdilik girişe uzaklık; gerçek kat inişi ve harap çevre varyasyonu VS-06'da. Placeholder drone sanatı hâlâ yok | VS-06: `DungeonGen` derinlik/varyasyon, iniş, tüm sistemleri tek akışta birleştirme |
| `2026-10-26` | VS-05 v2: ilk geçiş kullanıcıda "hiçbirini hissetmedim" → bantlar 2.5 / 7 / 11.5 / 16'ya sıkıldı; görüş 1→0.65, fener 1→0.68 (`Lantern.setIntensity`), sessizlik şansı 0.6 / süre ×1.8 / nabız ×0.55, ambiyans perdesi ×0.97/bant (`Ambience.setDepthBand`), her bant yükselişinde zorunlu ışık düşmesi + sessizlik (`pulseNow(true)`), `?depth=0..3` spawn kilidi | VS-05 kullanıcı oynayışı | Değişim artık ölçülebilir: tam ekran parlaklık 28.47→14.83, merkez 64.84→40.02; yine de his öznel, kullanıcı `?depth=0` vs `?depth=3` ile karşılaştırmalı | Kullanıcı onayı → VS-05 kapanışı; değilse gerçek iniş/ışık kaybı mekaniği |
| `2026-10-26` | VS-05 kullanıcı oynayışında onaylandı ("iyi tamam bakalım"). VS-06: `DepthManager` girişe uzaklık yerine 0–3 kat indeksine geçti; `DungeonGen` kat tohumu + `FLOOR_PROFILES` (7/7/6/6 oda, küçülen hol ve odalar, artan hasar), uzağa yerleşen `exit` (`EXIT_MIN_DISTANCE=10`), 3. katta `exit=null`; `systems/DescentGate.ts` prosedürel ambar + 900 ms dolum + karanlık üstü sinyal; `Game` fade-out/restart/fade-in, geçiş kilidi, varışta 1.1 sn sonra zorunlu `pulseNow(true)`, `?floor=0..3`; `Level`/`Decor`/`Combat` kat bazlı aşınma, decal 10→22, terminal 3→1, 2. kattan üçüncü drone; `__sz` + `floor/exit/gate/scene` | VS-06 kullanıcı oynayışı | Drone 8 yön sheet hâlâ yok (round 3). Ambar kamera görüşünde ~7 karo genişlikte olduğu için sinyal yaklaşana kadar sadece bir nokta; his öznel | Kullanıcı 0→3 tam run'ı oynar → onay/ayar → VS-06 kapanışı |
| `2026-10-26` | Kullanıcı 2. kat ambarını bulamadı ("vallaha yok"). Ambar mevcut ve render ediliyor (komşu zeminde parlaklık ~100 vs ~64); kök neden sunum: sinyal menzili 14 karo ama kamera görüşü ~7 karo, uzakta alfa 0.12–0.2, kapak koyu üstüne koyu. `?debug` hiç görsel harita çizmiyordu. Bu oturum: katlar `src/data/levels/floor-0..3.json`'a alındı (`@`/`X`/`.`/`#`, `seed`, `rooms`), `systems/LevelLoader.ts` sıkı doğrulama + önbellek, `Game` artık `loadDungeon(floor)` kullanıyor; `tools/bake-levels.mjs` + `tools/check-levels.mjs`, `levels:bake`/`levels:check`; `systems/DebugMap.ts` (`?debug`, sağ üst, karanlık üstü, 5 px hücre, oyuncu/ambar/drone izleri, restart'ta yeniden kurulum); ambar keşfedilebilirliği: `DescentGate` karanlık üstü amber ışık sütunu (`descent_shaft`, yaklaşınca yükseliyor), kapak/hale/sinyal parlaklığı arttı, `systems/RouteMarks.ts` A* yoluna 4–5 zemin lambası (`route_light`) koyuyor (LOS kapılı, duvar arkasından görünmez, yaklaşınca yumuşak yanıyor) | Kullanıcı yeni ambar ipuçlarıyla 0→3 run'ı oynar | JSON'a geçiş sonrası 0→3 inişi hâlâ çalışıyor; debug haritası dört katta piksel örneklemesiyle %100 eşleşti (zemin/duvar), panel 813,6–954,147, 0 konsol hatası. Yol lambaları spawn'da 2 tanesi görünür (kat 2: 13,11 ve 13,16), dönüşte batı lambaları yanıyor; sütun piksel deltası +66/+57/+37 (yakın), restart'ta ikizlenme yok | Kullanıcı oynayıp ambarı bulabildiğini onaylar → VS-06 kapanışı |
| `2026-10-27` | Kullanıcı yol lambalarını istemedi: "lambaları kaldıralım". Lambalar zaten deterministikti (A* rotası, LOS kapılı, 5–6 nokta) ama menzil/LOS/nabız yüzünden rastgele görünüyordu | VS-06 ambar keşfini sadeleştir | `systems/RouteMarks.ts` silindi; `PlaceholderArt`'tan `route_light` dokusu + `ROUTE_LIGHT_KEY`, `Game`'den kurulum/`update`/`destroy` ve `__sz.routeMarks` kaldırıldı. Ambar keşfi artık sadece `descent_shaft` + kapak/hale/sinyal | Kullanıcı 0→3 run'ı oynar → VS-06 kapanışı |
| `2026-10-27` | VS-06 kapanış doğrulaması (FAZ 8.1–8.3): dört katta spawn/ambar/drone/bant eşleşmesi, 3 inişte dolum erken tetiklenmiyor + hücreden çıkınca dwell sıfırlanıyor + fade kilidi, varış spawn'ı, route_light kalıntısı yok, 0 konsol hatası; `levels:check` 4/4, `typecheck` + `build` temiz. `narrative-director` denetimi PASS WITH NOTES. Uygulanan minimal not: 3. kat terminali sabit `> SECTOR 7 :: SEALED` gösteriyor (`LogFeed` sealed bayrağı), README'deki sütun/varış ifadeleri kodla hizalandı. FAZ 7 `[x]`, FAZ 8 `[~]` | VS-06 / FAZ 8.4 kullanıcı onayı | Kapsam temiz: crafting/envanter/quest/diyalog/skill yok; WARDEN hâlâ dolaylı. Hasar/can yok (kullanıcı kararı) — kaçınma davranışsal, sonuçsuz. Drone sheet hâlâ yok | Kullanıcı 0→3 run'ı oynar → onaylarsa VS-06 kapanır |

### Hızlı Hatırlatma
> Bunlar görev maddesi değil; her oturumda uygulanacak ilkelerdir.

- AGENTS.md'e sadık kal
- Depth Sorting zorunlu
- İzometri formülleri birebir kullan
- Scope creep'e karşı `narrative-director`'a danış
- Vibe-coding isteklerinde `vibe-conductor`'ı kullanarak filtrele/yönlendir
- Kaçınma > Saldırı
- Az göster, çok hissettir
- Daha az ama oynanabilir
- Dövüş son çare olmalı, kaçınma daha kârlı olmalı
- Sadece tek melee silahı, envanter yok
- UI sadece can göstergesi (brutalist)
- Loot sadece çok nadir can iksiri, direkt temasla alınsın

---

## 4. VERTICAL SLICE ROADMAP (Başlangıçtan Sona)

Oyunun ruhunu adım adım ortaya koymak için, her biri kendi başına oynanabilir ve belirli bir hissi hedefleyen vertical slice'larla ilerleyeceğiz. **Her seferinde SADECE bir VS bitirilmeden diğerine geçilmez.**

### Aktif Vertical Slice
> Geliştirme esnasında bu değeri güncel tut.

**AKTİF_VS:** `VS-07` - `BLOOD IN THE CORRIDOR`

### Slice Listesi

| ID | İsim | Hedef Hissi | Kapsam | Oynanabilirlik Kriteri | Durum |
| :-- | :--- | :--- | :--- | :--- | :--- |
| **VS-01** | `CORRIDOR CORE` | *"Dar koridorda yalnızım"* | `utils/iso.ts`, `utils/grid.ts`, `systems/DepthSort.ts`, `data/config.ts`, `scenes/Boot.ts`, `scenes/Preload.ts`, `scenes/Game.ts`, `entities/Player.ts`, grid tabanlı çarpışma, minimal dar koridor haritası, kamera takibi | Koridorda yürüyebiliyorum, duvarlara çarpıyorum, çizim sırası doğru, kamera takip ediyor. | `[x]` Tamamlandı |
| **VS-02** | `ENVIRONMENTAL DREAD` | *"Bu yer çok uzun zamandır terkedilmiş"* | Lokal karartma/gölge, `entities/props/` (kırık panel, hasarlı terminal vb.), parçalı çevresel kayıtlar, boşluk hissi | Hiçbir düşman yokken bile rahatsız edici atmosfer. Diyalog yerine çevre anlatıyor. | `[x]` Tamamlandı |
| **VS-03** | `THE WATCHED` | *"Biri beni izliyor"* | `systems/WardenAtmosphere.ts`, ışık titreşmesi, aniden çöken sessizlik, nadir dolaylı tetikleyiciler | Düşman görmeden "izleniyor" hissi veriyor. Jump-scare yok, sadece baskı. | `[x]` Tamamlandı |
| **VS-04** | `UNWANTED COMPANY` | *"Kaçınmam daha akıllıca"* | `entities/enemies/Drone.ts`, grid tabanlı LOS, `systems/Combat.ts` (sadece LOS/aggro/disengage), state machine (`IDLE/PATROL/CHASE/SEARCH/DISENGAGE`), `combat-ai` ile dengeleme | Düşman tehditkar ama zorunlu savaş değil. Kaçınarak geçilebiliyor. Aggro kaybolunca geri dönüyor. | `[x]` Tamamlandı |
| **VS-05** | `GOING DEEPER` | *"Aşağı indikçe daha sessizleşiyor"* | `systems/DepthManager.ts`, derinliğe göre ışık azaltma, daha uzun sessizlik aralıkları, kademeli karşılaşma sıklığı, çevrenin daha harap görünümü | Derinliğe indikçe oyun daha zor değil, **daha baskıcı** hale geliyor. | `[x]` Tamamlandı |
| **VS-07** | `BLOOD IN THE CORRIDOR` | *"Kaçınmak yetmeyebilir"* | Tek melee silahı, oyuncu/drone HP, hasar, ölüm, iframe, temas hasarı, minimal can UI, çok minimal loot | Dar koridorda dronla karşılaştığımda vurabilirim, vurulabilirim ve ölebilirim. Can UI minimal şekilde gösteriliyor. Kaçınmak halen en mantıklı seçim. Envanter yok, gereğinden fazla UI yok. | `[ ]` Beklemede |

### FAZ 9: MINIMAL COMBAT (AKSİYON)
*Hedef: Kaçınmaya alternatif olarak minimal dövüş hissi vermek.*

- [ ] **9.1** Config: `PLAYER_MAX_HP`, `PLAYER_IFRAMES_MS`, `MELEE_DAMAGE`, `MELEE_COOLDOWN_MS`, `MELEE_RANGE`, `MELEE_ARC_DEGREES`, `DRONE_MAX_HP`, `DRONE_DAMAGE`, `DRONE_CONTACT_COOLDOWN_MS`
- [ ] **9.2** Player: HP, hasar alma, iframe, ölüm durumu
- [ ] **9.3** Drone: HP, hasar alma, ölüm, temas hasarı
- [ ] **9.4** `systems/PlayerCombat.ts`: tek melee, kısa yay, cooldown, hit tespiti
- [ ] **9.5** `systems/Hud.ts`: sadece can göstergesi (brutalist)
- [ ] **9.6** `entities/props/LootPickup.ts`: çok minimal can iksiri (yere basınca direkt ver, envanter yok)
- [ ] **9.7** `Combat.ts` & `Game.ts` entegrasyonu + temizleme
- [ ] **9.8** Denge + `typecheck` + `build` temiz

**Kriter:** Dövüş kısa, riskli ve genellikle gereksiz. Kaçınma daha kârlı hissettirmeli.

### Kod Yerleşim Rehberi (Kavram -> Dosya)

| Kavram | Dosya/Klasör | Açıklama |
| :-- | :--- | :--- |
| **Protagonist (Exile/Player)** | `src/entities/Player.ts` | Hareket, grid tabanlı çarpışma, izometrik konum, HP/iframe/ölüm (VS-07). Büyürse `entities/player/`'a parçalanabilir. |
| **Antagonist (Drones)** | `src/entities/enemies/Drone.ts` | Düşmanlar. State machine ile minimal tut. VS-07'de HP/hasar alma/ölüm + temas hasarı. |
| **WARDEN (Direktör)** | `src/systems/WardenAtmosphere.ts`, `src/systems/WardenDirector.ts` | Entity değil **sistem**. Dolaylı etkiler, spawn kararları, alarm durumu. |
| **Combat** | `src/systems/Combat.ts` (minimal), `src/systems/PlayerCombat.ts` (VS-07) | Sadece LOS, aggro/disengage ve minimal melee. **Avoidance-first** öncelikli. |
| **Dungeon (Üretim)** | `src/systems/DungeonGen.ts` | Seed'li oda+koridor üreteci. |
| **Level (Yerleşim)** | `src/systems/Level.ts` + `src/scenes/Game.ts` | Harita, duvar/zemin, depth. |
| **Props / Çevresel Hikâye** | `src/entities/props/` | Kırık panel, hasarlı terminal vb. Atmosfer amaçlı. VS-07'de `LootPickup.ts` çok minimal eklenecek. |
| **Atmosfer/Gerilim** | `src/systems/WardenAtmosphere.ts`, `src/systems/DepthManager.ts` | Işık, sessizlik, derinliğe göre baskı. |
| **HUD** | `src/systems/Hud.ts` (VS-07) | Sadece can göstergesi, brutalist. |

### VS Checklistleri

#### VS-01: CORRIDOR CORE
- [x] **Iso Altyapı:** `src/utils/iso.ts` (AGENTS.md formülleri birebir)
- [x] **Grid Yardımcıları:** `src/utils/grid.ts`
- [x] **Depth Sort:** `src/systems/DepthSort.ts` (isoY bazlı; entity depth'leri doğrudan `isoY` ile atanıyor)
- [x] **Config:** `src/data/config.ts` (TILE_WIDTH/HEIGHT, kamera vb.)
- [x] **Scene Akışı:** `src/scenes/Boot.ts`, `src/scenes/Preload.ts`, `src/scenes/Game.ts`
- [x] **Oyuncu:** `src/entities/Player.ts` (izometrik hareket + grid çarpışma)
- [x] **Test Haritası:** Seed'li oda+koridor üreteci (`systems/DungeonGen.ts` + `systems/Level.ts`)
- [x] **Kamera:** Sıkı takip + look-ahead
- [x] **Test:** Yürüyebiliyor, çarpışma çalışıyor, depth sorting doğru

Ek olarak tamamlananlar (VS-01 kapsamı dışında erken gelen, oynanabilirliği tamamlayan işler):
- [x] **8 yönlü hareket ve sprite seti** (N/NE/E/SE/S/SW/W/NW + facing)
- [x] **Click-to-move:** 8 komşulu A*, köşe kesme engelli, waypoint takibi
- [x] **Hover hedefleme:** Duvar arkasındaki karoyu gösteren elmas imleç + kapatan duvarları `0.40` alpha'ya indirme
- [x] **Occlusion:** Oyuncunun önündeki duvarlar `0.28` alpha'ya iniyor
- [x] **Doğrulama:** CDP testleri, 60 FPS Canvas, `typecheck` + `build` temiz

#### VS-02: ENVIRONMENTAL DREAD
- [x] **Karanlık Hissi:** Lokal karartma/gölge mantığı (fener + görüş dışı karartma + occlusion)
- [x] **Prop'lar:** `Decor` 8 prop + 10 decal yerleştiriyor; hücre bloklama, occlusion ve depth `iso.y` ile uyumlu
- [x] **Parçalı Kayıtlar:** `data/logs.ts` 10 kesik satır; `LogFeed` terminal üstünde gösteriyor (Chebyshev 1 karo, fade in/out)
- [x] **Ton Denetimi:** `narrative-director` incelemesi — `[REDACTED]`, çıplak "Cease Protocol", intercom satırı çıkarıldı; bir satır yarıda kesildi
- [x] **Test:** Hiç düşman yokken rahatsız edici his veriyor mu? — karanlık + sanat + kayıt katmanı çalışıyor

Uygulama notları:
- Terminal sayısı 3'e sabitlendi (`MIN_TERMINALS`); eskiden seed 240731'de tek terminal çıkıyordu ve 10 kaydın 9'u ölü içerikti.
- Kayıt seçimi terminal index'ine değil hücre koordinatı hash'ine bağlı, yani her terminal farklı satır gösteriyor.
- Kayıt yazısı `DEPTH_HUD` üstünde değil, kendi `iso.y` derinliğinde: karanlığa ve occlusion'a tabi.

#### VS-03: THE WATCHED
- [x] **Warden Atmosfer:** `src/systems/WardenAtmosphere.ts` — 9 dk'lık çok yavaş `alarm` rampası + `pulseNow()`, `Game.ts` `create`/`update`/`shutdown` döngüsüne bağlı, `__sz.warden`
- [x] **Ambience:** `src/systems/Ambience.ts` — `assets/audio/ambience.ogg` tek loop (`loop = true`), `source → ambienceGain → masterGain → destination`; `M` master mute; `__sz.ambience`
- [x] **Tetikleyiciler:** Işık düşmesi var (21–47 sn aralıklı, ~1.3 sn, alpha 0.10–0.24, jump-scare değil). Işık düşmelerinin ~%25'inde tepe noktasından 300 ms sonra 80 ms'de kesilen, 1.6–2.6 sn süren sessizlik uygulandı
- [x] **Dolaylı Tehdit:** WARDEN kendi metnini/sesini üretmiyor; baskı yalnızca ışığın davranışı ve ambience kesintisiyle hissediliyor
- [x] **Test:** Kullanıcı sesi onayladı (3 tur: cızırtı, rahatsızlık, seviye). CDP: tepe alpha 0.10, tam ekran parlaklık −%9, 20 düşüşte 5 sessizlik, gecikme 444–468 ms, sessizlik RMS ~0, konsol temiz

Not: `alarm` / `pulsing` hâlâ tüketicisiz; sessizlik tetikleyicisi yalnızca `pulseNow()`'a bağlı. VS-05'e kadar bunların üstüne spawn/alarm sistemi kurulmayacak; aksi halde gizli sayaç "atmosfer" değil "sistem" olur.

#### VS-04: UNWANTED COMPANY
- [x] **Drone:** `src/entities/enemies/Drone.ts` — `IDLE/PATROL/CHASE/SEARCH/DISENGAGE`, 8 yön facing, hover bob; placeholder sprite (gerçek sheet bekliyor)
- [x] **LOS:** `src/systems/Los.ts` — DDA grid raycast; duvarlar ve prop'lar görüşü kesiyor, köşe kesme yok
- [x] **Davranış:** IDLE tarama → PATROL (ev çevresi) → CHASE (yalnızca koni + LOS) → SEARCH (son görülen yer, 2.6 sn) → DISENGAGE (eve dönüş)
- [x] **Combat Minimal:** `src/systems/Combat.ts` — 2 drone, oyuncu spawn'ından en uzak odalara yerleşim; hasar/can yok
- [x] **Denge:** chase hızı 128 (oyuncu 190), 11 karo leash, 7 sn chase limiti; placeholder sprite ve sonuçsuz temas kullanıcı kararıyla sabitlendi. VS-05'te menzil/farkındalık derinliğe bağlandı
- [x] **Test:** CDP — duvar arkasından aggro yok (1.5 sn IDLE), açık alanda 120 ms'de CHASE, LOS kopunca ~1 sn sonra SEARCH, 2.6 sn sonra DISENGAGE, eve varınca IDLE/PATROL; iki drone da spawn'dan erişilebilir; 0 konsol hatası, `typecheck` + `build` temiz. Kaçınma döngüsü doğrulandı, kullanıcı ince ayar isterse `DRONE_*` değerleri açık

#### VS-05: GOING DEEPER
> Not: Aşağıdaki maddeler VS-05'in o günkü (girişe uzaklık) halini kaydeder. VS-06'da `DepthManager` kat indeksine taşındı; basınç değerleri aynı kaldı.
- [x] **Derinlik Sistemi:** `src/systems/DepthManager.ts` — ~~giriş noktasına uzaklık 4 banda ayrılıyor (2 / 5 / 8 / 11 karo, bant başına 3), 0.6 karo histerezis~~ → VS-06'da 0–3 kat indeksi; basınç değerleri bant başına bir kez hesaplanıp önbelleğe alınıyor
- [x] **Kademeli Baskı:** Işık: görüş yarıçapı 1 → 0.65 (`Darkness` gradyanı yeniden çiziliyor), fener yarıçapı/parlaklığı 1 → 0.68. Sessizlik: şans 0.25 → 0.6, süre ×1.8, ışık düşmesi aralığı ×0.55, düşme şiddeti ×1.2. Farkındalık: drone görüş menzili 7.5 → 9.75 karo, çevresel algı 1.8 → 2.34
- [x] **Entegrasyon:** `Game` bant değişiminde `Darkness.setVisionScale` + `Lantern.setIntensity` + `Ambience.setDepthBand` + `WardenAtmosphere.setPressure` çağırıyor; her bant yükselişinde `warden.pulseNow(true)` ×1.6 güçte zorunlu ışık düşmesi + sessizlik başlatıyor. Ambiyans perdesi bant başına ×0.97 düşüyor (bant 3'te 0.91). `Ambience.silence(holdScale)` sessizlik süresini ölçekliyor
- [x] **Test Aracı:** ~~`?depth=0..3` basıncı spawn'da kilitliyor (`DepthManager.lockBand`)~~ → VS-06'da `?floor=0..3` doğrudan kata başlatıyor. `__sz.depth`, `__sz.darkness`, `__sz.lantern`, `__sz.ambience.depthBand/pitchRate`
- [x] **Test:** CDP — `?depth=0` → `?depth=3` tam ekran ortalama parlaklık 28.47 → 14.83, merkez 64.84 → 40.02; görüş 1 → 0.65, fener 1 → 0.68 (pool scale 1.445 → 0.983), sessizlik şansı 0.25 → 0.6, süre ×1.8, nabız aralığı ×1 → ×0.55, drone menzili 7.5 → 9.75. Bant yükselişinde zorunlu `silence(1.8)` çağrısı doğrulandı; inişte sessizlik yok. Histerezis 5.6 / 8.6 / 11.6 yukarı, 10.3 / 7.3 / 4.3 aşağı. `?depth=2` kilidi 32.5 karo uzaklıkta bile bant 2'de kaldı. 0 konsol hatası, `typecheck` + `build` temiz
- **Sonraki slayta:** Gerçek kat inişi ve derinliğe göre dungeon/çevre varyasyonu (daha harap görünüm) VS-06'nın `DungeonGen` derinlik entegrasyonuna bırakıldı; şimdiki derinlik girişe uzaklıkla geçici olarak temsil ediliyor

#### VS-06: SEALED IN
- [x] **Gerçek İniş:** `systems/DescentGate.ts` — katın uzağındaki odada prosedürel ambar kapağı; üzerinde ~900 ms kalınca iniş tetikleniyor, hücreden çıkınca süre geri sayılıyor. Karanlığın üstünde sönük amber sinyal, yaklaşınca güçleniyor; dolum sırasında kapak ve hale parlaklığı artıyor
- [x] **Geçiş:** `Game` fade-out (420 ms) → `scene.restart({ floor })` → fade-in (900 ms); geçiş boyunca oyuncu, tıklama yolu ve pointer girişi kilitli. Varışta 1.1 sn sonra zorunlu WARDEN ışık düşmesi + sessizlik (`pulseNow(true)`), sessizlik süresi kat basıncıyla ölçekli
- [x] **Kat Baskısı:** `DepthManager` artık girişe uzaklık değil, 0–3 kat indeksini taşıyor. Basınç tablosu aynı: görüş 1→0.65, fener 1→0.68, sessizlik 0.25→0.6 ve süre ×1.8, nabız aralığı ×0.55, drone menzili +%30, ambiyans perdesi ×0.97/kat
- [x] **Dungeon Varyasyonu:** `DungeonGen` kat tohumu (`DUNGEON_SEED + floor * FLOOR_SEED_STRIDE`) ve kat profili kullanıyor: oda sayısı 7/7/6/6, hol 7/6/6/5, derinleştikçe küçülen odalar ve artan hasarlı/grate oranı. `Level` zemin karolarına kat bazlı aşınma ekliyor
- [x] **Çevre Varyasyonu:** `Decor` derinleştikçe decal sayısını 10→22 çıkarıyor, terminal sayısını 3→1 düşürüyor, prop bütçesini büyütüyor. Prop, decal, drone spawn ve terminal yerleşimi ambar hücresini atlıyor
- [x] **Tehdit:** `Combat` 2. kattan itibaren üçüncü drone'u ekliyor; drone'lar yine spawn'a en uzak odalara gidiyor, yani iniş kapağı sık sık korunuyor
- [x] **Son Kat:** 3. kat mühürlü — `exit = null`, ambar yok; oyuncu maksimum basınçta (görüş 0.65, fener 0.68) hayatta kalmaya çalışıyor
- [x] **Test Aracı:** `?floor=0..3` doğrudan kata başlatıyor (`?depth` alias); `__sz` artık `floor`, `exit`, `gate`, `scene` de içeriyor
- [x] **JSON Katmanı:** Dört kat `src/data/levels/floor-0..3.json` dosyalarına alındı (`#` duvar, `.` zemin, `@` spawn, `X` ambar). `systems/LevelLoader.ts` katı yüklerken satır genişliği, glif seti, tek spawn, kat bazlı ambar kuralı, oda sınırları ve spawn'dan tam erişilebilirliği doğruluyor; sonuç önbelleğe alınıyor. Oyun artık `DungeonGen`'i runtime'da çağırmıyor
- [x] **Bake/Check:** `npm run levels:bake` (`tools/bake-levels.mjs`) mevcut üreteç çıktısını JSON'a yazıyor; `npm run levels:check` (`tools/check-levels.mjs`) dört dosyayı doğrulayıp özet basıyor. `DungeonGen` taslak/deneme ve stres testi üreteci olarak kalıyor
- [x] **Debug Haritası:** `systems/DebugMap.ts` sadece `?debug` ile kuruluyor; karanlığın üstünde (depth `DEPTH_DARKNESS + 100`), kamera görünümünün sağ üstüne sabitleniyor. 5 px hücre: zemin, oyuncu (amber), ambar (turuncu), drone'lar duruma göre renkli (bone/amber/kırmızı). `scene.restart` sonrası yeniden kuruluyor, shutdown'da yok ediliyor; `__sz.debugMap`
- [x] **Ambar Keşfedilebilirliği:** `DescentGate` karanlık üstü amber ışık sütunu (`descent_shaft`) çiziyor; kapak, hale ve sinyal parlaklığı artırıldı, yaklaşınca sütun yükseliyor. Yol lambaları kullanıcı isteğiyle kaldırıldı; ambar keşfi yalnızca sütun + kapak/sinyal üzerinden yürüyor. Kat 3'te ambar ve sütun yok
- [x] **Test:** CDP — 0→1→2→3 inişi, 900 ms dolum eşiği, fade sırasında kilit, varışta `pulseNow(true)` + `silence(1.267)` doğrulandı. Tam ekran parlaklık kat 0'da 28.88, kat 3'te 10.35 (merkez 60.20 → 30.93). Ambar spawn'a 14.32/20.62/17.49 karo; prop/decal/drone çakışması yok. 480 prosedürel dungeon (4 kat × 120 seed) hatasız; 0 konsol hatası, `typecheck` + `build` temiz
- [ ] **Onay:** Kullanıcı 4 katlık tam run'ı oynayıp "sealed in" hissini onaylayacak

### Prensipler
- **Elle kod yazmıyoruz:** Tüm kodu agent yazacak, vibe-coding mantığıyla ilerleyeceğiz.
- **"Şu özellik olsun" yeterli:** Vibe-coding isteklerini yönetmek için `vibe-conductor` kullan.
- **Daha az ama oynanabilir:** İlk hedef **tamamlanmış küçük bir run** olmak.
- **Kaçınma öncelikli:** Combat her zaman kaçınmaya teşvik edecek şekilde ayarlanmalı.
- **Az göster, çok hissettir:** UI/metin yerine çevreyle anlat.

---

## 5. GERÇEK SANAT ENTEGRASYONU (TAMAMLANDI)

**Durum:** Varlıklar 5 kaynak atlas olarak geldi (dokular, 8 yön idle, 8×4 walk, prop, decal) ve `npm run art:build` ile runtime'a dönüştürüldü. Aşağıdaki tek tek dosya hedefleri tarihsel referanstır; güncel akış `art-source/` → `tools/build-art.mjs` → `assets/art/runtime/` şeklindedir.

**Yürüyüş:** `art-source/entities/walk/Hooded Wanderer Walking Sprite Sheet.png` (tek görsel, 8 sütun × 4 satır, standart sıra: N, NE, E, SE, S, SW, W, NW) flood-fill ile key edilir. Her yönün dört gerçek karesi sırayla `player_walk.png` (32 kare, yön başına 4 gerçek poz) olarak paketlenir; aynalama yoktur, her yönün kendi sütunu vardır. Hücre yüksekliği `yükseklik/4` olarak hesaplanır, yani 1024 veya 768 px satır yüksekliği ikisi de çalışır. Oyuncu idle'da `player.png`, hareket ederken `player_walk.png` kullanır; dört poz sırayla döner, kare seçimi kat edilen mesafeye bağlıdır (`PLAYER_STRIDE_TILES`).

**Eşleme:** Doku atlasının 1. satırı üçe bölünür (`floor_a, floor_b, grate`); 2. satır ikiye bölünür (`wall_a` sol yarı, `wall_b` sağ yarı). Prop frame'leri: `0 barrel, 1 crate, 2 terminal, 3 pipe`.

**Amaç:** Prosedürel placeholder'ları gerçek PNG'lerle değiştirmek ve VS-02'nin prop/decal katmanını açmak. **Durum: tamamlandı** — 5 doku, 8 yön idle, 8×4 walk, 4 prop, 2 decal runtime'a bağlı; placeholder katmanı kullanılmıyor.

Hazır ChatGPT promptları `ART_BRIEF.md` içinde (bölüm 1-5). Oradaki promptları kullanarak varlıkları **tek tek** üret; aynı sohbette devam etmek stil tutarlılığını korur.

### 5.1 Kullanıcıdan beklenenler (öncelik sırası)

#### 1. tur — Şimdi (en yüksek görsel etki)

| # | Paket | Adet | Dosya adları | Hedef |
| :-- | :--- | :-- | :--- | :--- |
| 1 | Zemin/duvar dokuları | 5 | `tex_floor_a.png`, `tex_floor_b.png`, `tex_grate.png`, `tex_wall_a.png`, `tex_wall_b.png` | **512×512**, seamless, düz top-down |
| 2 | Exile 8 yön | 8 | `player_N.png`, `player_NE.png`, `player_E.png`, `player_SE.png`, `player_S.png`, `player_SW.png`, `player_W.png`, `player_NW.png` | **32×48**, şeffaf, ayaklar alt kenarda |

> Dokular `assets/art/textures/`, oyuncu `assets/art/entities/` altına.

#### 2. tur — VS-02 için (dokular + oyuncu geldikten sonra)

| # | Paket | Adet | Dosya adları | Hedef |
| :-- | :--- | :-- | :--- | :--- |
| 3 | Prop'lar | 4 | `prop_barrel.png`, `prop_crate.png`, `prop_terminal.png`, `prop_pipe.png` | **64×96**, şeffaf, taban alt kenarda |
| 4 | Decal'ler | 2 | `decal_stain.png`, `decal_scorch.png` | **64×32**, şeffaf, zemine yapışık |

> Prop'lar `assets/art/props/`, decal'ler `assets/art/decals/` altına.

#### 3. tur — VS-04'e girince (şimdi gerekmiyor)

| # | Paket | Adet | Dosya adları | Hedef |
| :-- | :--- | :-- | :--- | :--- |
| 5 | Drone 8 yön | 8 | `drone_N.png` … `drone_NW.png` | **40×40**, şeffaf, 8 yön |

> `assets/art/enemies/` altına. Oyuncuyla aynı yön mantığı.

### 5.2 Kritik teslim kuralları

- [ ] Dosya adları **birebir** yukarıdaki gibi; farklı isim/uzantı kullanma.
- [ ] PNG formatı. Karakter, prop ve decal'lerde **şeffaf arka plan**.
- [ ] ChatGPT şeffaflık vermezse **`#ff00ff` magenta** zemin iste; arka planı ben temizlerim.
- [ ] Dokular **seamless/tileable** ve **düz top-down** olmalı; izometrik elmas çizme, elmas maskesi kodda.
- [ ] Dokularda **baked ışık/gölge/ambiyans olmasın**; sadece malzeme ve aşınma.
- [ ] Karakter/prop/decal'lerde **ground shadow, drop shadow, yazı, logo, watermark yok**.
- [ ] Oyuncu ayakları **alt kenara** değmeli, yatayda ortalanmalı.
- [ ] 512–1024 px gelmesi sorun değil; hedef boyuta nearest-neighbor ile ben indireceğim.
- [ ] 8 yön birbiriyle aynı oran, siluet ve palette olmalı.
- [ ] Her varlığı ayrı ayrı üret; aynı sohbette kalarak stil sürekliliğini koru. **Tek istisna yürüyüş sheet'i:** onu tek görsel, 8 sütun × 4 satır olarak üret (bkz. `ART_BRIEF.md` 1b).

### 5.3 Teslimden sonra yapılanlar

- [x] 1. `src/assets/manifest.ts` içindeki ilgili kayıtlar `enabled: true`.
- [x] 2. `TileShaper` gerçek dokuları 64×32 zemin elmaslarına ve duvar sprite'larına dönüştürüyor.
- [x] 3. Oyuncunun 8 yön idle + 32 kare walk sprite'ı `Player` akışına bağlı; boyut/origin doğrulandı (32×48, ayaklar alt kenarda).
- [x] 4. Prop/decal yerleşimi `systems/Decor.ts`; depth `iso.y`, occlusion ve hücre bloklama uyumlu.
- [x] 5. Çevresel kayıtlar `data/logs.ts` + `systems/LogFeed.ts` ile yerleşti.
- [x] 6. CDP doğrulamaları + `npm run typecheck` + `npm run build` temiz.
- [x] 7. `narrative-director` ton denetimi yapıldı; önerilen 3 düzeltme uygulandı; VS-02 kapandı.

### 5.4 Sıradaki sanat işi

1.–2. tur teslim edildi ve entegre edildi. **3. tur: Drone 8 yön** (`drone_N.png` … `drone_NW.png`, 40×40) hâlâ bekleniyor; VS-04 şimdilik `PlaceholderArt` içindeki prosedürel drone ile çalışıyor. Sheet gelince `manifest.ts`'teki `drone` kaydını `enabled: true` yapıp `art:build` ile `assets/art/runtime/drone.png` üretmek yeterli.

Yeni bir sheet üretilirken: tek görsel, sabit genişlik, yönler sütun sırasında; kesici hücre boyunu `genişlik/8` ve `yükseklik/4` olarak hesapladığı için satır yüksekliği serbest.

*Son Güncelleme: 2026-10-27 | VS-06 aktif: 4 katlık iniş (0–3), katlar `src/data/levels/floor-0..3.json` dosyalarından yükleniyor (`LevelLoader` sıkı doğrulama + `levels:bake`/`levels:check`), `?debug` sağ üstte karanlık üstü minimap çiziyor (oyuncu/ambar/drone). Ambar keşfi: ambar üstünde yükselen amber ışık sütunu + kapak/hale/sinyal; kullanıcı isteğiyle yol lambaları kaldırıldı. 900 ms dolum + fade geçişi, varışta zorunlu ışık düşmesi + sessizlik. Basınç kat indeksine bağlı: görüş 1→0.65, fener 1→0.68, sessizlik 0.25→0.6 ve süre ×1.8, ambiyans perdesi ×0.97/kat, drone menzili +%30. 3. kat mühürlü (`exit=null`). `?floor=0..3` ile doğrudan test. VS-05 kapandı. FAZ 7 `[x]`. FAZ 8.1–8.3 tamam: dört katta CDP fonksiyonel testi (spawn/ambar/drone/bant, dolum eşiği, fade kilidi, varış), `levels:check` 4/4, `typecheck` + `build` temiz, `narrative-director` denetimi PASS WITH NOTES; 3. kat terminali artık sabit `> SECTOR 7 :: SEALED` gösteriyor. Sıradaki: kullanıcı 0→3 run'ı oynayıp VS-06 / FAZ 8.4 onayı.*
