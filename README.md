# 📋 Token Karnesi

**[tokenkarnesi.xyz](https://tokenkarnesi.xyz)**

A 12-question scorecard for memecoins. Paste a contract address, get one screen with a
plain verdict: **size up, size normal, size small, or skip.**

No backend. Everything is fetched straight from the browser against public APIs.

## The 12 questions

| # | Question | Source | Automated? |
|---|----------|--------|-----------|
| 1 | Is the liquidity pool above $30k? | DexScreener | ✅ |
| 2 | Is liquidity locked or burned? | GoPlus / RugCheck / chain | ✅ on V2 pools; V3/V4 have no LP token, explained |
| 3 | Is mint authority revoked? | GoPlus / RugCheck / bytecode | ✅ |
| 4 | Is freeze authority revoked? | GoPlus / RugCheck / bytecode | ✅ |
| 5 | Do the top 10 wallets hold less than 20%? | GoPlus / Blockscout | ✅ exchange and pool wallets excluded |
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

* **Chains GoPlus does not cover.** The data is read straight from the chain instead:
  `eth_getCode` scans the bytecode for mint/pause/blacklist selectors, `owner()` tells whether
  ownership is renounced, the LP pair's `totalSupply` and `0xdead` balance give the burn ratio,
  and holders come from Blockscout. Robinhood Chain is wired up; adding a network is one row
  in the `ONCHAIN` table.

## The Board (automated scan)

A GitHub Actions job (`scripts/scan.js`) runs every 30 minutes, pulls DexScreener's boosted and
newly profiled tokens and scores them **with the site's own engine**; whatever clears the bar is
written to `data/board.json` and rendered on the home page. No backend: the job commits the file
to the `board` branch and the page reads it from raw.githubusercontent.com, so a scan never
triggers a Vercel deploy (the free plan allows 100 a day and scan commits would eat into it).

The engine has a single source — the same `analyze()` the browser uses is executed under Node,
so a score on the board matches the scorecard you get when you click through.

```bash
BOARD_LIMIT=45 BOARD_MIN=9 node scripts/scan.js   # run it by hand
```

The repo is public, so GitHub Actions minutes are free; change the cadence from the
cron line in `.github/workflows/scan.yml`.

## Verdict gates (age and volume quality)

The 12 questions measure structural safety: can the dev mint, freeze, pull the LP, has the dev
rugged before. They say nothing about how old the token is or whether its volume is real, and
that is exactly where fresh pump.fun launches burn people: LP burned, authorities revoked, 12/12
on paper, then the holders dump. The board's own history (91 tokens, 28 Aug – 10 Oct 2026,
measured 11 Oct) made the pattern plain:

| First seen as | Tokens | Lost 80%+ | Went up |
|---|---|---|---|
| under 6 hours old | 41 | 90% | 2% |
| over 7 days old | 17 | 6% | 41% |
| 24h volume > 5x liquidity | 48 | 85% | 0% |
| 24h volume <= 5x liquidity | 24 | 17% | 42% |
| under 24h **and** volume > 5x | 44 | 91% | 0% |

So the score stays what it is, but the **verdict is capped**:

* **Under 24 hours:** at most RISKY · EARLY ("size small"), whatever the score.
* **Under 24 hours and volume above 5x liquidity:** SKIP · BOT VOLUME. Question 11 still
  counts as "yes", the note says why, and a red flag is raised.
* **24 to 72 hours:** at most CLEAN. No "size up" before the token has lived three days.
* Unknown age: no cap. The reason is printed under the stamp, on the PNG and in the share text.

Two more guards from the same incident: question 5 now falls back to RugCheck's holder list when
GoPlus has none for a brand-new Solana token (pool and burn accounts stripped first), and flipping
a question with no data to "yes" shows a warning, because that is how a 10/12 with two blanks
became a 12/12. The board only lists tokens at least 24 hours old (`BOARD_MIN_AGE_H`).

## Pricing (Arc, USDC)

Two paywalls, both paid in USDC on Arc mainnet to the site owner's wallet with a plain
ERC-20 `transfer` (`assets/pay.js`), no contract call needed:

* **Scorecard: 0.10 USDC per scan.** The analysis runs first; if the token is not found or
  the sources are down nothing is charged. Once the result is ready a payment card appears
  and the scorecard opens after the transaction confirms. Every scan is a separate payment,
  including the examples, the history, board rows and `?ca=` share links.
* **Board: 0.10 USDC for 30 minutes.** The list is locked behind a SHOW button. After payment
  it stays open for 30 minutes in that browser with a countdown, then closes by itself; seeing
  it again is a new payment. The locked state still shows how many tokens are over the bar.
* Recording a scorecard on-chain (`assets/onchain.js`) is a separate 0.10 USDC that goes to
  the `TokenKarnesi` contract.

The site is static, so the gates live in the browser: a technically minded visitor can still
reach the public APIs or the public `board` branch directly. The gates price the product, they
are not a secret.

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
