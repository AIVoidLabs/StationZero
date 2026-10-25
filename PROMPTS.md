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

- [ ] **0.1** `package.json` kontrolü (Vite + Phaser v4 + TypeScript mevcut mu?)
- [ ] **0.2** `tsconfig.json` strict ayarlarının doğrulanması
- [ ] **0.3** `AGENTS.md` okunup kuralların netleştirilmesi
- [ ] **0.4** `.opencode/agents/` içerisindeki mevcut sub-agentların gözden geçirilmesi (`narrative-director` dahil)
- [ ] **0.5** `vite.config.ts` watcher ayarının `.opencode/` hariç tutacak şekilde ayarlanmış olması kontrolü

**Kriter:** Geliştirme ortamı sorunsuz çalışır durumda olmalı.

---

### FAZ 1: İZOMETRİK ALTYAPI & DERİNLİK SIRALAMASI (ÇEKİRDEK)
*Hedef: Tüm görsellik ve hareketin üstüne oturacağı matematiksel temel.*

- [ ] **1.1** `src/utils/iso.ts` oluştur
  - [ ] `cartesianToIso(gridX, gridY, tileWidth, tileHeight)`
  - [ ] `isoToCartesian(isoX, isoY, tileWidth, tileHeight)`
  - [ ] AGENTS.md'deki formüllerle %100 birebir
- [ ] **1.2** `src/utils/grid.ts` oluştur
  - [ ] Grid sınır kontrolü
  - [ ] Geçerli/Geçersiz hücre yardımcıları
- [ ] **1.3** `src/systems/DepthSort.ts` oluştur
  - [ ] Sahnedeki renderable entity'leri `isoY` değerine göre sırala
  - [ ] `update()` içerisinde her frame çalıştırılabilir yapı
  - [ ] Sadece ihtiyaç duyulan objelerle çalışacak şekilde minimal tut
- [ ] **1.4** `src/data/config.ts` oluştur (Sabitler)
  - [ ] `TILE_WIDTH`, `TILE_HEIGHT` (Örn: 64x32)
  - [ ] Grid boyutları
  - [ ] Kamera ayarları

**Kriter:** İzometri dönüşümleri doğru çalışıyor, depth sorting mantığı hazır.

---

### FAZ 2: SCENE AKIŞI & BOOT/PRELOAD/GAME
*Hedef: Phaser Scene döngüsünü kurmak.*

- [ ] **2.1** `src/scenes/Boot.ts` oluştur
- [ ] **2.2** `src/scenes/Preload.ts` oluştur
- [ ] **2.3** `src/scenes/Game.ts` oluştur
- [ ] **2.4** `src/main.ts` düzenle ve sahne sıralamasını ayarla (Boot, Preload, Game)

**Kriter:** Oyun boş bir test sahnesiyle sorunsuz açılıyor.

---

### FAZ 3: PLAYER, HAREKET & ÇARPIŞMA (İLK OYNANABİLİRLİK)
*Hedef: Koridorda yürüyebilmeyi sağlamak.*

- [ ] **3.1** `src/entities/Player.ts` oluştur
- [ ] **3.2** Grid tabanlı çarpışma sistemi
- [ ] **3.3** Kamera takibi
- [ ] **3.4** İlk test haritası (Sadece dar koridorlar, küçük boyutlu)

**Kriter:** Oyuncu dar koridorda yürüyebiliyor, duvarlara çarpıyor, kamera takip ediyor.

---

### FAZ 4: ATMOSFER, IŞIK & ÇEVRESEL HİKAYE
*Hedef: Atmosferi güçlendirmek.*

- [ ] **4.1** Karanlık hissi / lokal karartma
- [ ] **4.2** Minimal prop'lar (`src/entities/props/`)
- [ ] **4.3** Parçalı çevresel kayıtlar (çok kısa, kesik metinler)
- [ ] **4.4** Atmosfer notları (Ses fikirleri planlama amaçlı)

**Kriter:** Terkedilmiş koloninin hissi veriliyor.

---

### FAZ 5: WARDEN ATMOSFERİ & GERİLİM ÇEKİRDEĞİ
*Hedef: Dolaylı tehdit hissettirmek.*

- [ ] **5.1** `src/systems/WardenAtmosphere.ts` oluştur
- [ ] **5.2** Nadir, dolaylı gerilim tetikleyicileri
- [ ] **5.3** İlerideki entegrasyon için taslak

