(function(){
  'use strict';

  const ROTATION_MS = 60000;
  // Canonical, public-domain World English Bible selections. Full-chapter
  // links retain context; Christian classics are clearly separate in the page.
  const PASSAGES = [
    { group: 'Still waters', ref: 'Psalm 23:2–3a', text: 'He makes me lie down in green pastures. He leads me beside still waters. He restores my soul.', url: 'https://ebible.org/engwebp/PSA023.htm', reflection: 'Where could you make room for rest and kindness today?' },
    { group: 'Trust', ref: 'Proverbs 3:5–6', text: 'Trust in the LORD with all your heart, and don’t lean on your own understanding. In all your ways acknowledge him, and he will make your paths straight.', url: 'https://ebible.org/engwebp/PRO03.htm', reflection: 'What uncertainty could you bring honestly to God in prayer?' },
    { group: 'Kindness and truth', ref: 'Proverbs 3:3', text: 'Don’t let kindness and truth forsake you. Bind them around your neck. Write them on the tablet of your heart.', url: 'https://ebible.org/engwebp/PRO03.htm', reflection: 'What would kindness and truth look like in one conversation today?' },
    { group: 'Care for a neighbor', ref: 'Proverbs 3:27', text: 'Don’t withhold good from those to whom it is due, when it is in the power of your hand to do it.', url: 'https://ebible.org/engwebp/PRO03.htm', reflection: 'Who could receive one practical act of care from you today?' }
  ];
  const JESUS_WORDS = [
    { ref: 'Matthew 11:28', text: 'Come to me, all you who labor and are heavily burdened, and I will give you rest.', url: 'https://ebible.org/engwebp/MAT11.htm' },
    { ref: 'Matthew 5:9', text: 'Blessed are the peacemakers, for they shall be called children of God.', url: 'https://ebible.org/engwebp/MAT05.htm' },
    { ref: 'Matthew 5:7', text: 'Blessed are the merciful, for they shall obtain mercy.', url: 'https://ebible.org/engwebp/MAT05.htm' },
    { ref: 'John 15:12', text: 'This is my commandment, that you love one another, even as I have loved you.', url: 'https://ebible.org/engwebp/JHN15.htm' },
    { ref: 'John 14:27', text: 'Peace I leave with you. My peace I give to you; not as the world gives, I give to you. Don’t let your heart be troubled, neither let it be fearful.', url: 'https://ebible.org/engwebp/JHN14.htm' }
  ];

  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function deterministicIndex(length, offset=0) {
    if (!length) return 0;
    const manualOffset = Number(window.__jcsScriptureOffset || 0);
    return (Math.floor(Date.now() / ROTATION_MS) + offset + manualOffset) % length;
  }

  let lastPassageIndex = -1;
  let lastJesusIndex = -1;

  function renderScriptureStreams(force = false) {
    if (!force && (window.__jcsScripturePaused || document.hidden)) return;
    const passageIndex = deterministicIndex(PASSAGES.length);
    const jesusIndex = deterministicIndex(JESUS_WORDS.length, 7);

    if (passageIndex !== lastPassageIndex) {
      lastPassageIndex = passageIndex;
      const item = PASSAGES[passageIndex];
      if ($('scriptureKicker')) $('scriptureKicker').textContent = item.group + ' · World English Bible';
      if ($('scriptureText')) $('scriptureText').textContent = '“' + item.text + '”';
      if ($('scriptureSource')) $('scriptureSource').textContent = item.ref + ' · World English Bible';
      if ($('scriptureContext')) $('scriptureContext').href = item.url;
      if ($('reflectionPrompt')) $('reflectionPrompt').textContent = item.reflection;
    }

    if (jesusIndex !== lastJesusIndex) {
      lastJesusIndex = jesusIndex;
      const item = JESUS_WORDS[jesusIndex];
      if ($('jesusWords')) $('jesusWords').textContent = '“' + item.text + '”';
      if ($('jesusWordsSource')) $('jesusWordsSource').textContent = item.ref + ' · World English Bible';
      if ($('jesusWordsContext')) $('jesusWordsContext').href = item.url;
    }
  }

  $('reflectJournalLink')?.addEventListener('click', () => {
    // Preserve existing writing and its explicit Save control.
    $('privatePrayerJournal')?.focus({ preventScroll: true });
  });

  window.__jcsRenderScriptureStreams = () => renderScriptureStreams(true);
  renderScriptureStreams(true);
  window.setInterval(() => renderScriptureStreams(false), ROTATION_MS);


  const fallbackMusic = [
    {
      title:'Gregorian Chant Mass · Track 2',
      url:'https://archive.org/download/GregorianChantMass/02Track2_64kb.mp3',
    },
    {
      title:'Gregorian Chant Mass · Track 4',
      url:'https://archive.org/download/GregorianChantMass/04Track4_64kb.mp3',
    },
    {
      title:'Gregorian Chant Mass · Track 5',
      url:'https://archive.org/download/GregorianChantMass/05Track5_64kb.mp3',
    },
    {
      title:'Gregorian Chant Mass · Track 6',
      url:'https://archive.org/download/GregorianChantMass/06Track6_64kb.mp3',
    }
  ];

  const psalmRanges = ['1–11', '12–21', '22–31', '32–37', '38–45', '46–55', '56–66', '67–72', '73–78', '79–88', '89–96', '97–105', '106–115', '116–119', '120–138', '139–150'];
  const fallbackReadings = psalmRanges.map((range, index) => ({
    title: 'Psalms ' + range + ' · KJV · LibriVox',
    url: 'https://archive.org/download/psalms_kjv_1202_librivox/psalms_' + String(index + 1).padStart(2, '0') + '_kjv.mp3'
  }));


  const MEDIA_STORAGE = 'jcs.sacredMedia.v3';
  const channels = Object.fromEntries(['music', 'reading'].map(name => [name, {
    name,
    audio: $(name + 'Audio'),
    start: $(name + 'Start'),
    stop: $(name + 'Stop') || $(name + 'Pause'),
    volume: $(name + 'Volume'),
    now: $(name + 'Now'),
    playlist: name === 'music' ? fallbackMusic : fallbackReadings,
    index: 0,
    wanted: false,
    loading: false,
    timeout: null,
    request: 0
  }]));

  function status(message) {
    if ($('audioStatus')) $('audioStatus').textContent = message;
  }

  function isQuiet() {
    return document.hidden || document.body.classList.contains('quiet-mode');
  }

  function updateControls() {
    const active = Object.values(channels).some(channel => channel.wanted);
    const master = $('audioStartAll');
    if (master) {
      master.textContent = active ? 'Pause worship audio' : 'Play worship audio';
      master.setAttribute('aria-pressed', String(active));
    }
    if ($('audioStopAll')) $('audioStopAll').disabled = !active;
    Object.values(channels).forEach(channel => {
      if (channel.start) {
        channel.start.textContent = channel.loading ? 'Connecting…' : 'Listen';
        channel.start.disabled = channel.wanted;
      }
      if (channel.stop) channel.stop.disabled = !channel.wanted;
    });
  }

  function saveSettings() {
    try {
      localStorage.setItem(MEDIA_STORAGE, JSON.stringify({
        musicVolume: Number(channels.music.volume?.value ?? .35),
        readingVolume: Number(channels.reading.volume?.value ?? .85)
      }));
    } catch {}
  }

  function applyVolume(channel) {
    if (!channel.audio) return;
    const raw = Number(channel.volume?.value ?? (channel.name === 'music' ? .35 : .85));
    channel.audio.volume = clamp(Number.isFinite(raw) ? raw : .5, 0, 1);
    channel.audio.muted = channel.audio.volume === 0;
  }

  function pauseChannel(channel) {
    channel.wanted = false;
    channel.loading = false;
    channel.request += 1;
    window.clearTimeout(channel.timeout);
    channel.timeout = null;
    channel.audio?.pause();
    if (channel.now) {
      channel.now.textContent = channel.audio?.src ? 'Paused · ' + channel.playlist[channel.index].title : 'Ready when you are.';
      channel.now.className = 'now-playing is-muted';
    }
    updateControls();
  }

  function pauseAll(message = 'Audio paused. Choose Listen whenever you are ready.') {
    Object.values(channels).forEach(pauseChannel);
    status(message);
  }

  async function listenChannel(channel) {
    if (!channel.audio || channel.wanted) return;
    if (isQuiet()) {
      status(document.hidden ? 'Return to this page and choose Listen.' : 'Turn off Quiet mode before starting audio.');
      return;
    }
    document.dispatchEvent(new CustomEvent('jcs:pause-media'));
    const audio = channel.audio;
    const request = ++channel.request;
    channel.wanted = true;
    channel.loading = true;
    const track = channel.playlist[channel.index];
    if (audio.dataset.trackUrl !== track.url) {
      audio.src = track.url;
      audio.dataset.trackUrl = track.url;
    } else if (audio.error) audio.load();
    applyVolume(channel);
    updateControls();
    if (channel.now) channel.now.textContent = 'Connecting · ' + track.title;
    channel.timeout = window.setTimeout(() => {
      if (request !== channel.request) return;
      pauseChannel(channel);
      if (channel.now) channel.now.textContent = 'The recording took too long to connect. Tap Listen to retry.';
      status('The audio source is slow to respond. You can retry Listen or use the other channel.');
    }, 15000);
    try {
      // Call play immediately in the button event; no metadata fetch can consume
      // the phone browser's user activation before this audible play request.
      await audio.play();
      if (request !== channel.request) return;
      window.clearTimeout(channel.timeout);
      channel.timeout = null;
      if (!channel.wanted || isQuiet()) {
        pauseChannel(channel);
        return;
      }
      channel.loading = false;
      if (channel.now) {
        channel.now.textContent = track.title;
        channel.now.className = 'now-playing is-live';
      }
      status('Music and Scripture have separate volume controls below.');
      updateControls();
    } catch (error) {
      if (request !== channel.request) return;
      pauseChannel(channel);
      const sourceFailed = error?.name === 'NotSupportedError' || Boolean(audio.error);
      if (channel.now) channel.now.textContent = sourceFailed ? 'This recording is unavailable. Tap Listen to retry.' : 'Playback paused. Tap Listen to start on this device.';
      status(sourceFailed ? 'The recording could not load. You can retry Listen or use the other channel.' : 'Your browser needs a direct tap on Listen to start this channel.');
    }
  }

  function startAll() {
    // Each call reaches play() synchronously, preserving one deliberate gesture
    // for both channels. A rejected channel does not stop the other channel.
    Object.values(channels).forEach(channel => { void listenChannel(channel); });
  }

  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(MEDIA_STORAGE) || '{}') || {}; } catch {}
  Object.values(channels).forEach(channel => {
    if (!channel.audio) return;
    const savedVolume = Number(saved[channel.name + 'Volume'] ?? (channel.name === 'music' ? .35 : .85));
    if (channel.volume) channel.volume.value = String(clamp(Number.isFinite(savedVolume) ? savedVolume : .5, 0, 1));
    channel.audio.autoplay = false;
    channel.audio.preload = 'none';
    // Cross-origin audio playback needs no CORS request; requiring it would
    // unnecessarily reject valid public recordings with no CORS response header.
    channel.audio.removeAttribute('crossorigin');
    channel.audio.pause();
    applyVolume(channel);
    if (channel.now) channel.now.textContent = 'Ready when you are.';
    channel.start?.addEventListener('click', () => { void listenChannel(channel); });
    channel.stop?.addEventListener('click', () => {
      pauseChannel(channel);
      status('Listening paused. Choose Listen to continue where you left off.');
    });
    channel.volume?.addEventListener('input', () => { applyVolume(channel); saveSettings(); });
    channel.audio.addEventListener('ended', () => {
      if (!channel.wanted || isQuiet()) return;
      channel.wanted = false;
      channel.index = (channel.index + 1) % channel.playlist.length;
      void listenChannel(channel);
    });
    channel.audio.addEventListener('error', () => {
      if (!channel.wanted) return;
      pauseChannel(channel);
      if (channel.now) channel.now.textContent = 'This recording could not load. Tap Listen to retry.';
      status('The recording is unavailable right now. Try Listen again or use the other channel.');
    });
  });

  $('audioStartAll')?.addEventListener('click', () => {
    if (Object.values(channels).some(channel => channel.wanted)) pauseAll();
    else startAll();
  });
  $('audioStopAll')?.addEventListener('click', () => pauseAll());
  document.addEventListener('jcs:film-start', () => pauseAll('Worship audio paused while you watch the film.'));
  window.__jcsStartSacredMedia = startAll;
  window.__jcsSuspendSacredMedia = (reason = 'Media paused') => {
    pauseAll(reason + '. Choose Listen to resume.');
    document.dispatchEvent(new CustomEvent('jcs:pause-media'));
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.__jcsSuspendSacredMedia('Page hidden');
    else renderScriptureStreams(false);
  });
  window.addEventListener('pagehide', () => window.__jcsSuspendSacredMedia('Page closed'));
  // No focus/blur handler: interacting with the embedded film moves focus to
  // its iframe, which must not stop playback or restart a previously paused track.
  updateControls();
  status('Choose Play worship audio, or Listen to either channel.');

  const blessings = [
    'May every ledger entry remind you that Jesus Christ never changes.',
    'Walk in faith; let your stewardship be as transparent as this ledger.',
    'Jesus Christ Saves — let your digital steps confess His name.',
    'Let your giving be in the light, your hope in the Lord.',
    'Grace and truth remain greater than any market chart.'
  ];
  let blessingIndex = deterministicIndex(blessings.length,3);
  function rotateBlessing(){
    const element = $('dailyBlessing');
    if (!element) return;
    blessingIndex = (blessingIndex + 1) % blessings.length;
    element.textContent = blessings[blessingIndex];
  }
  rotateBlessing();
  window.setInterval(rotateBlessing,60000);

})();
