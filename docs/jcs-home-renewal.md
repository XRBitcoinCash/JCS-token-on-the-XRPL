# JCS homepage renewal — 3.0.0

The homepage now starts with JCS, Scripture and fellowship, with independent practical-help organizations near the bottom. The empty third-party persecution dashboard, synthetic market wave, wallet-health scanner, quick-buy card and static mission blocks were removed from this page. The private journal remains browser-local.

The layout uses responsive columns, touch-sized controls, restrained Christian imagery and a botanical daily-practice illustration. Background and Scripture changes respect a 60-second interval and reduced-motion preferences. Worship playback is explicit, and separately paused channels stay paused.

The comparison chart records actual observations during the current visit. It compares percentage changes in JCS/USD, XRP/USD and Bitcoin/USD from a common starting observation. JCS comes from validated native AMM reserves; external USD references identify CoinGecko or the Coinbase fallback. Provider changes restart the comparison, stale values do not add false observations, and gaps remain visible. It is not a historical or candlestick feed.

The exchange adds existing-pool two-asset AMM deposits, proportional LP redemption and a bounded wallet NFT gallery. Native pool positions stay on the XRP Ledger and can be managed with the same wallet. Every action requires fresh balances, reserve/fee checks, an explicit review and individual Xaman signature. Exact reviewed inputs are preserved; final success requires a matching validated transaction with tesSUCCESS. No wallet transaction was submitted during development.

These native proportional AMM modes do not offer minimum output fields. The UI discloses this, rejects a material change before requesting a signature, and sets a short ledger expiry. Changes after signing remain possible. An NFT gallery link continues to the existing prayer/testimony creation page; that page was not modified.

The modern film is the distributor’s official trailer, not a hosted copy of the copyrighted full film. The silent 1903 companion sits outside the provider player. Licensed full-film viewing is linked separately.

## Verification

Run `npm ci && npm test` with a current supported Node.js runtime. These dependencies are for development checks only; the site still deploys as static files.

- Exact decimal/XRP/LP arithmetic and bounds: 5 passing tests.
- Mocked financial UI flows and failure guards: 13 passing scenarios.
- Core transaction/account/finality verification: 9 passing scenarios.
- Market observation, stale data, fallback and refresh behavior: passing.
- Full-page initialization, initial refresh, subsequent minute update, chart and removals: 14 passing assertions.
- JavaScript syntax, local resources, unique IDs, local anchors and diff whitespace: passing.
- The public CoinGecko reference endpoint returned HTTP 200 with CORS permission during development.

The checks simulate ledger and wallet results; they do not establish live transaction execution. The remote preview browser could not reach the local workspace, so visual rendering on a real phone, actual Xaman signing and provider video playback remain release checks. No successful visual/browser QA is claimed.

## Primary references

- [XRPL AMMDeposit](https://xrpl.org/docs/references/protocol/transactions/types/ammdeposit)
- [XRPL AMMWithdraw](https://xrpl.org/docs/references/protocol/transactions/types/ammwithdraw)
- [XRPL currency formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [CoinGecko simple prices](https://docs.coingecko.com/reference/simple-price)
- [Coinbase public spot prices](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices)
- [Official distributor Passion trailer](https://www.youtube.com/watch?v=itiY6yl8mS4)
- [Official film information](https://www.20thcenturystudios.com/movies/the-passion-of-the-christ)
- [YouTube player API](https://developers.google.com/youtube/iframe_api_reference)
