(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const companion = $('passionVideo');
  const mount = $('modernPassionPlayer');
  if (!companion || !mount) return;

  const VIDEO_ID = 'itiY6yl8mS4';
  let player = null;
  let playerReady = false;
  let apiPending = null;
  let playerPending = null;
  let desiredPlaying = false;
  let request = 0;
  let companionPlayRequested = false;
  let companionPauseRequested = false;
  let modernFailure = false;

  function setStatus(message) {
    if ($('filmStatus')) $('filmStatus').textContent = message;
  }

  function updateControls() {
    if ($('filmPauseBoth')) $('filmPauseBoth').disabled = !desiredPlaying;
    $('filmPlayBoth')?.setAttribute('aria-pressed', String(desiredPlaying));
  }

  function quiet() {
    return document.hidden || document.body.classList.contains('quiet-mode');
  }

  function companionStatus(message, playing) {
    if ($('passionNow')) {
      $('passionNow').textContent = message;
      $('passionNow').className = 'now-playing ' + (playing ? 'is-live' : 'is-muted');
    }
    if ($('passionOverlay')) $('passionOverlay').hidden = playing;
  }

  function pauseCompanion() {
    if (!companion.paused) {
      companionPauseRequested = true;
      companion.pause();
    }
    companionStatus('1903 silent film · paused', false);
  }

  async function playCompanion() {
    if (!desiredPlaying || quiet() || !companion.paused || companionPlayRequested) return;
    companionPlayRequested = true;
    companion.muted = true;
    try {
      await companion.play();
      if (!desiredPlaying || quiet()) pauseCompanion();
      else companionStatus('1903 silent film · playing without sound', true);
    } catch (error) {
      companionPlayRequested = false;
      companionStatus(
        companion.error || error?.name === 'NotSupportedError'
          ? 'Silent film unavailable. The official trailer can still play.'
          : 'Tap the small film’s play control if your phone requires another tap.',
        false
      );
    }
  }

  function pauseBoth(message = 'Films paused. Choose Play to continue.') {
    desiredPlaying = false;
    request += 1;
    if (playerReady) {
      try { player.pauseVideo(); } catch {}
    }
    pauseCompanion();
    updateControls();
    setStatus(message);
  }

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (apiPending) return apiPending;
    apiPending = new Promise((resolve, reject) => {
      const priorCallback = window.onYouTubeIframeAPIReady;
      const script = document.createElement('script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        script.onerror = null;
        if (error) {
          apiPending = null;
          script.remove();
          reject(error);
        } else resolve();
      };
      const timeout = window.setTimeout(() => finish(new Error('The YouTube player did not load.')), 15000);
      window.onYouTubeIframeAPIReady = () => {
        try { if (typeof priorCallback === 'function') priorCallback(); } catch {}
        finish(window.YT?.Player ? null : new Error('The YouTube player is unavailable.'));
      };
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => finish(new Error('The YouTube player is unavailable.'));
      document.head.appendChild(script);
    });
    return apiPending;
  }

  function onPlayerStateChange(event) {
    if (event.data === window.YT.PlayerState.PLAYING) {
      if (quiet()) { pauseBoth('Page inactive. Choose Play when you return.'); return; }
      modernFailure = false;
      desiredPlaying = true;
      document.dispatchEvent(new CustomEvent('jcs:film-start'));
      void playCompanion();
      updateControls();
      setStatus('Official Passion trailer with the silent 1903 companion. The films have separate scenes and running times.');
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      if (!desiredPlaying) return;
      desiredPlaying = false;
      request += 1;
      pauseCompanion();
      updateControls();
      setStatus('Films paused. Choose Play to continue.');
    } else if (event.data === window.YT.PlayerState.ENDED) {
      pauseBoth('The official trailer has ended. Use the full-film link to continue watching with the provider.');
    }
  }

  async function ensurePlayer() {
    if (playerReady) return player;
    if (playerPending) return playerPending;
    // A slow iframe can still finish loading after our timeout. Do not build
    // another player over it; its native control and external links remain usable.
    if (player) throw new Error('The embedded player is still connecting.');
    playerPending = (async () => {
      await loadYouTubeApi();
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          playerPending = null;
          reject(new Error('The film player took too long to connect.'));
        }, 15000);
        player = new window.YT.Player('modernPassionPlayer', {
          host: 'https://www.youtube-nocookie.com',
          width: '100%',
          height: '100%',
          videoId: VIDEO_ID,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            controls: 1,
            rel: 0,
            origin: window.location.origin
          },
          events: {
            onReady: () => {
              window.clearTimeout(timeout);
              playerReady = true;
              const frame = player.getIframe();
              frame.title = 'The Passion of the Christ — official trailer';
              frame.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
              resolve(player);
            },
            onStateChange: onPlayerStateChange,
            onAutoplayBlocked: () => {
              pauseCompanion();
              setStatus('Tap Play inside the large player to start the trailer on this device. The silent companion will join.');
            },
            onError: () => {
              modernFailure = true;
              setStatus('The trailer cannot play here. Use Watch on YouTube, or the full-film provider link. The silent film remains available.');
            }
          }
        });
      });
    })().catch(error => {
      playerPending = null;
      throw error;
    });
    return playerPending;
  }

  async function startBoth() {
    if (quiet()) {
      setStatus(document.hidden ? 'Return to this page and choose Play.' : 'Turn off Quiet mode before playing the films.');
      return;
    }
    const currentRequest = ++request;
    desiredPlaying = true;
    modernFailure = false;
    document.dispatchEvent(new CustomEvent('jcs:film-start'));
    updateControls();
    // Start the muted companion synchronously from the button interaction.
    void playCompanion();
    if (playerReady) {
      player.playVideo();
      return;
    }
    setStatus('Opening the official trailer. On some phones, tap Play inside the player when it appears.');
    try {
      const readyPlayer = await ensurePlayer();
      if (currentRequest !== request || !desiredPlaying || quiet()) return;
      readyPlayer.playVideo();
    } catch (error) {
      if (currentRequest !== request) return;
      modernFailure = true;
      setStatus('The trailer player could not load. Use Watch on YouTube. You can still watch the silent companion here.');
    }
  }

  companion.defaultMuted = true;
  companion.muted = true;
  companion.autoplay = false;
  companion.playsInline = true;
  companion.controls = true;
  companion.preload = 'none';
  companion.setAttribute('playsinline', '');
  companion.removeAttribute('crossorigin');
  companion.pause();
  companion.addEventListener('volumechange', () => {
    if (!companion.muted) companion.muted = true;
  });
  companion.addEventListener('play', () => {
    if (companionPlayRequested) { companionPlayRequested = false; return; }
    if (quiet()) { pauseCompanion(); return; }
    void startBoth();
  });
  companion.addEventListener('pause', () => {
    if (companionPauseRequested) { companionPauseRequested = false; return; }
    if (desiredPlaying && !companion.error && !companion.ended) pauseBoth();
  });
  companion.addEventListener('ended', () => {
    companionStatus('The 1903 silent film has ended.', false);
    // Different running times are intentional; never seek one film to imply
    // matching scenes or stop a longer modern presentation at this boundary.
  });
  companion.addEventListener('error', () => {
    companionStatus('The silent film is unavailable. You can still use the large trailer player.', false);
    if (!modernFailure) setStatus('The silent companion could not load. The official trailer is still available above.');
  });

  $('filmPlayBoth')?.addEventListener('click', () => { void startBoth(); });
  $('filmPauseBoth')?.addEventListener('click', () => pauseBoth());
  $('passionStart')?.addEventListener('click', () => { void startBoth(); });
  $('passionPause')?.addEventListener('click', () => pauseBoth());
  $('passionReturnAudio')?.addEventListener('click', () => pauseBoth('Films paused. Choose Listen in worship audio to resume music or Scripture.'));
  $('passionOverlay')?.addEventListener('click', () => { void startBoth(); });
  document.addEventListener('jcs:pause-media', () => pauseBoth('Films paused. Choose Play when you are ready.'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseBoth('Page hidden. Choose Play when you return.');
  });
  window.addEventListener('pagehide', () => pauseBoth('Films paused.'));

  updateControls();
  companionStatus('1903 silent film · ready', false);
  setStatus('Play the official trailer and muted silent companion together.');
})();
