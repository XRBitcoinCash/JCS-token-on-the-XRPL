(function () {
  'use strict';

  const JESUS_URL = 'https://www.jesusfilm.org/watch/jesus.html';
  const film = document.getElementById('passionVideo');
  const heritage = document.getElementById('heritageFilm');
  const status = document.getElementById('filmStatus');
  const primaryFrame = document.getElementById('jesusFilmFrame');
  const primaryStart = document.getElementById('jesusFilmStart');
  const primaryStatus = document.getElementById('jesusFilmPlayerStatus');
  const filmStart = document.getElementById('filmStart');
  const filmStop = document.getElementById('filmStop');
  const filmNow = document.getElementById('filmNow');
  const primaryFallback = document.getElementById('jesusFilmWatch');
  if (!film && !primaryFrame && !filmStart) return;

  let filmPlaying = false;
  let primaryLoadTimer = null;

  const say = message => { if (status) status.textContent = message; };
  const setPrimaryStatus = message => { if (primaryStatus) primaryStatus.textContent = message; };
  const updateFilmState = playing => {
    filmPlaying = Boolean(playing);
    window.__jcsFilmPlaying = filmPlaying;
    if (filmStart) {
      filmStart.disabled = filmPlaying;
      const label = filmStart.querySelector('span:last-child');
      if (label) label.textContent = filmPlaying ? 'Playing' : 'Play film';
      else filmStart.textContent = filmPlaying ? 'Playing' : 'Play film';
    }
    if (filmStop) filmStop.disabled = !filmPlaying;
    if (filmNow) {
      filmNow.textContent = filmPlaying
        ? 'Playing the public-domain 1903 Passion companion.'
        : (film?.currentTime ? 'Paused · public-domain 1903 Passion companion.' : 'Ready when you are.');
      filmNow.className = filmPlaying ? 'now-playing is-live' : 'now-playing is-muted';
    }
    document.dispatchEvent(new CustomEvent('jcs:film-state', { detail: { playing: filmPlaying } }));
  };

  function pauseFilm(message = 'Film paused. Press Play film to continue.') {
    if (film) {
      film.pause();
      film.dataset.jcsPlayGroup = '';
    }
    updateFilmState(false);
    if (message) say(message);
  }

  function startHeritage(options = {}) {
    if (!film) {
      say('The public-domain film companion is unavailable on this device.');
      if (filmNow) filmNow.textContent = 'Film unavailable. Use the primary film player above.';
      return Promise.resolve(false);
    }
    if (heritage) heritage.open = true;
    film.autoplay = false;
    film.controls = true;
    film.muted = true;
    film.defaultMuted = true;
    film.playsInline = true;
    film.dataset.jcsPlayGroup = options.group === 'all' ? 'all' : 'film';
    updateFilmState(true);
    const attempt = film.play();
    if (attempt && typeof attempt.then === 'function') {
      return attempt.then(() => true).catch(error => {
        updateFilmState(false);
        const blocked = error?.name === 'NotAllowedError';
        const message = blocked
          ? 'Your browser blocked playback. Press Play film again to allow the silent companion.'
          : 'The film could not load. Use the Wikimedia source link below.';
        say(message);
        if (filmNow) filmNow.textContent = message;
        return false;
      });
    }
    return Promise.resolve(true);
  }

  function startPrimary() {
    if (!primaryFrame) return false;
    primaryFrame.hidden = false;
    if (primaryFrame.dataset.loaded !== 'true') {
      primaryFrame.src = JESUS_URL;
      primaryFrame.dataset.loaded = 'loading';
      setPrimaryStatus('Loading the official JESUS player in this card. Use its own play and sound controls.');
      window.clearTimeout(primaryLoadTimer);
      primaryLoadTimer = window.setTimeout(() => {
        if (primaryFrame.dataset.loaded !== 'ready') {
          setPrimaryStatus('The official player did not load inside this card. Use the on-page fallback below.');
          if (primaryFallback) primaryFallback.hidden = false;
        }
      }, 12000);
    } else {
      setPrimaryStatus('The official JESUS player is ready. Use its play and sound controls.');
    }
    if (primaryStart) {
      primaryStart.textContent = 'JESUS player ready';
      primaryStart.disabled = true;
    }
    say('The official JESUS player is ready in the page. Press its play button and enable sound there if requested.');
    return true;
  }

  if (primaryFrame) {
    primaryFrame.hidden = true;
    primaryFrame.addEventListener('load', () => {
      primaryFrame.dataset.loaded = 'ready';
      window.clearTimeout(primaryLoadTimer);
      setPrimaryStatus('Official JESUS player loaded. Press its play button and enable sound there if requested.');
      if (primaryStart) {
        primaryStart.textContent = 'JESUS player ready';
        primaryStart.disabled = true;
      }
    });
    primaryFrame.addEventListener('error', () => {
      primaryFrame.dataset.loaded = 'error';
      setPrimaryStatus('The official player could not be embedded here. Use the authorized player link below.');
      if (primaryFallback) primaryFallback.hidden = false;
      if (primaryStart) {
        primaryStart.textContent = 'Retry official player';
        primaryStart.disabled = false;
      }
    });
  }

  if (film) {
    film.autoplay = false;
    film.controls = true;
    film.defaultMuted = true;
    film.muted = true;
    film.playsInline = true;
    film.preload = 'none';
    film.removeAttribute('crossorigin');
    film.pause();
    film.addEventListener('play', () => {
      if (document.hidden) { pauseFilm('Page hidden. Press Play film when you return.'); return; }
      updateFilmState(true);
      const group = film.dataset.jcsPlayGroup === 'all' ? 'all' : 'film';
      film.dataset.jcsPlayGroup = '';
      document.dispatchEvent(new CustomEvent('jcs:film-start', { detail: { group } }));
      say(group === 'all'
        ? 'Music, Scripture, and the public-domain film companion are playing.'
        : 'Playing the public-domain 1903 Passion companion. Use its controls to pause or view full screen.');
    });
    film.addEventListener('pause', () => {
      updateFilmState(false);
      if (filmNow) filmNow.textContent = 'Paused · public-domain 1903 Passion companion.';
    });
    film.addEventListener('ended', () => {
      updateFilmState(false);
      say('The public-domain film companion has ended.');
      if (filmNow) filmNow.textContent = 'Film ended. Press Play film to start again.';
    });
    film.addEventListener('error', () => {
      updateFilmState(false);
      say('This film could not load. Use the Wikimedia source link to watch there.');
      if (filmNow) filmNow.textContent = 'Film unavailable. Use the Wikimedia source link below.';
    });
    heritage?.addEventListener('toggle', () => {
      if (!heritage.open) pauseFilm('Historic film closed. Press Play film when you are ready.');
    });
  }

  primaryStart?.addEventListener('click', startPrimary);
  filmStart?.addEventListener('click', () => { void startHeritage({ group: 'film' }); });
  filmStop?.addEventListener('click', () => pauseFilm());
  document.getElementById('sacred-film')?.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', () => {
      if (filmPlaying) pauseFilm('Film paused while the selected provider opens.');
    });
  });
  document.addEventListener('jcs:pause-media', () => pauseFilm('Film paused. Press Play film to continue.'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseFilm('Page hidden. Press Play film when you return.');
  });
  window.addEventListener('pagehide', () => pauseFilm('Film paused.'));
  window.__jcsStartFilm = options => startHeritage(options || {});
  window.__jcsPauseFilm = message => pauseFilm(message || 'Film paused.');
  window.__jcsFilmPlaying = false;
  updateFilmState(false);
  say('Choose Start JESUS film here for the official player, or Play film for the public-domain companion.');
})();
