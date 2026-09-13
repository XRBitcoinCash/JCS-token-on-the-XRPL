(() => {
  'use strict';

  const header = document.querySelector('.jcs-index-header');
  const toggle = document.getElementById('mobileNavToggle');
  const nav = document.getElementById('primaryNav');
  const media = window.matchMedia('(max-width: 980px)');
  if (!header || !toggle || !nav) return;

  const icon = toggle.querySelector('.menu-icon');
  const label = toggle.querySelector('.menu-label');

  function setOpen(open, returnFocus = false) {
    const next = Boolean(open && media.matches);
    nav.classList.toggle('is-open', next);
    header.classList.toggle('menu-open', next);
    toggle.setAttribute('aria-expanded', String(next));
    toggle.setAttribute('aria-label', next ? 'Close site navigation' : 'Open site navigation');
    if (icon) icon.textContent = next ? '×' : '☰';
    if (label) label.textContent = next ? 'Close' : 'Menu';
    if (returnFocus) toggle.focus();
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', event => {
    if (media.matches && event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false, true);
    }
  });

  document.addEventListener('click', event => {
    if (
      media.matches &&
      toggle.getAttribute('aria-expanded') === 'true' &&
      !header.contains(event.target)
    ) {
      setOpen(false);
    }
  });

  media.addEventListener?.('change', () => setOpen(false));
  setOpen(false);
})();
