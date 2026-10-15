# Token Karnesi — AGENTS.md

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| TokenKarnesi | Arc Mainnet | `0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f` | https://explorer.arc.io/address/0x3b6BB772b7Ac34d9f7357d6F66867C2c29f2034f |
| TokenKarnesi | Arc Testnet | `0x1115a8e4b230321dde500cb73762941862e885e4` | https://explorer.testnet.arc.io/address/0x1115a8e4b230321dde500cb73762941862e885e4 |

## Owner
`0xD4F1254C803662c46D9c21f80F4F3c15FF57e2c9`

## Notes
- Arc mainnet chain ID 5042 (`0x13B2`), RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`
- Fee: 0.10 USDC (100_000, 6 decimals) per `submitScore`; kontrat ücreti `transferFrom` ile çeker, önce `approve`
- Ödeme kapıları (`assets/pay.js`, 11 Eki 2026): karne açmak tarama başına 0.10 USDC, tahta 30 dk için 0.10 USDC. İkisi de Arc USDC `transfer(owner, 100000)` — kontrat çağrısı değil, doğrudan owner cüzdanına. Tahta erişimi `localStorage` `tk_board_access` ile tarayıcı bazında; ödeme kaydı `tk_pay_log`
- Karne kapısı analizden SONRA çıkar: token bulunamazsa ödeme istenmez. Bot (`scripts/scan.js`) `analyze()`'i doğrudan çağırır, kapıdan geçmez
- Hüküm kapıları (`verdictFor`, 11 Eki 2026): <24 s → en fazla RİSKLİ·ERKEN; <24 s ve hacim >5× likidite → GEÇ·BOT HACMİ; 24–72 s → en fazla TEMİZ. Puan değişmez, hüküm sınırlanır; gerekçe tahta geçmişi (91 token: <6 s %90 çöküş, >7 gün %6). Tahta `BOARD_MIN_AGE_H=24` altını almaz. 5. soru GoPlus boşsa RugCheck topHolders'a düşer; bilinmeyen soruyu "evet" yapmak uyarı verir. Bu kapıları gevşetme; A1 ve RARINU rug'ı bunların yokluğundan oldu
- "Bu karneyi zincire kaydet" butonu (`assets/onchain.js`) cevapları `submitScore` ile yazar; ücreti ayrı (0.10 USDC, kontrata)
- Kontrat token'ı `address` ile anahtarlar: EVM adresi kendisi, Solana mint'i `sha256("solana:" + mint)`'in ilk 20 baytı
- USDC on Arc: `0x3600000000000000000000000000000000000000`
- withdraw() → owner adresine birikmiş USDC gönderir
- Arc USDC → Solana satın alma akışı (eski `assets/buy.js`) kaldırıldı: Solana'da mint adımı yoktu, alıcı adresi yanlış türetiliyordu. AL butonu dış linke gider, token seçili (11 Eki 2026, `arcOpenBuyModal`/`evmBuyUrl`): Arc → A NEW ONE; Solana → `jup.ag/swap?sell=<SOL mint>&buy=<mint>`; BSC/opBNB/Linea ve likiditesi PancakeSwap'te olanlar → `pancakeswap.finance/swap?chain=<c>&outputCurrency=<ca>`; Ethereum/Base/Arbitrum/Optimism/Polygon/Avalanche vb. → `app.uniswap.org/swap?chain=<c>&inputCurrency=ETH&outputCurrency=<ca>`; desteklenmeyen zincir → DexScreener çift sayfası. Eski `jup.ag/swap/USDC-<mint>` yolu yeni arayüzde çalışmıyor
- **İkili dosyalara (png/jpg/ico/zip) dokunma.** Arc Studio'nun git yazımı `assets/og.png`'yi metin olarak yeniden yazıp bozdu (10 Eki 2026, commit 2dd8089: ilk bayt 0x89 → EF BF BD, X/Telegram önizlemesi resimsiz kaldı; 16 Eki'de 29e4838'deki sağlam sürümle geri alındı). Görsel değişikliği gerekiyorsa kullanıcıya söyle, dosyayı yerelden commit etsin
