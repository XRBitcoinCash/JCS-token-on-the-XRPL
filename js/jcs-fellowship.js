(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE = {
    journal: 'jcs.home.privateJournal.v2',
    practice: 'jcs.home.practice.v2',
    reactions: 'jcs.home.localReactions.v2',
    quiet: 'jcs.home.quietMode.v2'
  };

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function safeRead(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  }

  function safeWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    return Promise.resolve();
  }

  function mirror(sourceId, targetId, fallback = '—') {
    const source = $(sourceId);
    const target = $(targetId);
    if (!target) return;
    const update = () => {
      const text = source?.textContent?.trim();
      target.textContent = text || fallback;
    };
    update();
    if (source) new MutationObserver(update).observe(source, { childList: true, subtree: true, characterData: true });
  }

  mirror('jcsSpot', 'homeSpotState');
  mirror('jcsAmm', 'homeAmmReference');
  mirror('jcsSpread', 'homeSpreadState');
  mirror('jcsAmm', 'homeAmmState');
  mirror('jcsLedgerMini', 'homeLedgerState');
  mirror('tradeJcsBalance', 'homeJcsBalance', 'Connect Xaman');
  mirror('tradeWalletSummary', 'homeWalletState', 'Not connected');
  mirror('jcsProjectPrice', 'homeMarketPrice', 'Loading validated market evidence…');

  const copyIssuerBtn = $('copyIssuerBtn');
  if (copyIssuerBtn) {
    copyIssuerBtn.addEventListener('click', async () => {
      try {
        await copyText('rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd');
        copyIssuerBtn.textContent = 'Issuer copied';
      } catch {
        copyIssuerBtn.textContent = 'Copy unavailable';
      }
      window.setTimeout(() => { copyIssuerBtn.textContent = 'Copy issuer'; }, 1800);
    });
  }

  // Scripture controls.
  window.__jcsScripturePaused = false;
  window.__jcsScriptureOffset = Number(window.__jcsScriptureOffset || 0);

  const pauseScripture = $('scripturePauseToggle');
  if (pauseScripture) {
    pauseScripture.addEventListener('click', () => {
      window.__jcsScripturePaused = !window.__jcsScripturePaused;
      pauseScripture.setAttribute('aria-pressed', String(window.__jcsScripturePaused));
      pauseScripture.textContent = window.__jcsScripturePaused ? 'Resume rotation' : 'Pause rotation';
    });
  }

  const nextScripture = $('scriptureNextBtn');
  if (nextScripture) {
    nextScripture.addEventListener('click', () => {
      window.__jcsScriptureOffset += 1;
      window.__jcsRenderScriptureStreams?.();
    });
  }

  async function shareReading(textId, sourceId) {
    const text = $(textId)?.textContent?.trim() || '';
    const source = $(sourceId)?.textContent?.trim() || '';
    const shareText = [text, source, 'Jesus Christ Saves Token'].filter(Boolean).join('\n');
    if (!shareText) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.hash = 'scripture';
    try {
      if (navigator.share) await navigator.share({ title: 'JCS Scripture', text: shareText, url: shareUrl.href });
      else await copyText(shareText);
    } catch (error) {
      if (error?.name !== 'AbortError') console.warn('Scripture share unavailable:', error);
    }
  }

  $('scriptureCopyBtn')?.addEventListener('click', () => shareReading('scriptureText', 'scriptureSource'));
  $('jesusWordsCopyBtn')?.addEventListener('click', () => shareReading('jesusWords', 'jesusWordsSource'));

  // Private journal.
  const journal = $('privatePrayerJournal');
  const journalCount = $('journalCount');
  const journalSavedState = $('journalSavedState');
  const journalStatus = $('journalStatus');

  function updateJournalCount() {
    if (journalCount && journal) journalCount.textContent = `${journal.value.length} / 1200`;
  }

  if (journal) {
    const saved = safeRead(STORAGE.journal, null);
    if (saved?.text) {
      journal.value = String(saved.text).slice(0, 1200);
      journalSavedState.textContent = `Saved locally ${saved.updated_at || ''}`.trim();
    }
    updateJournalCount();
    journal.addEventListener('input', () => {
      updateJournalCount();
      journalSavedState.textContent = 'Unsaved changes';
    });
  }

  $('saveJournalBtn')?.addEventListener('click', () => {
    const value = journal?.value || '';
    const updated = new Date().toISOString();
    if (safeWrite(STORAGE.journal, { text: value, updated_at: updated })) {
      journalSavedState.textContent = 'Saved locally now';
      journalStatus.textContent = 'Private note saved in this browser profile. It was not uploaded or placed on XRPL.';
      journalStatus.className = 'status ok';
    } else {
      journalStatus.textContent = 'Local browser storage was unavailable.';
      journalStatus.className = 'status err';
    }
  });

  $('clearJournalBtn')?.addEventListener('click', () => {
    if (!journal || !journal.value || window.confirm('Delete the private local prayer note from this browser?')) {
      try { localStorage.removeItem(STORAGE.journal); } catch {}
      if (journal) journal.value = '';
      updateJournalCount();
      if (journalSavedState) journalSavedState.textContent = 'Not saved';
      if (journalStatus) {
        journalStatus.textContent = 'The local note was deleted from this browser profile.';
        journalStatus.className = 'status ok';
      }
    }
  });

  $('exportJournalBtn')?.addEventListener('click', () => {
    const record = {
      schema: 'jcs-private-prayer-journal-v1',
      exported_at_utc: new Date().toISOString(),
      stored_locally_only: true,
      note: journal?.value || '',
      warning: 'This export is private. Do not publish sensitive personal information or wallet secrets.'
    };
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jcs-private-prayer-journal-${todayKey()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  // Daily practice and Prayer Garden. A practice record is device-local and
  // expires after one rolling day of inactivity (and at the next calendar day).
  const PRACTICE_WINDOW_MS = 24 * 60 * 60 * 1000;
  const newPracticeRecord = () => {
    const now = Date.now();
    return { date: todayKey(), items: {}, startedAt: now, lastTouchedAt: now };
  };
  const practiceIsStale = value => {
    const lastTouched = Number(value?.lastTouchedAt || value?.startedAt || 0);
    return !value || value.date !== todayKey() || !Number.isFinite(lastTouched) ||
      lastTouched <= 0 || Date.now() - lastTouched >= PRACTICE_WINDOW_MS ||
      !value.items || typeof value.items !== 'object' || Array.isArray(value.items);
  };
  let practice = safeRead(STORAGE.practice, null);
  if (practiceIsStale(practice)) {
    practice = newPracticeRecord();
    safeWrite(STORAGE.practice, practice);
  }

  function practiceResetHint() {
    let hint = $('practiceResetHint');
    if (!hint) {
      hint = document.createElement('p');
      hint.id = 'practiceResetHint';
      hint.className = 'hint practice-reset-hint';
      hint.setAttribute('aria-live', 'polite');
      const head = $('practiceProgress')?.closest('.practice-head');
      head?.insertAdjacentElement('afterend', hint);
    }
    return hint;
  }

  function formatPracticeRemaining(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    if (totalMinutes >= 120) return Math.ceil(totalMinutes / 60) + ' hours';
    return totalMinutes + ' minutes';
  }

  function updatePracticeHint() {
    const hint = practiceResetHint();
    if (!hint) return;
    const lastTouched = Number(practice.lastTouchedAt || practice.startedAt);
    const remaining = PRACTICE_WINDOW_MS - (Date.now() - lastTouched);
    hint.textContent = remaining > 0
      ? 'This daily practice resets in ' + formatPracticeRemaining(remaining) + '.'
      : 'Daily practice is ready to reset.';
  }

  function refreshPracticeFromClock() {
    if (practiceIsStale(practice)) {
      practice = newPracticeRecord();
      safeWrite(STORAGE.practice, practice);
      renderPractice();
      return;
    }
    updatePracticeHint();
  }

  function renderPractice() {
    const buttons = [...document.querySelectorAll('.practice-toggle')];
    let completed = 0;
    buttons.forEach(button => {
      const active = Boolean(practice.items[button.dataset.practice]);
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
      if (active) completed += 1;
    });
    if ($('practiceProgress')) $('practiceProgress').textContent = completed + ' / ' + buttons.length;
    const garden = $('prayerGarden');
    if (garden) {
      garden.dataset.growth = String(completed);
      garden.setAttribute('aria-label', 'Prayer Garden with ' + completed + ' of ' + buttons.length + ' local daily actions completed');
    }
    updatePracticeHint();
  }

  document.querySelectorAll('.practice-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.practice;
      practice.items[key] = !practice.items[key];
      practice.lastTouchedAt = Date.now();
      safeWrite(STORAGE.practice, practice);
      renderPractice();
    });
  });
  $('resetPracticeBtn')?.addEventListener('click', () => {
    practice = newPracticeRecord();
    safeWrite(STORAGE.practice, practice);
    renderPractice();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshPracticeFromClock();
  });
  window.addEventListener('pageshow', refreshPracticeFromClock);
  window.addEventListener('focus', refreshPracticeFromClock);
  window.setInterval(refreshPracticeFromClock, 60000);
  renderPractice();

  // Local prompt reactions: deliberately not presented as global social counts.
  let reactions = safeRead(STORAGE.reactions, { date: todayKey(), values: {} });
  if (reactions.date !== todayKey()) reactions = { date: todayKey(), values: {} };

  function reactionKey(button) {
    return `${button.closest('[data-prompt]')?.dataset.prompt || 'prompt'}:${button.dataset.reaction || 'reaction'}`;
  }

  function renderReactions() {
    document.querySelectorAll('.local-reaction').forEach(button => {
      const active = Boolean(reactions.values[reactionKey(button)]);
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const count = button.querySelector('span');
      if (count) count.textContent = active ? '1' : '0';
    });
  }

  document.querySelectorAll('.local-reaction').forEach(button => {
    button.addEventListener('click', () => {
      const key = reactionKey(button);
      reactions.values[key] = !reactions.values[key];
      safeWrite(STORAGE.reactions, reactions);
      renderReactions();
      const status = $('fellowshipStatus');
      if (status) {
        status.textContent = 'Your response was saved only on this device. Use Sign the Ledger for a deliberate public action.';
        status.className = 'status ok';
      }
    });
  });
  renderReactions();

  function setQuietMode(active, options = {}) {
    document.body.classList.toggle('quiet-mode', active);
    const buttons = [$('quietModeBtn'), $('sabbathModeBtn')].filter(Boolean);
    buttons.forEach(button => {
      button.setAttribute('aria-pressed', String(active));
      if (button.id === 'quietModeBtn') button.textContent = active ? 'Exit quiet mode' : 'Quiet mode';
    });
    if (!options.skipStorage) safeWrite(STORAGE.quiet, { active });
    if (active) {
      window.__jcsSuspendSacredMedia?.('Quiet mode enabled');
      document.querySelector('#scripture')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const storedQuiet = safeRead(STORAGE.quiet, { active: false });
  setQuietMode(Boolean(storedQuiet.active), { skipStorage: true });
  $('quietModeBtn')?.addEventListener('click', () => setQuietMode(!document.body.classList.contains('quiet-mode')));
  $('sabbathModeBtn')?.addEventListener('click', () => setQuietMode(!document.body.classList.contains('quiet-mode')));
}());
