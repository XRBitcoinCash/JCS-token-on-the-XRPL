<p align="center">
  <img src="./jcs-logo.png" width="160" alt="Jesus Christ Saves Token emblem">
</p>

<h1 align="center">Jesus Christ Saves Token (JCS)</h1>

<p align="center">
  <strong>A Christ-centered, non-custodial XRP Ledger application and the foundation for a privacy-conscious prayer, testimony, Scripture, and service network.</strong>
</p>

<p align="center">
  <a href="https://jesuschristsavestoken.com/">Official Website</a>
  ·
  <a href="https://jesuschristsavestoken.com/about-jcs.html">Vision &amp; Core Values</a>
  ·
  <a href="https://jesuschristsavestoken.com/verify.html">Sign the Ledger</a>
  ·
  <a href="https://jesuschristsavestoken.com/prayer.map.html">Prayer &amp; Integrity Map</a>
</p>

> **Mission:** Use transparent technology as a vessel for prayer, testimony, Scripture, service, and Christian community—without placing wallet custody, spiritual worth, or personal dignity under the control of a token balance.
>
> **Project design phrase:** “And the Word became code, and the code dwelt among us.”  
> This is creative project language, not a quotation from Scripture and not a replacement for Scripture, prayer, church, pastoral care, or faith in Jesus Christ.

---

## Project status

JCS has grown beyond its original landing and About pages. This repository now contains a public faith portal, non-custodial Xaman transaction flows, XRPL market and ledger tools, prayer and testimony NFT functions, a prayer-integrity map, Scripture and sacred-media experiences, machine-readable identity files, and dedicated privacy, terms, and security pages.

The current deployment is still primarily a **static, client-side GitHub Pages application**. It is the public foundation for a larger social platform; it is not yet a centralized social network with a server-side account database, private-message service, real-time moderation system, or guaranteed content delivery.

| Project identity | Current value |
|---|---|
| Official name | Jesus Christ Saves Token |
| Symbol | `JCS` |
| Network | XRP Ledger Mainnet |
| Issuer | `rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd` |
| Canonical domain | `jesuschristsavestoken.com` |
| Web DID | `did:web:jesuschristsavestoken.com` |
| Wallet authorization | Xaman |
| Custody model | Non-custodial; users review and authorize in their own wallet |
| Hosting | GitHub Pages with a custom domain |
| Source status | Publicly viewable, proprietary, and not open source |

Always verify the full issuer address. A ticker, image, social post, or similarly named asset is not sufficient token identification.

---

## What JCS is

JCS is a faith-centered XRPL issued token and application ecosystem intended to support:

- Scripture access and reflection
- Prayer requests and prayer commitments
- Testimony and reply records
- Faith-centered digital artifacts and NFTs
- Public-ledger verification
- Transparent, non-custodial wallet interaction
- Community participation and service
- Carefully separated public evidence and private communication
- A future Christian social platform designed around meaning rather than attention extraction

Technology is treated as a tool. The token, ledger, NFT, website, application, and community do not replace Jesus Christ, Scripture, prayer, fellowship, a local church, pastoral care, professional counseling, emergency services, or personal responsibility.

## What JCS is not

JCS is not represented as:

- A stablecoin, bank deposit, legal tender, insured account, or government-backed asset
- Equity, debt, ownership in a church or ministry, or a promise of profit
- A guarantee of price, liquidity, exchange listing, future utility, or continued access
- A substitute for legal, tax, financial, medical, mental-health, cybersecurity, or pastoral advice
- A system in which wealth determines spiritual authority, prayer visibility, doctrine, moderation power, or human worth
- An endorsement, partnership, or product of Ripple, Xaman, XRPL validators, Bithomp, Sologenic, XPMarket, GitHub, or any other independent service

---

## Current application surfaces

