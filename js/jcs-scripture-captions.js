/* Local timed captions. Read-only with respect to narration, timeline and wallets. */
(() => {
  'use strict';
  const audio = document.getElementById('jcs-watchers-audio');
  const viewport = document.getElementById('jcs-map-viewport');
  if (!audio || !viewport || document.getElementById('jcs-scripture-captions')) return;
  const dataURL = new URL('../data/captions/enoch-en.json?v=20261008a', document.currentScript.src);
  const key = 'jcs.scripture-captions.v1';
  let enabled = true, size = 24, face = 'gothic';
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (typeof saved?.enabled === 'boolean') enabled = saved.enabled;
    if ([20,24,28].includes(saved?.size)) size = saved.size;
    if (['gothic','serif'].includes(saved?.face)) face = saved.face;
  } catch {}

  const panel = document.createElement('section');
  panel.id = 'jcs-scripture-captions';
  panel.setAttribute('aria-labelledby', 'jcs-caption-title');
  panel.innerHTML = '<div class="jcs-caption-bar"><h2 id="jcs-caption-title"><span aria-hidden="true">✠</span> Words of the Reading</h2><div class="jcs-caption-options"><button id="jcs-caption-toggle" type="button" aria-controls="jcs-caption-body"></button><label for="jcs-caption-size">Size</label><select id="jcs-caption-size"><option value="20">Small</option><option value="24">Medium</option><option value="28">Large</option></select><label for="jcs-caption-face">Style</label><select id="jcs-caption-face"><option value="gothic">Gothic</option><option value="serif">Clear serif</option></select></div></div><div id="jcs-caption-body"><p id="jcs-caption-cue" aria-label="English subtitles" aria-live="off"></p><div class="jcs-caption-footer"><span id="jcs-caption-status" role="status"></span><button id="jcs-caption-retry" type="button" hidden>Retry subtitles</button></div></div>';
  viewport.after(panel);
  const $ = id => document.getElementById(id);
  const toggle = $('jcs-caption-toggle'), body = $('jcs-caption-body'), cue = $('jcs-caption-cue'), status = $('jcs-caption-status'), retry = $('jcs-caption-retry');
  let tracks = null, pending = null, failed = false;

  function text(element, value) { if (element.textContent !== value) element.textContent = value; }
  function findCue(cues, time) {
    let low = 0, high = cues.length - 1, index = -1;
    while (low <= high) { const mid = (low + high) >> 1; if (cues[mid][0] <= time) { index = mid; low = mid + 1; } else high = mid - 1; }
    return index >= 0 && time < cues[index][1] ? cues[index] : null;
  }
  function validateTrack(track) {
    if (!track || typeof track.file !== 'string' || !/^[a-zA-Z0-9_.-]+\.mp3$/.test(track.file) || typeof track.title !== 'string' || !Number.isFinite(track.duration) || track.duration <= 0 || !Array.isArray(track.cues) || !track.cues.length || track.cues.length > 3000) throw new Error('Invalid caption track');
    let end = 0;
    for (const row of track.cues) {
      if (!Array.isArray(row) || row.length !== 3 || !Number.isFinite(row[0]) || !Number.isFinite(row[1]) || row[0] < end || row[1] <= row[0] || row[1] > track.duration + .5 || typeof row[2] !== 'string' || row[2].length > 300) throw new Error('Invalid caption cue');
      end = row[1];
    }
    return track;
  }
  function currentTrack() {
    if (!tracks) return null;
    let file = '';
    try { file = new URL(audio.src || audio.currentSrc, document.baseURI).pathname.split('/').pop(); } catch {}
    return tracks.find(track => track.file === file) || null;
  }
  function render() {
    if (!enabled) return;
    if (!tracks) { text(cue, failed ? 'Subtitles could not be loaded.' : 'Preparing the reading…'); text(status, failed ? 'The audio controls remain available.' : 'English subtitles'); retry.hidden = !failed; return; }
    retry.hidden = true;
    const track = currentTrack();
    if (!track || Number.isFinite(audio.duration) && Math.abs(audio.duration - track.duration) > 2) { text(cue, 'Subtitles are unavailable for this recording.'); text(status, ''); return; }
    if (audio.error) { text(cue, 'Resume the reading to continue subtitles.'); text(status, track.title); return; }
    const time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const active = findCue(track.cues, time);
    text(cue, audio.ended ? 'Reading complete.' : active ? active[2] : time < track.cues[0][0] ? 'The words will appear as the reading begins.' : '');
    text(status, track.title + (audio.ended ? ' · Complete' : audio.paused && time > 0 ? ' · Paused' : ''));
  }
  function load() {
    if (tracks || pending) return;
    failed = false; render();
    pending = fetch(dataURL, {credentials:'omit', cache:'force-cache'})
      .then(response => { if (!response.ok) throw new Error('Caption request failed'); return response.json(); })
      .then(data => { if (data.schema !== 'jcs-scripture-captions-v1' || !Array.isArray(data.tracks) || data.tracks.length > 32) throw new Error('Invalid caption collection'); tracks = data.tracks.map(validateTrack); })
      .catch(() => { failed = true; })
      .finally(() => { pending = null; render(); });
  }
  function settings() {
    body.hidden = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? 'Turn subtitles off' : 'Turn subtitles on');
    text(toggle, enabled ? 'CC on' : 'CC off');
    $('jcs-caption-size').value = String(size); $('jcs-caption-face').value = face;
    panel.style.setProperty('--jcs-caption-size', size + 'px'); panel.dataset.face = face;
    if (enabled) { load(); render(); }
    document.dispatchEvent(new Event('jcs:caption-layout'));
  }
  function save() { try { localStorage.setItem(key, JSON.stringify({enabled,size,face})); } catch {} }
  toggle.addEventListener('click', () => { enabled = !enabled; settings(); save(); });
  $('jcs-caption-size').addEventListener('change', event => { const next = Number(event.target.value); if ([20,24,28].includes(next)) { size = next; settings(); save(); } });
  $('jcs-caption-face').addEventListener('change', event => { if (['gothic','serif'].includes(event.target.value)) { face = event.target.value; settings(); save(); } });
  retry.addEventListener('click', load);
  for (const event of ['timeupdate','seeking','seeked','loadedmetadata','loadeddata','play','pause','ended','error','emptied']) audio.addEventListener(event, render);
  audio.addEventListener('loadstart', () => { text(cue, 'Preparing the reading…'); render(); });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => document.dispatchEvent(new Event('jcs:caption-layout'))).observe(panel);
  settings();
})();