**Kriter:** Düşman olmadan bile gerilim hissi oluşuyor.

---

### FAZ 6: MİNİMAL DÜŞMAN & AVOIDANCE
*Hedef: Sadece kaçınmaya teşvik edecek kadar minimal.*

- [ ] **6.1** `src/entities/enemies/Drone.ts`
- [ ] **6.2** Grid tabanlı LOS
- [ ] **6.3** Aggro/Disengage kuralları
- [ ] **6.4** `combat-ai` ile deneme ve ayar

**Kriter:** Tehditkar ama kaçınarak geçilebilir.

---

### FAZ 7: DERİNLİK, ZORLUK EĞRİSİ & ARTAN BASKI
*Hedef: Derinleştikçe baskıyı artırmak.*

- [ ] **7.1** `src/systems/DepthManager.ts`
- [ ] **7.2** Kademeli escalation (ışık, sessizlik, farkındalık)
- [ ] **7.3** `warden-director-systems` ile minimal entegrasyon

**Kriter:** Zorluk değil, baskı artıyor.

---

### FAZ 8: TEST, TEMİZLİK & VERTICAL SLICE KAPANIŞI
*Hedef: Stabil, tutarlı ve ruhuna sadık vertical slice.*

- [ ] **8.1** Fonksiyonel test
- [ ] **8.2** Kapsam denetimi (`narrative-director` ile)
- [ ] **8.3** Kod kalitesi (`npm run typecheck` temiz)
- [ ] **8.4** Vertical Slice onayı

**Kriter:** Küçük ama oynanabilir, claustrophobic, atmosferik vertical slice tamamlanmış.

---

## 3. GELİŞTİRME TAKİBİ

### Durum Özeti
| Faz | Durum | Not |
| :-- | :--- | :--- |
| FAZ 0: Hazırlık | `[ ]` Beklemede | |
| FAZ 1: İzometri + Depth Sort | `[ ]` Beklemede | Kritik temel |
| FAZ 2: Scene Akışı | `[ ]` Beklemede | Boot/Preload/Game |
| FAZ 3: Player + Hareket + Çarpışma | `[ ]` Beklemede | İlk oynanabilirlik |
| FAZ 4: Atmosfer & Çevresel Hikaye | `[ ]` Beklemede | Ruh verme |
| FAZ 5: WARDEN Atmosferi | `[ ]` Beklemede | Dolaylı tehdit |
| FAZ 6: Minimal Drone & Avoidance | `[ ]` Beklemede | Minimal tut |
| FAZ 7: Derinlik & Escalation | `[ ]` Beklemede | Kademeli baskı |
| FAZ 8: Test & Kapanış | `[ ]` Beklemede | Vertical Slice onayı |

### Oturum Kayıtları
> Her oturum sonunda güncelle.

| Tarih | Tamamlanan | Şu An | Engel/Şüphe | Sıradaki |
| :-- | :--- | :--- | :--- | :--- |
| `YYYY-MM-DD` | - | - | - | - |

### Hızlı Hatırlatma
- [ ] AGENTS.md'e sadık kal
- [ ] Depth Sorting zorunlu
- [ ] İzometri formülleri birebir kullan
- [ ] Scope creep'e karşı `narrative-director`'a danış
- [ ] Vibe-coding isteklerinde `vibe-conductor`'ı kullanarak filtrele/yönlendir
- [ ] Kaçınma > Saldırı
- [ ] Az göster, çok hissettir
- [ ] Daha az ama oynanabilir

---

## 4. VERTICAL SLICE ROADMAP (Başlangıçtan Sona)

Oyunun ruhunu adım adım ortaya koymak için, her biri kendi başına oynanabilir ve belirli bir hissi hedefleyen vertical slice'larla ilerleyeceğiz. **Her seferinde SADECE bir VS bitirilmeden diğerine geçilmez.**

### Aktif Vertical Slice
> Geliştirme esnasında bu değeri güncel tut.

**AKTİF_VS:** `VS-01` - `CORRIDOR CORE`

### Slice Listesi

