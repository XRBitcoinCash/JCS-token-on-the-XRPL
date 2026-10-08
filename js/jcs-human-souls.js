/* Population context and Catholic sacred artwork are separate from prayer NFT data.
   There are no measured births, deaths, migration routes or judgments of people here. */
(() => {
  'use strict';
  if (window.JCSHumanSouls) return;
  const sourceScript = document.currentScript;
  const base = new URL('../', sourceScript?.src || location.href);
  const DATA_URL = new URL('data/population-history.json?v=20261008a', base).href;
  const SOURCE = 'https://ourworldindata.org/grapher/population-regions-with-projections';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const fmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 });
  const preferenceKey = 'jcs.human-souls.v1';
  const preferences = { population: true, journeys: true, labels: true };
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey) || 'null');
    for (const key of Object.keys(preferences)) if (typeof saved?.[key] === 'boolean') preferences[key] = saved[key];
  } catch (_) { /* The controls still work with storage disabled. */ }
  let data = null, loadState = 'loading', status = null, countList = null, retry = null;
  let pending = null, lastStatus = '', lastYear = null, revision = 0;
  const images = {};
  const api = { draw, get revision() { return revision; } };
  window.JCSHumanSouls = api;
  function invalidate() {
    revision += 1;
    document.dispatchEvent(new Event('jcs:souls-change'));
  }
  for (const name of ['heaven', 'hell', 'purgatory']) {
    const img = new Image();
    img.onload = invalidate;
    img.onerror = invalidate;
    img.src = new URL(`assets/sacred/${name}.svg?v=20261008a`, base).href;
    images[name] = img;
  }
  function validDataset(value) {
    if (value?.schema !== 'jcs-population-context-v1' || !Array.isArray(value.years) || value.years.length < 2 || value.years.length > 3000) return false;
    if (value.years[0] > 1 || value.years.at(-1) < 2026 || !value.years.every((y, i, a) => Number.isFinite(y) && (!i || y > a[i - 1]))) return false;
    const validValues = a => Array.isArray(a) && a.length === value.years.length && a.every(n => Number.isFinite(n) && n >= 0 && n < 2e10);
    const ids = ['africa', 'asia', 'europe', 'north-america', 'south-america', 'oceania'];
    return validValues(value.worldPopulation) && Array.isArray(value.regions) && value.regions.length === 6
      && ids.every(id => value.regions.filter(r => r.id === id).length === 1)
      && value.regions.every(r => typeof r.label === 'string' && r.label.length < 40 && validValues(r.population)
        && Array.isArray(r.illustrativeLatLon) && r.illustrativeLatLon.length === 2
        && r.illustrativeLatLon.every(Number.isFinite) && Math.abs(r.illustrativeLatLon[0]) <= 90 && Math.abs(r.illustrativeLatLon[1]) <= 180);
  }
  function load() {
    if (pending || data) return pending;
    loadState = 'loading';
    updateStatus(lastYear ?? 1);
    pending = fetch(DATA_URL, { credentials: 'omit', cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error('Population data unavailable'); return r.json(); })
      .then(value => { if (!validDataset(value)) throw new Error('Population data invalid'); data = value; loadState = 'ready'; })
      .catch(() => { loadState = 'unavailable'; })
      .finally(() => { pending = null; lastStatus = ''; updateStatus(lastYear ?? 1); invalidate(); });
    return pending;
  }
  function bracket(year) {
    const years = data.years;
    let lo = 0, hi = years.length - 1;
    while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (years[mid] <= year) lo = mid; else hi = mid; }
    return { lo, hi, t: clamp((year - years[lo]) / (years[hi] - years[lo]), 0, 1) };
  }
  function population(values, b) { return mix(values[b.lo], values[b.hi], b.t); }
  function updateStatus(rawYear) {
    const year = clamp(Math.floor(rawYear), 1, 2026);
    lastYear = rawYear;
    if (!status) return;
    const key = [year, rawYear < 1, loadState, preferences.population, preferences.journeys].join('|');
    if (key === lastStatus) return;
    lastStatus = key;
    if (retry) retry.hidden = loadState !== 'unavailable';
    if (!data) {
      status.textContent = loadState === 'unavailable' ? 'Population estimates unavailable. Sacred artwork remains symbolic.' : 'Loading population estimates…';
      if (countList) countList.replaceChildren();
      return;
    }
    const b = bracket(year), kind = year >= 2024 ? 'UN medium projection' : 'population estimate';
    status.textContent = `AD ${year.toLocaleString('en')} · ${fmt.format(population(data.worldPopulation, b))} people · ${kind}${rawYear < 1 ? ' (AD 1 context held before year 1)' : ''}${preferences.population ? '' : ' · clusters hidden'}`;
    if (countList) {
      const fragment = document.createDocumentFragment();
      for (const r of data.regions) {
        const row = document.createElement('span');
        row.textContent = `${r.label}: ${fmt.format(population(r.population, b))}`;
        fragment.append(row);
      }
      countList.replaceChildren(fragment);
    }
  }
  function setup() {
    const host = document.getElementById('jcs-map-focus-options');
    if (!host || document.getElementById('jcs-souls-controls')) return;
    const menu = document.createElement('details');
    menu.id = 'jcs-souls-controls';
    menu.className = 'jcs-focus-disclosure jcs-souls-controls';
    const summary = document.createElement('summary'); summary.textContent = 'Souls & sacred symbols';
    const body = document.createElement('div'); body.className = 'jcs-souls-options';
    const controls = document.createElement('div'); controls.className = 'jcs-souls-toggles';
    for (const [key, title] of [['population', 'Population clusters'], ['journeys', 'Symbolic soul journeys'], ['labels', 'Region labels']]) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.checked = preferences[key]; input.id = `jcs-souls-${key}`;
      input.addEventListener('change', () => {
        preferences[key] = input.checked;
        try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); } catch (_) { /* optional */ }
        updateStatus(lastYear ?? 1); invalidate();
      });
      label.append(input, document.createTextNode(title)); controls.append(label);
    }
    status = document.createElement('p'); status.className = 'jcs-souls-population'; status.setAttribute('aria-live', 'off');
    countList = document.createElement('div'); countList.className = 'jcs-souls-counts'; countList.setAttribute('aria-label', 'Population by continent');
    const note = document.createElement('p'); note.className = 'jcs-souls-note';
    note.textContent = 'Blue clusters represent estimated living populations at broad, illustrative land anchors. They are not settlement maps, migration routes or individual souls. Cluster change is net population change—not a count of births or deaths. Ancient years are interpolated; 2024–2026 values are projections.';
    const faith = document.createElement('p'); faith.className = 'jcs-souls-note';
    faith.textContent = 'Human souls: sacred journeys are unquantified devotional symbols. No person, country, victim or historical event is assigned a spiritual fate. Purgatory leads toward Heaven in Catholic teaching. The paths do not measure the proportions saved or condemned.';
    const sources = document.createElement('p'); sources.className = 'jcs-souls-sources';
    for (const [title, url] of [
      ['Population: HYDE / Gapminder / UN, via Our World in Data', SOURCE],
      ['Luke 13:1–5', 'https://bible.usccb.org/bible/luke/13'],
      ['Revelation 21: the holy city', 'https://bible.usccb.org/bible/revelation/21'],
      ['Catechism: Purgatory', 'https://www.vatican.va/content/catechism/en/part_one/section_two/chapter_three/article_12/iii_the_final_purification,_or_purgatory.html'],
      ['Catechism: Hell', 'https://www.vatican.va/content/catechism/en/part_one/section_two/chapter_three/article_12/iv_hell.html']
    ]) {
      const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = title; sources.append(a);
    }
    retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry population data'; retry.hidden = true; retry.addEventListener('click', load);
    body.append(controls, status, countList, note, faith, sources, retry); menu.append(summary, body); host.append(menu);
    updateStatus(lastYear ?? 1);
  }
  function label(ctx, text, x, y, size, color, align = 'center') {
    ctx.font = `600 ${size}px Georgia, serif`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(3,8,17,.95)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(.1, r), 0, TAU); ctx.fill(); }
  function clusters(view, b, motion) {
    const { ctx, radius, project, width, height } = view;
    ctx.save();
    // Clip halos at the visible Earth edge. All anchors rotate with the globe.
    ctx.beginPath(); ctx.arc(view.cx, view.cy, radius, 0, TAU); ctx.clip();
    for (let index = 0; index < data.regions.length; index += 1) {
      const region = data.regions[index], value = population(region.population, b);
      const [lat, lon] = region.illustrativeLatLon, p = project({ lat, lon });
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.z <= .035) continue;
      const visibility = clamp((p.z - .035) / .25, 0, 1);
      // Area follows population stock with an explicit small visibility floor.
      const r = Math.max(2.5, radius * .185 * Math.sqrt(value / 5e9));
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.7);
      g.addColorStop(0, `rgba(135,214,255,${.40 * visibility})`);
      g.addColorStop(.55, `rgba(67,155,233,${.18 * visibility})`); g.addColorStop(1, 'rgba(35,127,228,0)');
      ctx.fillStyle = g; circle(ctx, p.x, p.y, r * 1.7);
      // Six bounded constellations, never a particle per person or a birth tally.
      for (let n = 0; n < 12; n += 1) {
        const angle = n * 2.3999632297 + index * .63;
        const offset = Math.sqrt((n + .5) / 12) * r;
        const alpha = (.42 + .19 * Math.sin(motion * .7 + n * 1.31)) * visibility;
        ctx.fillStyle = `rgba(168,228,255,${alpha})`;
        circle(ctx, p.x + Math.cos(angle) * offset, p.y + Math.sin(angle) * offset * .65, n % 4 ? 1.05 : 1.65);
      }
      if (preferences.labels && width >= 420 && p.z > .35 && p.x > 55 && p.x < width - 55 && p.y + r + 24 < height - 20) {
        label(ctx, region.label, p.x, p.y + r + 13, width < 700 ? 10 : 11, '#bae5ff');
      }
    }
    ctx.restore();
  }
  function artwork(view) {
    const { ctx, width, height } = view;
    const small = width < 520, edge = clamp(Math.min(width * .20, height * .30), small ? 44 : 58, 140);
    const x = edge * .56 + 9, y = edge * .51 + 8;
    const corners = {
      heavenLeft: { x, y, name: 'heaven', label: 'Heaven', subtitle: 'with Christ', color: '#f9e8b5' },
      heavenRight: { x: width - x, y, name: 'heaven', label: 'Heaven', subtitle: 'with Christ', color: '#f9e8b5' },
      hell: { x, y: height - y, name: 'hell', label: 'Hell', subtitle: 'separation', color: '#f0a090' },
      purgatory: { x: width - x, y: height - y, name: 'purgatory', label: 'Purgatory', subtitle: 'purification', color: '#f2ce89' }
    };
    for (const [key, item] of Object.entries(corners)) {
      const img = images[item.name];
      if (img?.complete && img.naturalWidth) {
        const scale = Math.min(edge / img.naturalWidth, edge / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.save(); ctx.globalAlpha = .86; ctx.drawImage(img, item.x - w / 2, item.y - h / 2, w, h); ctx.restore();
      }
      const top = key.startsWith('heaven');
      const labelY = item.y + (top ? edge * .51 + 8 : -edge * .51 - (small ? 8 : 21));
      label(ctx, item.label, item.x, labelY, small ? 11 : 12, item.color);
      if (!small) label(ctx, item.subtitle, item.x, labelY + 13, 9, item.color);
    }
    return corners;
  }
  function curve(ctx, a, b, c, color, t, reduced) {
    ctx.save(); ctx.strokeStyle = color; ctx.globalAlpha = .30; ctx.lineWidth = 1;
    ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
    if (!reduced) {
      const u = 1 - t, x = u * u * a.x + 2 * u * t * b.x + t * t * c.x, y = u * u * a.y + 2 * u * t * b.y + t * t * c.y;
      ctx.globalAlpha = .9; ctx.fillStyle = color; circle(ctx, x, y, 2.4);
    }
    ctx.restore();
  }
  function journeys(view, corners, motion, reduced) {
    const { ctx, cx, cy, radius, width } = view;
    const rim = angle => ({ x: cx + Math.cos(angle) * radius * 1.02, y: cy + Math.sin(angle) * radius * 1.02 });
    // Origins are the unlocated Earth halo, never continent clusters or atrocity markers.
    const paths = [
      [rim(-2.25), { x: 10, y: cy * .48 }, corners.heavenLeft, '#fff0c7'],
      [rim(2.25), { x: 8, y: cy * 1.45 }, corners.hell, '#ed8570'],
      [rim(.85), { x: width - 8, y: cy * 1.45 }, corners.purgatory, '#f1c66e']
    ];
    paths.forEach((path, i) => curve(ctx, ...path, ((motion / 12 + i * .29) % 1 + 1) % 1, reduced));
    // Catholic purification is ordered toward Heaven, not a fourth final destiny.
    curve(ctx, corners.purgatory, { x: width - 8, y: cy }, corners.heavenRight, '#f5db99', ((motion / 16 + .45) % 1 + 1) % 1, reduced);
  }
  function draw(view) {
    if (!view?.ctx || typeof view.project !== 'function' || !Number.isFinite(view.position) || !Number.isFinite(view.radius) || view.radius <= 0) return;
    const { ctx, position, width, height } = view;
    updateStatus(position);
    const year = clamp(position, 1, 2026), reduced = !!view.reduced || view.state?.animationsEnabled === false;
    const motion = reduced ? 0 : position + 4;
    if (data && preferences.population) clusters(view, bracket(year), motion);
    ctx.save();
    if (view.architectureEnabled) {
      const corners = artwork(view);
      if (preferences.journeys) journeys(view, corners, motion, reduced);
    }
    const tiny = width < 520;
    if (preferences.population || (preferences.journeys && view.architectureEnabled)) {
      label(ctx, tiny ? 'Human souls · symbolic' : 'Human souls · population context & sacred symbolism', width / 2, height - (tiny ? 26 : 24), tiny ? 10 : 11, '#c4e5f4');
      label(ctx, tiny ? 'No person’s fate is assigned.' : 'No person, place or event is assigned an afterlife destination.', width / 2, height - 10, tiny ? 9 : 10, '#dfd4bc');
    }
    ctx.restore();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true }); else setup();
  load();
})();
