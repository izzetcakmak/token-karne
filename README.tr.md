# 📋 Token Karnesi

Memecoinler için 12 soruluk karne. Kontrat adresini yapıştır, tek ekranda net bir hüküm al:
**büyük gir, normal gir, küçük gir ya da geç.**

Backend yok. Her şey doğrudan tarayıcıdan, herkese açık API'lerden çekiliyor.

## 12 soru

| # | Soru | Kaynak | Otomatik mi? |
|---|------|--------|--------------|
| 1 | Likidite havuzu 30 bin doların üstünde mi? | DexScreener | ✅ |
| 2 | Likidite kilitli ya da yakılmış mı? | GoPlus / RugCheck | ✅ |
| 3 | Mint yetkisi kapalı mı? | GoPlus / RugCheck | ✅ |
| 4 | Freeze yetkisi kapalı mı? | GoPlus / RugCheck | ✅ |
| 5 | İlk 10 cüzdan arzın %20'sinden azını mı tutuyor? | GoPlus holder listesi | ✅ |
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
