# JCS project-link logos — 2026-10-08

The JCS sidebar showed text-only links for XRBitcoinCash, XRBitcoin and Creature NFT. The user requested the existing corresponding logos wherever these projects are linked on the page, consistent with the other ecosystem pages.

`css/jcs-project-logos.css` supplies decorative logos alongside readable project names. It is imported by both shared header stylesheets and loaded directly by `verify.html`, whose header is otherwise inline. This covers the ten public HTML pages with ecosystem links, including the homepage, Prayer Map, Market Monitor, verification, account readiness, about and policy pages. Matching footer and related-resource links also receive logos. The existing JCS site logo remains its identity.

The assets are unmodified copies from GitLab project 75781181, `xrbitcoincash-group/xrbitcoincash-project`, commit `a28ba1406c9f89b5d2d0288aba9cd6f5c099ba69`:

| Project | GitLab source | Local asset | SHA-256 |
| --- | --- | --- | --- |
| XRBitcoinCash | `public/favicon.png` | `assets/projects/xrbc.png` | `078ca86b6d5ddc85adb9bfb7c2ef54ff08ef264a1b4374d7efac94c490f12094` |
| XRBitcoin | `public/ecosystem-xrbitcoin-card.webp` | `assets/projects/xrbitcoin.webp` | `e6b69da10a7608179d3080bbe44684a850e5c610c5b633da442d4d0a5f6d6767` |
| Creature NFT | `public/ecosystem-creature-card.webp` | `assets/projects/creature-nft.webp` | `19324a4db4409baa2631f4624506a3c1b5466ede228aa305e086043d83c5c89d` |

Serving these copies locally avoids a new cross-origin image dependency. Empty CSS-generated content is decorative; the project names continue to supply the accessible link names. Logo dimensions are fixed at 22 pixels and do not shrink in the navigation. Existing link destinations, wallet controls, signing, prayer/media behavior and application JavaScript are unchanged.

Source baseline: GitHub `XRBitcoinCash/JCS-token-on-the-XRPL`, `main`, `357a65e88d6cfb78eb5a6e9f4fa653e6800d4a4a`. This checkpoint is prepared before release; use the associated PR and Pages deployment status to determine publication. Validation is limited to asset identity, CSS imports, coverage of existing project links and unchanged application scripts. No wallet or live transaction test is needed for this presentation change. Stop tool activity when deployment succeeds under the existing protocol.
