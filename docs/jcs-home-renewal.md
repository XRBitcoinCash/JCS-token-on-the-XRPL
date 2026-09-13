# JCS homepage renewal — 3.0.0

The homepage now starts with JCS, Scripture and fellowship, with independent practical-help organizations near the bottom. The empty third-party persecution dashboard, synthetic market wave, wallet-health scanner, quick-buy card and static mission blocks were removed from this page. The private journal remains browser-local.

The layout uses responsive columns, touch-sized controls, restrained Christian imagery and a botanical daily-practice illustration. Background and Scripture changes respect a 60-second interval and reduced-motion preferences. Worship playback is explicit, and separately paused channels stay paused.

The comparison chart records actual observations during the current visit. It compares percentage changes in JCS/USD, XRP/USD and Bitcoin/USD from a common starting observation. JCS comes from validated native AMM reserves; external USD references identify CoinGecko or the Coinbase fallback. Provider changes restart the comparison, stale values do not add false observations, and gaps remain visible. It is not a historical or candlestick feed.

The exchange adds existing-pool two-asset AMM deposits, proportional LP redemption and a bounded wallet NFT gallery. Native pool positions stay on the XRP Ledger and can be managed with the same wallet. Every action requires fresh balances, reserve/fee checks, an explicit review and individual Xaman signature. Exact reviewed inputs are preserved; final success requires a matching validated transaction with tesSUCCESS. No wallet transaction was submitted during development.

These native proportional AMM modes do not offer minimum output fields. The UI discloses this, rejects a material change before requesting a signature, and sets a short ledger expiry. Changes after signing remain possible. An NFT gallery link continues to the existing prayer/testimony creation page; that page was not modified.

The modern film is the distributor’s official trailer, not a hosted copy of the copyrighted full film. The silent 1903 companion sits outside the provider player. Licensed full-film viewing is linked separately.

## Verification

Run `npm ci && npm test` with a current supported Node.js runtime. These dependencies are for development checks only; the site still deploys as static files.

- Exact decimal/XRP/LP arithmetic and bounds: 6 passing tests.
- Mocked financial UI flows and failure guards: 18 passing scenarios.
- Core transaction/account/finality verification: 9 passing scenarios.
- Market observation, stale data, fallback and refresh behavior: passing.
- Desktop/mobile signing dialog and payload lifecycle: 8 passing scenarios.
- Full-page initialization, initial refresh, subsequent minute update, chart and removals: 14 passing assertions.
- JavaScript syntax, local resources, unique IDs, local anchors and diff whitespace: passing.
- The public CoinGecko reference endpoint returned HTTP 200 with CORS permission during development.

Release verification on September 13, 2026 confirmed that the public homepage and its published assets matched the merged source. A desktop browser loaded real validated ledger and JCS/XRP pool data, collected multiple chart observations at the minute interval, and opened the liquidity tab. The official trailer player loaded; the silent companion played and the shared pause control stopped it. No application console errors were observed. The chart observation text now uses the theme foreground color, and its interactive controls are no longer nested in an image role.

The automated checks simulate ledger and wallet results; they do not establish live transaction execution. A physical phone, actual Xaman signing and successful modern-trailer playback remain unverified. No wallet transaction was submitted.

## Liquidity and signing repair

The liquidity workspace now provides a pool overview, wallet position, balances, network reserve and fee details, two editable maximum deposit amounts, balance percentages, and an LP/share estimate before review. The existing native two-asset deposit and proportional withdrawal modes are retained. Balance shortcuts account for both assets, reserve requirements, the fee and an extra 1 XRP buffer. Full amounts and ledger identities remain available in the details section.

The signing dialog is a direct child of the page body, outside the exchange tabs. This fixes the defect where selecting Liquidity hid the signing interface inside the Trade tab. Desktop always displays the provider QR, including when a push notification was delivered. Mobile uses a deliberate same-device Open in Xaman link; an optional QR supports a second phone. Hiding and reopening preserves the same pending request. Terminal outcomes remove the old QR and link.

The preferred SDK path creates the request and immediately displays its QR/link before subscribing to status updates. The compatible create-and-subscribe path is retained. Requests use a three-minute provider opening window, while the existing transaction ledger deadline remains unchanged. Return URLs are omitted so wallet handoff does not replace the original page and lose its in-memory review. Actual signatures and funds are never simulated as live results.

Regression coverage includes exact input caps, reserve-limited presets, preservation of reviewed amounts, visible signing from the Liquidity tab, desktop push/no-push, phone handoff, duplicate submissions, hide/reopen, rejection, expiry, missing transaction results and ledger-confirmed completion with a fake wallet. A real wallet signature is still a user-device check.

## Primary references

- [XRPL AMMDeposit](https://xrpl.org/docs/references/protocol/transactions/types/ammdeposit)
- [XRPL AMMWithdraw](https://xrpl.org/docs/references/protocol/transactions/types/ammwithdraw)
- [XRPL currency formats](https://xrpl.org/docs/references/protocol/data-types/currency-formats)
- [CoinGecko simple prices](https://docs.coingecko.com/reference/simple-price)
- [Coinbase public spot prices](https://docs.cdp.coinbase.com/coinbase-app/track-apis/prices)
- [Official distributor Passion trailer](https://www.youtube.com/watch?v=itiY6yl8mS4)
- [Official film information](https://www.20thcenturystudios.com/movies/the-passion-of-the-christ)
- [YouTube player API](https://developers.google.com/youtube/iframe_api_reference)

- [Xaman browser signing flows](https://docs.xaman.dev/js-ts-sdk/examples-user-stories/sign-requests-payloads/browser)
- [Xaman payload creation and provider QR](https://docs.xaman.dev/js-ts-sdk/sdk-syntax/xumm.payload/create)
