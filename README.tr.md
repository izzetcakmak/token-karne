# 📋 Token Karnesi

**[tokenkarnesi.xyz](https://tokenkarnesi.xyz)**

Memecoinler için 12 soruluk karne. Kontrat adresini yapıştır, tek ekranda net bir hüküm al:
**büyük gir, normal gir, küçük gir ya da geç.**

Backend yok. Her şey doğrudan tarayıcıdan, herkese açık API'lerden çekiliyor.

## 12 soru

| # | Soru | Kaynak | Otomatik mi? |
|---|------|--------|--------------|
| 1 | Likidite havuzu 30 bin doların üstünde mi? | DexScreener | ✅ |
| 2 | Likidite kilitli ya da yakılmış mı? | GoPlus / RugCheck / zincir | ✅ V2 havuzda; V3/V4'te LP token yok, nedeni yazılır |
| 3 | Mint yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 4 | Freeze yetkisi kapalı mı? | GoPlus / RugCheck / bytecode | ✅ |
| 5 | İlk 10 cüzdan arzın %20'sinden azını mı tutuyor? | GoPlus / Blockscout | ✅ borsa ve havuz cüzdanları hariç |
| 6 | Cüzdanlar bağsız mı, dağılım temiz mi? | RugCheck insider grafiği + sezgisel | ⚠️ tahmin |
| 7 | Geliştirici daha önce coin çıkarıp bırakmamış mı? | RugCheck creatorTokens / GoPlus | ✅ Solana'da eski tokenler + mcap'leri |
| 8 | Sosyal hesap bir haftadan eski mi? | fxtwitter (public) | ✅ gerçek açılış tarihi |
| 9 | Takipçileri gerçek mi? | fxtwitter + sezgisel | ⚠️ tahmin |
| 10 | Holder sayısı son 24 saatte arttı mı? | GoPlus + yerel kayıt | ⚠️ proxy, tekrar bakışta gerçek |
| 11 | Günlük hacim likiditenin yarısı kadar mı? | DexScreener | ✅ |
| 12 | Hikâyeyi tek cümleyle anlatabiliyor musun? | sen | 👤 sen |

Tasarımı gereği sadece 12. soru sana kalıyor. Her cevabı elle çevirebilirsin — puan anında güncellenir, verdiğin cevaplar o token için
`localStorage`'da saklanır.

**Skala:** 11-12 nadir (büyük gir) · 9-10 temiz (normal) · 7-8 riskli (küçük gir, takip et) · ≤6 geç.

## Seni neyden koruyor

* **Sahte likidite.** Değersiz bir tokenle eşlenmiş havuz milyonlarca dolarlık "likidite"
  gösterebilir. Sadece tanınan bir varlıkla (SOL, ETH, USDC…) açılmış havuzlar sayılır,
  gerisi dışlanır ve kırmızı bayrak olarak yazılır. Fiyat ve piyasa değeri en yüksek
  *hacimli* havuzdan okunur, en yüksek *likiditeli* havuzdan değil.
* **Ters taraf havuzlar.** Sadece tokenin base tarafında olduğu havuzlar kullanılır;
  böylece piyasa değeri asla karşı tokene ait olmaz.
* **Top-10'daki LP/yakma adresleri.** Havuz cüzdanları, yakma adresleri, kilitli
  pozisyonlar ve bilinen AMM otoriteleri yoğunlaşma hesabından çıkarılır.

* **Kapsam dışı zincirler.** GoPlus bir ağı desteklemiyorsa veriler doğrudan zincirden okunur:
  `eth_getCode` ile bytecode'da mint/pause/blacklist selector'leri aranır, `owner()` ile
  sahipliğin bırakılıp bırakılmadığı sorulur, LP pair'in `totalSupply` ve `0xdead` bakiyesinden
  yakma oranı hesaplanır, holder listesi Blockscout'tan alınır. Şu an Robinhood Chain bağlı;
  yeni ağ eklemek `ONCHAIN` tablosuna bir satır.

## Tahta (otomatik tarama)

GitHub Actions'ta 30 dakikada bir çalışan bir iş (`scripts/scan.js`), DexScreener'ın öne çıkan ve
yeni profil açan tokenlerini çekip **sitenin kendi puanlama motoruyla** tarar; barajı geçenleri
`data/board.json`'a yazar, site de ana sayfada gösterir. Backend yok: iş dosyayı `board` dalına
commit eder, sayfa onu raw.githubusercontent.com'dan okur; böylece tarama hiçbir zaman Vercel
deploy'u tetiklemez (ücretsiz planda günde 100 deploy var, tarama commit'leri bu kotayı yerdi).

Motor tek kaynaktan gelir — tarayıcıdaki `analyze()` fonksiyonunun aynısı Node'da çalıştırılır,
böylece tahtadaki puanla tıklayınca çıkan karne birbirini tutar.

```bash
BOARD_LIMIT=45 BOARD_MIN=9 node scripts/scan.js   # elle çalıştırmak için
```

Repo public olduğu için GitHub Actions dakikaları ücretsiz; tarama sıklığını
`.github/workflows/scan.yml` içindeki cron satırından değiştirebilirsin.

## Veri kaynakları

* [DexScreener](https://docs.dexscreener.com/api/reference) — havuz, likidite, hacim, sosyaller
* [GoPlus Security](https://docs.gopluslabs.io/) — EVM + Solana token güvenliği, holder, LP
* [RugCheck](https://api.rugcheck.xyz/swagger/index.html) — Solana riskleri, LP kilidi, insider grafiği, dev'in eski tokenleri
* [fxtwitter](https://github.com/FixTweet/FxTwitter) — herkese açık X profil verisi: açılış tarihi, takipçi, takip, tweet
* Bubblemaps / GMGN / TweetScout — gözünle doğrulamak için tek tık linkler

## Çalıştırmak için

```bash
npx -y http-server . -p 4933 -c-1
```

Sadece statik dosya — Vercel, GitHub Pages, Walrus Sites, nereye istersen.

`?ca=<adres>&chain=<zincir>` ile URL'den doğrudan tarama başlar; paylaşım linkleri de
bunu kullanır.

## Yatırım tavsiyesi değildir

Skor bir kontrol listesidir, garanti değil. API'ler hatalı, eski ya da eksik olabilir.
Kendi araştırmanı yap.

Yapan: [izzetc](https://www.izzetc.com) · [@izzetcakmak35](https://x.com/izzetcakmak35)
