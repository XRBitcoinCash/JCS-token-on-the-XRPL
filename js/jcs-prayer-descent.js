/* Symbolic prayer NFT lights. Uses only the Prayer Map's public aggregate event. */
(() => {
  'use strict';

  const viewport = document.getElementById('jcs-map-viewport');
  const strip = document.getElementById('jcs-global-strip');
  const toggle = document.getElementById('prayer-toggle');
  const pause = document.getElementById('atlas-pause-motion');
  if (!viewport || !strip || !toggle || !pause) return;

  const layer = document.createElement('div');
  layer.id = 'jcs-prayer-descent';
  layer.className = 'jcs-prayer-descent';
  layer.setAttribute('aria-hidden', 'true');
  layer.hidden = true;
  const badge = document.createElement('span');
  badge.className = 'jcs-prayer-descent-badge';
  layer.append(badge);
  viewport.append(layer);

  const note = document.createElement('p');
  note.id = 'jcs-prayer-descent-note';
  note.setAttribute('role', 'status');
  strip.append(note);

  let count = 0;
  let rendered = -1;
  const maxLights = 24;

  function syncControls() {
    layer.hidden = !toggle.checked || count === 0;
    layer.classList.toggle('is-paused', pause.checked || document.hidden);
  }

  function renderLights(total) {
    const visible = Math.min(total, maxLights);
    if (visible === rendered) return;
    rendered = visible;
    const lights = [];
    for (let i = 0; i < visible; i += 1) {
      const light = document.createElement('span');
      light.className = 'jcs-prayer-light';
      // These are fixed illustration positions, never ledger or signer coordinates.
      const angle = i * 2.3999632297;
      const radius = Math.sqrt((i + 0.5) / Math.max(visible, 1));
      light.style.setProperty('--x', `${(50 + Math.cos(angle) * radius * 29).toFixed(2)}%`);
      light.style.setProperty('--y', `${(53 + Math.sin(angle) * radius * 20).toFixed(2)}%`);
      light.style.setProperty('--orbit-x', (Math.cos(angle) * radius * .74).toFixed(4));
      light.style.setProperty('--orbit-y', (Math.sin(angle) * radius * .70).toFixed(4));
      light.style.setProperty('--delay', `${(-i * 1.91).toFixed(2)}s`);
      lights.push(light);
    }
    layer.replaceChildren(badge, ...lights);
  }

  function onSummary(event) {
    const data = event.detail || {};
    if (!Number.isSafeInteger(data.nfts) || data.nfts < 0 || data.nfts > 10000000) return;
    count = data.nfts;
    renderLights(count);
    layer.dataset.verifiedNfts = String(count);
    badge.textContent = `${count.toLocaleString()} prayer NFT lights · symbolic, no location`;
    const source = data.sourceState === 'ready' ? 'live validated scan'
      : data.embedded ? 'audited snapshot' : 'cached validated aggregate';
    const scale = count > maxLights ? `Up to ${maxLights} lights illustrate the count.` : 'One light per verified prayer NFT.';
    note.textContent = count
      ? `${count.toLocaleString()} verified prayer NFTs (${source}). ${scale} Their looping descent is symbolic, independent of the historical timeline; positions are not prayer or signer locations.`
      : `No verified prayer NFTs in the ${source}. The visual does not infer a location.`;
    syncControls();
  }

  document.addEventListener('jcs:public-map-summary', onSummary);
  toggle.addEventListener('change', syncControls);
  pause.addEventListener('change', syncControls);
  document.addEventListener('visibilitychange', syncControls);
  document.dispatchEvent(new Event('jcs:request-public-map'));
})();
