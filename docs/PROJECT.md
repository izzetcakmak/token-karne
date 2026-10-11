# Token Karnesi — Proje Dokümantasyonu

**Canlı site:** https://tokenkarnesi.xyz  
**GitHub:** https://github.com/izzetcakmak/token-karne  
**Yapan:** [izzetc](https://www.izzetc.com) · [@izzetcakmak35](https://x.com/izzetcakmak35)

---

## Nedir?

Token Karnesi, memecoin yatırımcıları için 12 soruluk otomatik bir güvenlik kontrol listesidir. Bir kontrat adresi yapıştır; likidite, mint/freeze yetkisi, holder dağılımı, dev geçmişi, sosyal medya durumu ve hacim — hepsi tek ekranda. Karne sonu net bir karar: büyük gir, normal gir, küçük gir ya da geç.

**Mimari:** Saf HTML + CSS + JavaScript. Framework yok, backend yok. Tüm veriler tarayıcıdan halka açık API'lere doğrudan çekilir.

---

## 12 Soru

| # | Soru | Kaynak | Otomasyon |
|---|------|--------|-----------|
| 1 | Likidite havuzu 30 bin doların üstünde mi? | DexScreener | ✅ |
| 2 | Likidite kilitli ya da yakılmış mı? | GoPlus / RugCheck / zincir | ✅ V2 havuzlarında; V3/V4'te LP tokeni yok, açıklanır |
| 3 | Mint yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 4 | Freeze yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 5 | İlk 10 cüzdan arzın %20'sinden azını tutuyor mu? | GoPlus / RugCheck / Blockscout | ✅ borsa ve havuz cüzdanları hariç |
| 6 | Cüzdanlar birbirine bağımsız mı, dağılım temiz mi? | RugCheck insider grafiği + sezgisel | ⚠️ tahmin |
| 7 | Geliştirici daha önce coin çıkarıp bırakmamış mı? | RugCheck creatorTokens / GoPlus | ✅ Solana: önceki tokenler + piyasa değerleri |
| 8 | Sosyal hesap bir haftadan eski mi? | fxtwitter (herkese açık) | ✅ gerçek kayıt tarihi |
| 9 | Takipçiler gerçek mi, bot şişirmemiş mi? | fxtwitter + sezgisel | ⚠️ tahmin |
| 10 | Holder sayısı son 24 saatte arttı mı? | GoPlus + yerel snapshot | ⚠️ vekil, yeniden bakıldığında gerçek |
| 11 | 24 saatlik hacim likiditanin en az yarısı kadar mı? | DexScreener | ✅ |
| 12 | Hikâyeyi tek cümlede anlatabilir misin? | sen | 👤 senin cevabın |

**Puan skalası:** 11–12 büyük gir · 9–10 normal gir · 7–8 küçük gir · ≤6 geç.

Her cevap elle çevrilebilir — puan anında güncellenir ve değişiklikler `localStorage`'a kaydedilir.

---

## Hüküm Kapıları (pay.js)

Site, iki noktada 0.10 USDC ödeme kapısı uygular. Ödeme Arc mainnet'te USDC `transfer()` işlemiyle yapılır; kendi cüzdanına gider (`0xD4F...2c9`).

### 1. Karne Kapısı
- Analiz **önce** çalışır. Token bulunamazsa ya da kaynaklar cevap vermezse ödeme hiç istenmez.
- Sonuç hazır olunca ödeme kartı çıkar; onaylanan işlemden sonra karne açılır.
- Her karne ayrı ödeme: örnekler, geçmiş, tahta satırları ve `?ca=` linkleri de bu kapıdan geçer.

### 2. Tahta Kapısı
- 0.10 USDC = 30 dakikalık erişim (bu tarayıcıda).
- Süre bitince liste kendiliğinden kapanır; tekrar görmek yeni ödeme ister.
- Geri sayım sayacı tahtanın üstünde görünür.

---

## Arc Entegrasyonu

### Onchain Skor Kaydı (onchain.js)
Analiz tamamlandıktan sonra kullanıcı sonucu Arc Mainnet'e yazabilir:

| Parametre | Değer |
|-----------|-------|
| Contract | `0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f` |
| Ağ | Arc Mainnet (Chain ID: 5042 / `0x13B2`) |
| USDC | `0x3600000000000000000000000000000000000000` |
| Ücret | 0.10 USDC / `submitScore` |
| Owner | `0xD4F1254C803662c46D9c21f80F4F3c15FF57e2c9` |
| Explorer | https://explorer.arc.io/address/0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f |

**Contract fonksiyonları:**
- `submitScore(tokenCA, scores[12], total)` — 0.10 USDC karşılığında skoru zincire yazar
- `getScore(tokenCA)` — herkes ücretsiz okur
- `withdraw()` — birikmiş USDC'yi owner adresine gönderir (sadece owner çağırabilir)
- `setFee(newFee)` — ücreti günceller (sadece owner)

**Token anahtarlama:** EVM adresleri kendisi kullanılır. Solana mint'leri için `sha256("solana:" + mint)`'in ilk 20 baytı kullanılır — okuma ve yazma aynı anahtardan geçer.

### AL Butonu (onchain.js)
Token zincirine göre dış linke yönlendirir:

| Zincir | Yönlendirme |
|--------|------------|
| Arc (A NEW ONE) | A NEW ONE token sayfası |
| Solana | `jup.ag/swap/USDC-<CA>` |
| Diğer EVM | DexScreener pair URL |

---

## Tahta (The Board)

GitHub Actions ile otomatik tarama (`scripts/scan.js` + `.github/workflows/scan.yml`):

- Her **30 dakikada bir** DexScreener'daki yeni/öne çıkan tokenler taranır
- Minimum eşik: 9 puan ve **24 saati doldurmuş** token
- Sonuçlar `data/board.json`'a yazılır; Vercel bu commit'i algılayınca otomatik deploy eder
- Tarayıcıda aynı `analyze()` motoru çalışır → tahta skoru ile manuel karne skoru eşleşir
- Tahta erişimi ücretlidir: 0.10 USDC / 30 dakika

Elle çalıştırmak için:
```bash
BOARD_LIMIT=45 BOARD_MIN=9 node scripts/scan.js
```

---

## Desteklenen Zincirler

| Zincir | Güvenlik Verisi | Holder | Sosyal |
|--------|----------------|--------|--------|
| Ethereum | GoPlus | GoPlus | fxtwitter |
| Base | GoPlus / bytecode | Blockscout | fxtwitter |
| Arbitrum | GoPlus | GoPlus | fxtwitter |
| BSC | GoPlus | GoPlus | fxtwitter |
| Solana | GoPlus + RugCheck | GoPlus | fxtwitter |
| Arc (A NEW ONE) | Bytecode + A NEW ONE API | A NEW ONE API | Metadata |
| Diğer EVM | Bytecode + Blockscout | Blockscout | fxtwitter |

---

## Veri Kaynakları

- **DexScreener** — havuzlar, likidite, hacim, sosyal linkler
- **GoPlus Security** — EVM + Solana token güvenliği, holderlar, LP
- **RugCheck** — Solana riskleri, LP kilidi, insider grafik, dev'in önceki tokenleri
- **fxtwitter** — herkese açık X profili: kayıt tarihi, takipçi, takip, tweet sayısı
- **Bubblemaps / GMGN / TweetScout** — göz ile doğrulama için derin linkler
- **A NEW ONE API** — Arc zincirindeki eğri havuzu verileri

---

## Yerel Çalıştırma

```bash
npx -y http-server . -p 4933 -c-1
```

Statik dosyalar — Vercel, GitHub Pages, Walrus Sites veya herhangi bir CDN'e deploy edilebilir.

`?ca=<adres>&chain=<zincir>` URL parametresiyle tarama direkt başlar (paylaşım linkleri bu formatı kullanır).

---

## Önemli Not

> ⚠️ Bu araç **yatırım tavsiyesi değildir.** Veriler herkese açık API'lerden anlık çekilir; hatalı, eksik ya da gecikmeli olabilir. Skor bir kontrol listesidir, garanti değil. Kendi araştırmanı yap.
