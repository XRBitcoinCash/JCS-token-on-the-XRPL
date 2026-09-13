(function(){
  'use strict';

  const ROTATION_MS = 60000;
  const PASSAGES = [{"group": "Proverbs · King James Version", "ref": "Proverbs 1:7", "text": "The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 3:5–6", "text": "Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 4:23", "text": "Keep thy heart with all diligence; for out of it are the issues of life."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 9:10", "text": "The fear of the LORD is the beginning of wisdom: and the knowledge of the holy is understanding."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 10:12", "text": "Hatred stirreth up strifes: but love covereth all sins."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 11:25", "text": "The liberal soul shall be made fat: and he that watereth shall be watered also himself."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 15:1", "text": "A soft answer turneth away wrath: but grievous words stir up anger."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 16:3", "text": "Commit thy works unto the LORD, and thy thoughts shall be established."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 16:9", "text": "A man's heart deviseth his way: but the LORD directeth his steps."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 18:10", "text": "The name of the LORD is a strong tower: the righteous runneth into it, and is safe."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 19:17", "text": "He that hath pity upon the poor lendeth unto the LORD; and that which he hath given will he pay him again."}, {"group": "Proverbs · King James Version", "ref": "Proverbs 27:17", "text": "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend."}, {"group": "1 Enoch · R. H. Charles", "ref": "1 Enoch 1:1", "text": "The words of the blessing of Enoch, wherewith he blessed the elect and righteous."}, {"group": "1 Enoch · R. H. Charles", "ref": "1 Enoch 1:4", "text": "The Holy Great One will come forth from His dwelling."}, {"group": "1 Enoch · R. H. Charles", "ref": "1 Enoch 1:8", "text": "But with the righteous He will make peace, and will protect the elect, and mercy shall be upon them."}, {"group": "1 Enoch · R. H. Charles", "ref": "1 Enoch 1:8", "text": "And light shall appear unto them, and He will make peace with them."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 21:2", "text": "Throughout all the days of my life I have remembered the Lord, and sought with all my heart to do His will."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 21:4", "text": "He is the living God, and He is holy and faithful, and He is righteous beyond all."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 21:23", "text": "Observe the ordinance of the Most High God, and do His will and be upright in all things."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 21:24", "text": "And He will bless thee in all thy deeds, and will raise up from thee the plant of righteousness."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 22:10", "text": "May the God of all bless thee and strengthen thee to do righteousness, and His will before Him."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 22:14", "text": "May He cleanse thee from all unrighteousness and impurity, that thou mayest be forgiven."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 22:19", "text": "May the Most High God help thee, and the God of heaven bless thee."}, {"group": "Book of Jubilees · R. H. Charles", "ref": "Jubilees 22:23", "text": "Fear not, and be not dismayed: may the Most High God preserve thee from destruction."}];
  const JESUS_WORDS = [{"ref": "John 14:6", "text": "I am the way, the truth, and the life: no man cometh unto the Father, but by me."}, {"ref": "Matthew 11:28", "text": "Come unto me, all ye that labour and are heavy laden, and I will give you rest."}, {"ref": "John 8:12", "text": "I am the light of the world: he that followeth me shall not walk in darkness."}, {"ref": "Matthew 5:9", "text": "Blessed are the peacemakers: for they shall be called the children of God."}, {"ref": "Matthew 6:33", "text": "Seek ye first the kingdom of God, and his righteousness."}, {"ref": "John 10:11", "text": "I am the good shepherd: the good shepherd giveth his life for the sheep."}, {"ref": "John 11:25", "text": "I am the resurrection, and the life."}, {"ref": "Luke 11:9", "text": "Ask, and it shall be given you; seek, and ye shall find."}, {"ref": "Matthew 28:20", "text": "Lo, I am with you alway, even unto the end of the world."}, {"ref": "Mark 16:15", "text": "Go ye into all the world, and preach the gospel to every creature."}];

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
      if ($('scriptureKicker')) $('scriptureKicker').textContent = item.group;
      if ($('scriptureText')) $('scriptureText').textContent = '“' + item.text + '”';
      if ($('scriptureSource')) $('scriptureSource').textContent = item.ref + ' · Public-domain translation';
    }

    if (jesusIndex !== lastJesusIndex) {
      lastJesusIndex = jesusIndex;
      const item = JESUS_WORDS[jesusIndex];
      if ($('jesusWords')) $('jesusWords').textContent = '“' + item.text + '”';
      if ($('jesusWordsSource')) $('jesusWordsSource').textContent = item.ref + ' · King James Version';
    }
  }

  window.__jcsRenderScriptureStreams = () => renderScriptureStreams(true);
  renderScriptureStreams(true);
  window.setInterval(() => renderScriptureStreams(false), ROTATION_MS);


  const fallbackMusic = [
    {
      title:'Gregorian Chant Mass · Track 2',
      url:'https://archive.org/download/GregorianChantMass/02Track2_64kb.mp3',
      duration:300
    },
    {
      title:'Gregorian Chant Mass · Track 4',
      url:'https://archive.org/download/GregorianChantMass/04Track4_64kb.mp3',
      duration:300
    },
    {
      title:'Gregorian Chant Mass · Track 5',
      url:'https://archive.org/download/GregorianChantMass/05Track5_64kb.mp3',
      duration:300
    },
    {
      title:'Gregorian Chant Mass · Track 6',
      url:'https://archive.org/download/GregorianChantMass/06Track6_64kb.mp3',
      duration:300
    },
    {
      title:'Ave Maria · Enrico Caruso archival recording',
      url:'https://archive.org/download/Caruso_part1/Caruso-AveMaria.mp3',
      duration:270
    }
  ];

  const fallbackReadings = [
    {
      title:'King James Psalms · Book I',
      url:'https://archive.org/download/psalms_kjv_1202_librivox/psalms_01_kjv.mp3',
      duration:957
    },
    {
      title:'King James Psalms · Book II',
      url:'https://archive.org/download/psalms_kjv_1202_librivox/psalms_02_kjv.mp3',
      duration:965
    },
    {
      title:'King James Psalms · Book III',
      url:'https://archive.org/download/psalms_kjv_1202_librivox/psalms_03_kjv.mp3',
      duration:1410
    },
    {
      title:'Book of Enoch · Opening reading',
      url:'https://archive.org/download/bookofenoch_1812_librivox/bookofenoch_02_charles_128kb.mp3',
      duration:964
    },
    {
      title:'Book of Enoch · Further reading',
      url:'https://archive.org/download/bookofenoch_1812_librivox/bookofenoch_03_charles_128kb.mp3',
      duration:873
    },
    {
      title:'Book of Jubilees · Opening reading',
      url:'https://archive.org/download/book_jubilees_2108_librivox/bookofjubilees_01_charles_128kb.mp3',
      duration:900
    }
  ];


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
