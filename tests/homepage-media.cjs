const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/jcs-renewal.css'), 'utf8');
const dom = new JSDOM(html, { url: 'https://jesuschristsavestoken.com/', runScripts: 'outside-only', pretendToBeVisual: true });
const w = dom.window, doc = w.document;
const intervalCallbacks = [];
const plays = [], pauses = [];
let now = 0;
w.Date.now = () => now;
w.setInterval = (fn, ms) => { intervalCallbacks.push({ fn, ms }); return intervalCallbacks.length; };
w.clearInterval = () => {};
w.setTimeout = () => 1;
w.clearTimeout = () => {};
w.HTMLMediaElement.prototype.play = function () { plays.push(this.id); return Promise.resolve(); };
w.HTMLMediaElement.prototype.pause = function () { pauses.push(this.id); };
w.HTMLMediaElement.prototype.load = function () {};
w.HTMLElement.prototype.scrollIntoView = () => {};
const style = doc.createElement('style');
style.textContent = css;
doc.head.appendChild(style);
const load = name => w.eval(fs.readFileSync(path.join(root, 'js', name), 'utf8'));
const get = id => doc.getElementById(id);

(async () => {
  const lanes = [...doc.querySelectorAll('.sanctuary-path-grid > a.sanctuary-path')];
  assert.deepEqual(lanes.map(lane => lane.querySelector('.path-copy > h3').textContent), ['Worship', 'Fellowship', 'Stewardship']);
  for (const lane of lanes) {
    const title = lane.querySelector('h3');
    assert.equal(lane.children.length, 2, 'Icon and grouped copy are the only competing layout items');
    assert.equal(title.querySelectorAll('br, wbr').length, 0, 'No forced title fragments');
    assert.equal(w.getComputedStyle(lane).display, 'grid', 'Scoped lane grid overrides global button layout');
    const titleStyle = w.getComputedStyle(title);
    assert.equal(titleStyle.whiteSpace, 'nowrap');
    assert.equal(titleStyle.wordBreak, 'normal');
    assert.equal(titleStyle.overflowWrap, 'normal');
    assert.equal(titleStyle.writingMode, 'horizontal-tb');
    assert.ok(doc.querySelector(lane.getAttribute('href')), 'Each lane reaches a real destination');
  }
  // jsdom cannot measure rendered glyphs. These are CSS policy checks at the
  // requested widths; the real-browser responsive harness measures overflow.
  const gridSelector = '#main-content .sanctuary-path-grid';
  const rules = [...style.sheet.cssRules];
  function responsiveRules(width, list = rules) {
    return list.flatMap(rule => {
      if (rule.selectorText || !rule.cssRules) return [rule];
      const min = /min-width:\s*(\d+)px/.exec(rule.conditionText || '');
      const max = /max-width:\s*(\d+)px/.exec(rule.conditionText || '');
      return (!min || width >= +min[1]) && (!max || width <= +max[1]) ? responsiveRules(width, [...rule.cssRules]) : [];
    });
  }
  for (const width of [320, 375, 768, 1280]) {
    const applicable = responsiveRules(width).filter(rule => rule.selectorText === gridSelector);
    assert.ok(applicable.length);
    assert.equal(applicable.at(-1).style.getPropertyValue('grid-template-columns'), 'minmax(0,1fr)', `One lane per row at ${width}px`);
    assert.equal(applicable.at(-1).style.getPropertyPriority('grid-template-columns'), 'important');
  }

  assert.equal(get('jesusFilmWatch').href, 'https://www.jesusfilm.org/watch/jesus.html');
  assert.match(get('jesusFilmWatch').textContent, /full film/);
  assert.equal(get('jesusFilmWatch').target, '_blank', 'Provider viewing is explicit');
  assert.equal(doc.querySelectorAll('#sacred-film iframe').length, 0, 'No unverified or trailer iframe');
  assert.equal(get('modernPassionPlayer'), null);
  assert.equal(get('filmPlayBoth'), null, 'No fake simultaneous full-film promise');
  assert.ok(get('passionVideo').closest('#heritageFilm'), '1903 film is an optional heritage disclosure');
  assert.ok(doc.querySelector('.watch-companions a[href="https://bibleproject.com/explore/"]'));
  assert.ok(doc.querySelector('.resource-credit a[href="https://bibleproject.com/"]'), 'BibleProject attribution');
  assert.ok(doc.querySelector('.passion-viewing-option a[href^="https://tv.apple.com/"]'));
  for (const target of ['watch', 'scripture', 'audio', 'reflect']) assert.ok(doc.querySelector(`.worship-wayfinding a[href="#${target}"]`));
  assert.ok(doc.querySelector('.reading-library a[href="https://www.gutenberg.org/ebooks/1653"]'));
  assert.ok(doc.querySelector('.reading-library a[href="https://www.ccel.org/ccel/bunyan/pilgrim.html"]'));

  load('jcs-worship.js');
  load('jcs-film.js');
  load('jcs-fellowship.js');
  assert.deepEqual(plays, [], 'Audio and heritage film never autoplay');
  assert.equal(intervalCallbacks.filter(({ ms }) => ms < 60000).length, 0, 'No frequent reading refresh');
  const first = get('scriptureText').textContent;
  get('scripturePauseToggle').click();
  now = 60000;
  intervalCallbacks.forEach(({ fn }) => fn());
  assert.equal(get('scriptureText').textContent, first, 'Paused Scripture remains readable');
  get('scriptureNextBtn').click();
  assert.notEqual(get('scriptureText').textContent, first, 'Manual next works while paused');
  for (let i = 0; i < 12; i++) {
    get('scriptureNextBtn').click();
    assert.match(get('scriptureSource').textContent, /World English Bible/);
    assert.match(get('jesusWordsSource').textContent, /World English Bible/);
    assert.match(get('scriptureContext').href, /^https:\/\/ebible.org\/engwebp\//);
    assert.match(get('jesusWordsContext').href, /^https:\/\/ebible.org\/engwebp\//);
    assert.doesNotMatch(get('scriptureSource').textContent, /Enoch|Jubilees/);
    assert.ok(get('reflectionPrompt').textContent.length > 30, 'A relevant reflection accompanies reading');
  }
  get('privatePrayerJournal').value = 'An existing private prayer.';
  get('reflectJournalLink').addEventListener('click', event => event.preventDefault());
  get('reflectJournalLink').click();
  assert.equal(get('privatePrayerJournal').value, 'An existing private prayer.', 'Reflect preserves private writing');
  assert.equal(doc.activeElement, get('privatePrayerJournal'));
  get('musicStart').click();
  await Promise.resolve();
  assert.deepEqual(plays, ['musicAudio'], 'Only chosen audio starts');
  assert.match(get('musicAudio').src, /^https:\/\/archive.org\/download\/GregorianChantMass\//);
  get('readingStart').click();
  await Promise.resolve();
  assert.match(get('readingAudio').src, /psalms_01_kjv\.mp3$/);
  assert.match(get('readingNow').textContent, /Psalms 1–11/);
  const pausedBeforeFilm = pauses.length;
  get('passionVideo').dispatchEvent(new w.Event('play'));
  assert.ok(pauses.length >= pausedBeforeFilm + 2, 'Film playback pauses both audio channels');
  get('jesusFilmWatch').addEventListener('click', event => event.preventDefault());
  get('jesusFilmWatch').click();
  assert.match(get('filmStatus').textContent, /selected provider/);
  assert.equal(doc.querySelectorAll('script[src*="youtube"]').length, 0, 'No trailer API request');
  console.log('PASS homepage/media: readable lane structure and CSS at 320/375/768/1280; official full-film links; canonical rotation; private reflection; explicit audio and heritage controls. Rendered layout is checked separately in the browser.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => dom.window.close());
