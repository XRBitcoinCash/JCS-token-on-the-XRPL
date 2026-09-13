(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const ISSUER = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
  const NETWORK = 'XRP Ledger Mainnet';
  const RECEIPT_KEY = 'jcs.validatedReceipts.v1';
  let lastEvidenceAt = 0;

  function safeJsonRead(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch { return fallback; }
  }
  function safeJsonWrite(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }
  function clean(value) { return String(value ?? '').trim(); }
  function numberFrom(text) {
    const match = String(text || '').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }
  function setPortalMode(mode) {
    const exchange = mode === 'exchange';
    document.body.classList.toggle('exchange-focus', exchange);
    const exchangeBtn = $('exchangeFocusBtn');
    exchangeBtn?.setAttribute('aria-pressed', String(exchange));
    if (exchangeBtn) exchangeBtn.textContent = exchange ? 'Exit exchange focus' : 'Exchange focus';

    if (exchange && document.body.classList.contains('quiet-mode')) {
      $('quietModeBtn')?.click();
    }
    if (!exchange && mode === 'full') {
      document.body.classList.remove('exchange-focus');
      exchangeBtn?.setAttribute('aria-pressed','false');
      if (exchangeBtn) exchangeBtn.textContent = 'Exchange focus';
    }
    try { localStorage.setItem('jcs.portalFocus.v1', exchange ? 'exchange' : 'full'); } catch {}
    updateIntegrity();
  }

  $('exchangeFocusBtn')?.addEventListener('click', () => {
    setPortalMode(document.body.classList.contains('exchange-focus') ? 'full' : 'exchange');
  });
  ['quietModeBtn','sabbathModeBtn'].forEach(id => {
    $(id)?.addEventListener('click', () => {
      if (document.body.classList.contains('exchange-focus')) setPortalMode('full');
      window.setTimeout(updateIntegrity,0);
    });
  });

  try {
    if (localStorage.getItem('jcs.portalFocus.v1') === 'exchange') setPortalMode('exchange');
  } catch {}

  // Private-note screen shield. It is intentionally a visual control only.
  const journalCard = $('privatePrayerJournal')?.closest('.fellowship-composer');
  function setJournalShield(active) {
    if (!journalCard) return;
    journalCard.classList.toggle('journal-shielded', active);
    const btn = $('journalShieldBtn');
    btn?.setAttribute('aria-pressed', String(active));
    if (btn) btn.textContent = active ? 'Reveal private note' : 'Shield private note';
  }
  $('journalShieldBtn')?.addEventListener('click', () => {
    setJournalShield(!journalCard?.classList.contains('journal-shielded'));
  });
  window.addEventListener('blur', () => setJournalShield(true));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) setJournalShield(true);
  });

  function evidenceText(id, fallback='Unavailable') {
    const text = clean($(id)?.textContent);
    return text && text !== '—' ? text : fallback;
  }
  // Freshness follows successful ledger reads, never unrelated DOM changes.
  window.addEventListener('jcs:market-snapshot', event => {
    if (event.detail?.validated && Number(event.detail.priceXrpPerJcs) > 0) {
      const at = Number(event.detail.observedAt) || Date.parse(event.detail.observedAt);
      if (Number.isFinite(at)) lastEvidenceAt = at;
    }
    updateIntegrity();
  });
  document.addEventListener('jcs:wallet-changed', updateIntegrity);

  function updateIntegrity() {
    const mode = document.body.classList.contains('quiet-mode')
      ? 'Sanctuary mode'
      : document.body.classList.contains('exchange-focus')
        ? 'Exchange focus'
        : 'Full portal';
    if ($('integrityPortalMode')) $('integrityPortalMode').textContent = mode;
    if ($('integrityWalletState')) $('integrityWalletState').textContent =
      clean($('walletPill')?.textContent) || 'Not connected';
    if ($('integrityLedgerState')) $('integrityLedgerState').textContent =
      evidenceText('jcsLedgerMini','Awaiting validated evidence');

    if ($('integrityQuoteAge')) {
      if (!lastEvidenceAt) $('integrityQuoteAge').textContent = 'Awaiting market evidence';
      else {
        const minutes = Math.floor((Date.now()-lastEvidenceAt)/60000);
        const time = new Date(lastEvidenceAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
        $('integrityQuoteAge').textContent = minutes < 2 ? `Updated ${time} · every 60 seconds` : `Last read ${time} · waiting for update`;
      }
    }

    const receipts = safeJsonRead(RECEIPT_KEY, []);
    const latest = Array.isArray(receipts) ? receipts[0] : null;
    if ($('integrityLastReceipt')) {
      $('integrityLastReceipt').textContent = latest?.txid
        ? `${latest.kind} · ${latest.txid.slice(0,10)}…`
        : 'None this browser session';
    }
    if ($('downloadLatestReceiptBtn')) $('downloadLatestReceiptBtn').disabled = !latest;
  }
  window.setInterval(() => { if (!document.hidden) updateIntegrity(); },60000);
  updateIntegrity();

  async function sha256Hex(text) {
    if (!crypto?.subtle) return '';
    const bytes = new TextEncoder().encode(String(text));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function canonicalIntentRecord() {
    const side = clean($('side')?.value) || 'buy';
    const amountJcs = Number($('amount')?.value || 0) || null;
    const price = Number($('price')?.value || 0) || numberFrom($('tradeLivePrice')?.textContent);
    const estimatedXrp = amountJcs && price ? amountJcs * price : null;
    const includeWallet = Boolean($('intentIncludeWallet')?.checked);
    return {
      schema:'jcs-pre-sign-intent-v1',
      created_at_utc:new Date().toISOString(),
      purpose:'Local pre-sign evidence record only; does not create, sign or submit a transaction.',
      network:NETWORK,
      asset:{name:'Jesus Christ Saves Token',symbol:'JCS',issuer:ISSUER},
      wallet:includeWallet ? (clean(window.__jcsWallet) || null) : null,
      intent:{side,amount_jcs:amountJcs,reference_price_xrp_per_jcs:price||null,estimated_xrp_total:estimatedXrp},
      protections:{
        xaman_review_required:true,
        six_digit_verification_memo:true,
        market_estimate_drift_cap_percent:2,
        market_order_fill_or_kill:true,
        finality_required:'validated ledger + tesSUCCESS'
      },
      observed_ui:{
        ledger:evidenceText('jcsLedgerMini',null),
        spot:evidenceText('jcsSpot',null),
        amm:evidenceText('jcsAmm',null),
        spread:evidenceText('jcsSpread',null),
        quote_note:evidenceText('tradeQuoteNote',null),
        observed_at_utc:lastEvidenceAt ? new Date(lastEvidenceAt).toISOString() : null
      },
      faith_finance_boundary:'Prayer, Scripture, testimony, daily practice and fellowship activity do not unlock, rank, reward, discount or personalize financial actions.',
      limitation:'Market data can change after this record is created. Verify the exact transaction in Xaman and the final result on a validated XRP Ledger.'
    };
  }
  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1200);
  }
  async function downloadIntent() {
    const record = canonicalIntentRecord();
    const canonical = JSON.stringify(record);
    const hash = await sha256Hex(canonical);
    const out = {...record, sha256:hash || null};
    downloadJson(`jcs-pre-sign-intent-${Date.now()}.json`, out);
    if ($('intentPassportStatus')) {
      $('intentPassportStatus').textContent = hash
        ? `Local intent passport downloaded · SHA-256 ${hash.slice(0,16)}…`
        : 'Local intent passport downloaded. Web Crypto digest was unavailable in this browser.';
    }
  }
  $('downloadJcsIntentBtn')?.addEventListener('click', downloadIntent);
  $('downloadTradeIntentBtn')?.addEventListener('click', downloadIntent);

  document.addEventListener('jcs:validated-transaction', event => {
    const detail = event.detail || {};
    if (!detail.txid) return;
    const record = {
      schema:'jcs-validated-transaction-receipt-v1',
      validated_at_utc:new Date().toISOString(),
      network:NETWORK,
      asset:{symbol:'JCS',issuer:ISSUER},
      ...detail,
      limitation:'This receipt records a validated transaction reference. Transaction metadata must still be interpreted in context to determine the exact ledger effect.'
    };
    const list = safeJsonRead(RECEIPT_KEY, []);
    const next = [record, ...(Array.isArray(list)?list:[]).filter(item=>item?.txid!==record.txid)].slice(0,10);
    safeJsonWrite(RECEIPT_KEY,next);
    updateIntegrity();
  });
  $('downloadLatestReceiptBtn')?.addEventListener('click', () => {
    const list = safeJsonRead(RECEIPT_KEY, []);
    const latest = Array.isArray(list) ? list[0] : null;
    if (latest) downloadJson(`jcs-validated-receipt-${latest.txid}.json`,latest);
  });

  // Keep visible mode label aligned with existing quiet-mode implementation.
  const quiet = $('quietModeBtn');
  if (quiet) {
    const observer = new MutationObserver(() => {
      if (!document.body.classList.contains('quiet-mode') && !document.body.classList.contains('exchange-focus')) {
        quiet.textContent='Sanctuary mode';
        quiet.setAttribute('aria-pressed','false');
      } else if (document.body.classList.contains('quiet-mode')) {
        quiet.textContent='Exit sanctuary mode';
      }
      updateIntegrity();
    });
    observer.observe(document.body,{attributes:true,attributeFilter:['class']});
  }
})();
