# 📋 Token Karnesi

**[tokenkarnesi.xyz](https://tokenkarnesi.xyz)**

A 12-question scorecard for memecoins. Paste a contract address, get one screen with a
plain verdict: **size up, size normal, size small, or skip.**

No backend. Everything is fetched straight from the browser against public APIs.

## The 12 questions

| # | Question | Source | Automated? |
|---|----------|--------|-----------|
| 1 | Is the liquidity pool above $30k? | DexScreener | ✅ |
| 2 | Is liquidity locked or burned? | GoPlus / RugCheck | ✅ |
| 3 | Is mint authority revoked? | GoPlus / RugCheck | ✅ |
| 4 | Is freeze authority revoked? | GoPlus / RugCheck | ✅ |
| 5 | Do the top 10 wallets hold less than 20%? | GoPlus holders | ✅ |
| 6 | Are the wallets unlinked, distribution clean? | RugCheck insider graph + heuristic | ⚠️ estimate |
| 7 | Has the dev never rugged before? | RugCheck creatorTokens / GoPlus | ✅ Solana: past tokens + their mcap |
| 8 | Is the social account older than a week? | fxtwitter (public) | ✅ real join date |
| 9 | Are the followers real? | fxtwitter + heuristic | ⚠️ estimate |
| 10 | Did holders grow in the last 24h? | GoPlus + local snapshot | ⚠️ proxy, real on re-check |
| 11 | Is 24h volume ≥ half of liquidity? | DexScreener | ✅ |
| 12 | Can you tell the story in one sentence? | you | 👤 yours |

Only question 12 is left to you by design. Every answer can be flipped by hand — the score recalculates instantly and your
overrides are remembered per token in `localStorage`.

**Scale:** 11-12 rare (size up) · 9-10 clean (normal) · 7-8 risky (small, watch it) · ≤6 skip.

## What it protects you from

* **Fake liquidity.** A pool paired against a worthless token can show millions in
  "liquidity". Only pools quoted in a recognised asset (SOL, ETH, USDC, …) are counted;
  the rest are excluded and flagged. Price and market cap are read from the highest
  *volume* pool, not the highest *liquidity* one.
* **Quote-side pairs.** Only pools where the token is the base asset are used, so the
  market cap never belongs to the other side of the pair.
* **LP/burn addresses in the top-10.** Pool vaults, burn addresses, locked positions and
  known AMM authorities are stripped before the concentration is calculated.

## Data sources

* [DexScreener](https://docs.dexscreener.com/api/reference) — pools, liquidity, volume, socials
* [GoPlus Security](https://docs.gopluslabs.io/) — EVM + Solana token security, holders, LP
* [RugCheck](https://api.rugcheck.xyz/swagger/index.html) — Solana risks, LP lock, insider graph, the dev's previous tokens
* [fxtwitter](https://github.com/FixTweet/FxTwitter) — public X profile data: join date, followers, following, tweets
* Bubblemaps / GMGN / TweetScout — deep links to double-check by eye

## Run it

```bash
npx -y http-server . -p 4933 -c-1
```

Static files only — deploy on Vercel, GitHub Pages, Walrus Sites, anywhere.

`?ca=<address>&chain=<chain>` runs a scan straight from the URL, which is what the
share links use.

## Not financial advice

The score is a checklist, not a guarantee. APIs can be wrong, stale or incomplete.
Do your own research.

Built by [izzetc](https://www.izzetc.com) · [@izzetcakmak35](https://x.com/izzetcakmak35)
