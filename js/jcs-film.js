(function () {
  'use strict';

  const film = document.getElementById('passionVideo');
  const primaryVideo = document.getElementById('jesusFilmVideo');
  const primaryStart = document.getElementById('jesusFilmStart');
  const primaryStatus = document.getElementById('jesusFilmPlayerStatus');
  const filmStart = document.getElementById('filmStart');
  const filmStop = document.getElementById('filmStop');
  const filmNow = document.getElementById('filmNow');
  const status = document.getElementById('filmStatus');
  const heritage = document.getElementById('heritageFilm');
  if (!film && !primaryVideo && !filmStart && !primaryStart) return;

  let filmPlaying = false;
  let primaryPlaying = false;

  const say = message => {
    if (status) status.textContent = message;
  };
  const setPrimaryStatus = message => {
    if (primaryStatus) primaryStatus.textContent = message;
  };
  const updateOverallState = (channel = 'film') => {
    const playing = Boolean(filmPlaying || primaryPlaying);
    window.__jcsFilmPlaying = playing;
    document.dispatchEvent(new CustomEvent('jcs:film-state', {
      detail: { playing, channel, primaryPlaying, filmPlaying }
    }));
  };
  const updateFilmState = playing => {
    filmPlaying = Boolean(playing);
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
    updateOverallState('heritage');
  };
  const updatePrimaryState = playing => {
    primaryPlaying = Boolean(playing);
    if (primaryStart) {
      primaryStart.disabled = primaryPlaying;
      primaryStart.textContent = primaryPlaying ? 'JESUS is playing' : 'Play JESUS here';
    }
    updateOverallState('jesus');
  };

  function pauseHeritage(message = 'Film paused. Press Play film to continue.') {
    if (film) {
      film.pause();
      film.dataset.jcsPlayGroup = '';
    }
    updateFilmState(false);
    if (message) say(message);
  }

  function pausePrimary(message = 'JESUS paused. Press Play JESUS here to continue.') {
    if (primaryVideo) primaryVideo.pause();
    updatePrimaryState(false);
    if (message) setPrimaryStatus(message);
  }

  function pauseAllMedia(message = 'Media paused. Press play when you are ready.') {
    if (filmPlaying || film?.currentTime) pauseHeritage('');
    if (primaryPlaying || primaryVideo?.currentTime) pausePrimary('');
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
    film.playsInline = true;
    film.preload = 'metadata';
    film.dataset.jcsPlayGroup = options.group === 'all' ? 'all' : 'film';
    const requestSound = options.muted !== true;
    film.muted = !requestSound;
    film.defaultMuted = !requestSound;
    const attempt = film.play();
    if (attempt && typeof attempt.then === 'function') {
      return attempt.then(() => true).catch(error => {
        if (error?.name === 'NotAllowedError' && requestSound) {
          film.muted = true;
          film.defaultMuted = true;
          return Promise.resolve(film.play()).then(() => true).catch(() => {
            updateFilmState(false);
            const message = 'Your browser blocked playback. Press Play film again or use the video controls.';
            say(message);
            if (filmNow) filmNow.textContent = message;
            return false;
          });
        }
        updateFilmState(false);
        const message = 'The public-domain film could not load. Use the Wikimedia source listed above.';
        say(message);
        if (filmNow) filmNow.textContent = message;
        return false;
      });
    }
    return Promise.resolve(true);
  }

  function startPrimary() {
    if (!primaryVideo) return Promise.resolve(false);
    primaryVideo.controls = true;
    primaryVideo.playsInline = true;
    primaryVideo.muted = false;
    primaryVideo.defaultMuted = false;
    const attempt = primaryVideo.play();
    if (attempt && typeof attempt.then === 'function') {
      return attempt.then(() => {
        setPrimaryStatus('JESUS is playing in this card. Use the player controls for sound and full screen.');
        return true;
      }).catch(error => {
        if (error?.name === 'NotAllowedError') {
          primaryVideo.muted = true;
          primaryVideo.defaultMuted = true;
          return Promise.resolve(primaryVideo.play()).then(() => {
            setPrimaryStatus('JESUS is playing muted. Tap the player’s sound control to hear it.');
            return true;
          }).catch(() => {
            updatePrimaryState(false);
            setPrimaryStatus('The JESUS film could not start. Press play on the video to retry.');
            return false;
          });
        }
        updatePrimaryState(false);
        setPrimaryStatus('The JESUS film could not load in this card. Try the video controls again.');
        return false;
      });
    }
    return Promise.resolve(true);
  }

  if (primaryVideo) {
    primaryVideo.autoplay = false;
    primaryVideo.controls = true;
    primaryVideo.playsInline = true;
    primaryVideo.preload = 'metadata';
    primaryVideo.addEventListener('play', () => {
      if (document.hidden) {
        pausePrimary('Page hidden. Press Play JESUS here when you return.');
        return;
      }
      updatePrimaryState(true);
      document.dispatchEvent(new CustomEvent('jcs:film-start', { detail: { group: 'jesus' } }));
      say('The full JESUS film is playing in this card.');
    });
    primaryVideo.addEventListener('pause', () => {
      updatePrimaryState(false);
      if (primaryVideo.currentTime > 0) setPrimaryStatus('JESUS paused. Press play on the video or the button to continue.');
    });
    primaryVideo.addEventListener('ended', () => {
      updatePrimaryState(false);
      setPrimaryStatus('The full JESUS film has ended. Press play to watch it again.');
      say('The full JESUS film has ended.');
    });
    primaryVideo.addEventListener('error', () => {
      updatePrimaryState(false);
      setPrimaryStatus('The JESUS stream could not load in this browser. Press play to retry or use the film source link.');
    });
  }

  if (film) {
    film.autoplay = false;
    film.controls = true;
    film.playsInline = true;
    film.preload = 'metadata';
    film.removeAttribute('crossorigin');
    film.pause();
    film.addEventListener('play', () => {
      if (document.hidden) {
        pauseHeritage('Page hidden. Press Play film when you return.');
        return;
      }
      updateFilmState(true);
      const group = film.dataset.jcsPlayGroup === 'all' ? 'all' : 'film';
      film.dataset.jcsPlayGroup = '';
      document.dispatchEvent(new CustomEvent('jcs:film-start', { detail: { group } }));
      say(group === 'all'
        ? 'Music, Scripture, and the public-domain 1903 film are playing.'
        : 'The public-domain 1903 Passion film is playing in the listening card.');
    });
    film.addEventListener('pause', () => {
      updateFilmState(false);
      if (film.currentTime > 0 && filmNow) filmNow.textContent = 'Paused · public-domain 1903 Passion companion.';
    });
    film.addEventListener('ended', () => {
      updateFilmState(false);
      say('The public-domain 1903 film has ended.');
      if (filmNow) filmNow.textContent = 'Film ended. Press Play film to start again.';
    });
    film.addEventListener('error', () => {
      updateFilmState(false);
      say('The public-domain film could not load. Use the Wikimedia source listed above.');
      if (filmNow) filmNow.textContent = 'Film unavailable. Use the Wikimedia source above.';
    });
    heritage?.addEventListener('toggle', () => {
      if (!heritage.open) pauseHeritage('Historic film closed. Press Play film when you are ready.');
    });
  }

  primaryStart?.addEventListener('click', () => { void startPrimary(); });
  filmStart?.addEventListener('click', () => { void startHeritage({ group: 'film' }); });
  filmStop?.addEventListener('click', () => pauseHeritage());
  document.getElementById('sacred-film')?.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', () => pauseAllMedia('Media paused while the source opens.'));
  });
  document.addEventListener('jcs:pause-media', () => pauseAllMedia('Media paused. Press play when you are ready.'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAllMedia('Page hidden. Press play when you return.');
  });
  window.addEventListener('pagehide', () => pauseAllMedia('Media paused.'));

  window.__jcsStartFilm = options => startHeritage(options || {});
  window.__jcsPauseFilm = message => pauseAllMedia(message || 'Media paused.');
  window.__jcsFilmPlaying = false;
  updateOverallState('initial');
  if (primaryVideo) setPrimaryStatus('Press Play JESUS here or use the video controls to begin.');
  say('Choose Play all three, Listen to a channel, or Play JESUS here.');
})();
