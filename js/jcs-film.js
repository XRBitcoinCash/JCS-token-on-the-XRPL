(function () {
  'use strict';

  const film = document.getElementById('passionVideo');
  const heritage = document.getElementById('heritageFilm');
  const status = document.getElementById('filmStatus');
  if (!film) return;
  const say = message => { if (status) status.textContent = message; };
  const pause = message => { film.pause(); say(message); };

  // Primary films are official viewing links. Only the optional 1903 heritage
  // film plays here, with native controls and a deliberate user gesture.
  film.autoplay = false;
  film.controls = true;
  film.defaultMuted = true;
  film.muted = true;
  film.playsInline = true;
  film.preload = 'none';
  film.removeAttribute('crossorigin');
  film.pause();
  film.addEventListener('play', () => {
    if (document.hidden) { pause('Page hidden. Press play when you return.'); return; }
    document.dispatchEvent(new CustomEvent('jcs:film-start'));
    say('Playing the 1903 silent film. Use its controls to pause or view full screen.');
  });
  film.addEventListener('pause', () => say('Historic film paused. Press play to continue.'));
  film.addEventListener('ended', () => say('The historic film has ended.'));
  film.addEventListener('error', () => say('This film could not load. Use the Wikimedia source link to watch there.'));
  heritage?.addEventListener('toggle', () => {
    if (!heritage.open) pause('Historic film closed. Open it and press play when you are ready.');
  });
  document.getElementById('sacred-film')?.querySelectorAll('a[target="_blank"]').forEach(link => {
    link.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('jcs:film-start'));
      pause('Viewing opens with the selected provider.');
    });
  });
  document.addEventListener('jcs:pause-media', () => pause('Historic film paused. Press play to continue.'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('Page hidden. Press play when you return.');
  });
  window.addEventListener('pagehide', () => pause('Historic film paused.'));
})();
