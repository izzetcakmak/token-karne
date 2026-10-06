# Token Karnesi — Proje Notları

## Deploy Edilmiş Contract'lar

### TokenKarnesi
- **Ağ:** Arc Testnet
- **Adres:** `0x65ab5145236b7a34377ae700d4de8b2aac6d2bdd`
- **Explorer:** https://explorer.testnet.arc.io/address/0x65ab5145236b7a34377ae700d4de8b2aac6d2bdd
- **Deploy Tarihi:** 2026-09-19
- **USDC (Arc Testnet):** `0x3600000000000000000000000000000000000000`
- **Fee:** 100000 (0.10 USDC, 6 decimals)
- **Owner:** Platform deployer cüzdanı (`0x5B12Ce46C7194aD57d143bC22847224047b1Ef42`)

## Önemli Notlar

- Owner fonksiyonları (`withdraw`, `setFee`) platform cüzdanı tarafından çağrılabilir.
- Kendi cüzdanınla owner olmak için `transferOwnership` çağırman gerekir.
- Testnet USDC almak için Arc Studio sidebar'ındaki "Get test USDC" butonunu kullan.