| Surface | Purpose | Current role |
|---|---|---|
| [`index.html`](https://jesuschristsavestoken.com/) | Main JCS portal | Xaman-authorized JCS interaction, public XRPL/DEX information, Scripture, sacred audio and video, and liquidity-oriented tools |
| [`about-jcs.html`](https://jesuschristsavestoken.com/about-jcs.html) | Vision and core values | Christ-centered mission, project boundaries, stewardship principles, and long-term direction |
| [`verify.html`](https://jesuschristsavestoken.com/verify.html) | Sign the Ledger | Prayer NFTs, validated testimony and reply records, Amen reactions, and sacred Scripture/music streams |
| [`prayer.map.html`](https://jesuschristsavestoken.com/prayer.map.html) | Prayer and Integrity Map | Frontend-only, read-oriented visualization using public XRPL data through a proxy; no wallet secret is required |
| [`connectwallet.html`](https://jesuschristsavestoken.com/connectwallet.html) | Wallet utility | Earlier standalone Xaman connection surface scheduled for consolidation into the unified application experience |
| [`metrics.html`](https://jesuschristsavestoken.com/metrics.html) | Market-information surface | Earlier standalone metrics page scheduled for methodology, privacy, dependency, and presentation upgrades |
| [`privacy.html`](https://jesuschristsavestoken.com/privacy.html) | Privacy policy | Wallet-address, public-ledger, local-browser, NFT, testimony, and third-party-service disclosures |
| [`terms.html`](https://jesuschristsavestoken.com/terms.html) | Terms of Service | Rules and limitations for the website, Xaman integration, XRPL tools, prayer NFTs, testimony, trading links, and media |
| [`security.html`](https://jesuschristsavestoken.com/security.html) | Security policy | Coordinated vulnerability disclosure and security-contact instructions |
| [`ai.json`](./ai.json) | Machine-readable project manifest | Current AI-discovery record; scheduled for the same top-down modernization as the rest of the repository |

A page being present in the repository does not mean every external endpoint, wallet flow, market route, metadata source, or third-party service is continuously available. Each upgraded page is tested separately before stronger claims are made.

---

## Non-custodial wallet model

The intended wallet pattern is:

1. The site reads public information or prepares a proposed XRPL transaction.
2. The user opens Xaman and reviews the request.
3. Xaman retains control of the wallet secret.
4. The user approves or rejects the transaction.
5. The application checks validated XRPL results when the workflow requires final confirmation.

The project must never request:

- A seed phrase
- Family seed
- Recovery words
- Private key
- Xaman passcode
- Device passcode
- Remote-access credentials

A public XRPL address is not a secret. Transactions, trust lines, balances, offers, AMMs, NFTs, memos, and other ledger records may be publicly observable and may remain available indefinitely.

---

## Sign the Ledger

`verify.html` is the current social and devotional center of the application.

Its present direction combines:

- Numbered JCS prayer NFTs
- Xaman-authorized minting
- On-ledger testimony records
- Replies and Amen reactions
- Public transaction verification
- Scripture and sacred-media streams
- A developing social feed centered on prayer and testimony

An NFT or transaction can prove that a public wallet authorized a ledger event. It does not, by itself, prove the real-world identity of the wallet holder, the truth of a prayer or testimony, legal ownership of underlying content, email delivery, institutional acceptance, or entitlement to a response.

Never place confidential, privileged, medical, financial, identifying, or otherwise sensitive information into public NFT metadata or XRPL memo fields.

---

## Long-term product direction: JCS Fellowship

The long-term goal is a purpose-based Christian social application—not an attention-maximizing copy of conventional social media.

Planned concepts are listed here as product direction, not as claims that they are already deployed.

### Prayer and testimony lifecycle

```text
Prayer requested
→ people commit to pray
→ encouragement and Scripture are shared
→ an update is posted
→ the request remains active, is answered, or is respectfully closed
→ an optional public receipt or testimony record is created
```

Meaningful responses may include:

- I prayed
- Standing with you
- Scripture shared
- Practical help offered
- Prayer answered

### Faith Circles

Small communities may eventually support:

- Family prayer
- Local churches
- Bible study
- Recovery
- Grief
- Veterans
- Marriage and parenting
- Ministry projects
- Private or invitation-only prayer groups

### Prayer Garden

A future symbolic mini-game may turn healthy participation into a visual garden:

- A prayer begins as a seed.
- Returning to pray waters it.
- Encouraging another person creates light.
- A meaningful update produces growth.
- An answered prayer creates a flower or tree.
- Acts of service add paths, lamps, wells, or shelters.

The intended reward is reflection, service, consistency, and fellowship—not gambling, speculation, or pay-to-win advantage.

### Scripture Path

Planned Scripture-centered activities may include:

- Verse-order challenges
- Passage-completion exercises
- Parable matching
- Collaborative reading journeys
- Memory progress
- Reflection prompts
- Circle-based study milestones

### Acts of Mercy

A privacy-conscious community board may eventually help people offer or request practical support while revealing only the minimum information necessary.

### Quiet and Sabbath modes

The platform should help people leave the screen, not trap them inside it. A finite daily experience may present Scripture, a small number of prayer requests, one act of encouragement, and a clear stopping point.

---

## Ethical access principles

Core spiritual and community functions should not require token purchases.

The product direction is governed by these boundaries:

```text
No pay-to-pray
No pay-to-be-heard
No token-weighted theology
No wealth-based spiritual ranking
No paid priority for crisis or pastoral needs
No engagement design built around outrage or compulsive scrolling
```

JCS may later support optional utility for archival receipts, visual customization, creator tools, ledger evidence, or reusable application access. Any gate must be clearly disclosed and must not control access to Scripture, basic prayer participation, safety resources, or human dignity.

---

## Architecture

### Current foundation

- Static HTML, CSS, and JavaScript
- GitHub Pages deployment
- Canonical custom domain
- Xaman for user-controlled wallet authorization
- Public XRP Ledger Mainnet data
- Selected third-party market, media, mapping, and metadata services
- Local browser processing and storage where practical
- No server-side custody of wallet secrets

### Required future social infrastructure

A durable social network will require systems that are not yet supplied by a static site alone:

- Account and session service
- Passkeys, Xaman, and DID-based identity options
- Database-backed profiles and content
- Private-message encryption and recovery
- Real-time feeds and notifications
- Moderation queues, blocking, reporting, and appeals
- Circle membership and permission controls
- Media storage and content-safety controls
- Rate limiting, abuse prevention, and anti-spam systems
- Backups, audit logs, account recovery, and incident response
- Legal, privacy, child-safety, accessibility, and security review

These systems should be introduced as separate, least-privilege services rather than placing secrets or privileged logic into the static GitHub Pages frontend.

---

## Machine-readable identity and discovery

| Resource | Repository file | Public purpose |
|---|---|---|
| Web DID | [`.well-known/did.json`](./.well-known/did.json) | Canonical `did:web` identity for `jesuschristsavestoken.com` |
| Security contact | [`.well-known/security.txt`](./.well-known/security.txt) | Private, responsible vulnerability-reporting instructions |
| XRP Ledger metadata | [`.well-known/xrp-ledger.toml`](./.well-known/xrp-ledger.toml) | JCS issuer, currency, token metadata, project links, and security boundaries |
| AI manifest | [`ai.json`](./ai.json) | Machine-readable project and resource description |
| Crawler policy | [`robots.txt`](./robots.txt) | Standards-based crawler rules |
| URL discovery | [`sitemap.xml`](./sitemap.xml) | Canonical public-page inventory |
| Custom domain | [`CNAME`](./CNAME) | GitHub Pages domain binding |
| Static deployment marker | [`.nojekyll`](./.nojekyll) | Direct GitHub Pages publication without Jekyll processing |

The presence of machine-readable metadata does not constitute third-party verification, certification, endorsement, or a guarantee that every crawler, wallet, explorer, or AI agent will interpret the information identically.

---

## Repository map

```text
.
├── .well-known/
│   ├── did.json
│   ├── security.txt
│   └── xrp-ledger.toml
├── about/
│   └── index.html
├── css/
│   └── style.css
├── index.html
├── about-jcs.html
├── verify.html
├── prayer.map.html
├── connectwallet.html
├── metrics.html
├── privacy.html
├── terms.html
├── security.html
├── ai.json
├── robots.txt
├── sitemap.xml
├── CNAME
├── .nojekyll
├── LICENSE
└── README.md
```

Image and media assets remain in the repository root while the project is being standardized. Asset optimization, shared component extraction, and file consolidation are part of the modernization process.

---

## Development approach

The repository is being modernized one file at a time.

Each controlled step is intended to:

1. Preserve working behavior before changing presentation or architecture.
2. Remove placeholders, malformed URLs, stale claims, and obsolete dependencies.
3. Standardize identity, design, security, privacy, and legal language.
4. Improve mobile containment, accessibility, and plain-language explanations.
5. Separate observed facts from calculated values and unknown information.
6. Test syntax, identifiers, links, responsive behavior, and error paths.
7. Avoid calling a mocked or simulated test “production proven.”
8. Commit one reviewable change before moving to the next file.

Development is human-directed and AI-assisted. AI assistance is not an independent security audit, legal opinion, penetration test, regulator examination, or guarantee that defects do not remain.

---

## Local review

This repository has no required build step for ordinary static inspection.

```bash
git clone https://github.com/XRBitcoinCash/JCS-token-on-the-XRPL.git
cd JCS-token-on-the-XRPL
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

Important limitations:

- Wallet authorization may require an HTTPS origin registered with the Xaman application.
- Some third-party services may block localhost, cross-origin requests, framing, or automated access.
- Never add API secrets, seed phrases, private keys, recovery words, or privileged credentials to repository files.
- Test transaction templates on the intended network and verify validated XRPL results before describing a transaction as final.
- Do not perform invasive security testing against production services without legal authority and written authorization.

---

## Security

Report suspected vulnerabilities privately:

- Security policy: [https://jesuschristsavestoken.com/security.html](https://jesuschristsavestoken.com/security.html)
- RFC 9116 contact: [https://jesuschristsavestoken.com/.well-known/security.txt](https://jesuschristsavestoken.com/.well-known/security.txt)
- Security email: `jesuschristsaves@gmail.com`

Do not include wallet secrets, recovery words, private keys, passcodes, unnecessary personal information, or live exploit payloads in a public GitHub issue.

The project currently offers no paid bug-bounty program.

---

## Legal and privacy boundaries

Before using wallet, NFT, prayer, testimony, market, media, or community functions, review:

- [Privacy Policy](https://jesuschristsavestoken.com/privacy.html)
- [Terms of Service](https://jesuschristsavestoken.com/terms.html)
- [Security Policy](https://jesuschristsavestoken.com/security.html)
- [Repository License](./LICENSE)

Displayed prices, liquidity, balances, market capitalization, supply estimates, transaction previews, metadata, and third-party content may be incomplete, delayed, unavailable, or incorrect. They are informational and are not financial advice.

Public-ledger timestamps, hashes, NFTs, and transaction records can document technical events. They do not automatically prove authorship, identity, truth, legal ownership, regulatory compliance, pastoral authority, or the legal effect of an off-ledger agreement.

---

## License

This repository is **source-visible and proprietary**.

It is not open source, free software, Creative Commons, public domain, or a general noncommercial license. Public access does not grant permission to copy, modify, redistribute, deploy, train AI systems on, create derivative works from, or commercially or institutionally reuse the covered material.

Review the complete [`LICENSE`](./LICENSE), including its narrowly defined Qualified Federal Watchdog Exception, third-party and public-domain exclusions, GitHub platform provision, and statutory-rights savings clause.

---

## Independent services

JCS references or interoperates with independent services and public infrastructure, including the XRP Ledger, Xaman, GitHub Pages, Bithomp, Sologenic, XPMarket, mapping providers, media archives, and public market-data services.

Those references do not imply endorsement, partnership, custody, sponsorship, certification, shared control, or guaranteed availability. Each independent service applies its own terms, privacy practices, eligibility rules, fees, technical limits, and security model.

---

## Official links

- Website: [https://jesuschristsavestoken.com/](https://jesuschristsavestoken.com/)
- Vision: [https://jesuschristsavestoken.com/about-jcs.html](https://jesuschristsavestoken.com/about-jcs.html)
- Sign the Ledger: [https://jesuschristsavestoken.com/verify.html](https://jesuschristsavestoken.com/verify.html)
- Prayer Map: [https://jesuschristsavestoken.com/prayer.map.html](https://jesuschristsavestoken.com/prayer.map.html)
- X: [https://x.com/JesusCS_token](https://x.com/JesusCS_token)
- Issuer on Bithomp: [https://bithomp.com/en/account/JesusChristSaves](https://bithomp.com/en/account/JesusChristSaves)
- JCS on XPMarket: [https://xpmarket.com/token/JCS-rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd](https://xpmarket.com/token/JCS-rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd)
- JCS/XRP on Sologenic: [Open market](https://sologenic.org/trade?market=JCS%2BrPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd%2FXRP)

Always return to the canonical domain and verify the complete issuer before interacting with JCS.

---

## Closing word

> This code is not an idol.  
> It is a vessel.  
> Use it with reverence.  
> Let every feature serve truth, prayer, dignity, stewardship, and the message that **Jesus Christ saves**.
