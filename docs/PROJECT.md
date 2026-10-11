# Token Karnesi — Proje Dokümantasyonu

**Canlı site:** https://tokenkarnesi.xyz  
**GitHub:** https://github.com/izzetcakmak/token-karne  
**Yapım:** izzetcakmak · [@izzetcakmak35](https://x.com/izzetcakmak35)

---

## Proje Nedir?

Token Karnesi, memecoin yatırımcıları için tasarlanmış açık kaynaklı bir due-diligence aracıdır. Bir token kontrat adresi yapıştırırsın, 12 soruluk otomatik analiz saniyeler içinde çalışır ve sana net bir karar verir: büyük gir, normal gir, küçük gir veya geç.

Backend yok. Her şey tarayıcıdan public API'lere doğrudan çekilir.

---

## Desteklenen Zincirler

- **Solana** (GoPlus, RugCheck, fxtwitter)
- **Ethereum, Base, Arbitrum, BSC, Polygon** ve tüm büyük EVM zincirleri (DexScreener + GoPlus)
- **Arc** (A NEW ONE eğri verisi, Arc Mainnet kontratı)
- GoPlus'ın kapsamadığı EVM zincirleri: bytecode taraması + Blockscout holder verisi

---

## 12 Soru

| # | Soru | Kaynak | Otomatik? |
|---|------|--------|-----------|
| 1 | Likidite havuzu $30k üstünde mi? | DexScreener | ✅ |
| 2 | Likidite kilitli ya da yakılmış mı? | GoPlus / RugCheck / zincir | ✅ V2; V3/V4 açıklamalı |
| 3 | Mint yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 4 | Freeze yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 5 | İlk 10 cüzdan arzın %20'sinden azını tutuyor mu? | GoPlus / Blockscout | ✅ borsa/havuz hariç |
| 6 | Cüzdanlar birbirinden bağımsız mı? | RugCheck insider graph | ⚠️ tahmin |
| 7 | Geliştirici daha önce coin çıkarıp bırakmamış mı? | RugCheck / GoPlus | ✅ |
| 8 | Sosyal hesap bir haftadan eski mi? | fxtwitter | ✅ gerçek tarih |
| 9 | Takipçiler gerçek mi? | fxtwitter + heuristic | ⚠️ tahmin |
| 10 | Holder sayısı son 24 saatte arttı mı? | GoPlus + lokal snapshot | ⚠️ proxy |
| 11 | 24s hacim likiditinin en az yarısı mı? | DexScreener | ✅ |
| 12 | Hikayeyi tek cümleyle anlatabilir misin? | Sen | 👤 senin cevabın |

**Puan skalası:** 11-12 büyük gir · 9-10 normal · 7-8 küçük · ≤6 geç

Her cevap elle değiştirilebilir, skor anında güncellenir. Değişiklikler `localStorage`'da token bazında saklanır.

---

## Mimari

```
tokenkarnesi.xyz (Vercel)
├── index.html          — tek sayfa, tüm uygulama
├── assets/
│   ├── app.js          — çekirdek analiz motoru (~1500 satır)
│   ├── i18n.js         — TR/EN çeviriler
│   ├── style.css       — tüm stiller
│   └── onchain.js      — Arc Mainnet cüzdan bağlantısı + skor kayıt
├── data/
│   └── board.json      — otomatik tarama sonuçları (GitHub Actions yazar)
└── scripts/
    └── scan.js         — tahta tarama scripti (Node.js)

.github/workflows/
└── scan.yml            — 30 dakikada bir tahta taraması

contracts/
└── TokenKarnesi.sol    — Arc Mainnet skor kayıt kontratı
```

---

## Arc Entegrasyonu

### Skor Kayıt Kontratı

| | |
|---|---|
| **Ağ** | Arc Mainnet (Chain ID: 5042) |
| **Adres** | `0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f` |
| **Owner** | `0xD4F1254C803662c46D9c21f80F4F3c15FF57e2c9` |
| **Explorer** | https://explorer.arc.io/address/0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f |

**Fonksiyonlar:**
- `submitScore(tokenCA, uint8[12] scores, uint8 total)` — 0.10 USDC karşılığında skoru zincire yazar
- `getScore(tokenCA)` — herkes ücretsiz okur
- `withdraw()` — birikmiş USDC'yi owner adresine gönderir (sadece owner)
- `setFee(newFee)` — ücreti günceller (sadece owner)

**Ücret akışı:**
1. Kullanıcı analizi ücretsiz yapar
2. "Bu karneyi zincire kaydet" butonuna basınca MetaMask/Rabby/OKX açılır
3. USDC approve → `submitScore` → skor zincire yazılır
4. Biriken USDC `withdraw()` ile owner'a çekilir

**Token anahtarlama:**
- EVM adresi → kendisi kullanılır
- Solana mint → `sha256("solana:" + mint)`'in ilk 20 baytı

### USDC (Arc Mainnet)
`0x3600000000000000000000000000000000000000`

### Desteklenen Cüzdanlar
- MetaMask
- Rabby
- OKX Web3 Wallet
- Diğer EIP-1193 uyumlu cüzdanlar

---

## AL Butonu

Token karnesinde AL butonuna tıklayınca zincire göre yönlendirme yapılır:

| Zincir | Yönlendirme |
|--------|-------------|
| Arc | A NEW ONE platformu |
| Solana | Jupiter (`jup.ag/swap/USDC-<CA>`) |
| Diğer EVM | DexScreener çifti |

---

## Tahta (Otomatik Tarama)

`scripts/scan.js` Node.js scripti GitHub Actions üzerinden **30 dakikada bir** çalışır:

1. DexScreener'ın boosted ve yeni listelenen tokenlerini çeker
2. Sitenin kendi analiz motoruyla (`analyze()`) puanlar
3. 9+ puan alanları `data/board.json`'a yazar
4. Commit → Vercel otomatik deploy → tahta güncellenir

```bash
# Elle çalıştır
BOARD_LIMIT=45 BOARD_MIN=9 node scripts/scan.js
```

Son tarama tarihi ve token sayısı tahtanın altında gösterilir.

---

## Veri Kaynakları

| Kaynak | Kullanım |
|--------|----------|
| [DexScreener](https://docs.dexscreener.com/api/reference) | Havuzlar, likidite, hacim, sosyal medya linkleri |
| [GoPlus Security](https://docs.gopluslabs.io/) | EVM + Solana token güvenliği, holder'lar, LP |
| [RugCheck](https://api.rugcheck.xyz/swagger/index.html) | Solana riskleri, LP kilidi, insider graph, dev geçmişi |
| [fxtwitter](https://github.com/FixTweet/FxTwitter) | X profil verisi: katılım tarihi, takipçi, tweet sayısı |
| Bubblemaps / GMGN / TweetScout | Göz ile inceleme için derin linkler |

---

## Yerel Çalıştırma

```bash
npx -y http-server . -p 4933 -c-1
# veya
python3 -m http.server 4933
```

Statik dosyalar — Vercel, GitHub Pages, Walrus Sites, herhangi bir CDN'de çalışır.

URL parametresi ile doğrudan analiz:
```
https://tokenkarnesi.xyz/?ca=<ADRES>&chain=<ZİNCİR>
```

---

## Önemli Notlar

- Analiz sonuçları **kesinlikle yatırım tavsiyesi değildir**
- Memecoin sektörü son derece yüksek risklidir
- API'ler bazen yanlış, eski veya eksik veri dönebilir
- Her karneyi kendi araştırmanla destekle

---

*Son güncelleme: Ekim 2026*
