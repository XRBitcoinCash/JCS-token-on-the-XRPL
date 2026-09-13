# JCS homepage renewal — 3.0.0

The homepage now starts with JCS, Scripture and fellowship, with independent practical-help organizations near the bottom. The empty third-party persecution dashboard, synthetic market wave, wallet-health scanner, quick-buy card and static mission blocks were removed from this page. The private journal remains browser-local.

The homepage entry navigation uses three full-width lanes: Worship, Fellowship and Stewardship. Each title and description occupies its own text group; the lane grid overrides the older shared button flex styles. Titles never use forced word breaks. Background changes respect a 60-second interval and reduced-motion preferences. Worship playback is explicit, and separately paused channels stay paused.

The comparison chart records actual observations during the current visit. It compares percentage changes in JCS/USD, XRP/USD and Bitcoin/USD from a common starting observation. JCS comes from validated native AMM reserves; external USD references identify CoinGecko or the Coinbase fallback. Provider changes restart the comparison, stale values do not add false observations, and gaps remain visible. It is not a historical or candlestick feed.

The exchange adds existing-pool two-asset AMM deposits, proportional LP redemption and a bounded wallet NFT gallery. Native pool positions stay on the XRP Ledger and can be managed with the same wallet. Every action requires fresh balances, reserve/fee checks, an explicit review and individual Xaman signature. Exact reviewed inputs are preserved; final success requires a matching validated transaction with tesSUCCESS. No wallet transaction was submitted during development.

These native proportional AMM modes do not offer minimum output fields. The UI discloses this, rejects a material change before requesting a signature, and sets a short ledger expiry. Changes after signing remain possible. The NFT gallery now provides an optional receipt workflow on this homepage; the separate prayer/testimony page remains independent.

The Watch section leads to the full JESUS film on the official Jesus Film Project site. BibleProject is an attributed, official teaching companion. The Passion of the Christ is only an external provider viewing option, and the 1903 silent film is a secondary heritage player. Read offers canonical World English Bible passages, clearly identified editions and links to Christian classics. Listen keeps independent music and Scripture controls; Reflect connects a reading prompt to the private journal without overwriting a note.

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

Verification of the earlier liquidity release on September 13, 2026 confirmed that its public homepage and published assets matched the source at that time. A desktop browser loaded real validated ledger and JCS/XRP pool data, collected multiple chart observations at the minute interval, and opened the liquidity tab. That release still used the trailer, which this media repair removes. The chart observation text uses the theme foreground color, and its interactive controls are no longer nested in an image role.

The automated checks simulate ledger and wallet results; they do not establish live transaction execution. A physical phone and actual Xaman signing remain unverified. No wallet transaction was submitted.

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

## Optional transaction receipt NFTs

`jcs:validated-transaction` exposes receipt actions after a successful validated trade or liquidity transaction. Source references are saved by the existing local receipt system. Before minting, the source transaction is read again from the ledger and checked against the connected wallet and the exact configured JCS/XRP pair. A limit-order receipt documents the transaction and its requested limits; it does not assert that the order filled.

Visitors can review and download the full `jcs-validated-receipt-nft-v1` JSON before making a separate mint request. The immutable NFT URI is a compact `data:application/json` document identifying the schema, network and source transaction, encoded as hex within the 256-byte XRPL limit. The full JSON is preserved in the mint's signed `application/json` memo, with the normal Xaman verification memos. The code checks the complete memo budget. This design does not depend on temporary object URLs, an unconfigured metadata host, or a new Render service. General-purpose NFT wallets may show the compact reference rather than rendering the full receipt; the full record is available in the mint transaction's memos and the downloaded JSON.

Receipt minting uses no delegated issuer, royalty or transferable flag. This is a personal record, not a spiritual reward, investment guarantee or claim on liquidity. XRPL permits transfers involving an NFT's issuer even when the general transferable flag is disabled; these self-issued receipts are therefore not described as permanently non-transferable. Masking the wallet address only shortens the downloaded/public receipt field. Transaction references and signing accounts remain public on XRPL.

My NFTs reads `account_nfts` at a validated ledger and presents the ID, issuer, taxon and safe decoded URI. A sell offer requires current ownership, an explicit XRP price review and another Xaman signature. Creating a sell offer does not itself transfer ownership. No accept-offer or automated marketplace purchase is introduced in this release.

Desktop requests use the shared QR dialog; phones use a user-clicked Open in Xaman link. Mint success is displayed only after matching the validated `NFTokenMint` result. Rejected and unconfirmed requests are distinct states.

### Media and NFT sources

- [Jesus Film Project sharing FAQ](https://www.jesusfilm.org/about/faq/)
- [Official full JESUS film](https://www.jesusfilm.org/watch/jesus.html)
- [BibleProject terms](https://bibleproject.com/terms/)
- [World English Bible public-domain notice](https://ebible.org/engwebp/copyright.htm)
- [The Imitation of Christ](https://www.gutenberg.org/ebooks/1653)
- [The Pilgrim's Progress](https://www.ccel.org/ccel/bunyan/pilgrim.html)
- [XRPL NFTokenMint fields, URI limit, memos and flag exceptions](https://xrpl.org/docs/references/protocol/transactions/types/nftokenmint)
- [XRPL NFTokenCreateOffer](https://xrpl.org/docs/references/protocol/transactions/types/nftokencreateoffer)
- [XRPL account_nfts](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_nfts)

### Responsive verification

`tests/responsive-preview.html` is a noindex development harness. It embeds the real same-origin homepage and checks title line rectangles and card bounds at 320, 375, 768 and 1280 pixels. It can also show Watch, Read, Listen and Stewardship at those viewport widths. It contains no fake wallet or transaction and requires no connection to Xaman.

The complete `npm test` run for this repair passed all nine suites, including 23 NFT workflow cases, 35 NFT bridge/signing cases and the new homepage/media checks. The bridge suite includes the real homepage NFT UI through simulated Xaman signing to an APIv2 validated ledger result. Node syntax checks, duplicate IDs, local anchors, local assets and diff whitespace also passed. Localhost preview was blocked by the cloud browser; the responsive harness supports checking the deployed page. These automated wallet checks used fixtures, not real signatures or funds.