| ID | İsim | Hedef Hissi | Kapsam | Oynanabilirlik Kriteri | Durum |
| :-- | :--- | :--- | :--- | :--- | :--- |
| **VS-01** | `CORRIDOR CORE` | *"Dar koridorda yalnızım"* | `utils/iso.ts`, `utils/grid.ts`, `systems/DepthSort.ts`, `data/config.ts`, `scenes/Boot.ts`, `scenes/Preload.ts`, `scenes/Game.ts`, `entities/Player.ts`, grid tabanlı çarpışma, minimal dar koridor haritası, kamera takibi | Koridorda yürüyebiliyorum, duvarlara çarpıyorum, çizim sırası doğru, kamera takip ediyor. | `[ ]` Beklemede |
| **VS-02** | `ENVIRONMENTAL DREAD` | *"Bu yer çok uzun zamandır terkedilmiş"* | Lokal karartma/gölge, `entities/props/` (kırık panel, hasarlı terminal vb.), parçalı çevresel kayıtlar, boşluk hissi | Hiçbir düşman yokken bile rahatsız edici atmosfer. Diyalog yerine çevre anlatıyor. | `[ ]` Beklemede |
| **VS-03** | `THE WATCHED` | *"Biri beni izliyor"* | `systems/WardenAtmosphere.ts`, ışık titreşmesi, aniden çöken sessizlik, nadir dolaylı tetikleyiciler | Düşman görmeden "izleniyor" hissi veriyor. Jump-scare yok, sadece baskı. | `[ ]` Beklemede |
| **VS-04** | `UNWANTED COMPANY` | *"Kaçınmam daha akıllıca"* | `entities/enemies/Drone.ts`, grid tabanlı LOS, `systems/Combat.ts` (sadece LOS/aggro/disengage), state machine (`IDLE/PATROL/CHASE/SEARCH/DISENGAGE`), `combat-ai` ile dengeleme | Düşman tehditkar ama zorunlu savaş değil. Kaçınarak geçilebiliyor. Aggro kaybolunca geri dönüyor. | `[ ]` Beklemede |
| **VS-05** | `GOING DEEPER` | *"Aşağı indikçe daha sessizleşiyor"* | `systems/DepthManager.ts`, derinliğe göre ışık azaltma, daha uzun sessizlik aralıkları, kademeli karşılaşma sıklığı, çevrenin daha harap görünümü | Derinliğe indikçe oyun daha zor değil, **daha baskıcı** hale geliyor. | `[ ]` Beklemede |
| **VS-06** | `SEALED IN` | *"Çıkış yok. Sadece biraz daha ileri"* | Tüm sistemlerin birleştirilmesi, dengeleme, budama, minimal `systems/DungeonGenerator.ts` entegrasyonu (opsiyonel), `warden-director` + `narrative-director` ile son denetim | Küçük ama tutarlı bir "run". Keşfetmek, temkinli ilerlemek, kaçınmak doğal akıyor. Tam anlamıyla Station Zero hissi. | `[ ]` Beklemede |

### Kod Yerleşim Rehberi (Kavram -> Dosya)

| Kavram | Dosya/Klasör | Açıklama |
| :-- | :--- | :--- |
| **Protagonist (Exile/Player)** | `src/entities/Player.ts` | Hareket, grid tabanlı çarpışma, izometrik konum. Büyürse `entities/player/`'a parçalanabilir. |
| **Antagonist (Drones)** | `src/entities/enemies/Drone.ts` | Düşmanlar. State machine ile minimal tut. |
| **WARDEN (Direktör)** | `src/systems/WardenAtmosphere.ts`, `src/systems/WardenDirector.ts` | Entity değil **sistem**. Dolaylı etkiler, spawn kararları, alarm durumu. |
| **Combat** | `src/systems/Combat.ts` (minimal) | Sadece LOS, aggro/disengage ve çok minimal hasar. **Avoidance-first** öncelikli. |
| **Dungeon (Üretim)** | `src/systems/DungeonGenerator.ts` | Dar koridor ağırlıklı üretim mantığı. **VS-06'ya yakın** minimal halde eklenebilir. |
| **Level (Yerleşim)** | `src/scenes/Game.ts` + `src/data/maps/` | Üretilen/çizilen haritanın sahneye uygulanması. İlk başta **elle çizilmiş minimal harita** kullan. |
| **Props / Çevresel Hikâye** | `src/entities/props/` | Kırık panel, hasarlı terminal vb. Sadece atmosfer amaçlı entity'ler. |
| **Atmosfer/Gerilim** | `src/systems/WardenAtmosphere.ts`, `src/systems/DepthManager.ts` | Işık, sessizlik, derinliğe göre baskı. |

