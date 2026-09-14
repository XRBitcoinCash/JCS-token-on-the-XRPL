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
  const PRIMARY_PLAYBACK_ID = 'Dl8dRUL01MKAdzv7XtfvvUj1jVYq029z2TS9TGeH8Xj00o';
  const PRIMARY_HLS_URL = 'https://stream.mux.com/' + PRIMARY_PLAYBACK_ID + '.m3u8?redundant_streams=true';
  const PRIMARY_MP4_URL = 'https://stream.mux.com/' + PRIMARY_PLAYBACK_ID + '/medium.mp4';
  let primaryHls = null;
  let primarySourceMode = 'mp4';
  let primaryHlsRetried = false;
  const canPlayNativeHls = video => Boolean(
    video?.canPlayType?.('application/vnd.apple.mpegurl') ||
    video?.canPlayType?.('application/x-mpegURL')
  );
  const destroyPrimaryHls = () => {
    if (!primaryHls) return;
    try { primaryHls.destroy(); } catch {}
    primaryHls = null;
  };
  const usePrimaryMp4 = () => {
    if (!primaryVideo) return false;
    destroyPrimaryHls();
    primarySourceMode = 'mp4';
    primaryVideo.src = PRIMARY_MP4_URL;
    primaryVideo.load();
    return true;
  };
  const preparePrimarySource = () => {
    if (!primaryVideo) return Promise.resolve(false);
    const HlsCtor = window.Hls;
    if (HlsCtor && typeof HlsCtor.isSupported === 'function' && HlsCtor.isSupported()) {
      try {
        primaryHlsRetried = false;
        primaryHls = new HlsCtor({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60
        });
        primarySourceMode = 'hls.js';
        const events = HlsCtor.Events || {};
        if (events.MANIFEST_PARSED) {
          primaryHls.on(events.MANIFEST_PARSED, () => {
            if (!primaryPlaying) setPrimaryStatus('JESUS is ready. Press play to begin this card.');
          });
        }
        if (events.ERROR) {
          primaryHls.on(events.ERROR, (_event, data) => {
            if (!data?.fatal || !primaryHls) return;
            if (data.type === HlsCtor.ErrorTypes?.NETWORK_ERROR && !primaryHlsRetried) {
              primaryHlsRetried = true;
              primaryHls.startLoad();
              return;
            }
            if (data.type === HlsCtor.ErrorTypes?.MEDIA_ERROR) {
              primaryHls.recoverMediaError();
              return;
            }
            usePrimaryMp4();
            setPrimaryStatus('The adaptive JESUS stream could not load; trying the direct film file…');
          });
        }
        primaryHls.attachMedia(primaryVideo);
        primaryHls.loadSource(PRIMARY_HLS_URL);
        return Promise.resolve(true);
      } catch {
        destroyPrimaryHls();
      }
    }
    if (canPlayNativeHls(primaryVideo)) {
      primaryVideo.src = PRIMARY_HLS_URL;
      primarySourceMode = 'native-hls';
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  };
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
      primaryStart.textContent = primaryPlaying ? 'JESUS is loading…' : 'Play JESUS here';
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
    film.controls = Boolean(filmStart);
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
        const message = 'The public-domain film could not load. Press Play again when the channel is ready.';
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
        if (!primaryPlaying) setPrimaryStatus('Loading JESUS in this card…');
        return true;
      }).catch(error => {
        if (error?.name === 'NotAllowedError') {
          primaryVideo.muted = true;
          primaryVideo.defaultMuted = true;
          return Promise.resolve(primaryVideo.play()).then(() => {
            if (!primaryPlaying) setPrimaryStatus('Loading JESUS muted… Tap the player’s sound control when playback begins.');
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
    primaryVideo.preload = 'auto';
    primaryVideo.addEventListener('play', () => {
      if (document.hidden) {
        pausePrimary('Page hidden. Press Play JESUS here when you return.');
        return;
      }
      updatePrimaryState(true);
      document.dispatchEvent(new CustomEvent('jcs:film-start', { detail: { group: 'jesus' } }));
      setPrimaryStatus('JESUS is starting in this card…');
      say('The full JESUS film is starting in this card.');
    });
    primaryVideo.addEventListener('loadeddata', () => {
      if (!primaryPlaying) setPrimaryStatus('JESUS is ready. Press play to begin this card.');
    });
    primaryVideo.addEventListener('canplay', () => {
      if (primaryPlaying && primaryVideo.paused) setPrimaryStatus('JESUS is ready to play in this card…');
    });
    primaryVideo.addEventListener('playing', () => {
      if (!primaryPlaying) updatePrimaryState(true);
      if (primaryStart) primaryStart.textContent = 'JESUS is playing';
      setPrimaryStatus('JESUS is playing in this card. Use the player controls for sound and full screen.');
      say('The full JESUS film is playing in this card.');
    });
    primaryVideo.addEventListener('timeupdate', () => {
      if (primaryPlaying && primaryVideo.currentTime > 0.05) {
        if (primaryStart) primaryStart.textContent = 'JESUS is playing';
        setPrimaryStatus('JESUS is playing in this card. Use the player controls for sound and full screen.');
      }
    });
    primaryVideo.addEventListener('waiting', () => {
      if (primaryPlaying) setPrimaryStatus('JESUS is buffering in this card…');
    });
    primaryVideo.addEventListener('stalled', () => {
      if (primaryPlaying) setPrimaryStatus('JESUS stream is waiting for the next segment…');
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
    void preparePrimarySource();
  }

  if (film) {
    film.autoplay = false;
    film.controls = Boolean(filmStart);
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
      say('The public-domain film could not load. Press Play again when the channel is ready.');
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
  say('Choose Play to start the listening channels together, or Play JESUS here.');
})();
