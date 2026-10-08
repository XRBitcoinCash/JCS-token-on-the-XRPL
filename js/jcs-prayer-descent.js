/* Verified prayer NFTs remain aggregate evidence, separate from human population. */
(() => {
  'use strict';
  const strip = document.getElementById('jcs-global-strip');
  if (!strip || document.getElementById('jcs-prayer-descent-note')) return;
  const note = document.createElement('p');
  note.id = 'jcs-prayer-descent-note';
  note.setAttribute('role', 'status');
  strip.append(note);
  document.addEventListener('jcs:public-map-summary', event => {
    const data = event.detail || {};
    if (!Number.isSafeInteger(data.nfts) || data.nfts < 0 || data.nfts > 10000000) return;
    const source = data.sourceState === 'ready' ? 'live validated scan'
      : data.embedded ? 'audited snapshot' : 'cached validated aggregate';
    note.textContent = `${data.nfts.toLocaleString()} verified prayer NFTs (${source}). These are ledger records, separate from the blue human-population clusters. No prayer or signer location is inferred.`;
  });
  document.dispatchEvent(new Event('jcs:request-public-map'));
})();