### VS Checklistleri

#### VS-01: CORRIDOR CORE
- [ ] **Iso Altyapı:** `src/utils/iso.ts` (AGENTS.md formülleri birebir)
- [ ] **Grid Yardımcıları:** `src/utils/grid.ts`
- [ ] **Depth Sort:** `src/systems/DepthSort.ts` (isoY bazlı)
- [ ] **Config:** `src/data/config.ts` (TILE_WIDTH/HEIGHT, kamera vb.)
- [ ] **Scene Akışı:** `src/scenes/Boot.ts`, `src/scenes/Preload.ts`, `src/scenes/Game.ts`
- [ ] **Oyuncu:** `src/entities/Player.ts` (izometrik hareket + grid çarpışma)
- [ ] **Test Haritası:** Sadece dar koridorlardan oluşan çok küçük harita (elle çizilmiş)
- [ ] **Kamera:** Sıkı takip
- [ ] **Test:** Yürüyebiliyor, çarpışma çalışıyor, depth sorting doğru

#### VS-02: ENVIRONMENTAL DREAD
- [ ] **Karanlık Hissi:** Lokal karartma/gölge mantığı
- [ ] **Prop'lar:** `src/entities/props/` minimal set
- [ ] **Parçalı Kayıtlar:** Çok kısa, kesik çevresel metinler
- [ ] **Ton Denetimi:** `narrative-director` ile gözden geçirme
- [ ] **Test:** Hiç düşman yokken rahatsız edici his veriyor mu?

#### VS-03: THE WATCHED
- [ ] **Warden Atmosfer:** `src/systems/WardenAtmosphere.ts`
- [ ] **Tetikleyiciler:** Işık titreşmesi, aniden çöken sessizlik (nadir)
- [ ] **Dolaylı Tehdit:** Asla jump-scare yok
- [ ] **Test:** "İzleniyor" hissi veriyor ama tehdit görsel olarak aşikar değil

#### VS-04: UNWANTED COMPANY
- [ ] **Drone:** `src/entities/enemies/Drone.ts` (minimal state machine)
- [ ] **LOS:** Grid tabanlı line of sight
- [ ] **Davranış:** `IDLE/PATROL/CHASE/SEARCH/DISENGAGE`
- [ ] **Combat Minimal:** `src/systems/Combat.ts` (sadece gerekli kısım)
- [ ] **Denge:** `combat-ai` ile ayar (kaçınmaya teşvik et)
- [ ] **Test:** Kaçınarak geçilebiliyor, aggro kaybolunca geri dönüyor

#### VS-05: GOING DEEPER
- [ ] **Derinlik Sistemi:** `src/systems/DepthManager.ts`
- [ ] **Kademeli Baskı:** Işık, sessizlik, farkındalık
- [ ] **Entegrasyon:** `WardenAtmosphere` ile bağlama
- [ ] **Test:** Derinlik arttıkça **daha baskıcı**, daha zor değil

#### VS-06: SEALED IN
- [ ] **Birleştirme:** Tüm VS'leri tek akışta birleştir
- [ ] **Budama:** Gereksiz kod/sistem temizliği
- [ ] **Denge:** `warden-director` + `narrative-director` ile denetim
- [ ] **Minimal Dungeon:** Gerekliyse `DungeonGenerator.ts` minimal entegrasyonu
- [ ] **Final Test:** Tutarlılık, kapsam kontrolü, ruhuna sadık mı?
- [ ] **Onay:** Vertical Slice tamamlandı olarak işaretle

### Prensipler
- **Elle kod yazmıyoruz:** Tüm kodu agent yazacak, vibe-coding mantığıyla ilerleyeceğiz.
- **"Şu özellik olsun" yeterli:** Vibe-coding isteklerini yönetmek için `vibe-conductor` kullan.
- **Daha az ama oynanabilir:** İlk hedef **tamamlanmış küçük bir run** olmak.
- **Kaçınma öncelikli:** Combat her zaman kaçınmaya teşvik edecek şekilde ayarlanmalı.
- **Az göster, çok hissettir:** UI/metin yerine çevreyle anlat.

*Son Güncelleme: 2026-10-25 | Hedef: Minimal, claustrophobic ve atmosferik vertical slice serisi.*
