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
- "Bu karneyi zincire kaydet" butonu (`assets/onchain.js`) cevapları `submitScore` ile yazar; ücreti ayrı (0.10 USDC, kontrata)
- Kontrat token'ı `address` ile anahtarlar: EVM adresi kendisi, Solana mint'i `sha256("solana:" + mint)`'in ilk 20 baytı
- USDC on Arc: `0x3600000000000000000000000000000000000000`
- withdraw() → owner adresine birikmiş USDC gönderir
- Arc USDC → Solana satın alma akışı (eski `assets/buy.js`) kaldırıldı: Solana'da mint adımı yoktu, alıcı adresi yanlış türetiliyordu. AL butonu dış linke gider.
