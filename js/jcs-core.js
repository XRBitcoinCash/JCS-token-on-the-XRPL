(function () {
  'use strict';

  const JCS_RELEASE = '3.0.0';

  window.addEventListener('error', (event) => {
    console.error('Jesus Christ Saves Token runtime error:', event.error || event.message);
    const status = document.getElementById('tradeMsg');
    if (status && !status.classList.contains('ok')) {
      status.textContent =
        'The Jesus Christ Saves Token interface encountered an error. Refresh the page and try again.';
      status.classList.remove('connecting', 'ok');
      status.classList.add('err');
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('Jesus Christ Saves Token unhandled promise rejection:', event.reason);
  });

  function safeJson(elId) {
    try {
      const el = document.getElementById(elId);
      if (!el) return {};
      return JSON.parse(el.textContent || el.innerText || '{}') || {};
    } catch {
      return {};
    }
  }

  const cfg = safeJson('app-config');

  const XRPL_WSS = String(cfg.xrplWs || 'wss://xrplcluster.com').trim();
  const XUMM_API_KEY = (cfg.xummApiKey || '').trim();
  const ASSET = cfg.asset || {};
  const CURRENCY_HEX = String(ASSET.currencyHex || '').toUpperCase();
  const ISSUER = (ASSET.issuer || '').trim();
  const normalizeHexCurrency = (value) =>
    String(value || '').toUpperCase().replace(/0+$/, '');
  const CURRENCY_HEX_NORM = normalizeHexCurrency(CURRENCY_HEX);

  const XRP_TO_DROPS = 1000000;
  const SLIPPAGE_PCT = 2;
  const RESERVE_BUFFER_XRP = 1.0;

  if (!XRPL_WSS) console.warn('XRPL WebSocket URL missing');
  if (!ISSUER || !CURRENCY_HEX) console.warn('Asset config missing');
  const $ = id => document.getElementById(id);

  const walletStatus = $('walletStatus');
  const trustlineMsg = $('trustlineMsg');
  const headerConnectBtn = $('connectBtn');
  const headerDisconnectBtn = $('disconnectBtn');
  const bodyConnectBtn = $('connectWalletBtn');
  const bodyDisconnectBtn = $('disconnectWalletBtn');
  const connectButtons = [headerConnectBtn, bodyConnectBtn].filter(Boolean);
  const disconnectButtons = [headerDisconnectBtn, bodyDisconnectBtn].filter(Boolean);
  const connectBtn = bodyConnectBtn || headerConnectBtn;
  const disconnectBtn = bodyDisconnectBtn || headerDisconnectBtn;
  const walletPill = $('walletPill');
  const setTrustBtn = $('setTrustlineBtn');
  const logEl = $('log');
  const resultBox = $('resultBox');

  const walletStepConnect = $('walletStepConnect');
  const walletStepTrust = $('walletStepTrust');
  const walletStepTrade = $('walletStepTrade');
  const tradeWalletSummary = $('tradeWalletSummary');
  const tradeXrpBalance = $('tradeXrpBalance');
  const tradeJcsBalance = $('tradeJcsBalance');
  const tradeLivePrice = $('tradeLivePrice');
  const tradePayLabel = $('tradePayLabel');
  const tradePayValue = $('tradePayValue');
  const tradeReceiveLabel = $('tradeReceiveLabel');
  const tradeReceiveValue = $('tradeReceiveValue');
  const tradeQuoteNote = $('tradeQuoteNote');
  const quickAmountMode = $('quickAmountMode');

  const xamanSignPanel = $('xamanSignPanel');
  const xamanSignTitle = $('xamanSignTitle');
  const xamanSignStatus = $('xamanSignStatus');
  const xamanOpenPayload = $('xamanOpenPayload');
  const xamanPayloadQr = $('xamanPayloadQr');
  const xamanQrPlaceholder = $('xamanQrPlaceholder');
  const xamanClosePanel = $('xamanClosePanel');

  (function initDownloadPopover() {
    const wrap = document.querySelector('.dl-wrap');
    const downloadBtn = $('btnDownloadXaman');
    const popover = $('downloadPopover');
    const qrImage = $('downloadQr');

    if (!wrap || !downloadBtn || !popover) return;

    const downloadUrl = 'https://xaman.app/download';
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    if (qrImage && !qrImage.src) {
      qrImage.src =
        'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' +
        encodeURIComponent(downloadUrl);
    }

    const open = () => {
      popover.hidden = false;
      popover.classList.add('open');
      popover.setAttribute('aria-hidden', 'false');
      downloadBtn.setAttribute('aria-expanded', 'true');
    };

    const close = () => {
      popover.classList.remove('open');
      popover.setAttribute('aria-hidden', 'true');
      downloadBtn.setAttribute('aria-expanded', 'false');
      window.setTimeout(() => {
        if (!popover.classList.contains('open')) popover.hidden = true;
      }, 180);
    };

    downloadBtn.addEventListener('click', (event) => {
      if (isMobile) {
        window.location.href = downloadUrl;
        return;
      }

      event.preventDefault();
      popover.classList.contains('open') ? close() : open();
    });

    document.addEventListener('click', (event) => {
      if (!popover.hidden && !wrap.contains(event.target)) close();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popover.hidden) close();
    });
  })();

  function log(msg) {
    if (!logEl) return;
    logEl.textContent += msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setStatus(el, msg, cls) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('ok', 'err');
    if (cls) el.classList.add(cls);
    if (el === walletStatus) log('[wallet] ' + msg);
    if (el === $('tradeMsg')) log('[trade] ' + msg);
    if (el === $('offersStatus')) log('[offers] ' + msg);
    if (el === $('healthStatus')) log('[health] ' + msg);
    if (el === $('buyStatus')) log('[buy] ' + msg);
  }

  function setResult(msg) {
    if (!resultBox) return;
    resultBox.textContent = msg;
    log('[result] ' + msg);
  }

  function setReadyStep(element, ready) {
    if (!element) return;
    element.classList.toggle('ready', !!ready);
    const number = element.querySelector('.wallet-step-number');
    if (number) {
      number.textContent = ready ? '✓' : (number.dataset.original || '');
    }
  }

  function shortAccount(account) {
    const value = String(account || '');
    if (value.length < 18) return value || 'Not connected';
    return value.slice(0, 8) + '…' + value.slice(-6);
  }

  const xamanReopenPanel = $('xamanReopenPanel');
  const xamanShowQr = $('xamanShowQr');
  const xamanQrArea = $('xamanQrArea');
  const xamanSignSummary = $('xamanSignSummary');
  const xamanSignHelp = $('xamanSignHelp');
  const xamanMobile = /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let xamanReturnFocus = null;
  let xamanHasRequest = false;

  function setXamanSignStatus(message, state) {
    if (!xamanSignStatus) return;
    xamanSignStatus.textContent = message;
    xamanSignStatus.dataset.state = state || '';
    if (['signed', 'rejected', 'expired', 'error'].includes(state)) {
      if (xamanOpenPayload) { xamanOpenPayload.hidden = true; xamanOpenPayload.removeAttribute('href'); }
      if (xamanPayloadQr) { xamanPayloadQr.hidden = true; xamanPayloadQr.removeAttribute('src'); }
      if (xamanQrArea) xamanQrArea.hidden = true;
      if (xamanShowQr) xamanShowQr.hidden = true;
      setSecurityCodeDisplay(null);
      if (xamanClosePanel) xamanClosePanel.textContent = 'Close';
      if (xamanReopenPanel) xamanReopenPanel.textContent = 'View Xaman result';
      if (xamanSignHelp) xamanSignHelp.textContent = state === 'signed'
        ? 'The request was signed. The page checks the XRP Ledger separately before reporting a successful transaction.'
        : 'Check the request outcome in Xaman before starting again. Hiding this window does not cancel a wallet request.';
    }
  }

  function openXamanSignPanel() {
    if (!xamanSignPanel || !xamanHasRequest) return;
    xamanSignPanel.hidden = false;
    if (!xamanSignPanel.open) {
      if (typeof xamanSignPanel.showModal === 'function') xamanSignPanel.showModal();
      else xamanSignPanel.setAttribute('open', '');
    }
    if (xamanReopenPanel) xamanReopenPanel.hidden = true;
    const focusTarget = xamanMobile && xamanOpenPayload && !xamanOpenPayload.hidden
      ? xamanOpenPayload : xamanSignTitle;
    focusTarget?.focus({ preventScroll: true });
  }

  // Hide is deliberately not Cancel: an already-open request can still be signed in Xaman.
  function closeXamanSignPanel() {
    if (xamanSignPanel) {
      if (typeof xamanSignPanel.close === 'function' && xamanSignPanel.open) xamanSignPanel.close();
      xamanSignPanel.removeAttribute('open');
      xamanSignPanel.hidden = true;
    }
    if (xamanReopenPanel) xamanReopenPanel.hidden = !xamanHasRequest;
    if (xamanReturnFocus?.isConnected && !xamanReturnFocus.closest('[hidden]')) xamanReturnFocus.focus({ preventScroll: true });
  }

  function officialXamanUrl(value, uuid) {
    try {
      const url = new URL(String(value || ''));
      if (url.protocol !== 'https:' || !['xumm.app', 'xaman.app'].includes(url.hostname) ||
          url.username || url.password || (url.port && url.port !== '443') ||
          !url.pathname.startsWith('/sign/' + uuid)) return '';
      const suffix = url.pathname.slice(('/sign/' + uuid).length);
      if (suffix && !/^(?:[/_?])/.test(suffix)) return '';
      return url.href;
    } catch { return ''; }
  }

  function showXamanSignRequest(created, code, purpose, transaction = {}) {
    if (!xamanSignPanel) throw new Error('The signing dialog is unavailable.');
    const uuid = String(created?.uuid || created?.payload_uuidv4 || '');
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(uuid)) throw new Error('Xaman returned an invalid request identifier.');
    const deepLink = officialXamanUrl(created?.next?.always, uuid) || 'https://xumm.app/sign/' + uuid;
    const qr = officialXamanUrl(created?.refs?.qr_png, uuid);
    const labels = {
      trust: 'Add JCS trustline', offer: 'Review JCS limit order', swap: 'Review JCS market swap',
      cancel: 'Cancel JCS order', quickbuy: 'Review JCS quick buy',
      'liquidity-add': 'Approve liquidity deposit', 'liquidity-remove': 'Approve liquidity withdrawal'
    };
    xamanReturnFocus = document.activeElement;
    xamanHasRequest = true;
    if (xamanSignTitle) xamanSignTitle.textContent = labels[purpose] || 'Review in Xaman';
    if (xamanClosePanel) xamanClosePanel.textContent = 'Hide';
    if (xamanReopenPanel) xamanReopenPanel.textContent = 'View Xaman request';
    if (xamanSignHelp) xamanSignHelp.textContent = 'Hiding this window keeps the request active. Complete or reject it in Xaman, then return to this page.';
    if (xamanSignSummary) {
      const rows = [['Network', 'XRP Ledger · Mainnet'], ['Wallet', transaction.Account || currentAccount || 'Connected wallet']];
      const exactXrp = value => {
        if (!/^\d+$/.test(String(value))) return String(value);
        const n = BigInt(value); return (n / 1000000n).toString() + '.' + (n % 1000000n).toString().padStart(6, '0') + ' XRP';
      };
      if (transaction.TransactionType === 'AMMDeposit') {
        rows.push(['Maximum XRP', exactXrp(transaction.Amount)], ['Maximum JCS', String(transaction.Amount2?.value || '') + ' JCS']);
      } else if (transaction.TransactionType === 'AMMWithdraw') rows.push(['LP tokens to redeem', String(transaction.LPTokenIn?.value || '')]);
      if (transaction.Fee) rows.push(['Network fee', exactXrp(transaction.Fee)]);
      if (transaction.LastLedgerSequence) rows.push(['Last eligible ledger', '#' + transaction.LastLedgerSequence]);
      xamanSignSummary.replaceChildren(...rows.map(([label, value]) => {
        const row = document.createElement('div'), term = document.createElement('dt'), detail = document.createElement('dd');
        term.textContent = label; detail.textContent = value; row.append(term, detail); return row;
      }));
    }
    if (xamanPayloadQr) {
      xamanPayloadQr.hidden = !qr;
      xamanPayloadQr.removeAttribute('src');
      if (qr) xamanPayloadQr.src = qr;
    }
    if (xamanQrPlaceholder) {
      xamanQrPlaceholder.hidden = !!qr;
      xamanQrPlaceholder.textContent = 'QR unavailable. Use Open in Xaman to open the official signing page.';
    }
    if (xamanQrArea) xamanQrArea.hidden = xamanMobile;
    if (xamanShowQr) { xamanShowQr.hidden = !xamanMobile; xamanShowQr.setAttribute('aria-expanded', 'false'); }
    if (xamanOpenPayload) {
      xamanOpenPayload.href = deepLink;
      xamanOpenPayload.target = xamanMobile ? '_self' : '_blank';
      xamanOpenPayload.textContent = xamanMobile ? 'Open in Xaman to sign' : 'Open Xaman signing page';
      xamanOpenPayload.hidden = false;
    }
    setSecurityCodeDisplay(code);
    setXamanSignStatus(xamanMobile
      ? 'Tap Open in Xaman to review and sign this exact request. Return here afterward for the ledger result.'
      : 'Scan this QR code with Xaman on your phone, then review and sign. A wallet notification may also arrive.', 'pending');
    openXamanSignPanel();
  }

  xamanClosePanel?.addEventListener('click', closeXamanSignPanel);
  xamanReopenPanel?.addEventListener('click', openXamanSignPanel);
  xamanSignPanel?.addEventListener('cancel', event => { event.preventDefault(); closeXamanSignPanel(); });
  xamanShowQr?.addEventListener('click', () => {
    if (!xamanQrArea) return;
    xamanQrArea.hidden = !xamanQrArea.hidden;
    xamanShowQr.setAttribute('aria-expanded', String(!xamanQrArea.hidden));
  });
  xamanPayloadQr?.addEventListener('error', () => {
    xamanPayloadQr.hidden = true;
    if (xamanQrPlaceholder) { xamanQrPlaceholder.hidden = false; xamanQrPlaceholder.textContent = 'The QR image could not load. Open the Xaman signing page instead.'; }
  });

  function toDrops(xrp) {
    return Math.round(Number(xrp) * XRP_TO_DROPS).toString();
  }

  function genCode() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }

  function asciiToHex(str) {
    let out = '';
    for (let i = 0; i < str.length; i++) {
      const h = str.charCodeAt(i).toString(16).toUpperCase();
      out += (h.length === 1 ? '0' : '') + h;
    }
    return out;
  }

  function hexToAsciiSymbol(hex) {
    if (!hex) return '';
    let out = '';
    for (let i = 0; i < hex.length; i += 2) {
      const b = parseInt(hex.slice(i, i + 2), 16);
      if (!Number.isFinite(b) || b <= 0) break;
      out += String.fromCharCode(b);
    }
    return out.replace(/[^\x20-\x7E]/g, '');
  }

  function nowIso() {
    try { return new Date().toISOString(); } catch { return ''; }
  }

  function originForMemo() {
    try { return location.origin + location.pathname; } catch { return ''; }
  }
  const TOKEN_META = {
    'JCS': {
      ticker: 'JCS',
      name: 'Jesus Christ Saves Token',
      logo: 'https://jesuschristsavestoken.com/jcs-logo.png',
      source: 'Jesus Christ Saves Token project'
    }
  };

  const XRPL_META_BASE = 'https://s1.xrplmeta.org/v2/token/';
  const TOKEN_METADATA_STORAGE_KEY = 'jcs.tokenMetadata.v2';
  const TOKEN_METADATA_TTL_MS = 24 * 60 * 60 * 1000;
  const TOKEN_METADATA_MISS_TTL_MS = 60 * 60 * 1000;
  const TOKEN_METADATA_TIMEOUT_MS = 6000;
  const tokenMetadataCache = new Map();

  function decodeCurrencyHex(hex) {
    if (!hex) return null;
    if (/^[A-Z0-9]{3}$/.test(String(hex).toUpperCase())) {
      return String(hex).toUpperCase();
    }
    let trimmed = hex.replace(/0+$/,'');
    if (!trimmed || trimmed.length % 2 !== 0) return null;
    let out = '';
    for (let i = 0; i < trimmed.length; i += 2) {
      const code = parseInt(trimmed.slice(i, i + 2), 16);
      if (!Number.isFinite(code) || code < 0x21 || code > 0x7E) return null;
      out += String.fromCharCode(code);
    }
    if (!out.trim()) return null;
    if (out.length > 12) return null;
    return out;
  }

  function getDisplayTicker(hex, issuer) {
    if (!hex) return 'IOU';
    const meta = TOKEN_META[hex];
    if (meta && meta.ticker) return meta.ticker;

    const cached = tokenMetadataCache.get((hex || '') + '|' + (issuer || ''));
    if (cached && cached.ticker) return cached.ticker;

    const decoded = decodeCurrencyHex(hex);
    if (decoded) return decoded;
    return hex.slice(0, 6);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function fallbackIconForToken(hex, issuer) {
    const label = (getDisplayTicker(hex, issuer) || '?').slice(0, 4);
    const safeLabel = escapeHtml(label);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect width="32" height="32" rx="7" fill="#071427"/>' +
        '<circle cx="16" cy="16" r="14" fill="none" stroke="#38bdf8" stroke-width="1.5"/>' +
        '<text x="50%" y="56%" font-size="8" font-weight="700" text-anchor="middle" fill="#7dd3fc" font-family="system-ui,-apple-system,sans-serif">' +
        safeLabel +
        '</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function iconUrlForToken(hex, issuer) {
    const local = TOKEN_META[hex];
    if (local && local.logo) return local.logo;

    const cached = tokenMetadataCache.get((hex || '') + '|' + (issuer || ''));
    if (cached && cached.icon) return cached.icon;

    return fallbackIconForToken(hex, issuer);
  }

  function readStoredTokenMetadata() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TOKEN_METADATA_STORAGE_KEY) || '{}');
      const now = Date.now();

      Object.entries(parsed).forEach(([key, value]) => {
        if (!value || typeof value !== 'object') return;
        if (!Number.isFinite(value.expiresAt) || value.expiresAt <= now) return;
        tokenMetadataCache.set(key, value);
      });
    } catch {}
  }

  function writeStoredTokenMetadata() {
    try {
      const now = Date.now();
      const stored = {};

      tokenMetadataCache.forEach((value, key) => {
        if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= now) return;
        stored[key] = value;
      });

      localStorage.setItem(TOKEN_METADATA_STORAGE_KEY, JSON.stringify(stored));
    } catch {}
  }

  function isAllowedMetadataIcon(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
      ) return false;
      return true;
    } catch {
      return false;
    }
  }

  function normalizeMetadataCurrency(value) {
    return String(value || '').trim().toUpperCase();
  }

  function metadataMatchesAsset(data, hex, issuer) {
    if (!data || String(data.issuer || '') !== issuer) return false;

    const returned = normalizeMetadataCurrency(data.currency);
    const requested = normalizeMetadataCurrency(hex);
    const decoded = normalizeMetadataCurrency(decodeCurrencyHex(requested));

    return returned === requested || (decoded && returned === decoded);
  }

  async function fetchTokenMetadata(hex, issuer) {
    const key = (hex || '') + '|' + (issuer || '');
    const local = TOKEN_META[hex];

    if (local && local.logo) {
      return {
        ticker: local.ticker || getDisplayTicker(hex, issuer),
        name: local.ticker || getDisplayTicker(hex, issuer),
        icon: local.logo,
        domain: '',
        trustLevel: null,
        source: local.source || 'Local project asset',
        expiresAt: Date.now() + TOKEN_METADATA_TTL_MS
      };
    }

    const existing = tokenMetadataCache.get(key);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.missing ? null : existing;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TOKEN_METADATA_TIMEOUT_MS);

    try {
      const identifier =
        encodeURIComponent(String(hex || '').toUpperCase()) +
        ':' +
        encodeURIComponent(String(issuer || ''));

      const response = await fetch(
        XRPL_META_BASE + identifier +
          '?decode_currency=false&original_icons=false',
        {
          method: 'GET',
          mode: 'cors',
          cache: 'force-cache',
          credentials: 'omit',
          headers: { Accept: 'application/json' },
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw new Error('Metadata HTTP ' + response.status);
      }

      const data = await response.json();
      if (!metadataMatchesAsset(data, hex, issuer)) {
        throw new Error('Metadata asset mismatch');
      }

      const tokenMeta = data.meta && data.meta.token ? data.meta.token : {};
      const issuerMeta = data.meta && data.meta.issuer ? data.meta.issuer : {};
      const iconCandidate = tokenMeta.icon || issuerMeta.icon || '';
      const icon = isAllowedMetadataIcon(iconCandidate) ? iconCandidate : '';
      const decodedTicker = decodeCurrencyHex(hex) || String(data.currency || '') || hex.slice(0, 6);

      const resolved = {
        ticker: decodedTicker,
        name: String(tokenMeta.name || decodedTicker || '').trim(),
        icon,
        domain: String(issuerMeta.domain || '').trim(),
        trustLevel: Number.isFinite(Number(tokenMeta.trust_level))
          ? Number(tokenMeta.trust_level)
          : null,
        source: 'Issuer TOML metadata via XRPL Meta',
        missing: !icon,
        expiresAt: Date.now() + (icon ? TOKEN_METADATA_TTL_MS : TOKEN_METADATA_MISS_TTL_MS)
      };

      tokenMetadataCache.set(key, resolved);
      writeStoredTokenMetadata();
      return icon ? resolved : null;
    } catch (error) {
      const missed = {
        missing: true,
        expiresAt: Date.now() + TOKEN_METADATA_MISS_TTL_MS
      };
      tokenMetadataCache.set(key, missed);
      writeStoredTokenMetadata();
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function hydrateTokenMetadata(rows) {
    if (!Array.isArray(rows) || !rows.length) return rows || [];

    const queue = rows.filter(row => row && row.hex && row.issuer);
    let cursor = 0;
    const workerCount = Math.min(4, queue.length);

    async function worker() {
      while (cursor < queue.length) {
        const index = cursor++;
        const row = queue[index];
        const resolved = await fetchTokenMetadata(row.hex, row.issuer);

        if (!resolved) {
          row.icon = iconUrlForToken(row.hex, row.issuer);
          row.iconSource = TOKEN_META[row.hex]
            ? 'Local project asset'
            : 'Generated fallback';
          continue;
        }

        row.icon = resolved.icon || iconUrlForToken(row.hex, row.issuer);
        row.projectName = resolved.name || row.label;
        row.projectDomain = resolved.domain || '';
        row.iconSource = resolved.source || 'XRPL metadata';
        row.trustLevel = resolved.trustLevel;
      }
    }

    await Promise.all(
      Array.from({ length: workerCount }, () => worker())
    );

    return rows;
  }

  readStoredTokenMetadata();

  const CURRENCY_ASCII = hexToAsciiSymbol(CURRENCY_HEX);
  const APP_NAME = (cfg.appName || CURRENCY_ASCII || 'Jesus Christ Saves Token').trim() || 'Jesus Christ Saves Token';

  const SENTINEL_PREFIX = (cfg.sentinelPrefix || 'JCS').toUpperCase();

  const SENTINEL_VERSION = 'v1';

  function appIdFromPath(p) {
    try {
      const name = (p || location.pathname).split('/').filter(Boolean).pop() || 'index.html';
      return APP_NAME + ':' + name;
    } catch {
      return APP_NAME + ':index';
    }
  }

  function buildSentinelMemos(code) {
    const ctx = {
      v: SENTINEL_VERSION,
      ts: nowIso(),
      origin: originForMemo(),
      app_id: appIdFromPath(location.pathname)
    };
    return [
      { Memo: { MemoType: asciiToHex(SENTINEL_PREFIX + '-SENT'), MemoData: asciiToHex(code) } },
      { Memo: { MemoType: asciiToHex(SENTINEL_PREFIX + '-CTX'),  MemoData: asciiToHex(JSON.stringify(ctx)) } }
    ];
  }

  function setSecurityCodeDisplay(code) {
    const el = $('xamanSecurityCode');
    if (!el) return;

    const normalized = String(code || '').replace(/\D/g, '').slice(0, 6);

    if (normalized.length === 6) {
      el.textContent = 'Xaman security code: ' + normalized;
      el.hidden = false;
      el.classList.add('is-visible');
      el.classList.remove('err');
      el.style.setProperty('display', 'block', 'important');
      el.setAttribute('data-security-code', normalized);
    } else {
      el.textContent = '';
      el.hidden = true;
      el.classList.remove('is-visible');
      el.style.setProperty('display', 'none', 'important');
      el.removeAttribute('data-security-code');
    }
  }

  let sharedXrplClient = null;
  let sharedXrplConnecting = null;

  async function ensureXrplClient() {
    if (!window.xrpl || !window.xrpl.Client) {
      throw new Error('XRPL library is unavailable.');
    }
    if (sharedXrplClient && sharedXrplClient.isConnected()) {
      return sharedXrplClient;
    }
    if (sharedXrplConnecting) return sharedXrplConnecting;

    sharedXrplConnecting = (async () => {
      try {
        if (sharedXrplClient) {
          try { await sharedXrplClient.disconnect(); } catch {}
        }
        sharedXrplClient = new window.xrpl.Client(XRPL_WSS, {
          connectionTimeout: 10000
        });
        await sharedXrplClient.connect();
        return sharedXrplClient;
      } finally {
        sharedXrplConnecting = null;
      }
    })();

    return sharedXrplConnecting;
  }

  async function xrplRequest(payload, { timeoutMs = 15000 } = {}) {
    const method = String(payload?.method || payload?.command || '').trim();
    if (!method) throw new Error('XRPL method missing.');

    const firstParams = Array.isArray(payload?.params)
      ? (payload.params[0] || {})
      : (payload?.params || {});

    const request = { command: method, ...firstParams };
    const client = await ensureXrplClient();

    let timeoutId = null;
    try {
      const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error('XRPL request timed out.')),
          timeoutMs
        );
      });

      const response = await Promise.race([
        client.request(request),
        timeout
      ]);

      const result = response?.result || {};
      if (result.error || result.error_message) {
        throw new Error(result.error_message || result.error || 'XRPL error');
      }
      return response;
    } catch (error) {
      if (sharedXrplClient && !sharedXrplClient.isConnected()) {
        sharedXrplClient = null;
      }
      throw error;
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  window.__jcsXrplRequest = xrplRequest;

  window.addEventListener('pagehide', () => {
    try { sharedXrplClient && sharedXrplClient.disconnect(); } catch {}
  });

  async function call(method, params) {
    const base = { ...(params || {}), ledger_index: 'validated' };
    const r = await xrplRequest({ method, params: [base] });
    return r.result;
  }

  let xumm = null;
  let xamanAvailable = false;
  let xamanReady = false;
  let xamanAuthorizing = false;
  let currentAccount = null;
  let HAS_TRUSTLINE = false;
  let APP_INITIALIZED = false;
  const BAL = { xrp: 0, jcs: 0 };

  function scheduleAppRefresh() {
    window.setTimeout(() => {
      if (!APP_INITIALIZED) return;
      fetchBalances().catch(() => {});
      refreshAll({ force: true }).catch(() => {});
    }, 0);
  }

  function updateWalletButtons() {
    const connected = !!currentAccount;
    const allowTrade = connected && HAS_TRUSTLINE;
    const canConnect =
      xamanAvailable && xamanReady && !connected && !xamanAuthorizing;

    connectButtons.forEach((button) => {
      button.disabled = !canConnect;
      button.textContent = connected
        ? 'Xaman connected'
        : xamanAuthorizing
          ? 'Connecting…'
          : 'Connect Xaman';
    });

    disconnectButtons.forEach((button) => {
      button.disabled = !connected || xamanAuthorizing;
    });

    if (headerConnectBtn) headerConnectBtn.hidden = connected;
    if (headerDisconnectBtn) headerDisconnectBtn.hidden = !connected;

    if (walletPill) {
      walletPill.textContent = connected
        ? shortAccount(currentAccount, 9)
        : 'Wallet disconnected';
      walletPill.title = connected ? currentAccount : '';
    }

    if (setTrustBtn) {
      setTrustBtn.hidden = !connected;
      setTrustBtn.disabled = !connected || HAS_TRUSTLINE;
    }

    if ($('placeOfferBtn')) $('placeOfferBtn').disabled = !allowTrade;
    if ($('marketTradeBtn')) $('marketTradeBtn').disabled = !allowTrade;
    if ($('btnHealthScan')) $('btnHealthScan').disabled = !connected;

    setReadyStep(walletStepConnect, connected);
    setReadyStep(walletStepTrust, connected && HAS_TRUSTLINE);
    setReadyStep(walletStepTrade, allowTrade);

    if (tradeWalletSummary) {
      tradeWalletSummary.textContent = connected
        ? shortAccount(currentAccount)
        : 'Not connected';
      tradeWalletSummary.title = connected ? currentAccount : '';
    }

    if (!connected) {
      if (tradeXrpBalance) tradeXrpBalance.textContent = '—';
      if (tradeJcsBalance) tradeJcsBalance.textContent = '—';
      if ($('tradeMsg')) {
        setStatus(
          $('tradeMsg'),
          'Connect Xaman and confirm the JCS trustline to begin.'
        );
      }
    } else if (!HAS_TRUSTLINE) {
      setStatus(
        $('tradeMsg'),
        'Xaman is connected. Add the JCS trustline before trading.'
      );
    } else if (
      $('tradeMsg') &&
      (
        $('tradeMsg').textContent.includes('Connect Xaman') ||
        $('tradeMsg').textContent.includes('Add the JCS trustline')
      )
    ) {
      setStatus(
        $('tradeMsg'),
        'Ready. Select Buy or Sell, choose an amount, and review the request in Xaman.',
        'ok'
      );
    }
  }

  async function checkTrustline(acct) {
    try {
      if (!acct) return false;
      const r = await xrplRequest({
        method: 'account_lines',
        params: [{ account: acct, peer: ISSUER, ledger_index: 'validated', limit: 400 }]
      });
      const lines = (r.result && r.result.lines) || [];
      return lines.some((line) =>
        line.account === ISSUER &&
        normalizeHexCurrency(line.currency) === CURRENCY_HEX_NORM
      );
    } catch {
      return false;
    }
  }

  async function refreshTrustline() {
    if (!currentAccount) {
      HAS_TRUSTLINE = false;
      updateWalletButtons();
      return false;
    }

    HAS_TRUSTLINE = await checkTrustline(currentAccount);

    if (HAS_TRUSTLINE) {
      setStatus(trustlineMsg, '✅ JCS trustline present.', 'ok');
    } else {
      setStatus(
        trustlineMsg,
        'JCS trustline not found. Click “Add JCS Trustline”.'
      );
    }

    updateWalletButtons();
    return HAS_TRUSTLINE;
  }

  function setConnected(acct) {
    const account = String(acct || '').trim();
    if (!account) return;

    currentAccount = account;
    window.__jcsWallet = account;
    window.__jcsManualDisconnect = false;

    try { localStorage.setItem('jcsWallet', account); } catch {}

    setStatus(walletStatus, 'Connected: ' + account, 'ok');
    updateWalletButtons();

    refreshTrustline().catch(() => {});
    if ($('healthStatus')) refreshHealth().catch(() => {});
    document.dispatchEvent(new CustomEvent('jcs:wallet-changed', { detail: { account } }));
    scheduleAppRefresh();
  }

  function setDisconnected() {
    currentAccount = null;
    window.__jcsWallet = null;
    window.__jcsManualDisconnect = true;

    try { localStorage.removeItem('jcsWallet'); } catch {}

    HAS_TRUSTLINE = false;
    BAL.xrp = 0;
    BAL.jcs = 0;

    setStatus(walletStatus, 'Status: Not connected');
    setStatus(trustlineMsg, 'Connect Xaman to check the trustline.');

    closeXamanSignPanel();
    updateWalletButtons();
    document.dispatchEvent(new CustomEvent('jcs:wallet-changed', { detail: { account: null } }));
  }


  async function resolveXamanAccount(event = null) {
    const nested = event?.data || event || {};
    const direct =
      nested.account ||
      nested.me?.account ||
      nested.data?.account ||
      nested.user?.account ||
      '';

    if (direct) return String(direct).trim();

    try {
      const account = await xumm?.user?.account;
      return String(account || '').trim();
    } catch {
      return '';
    }
  }

  async function applyXamanIdentity(event = null) {
    const account = await resolveXamanAccount(event);
    if (!account) return false;
    setConnected(account);
    return true;
  }

  async function beginXamanConnection(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!xumm || !xamanAvailable) {
      setStatus(
        walletStatus,
        'The Xaman SDK is unavailable. Reload the page and try again.',
        'err'
      );
      return;
    }

    if (!xamanReady) {
      setStatus(walletStatus, 'Xaman is still loading. Try again in a moment.');
      return;
    }

    if (xamanAuthorizing || currentAccount) return;

    let authorization;

    try {
      /*
       * IMPORTANT: authorize() must be invoked directly inside the original
       * user click. Do not await account/session checks before this call or
       * browsers may block Xaman's authorization window as an unsolicited popup.
       */
      authorization = xumm.authorize();
    } catch (error) {
      setStatus(
        walletStatus,
        'Xaman could not open authorization: ' +
          (error?.message || error || 'Unknown error'),
        'err'
      );
      return;
    }

    xamanAuthorizing = true;
    setStatus(walletStatus, 'Opening Xaman authorization…');
    updateWalletButtons();

    try {
      await authorization;

      const connected = await applyXamanIdentity();
      if (!connected) {
        throw new Error('Xaman authorization completed without returning an account.');
      }
    } catch (error) {
      setStatus(
        walletStatus,
        'Xaman connection failed or was canceled: ' +
          (error?.message || error || 'Unknown error'),
        'err'
      );
    } finally {
      xamanAuthorizing = false;
      updateWalletButtons();
    }
  }

  async function withTimeout(promise, timeoutMs, message) {
    let timeoutId = null;
    try {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error(message)),
            timeoutMs
          );
        })
      ]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  }

  let xamanPayloadInFlight = false;

  async function createAndResolveXamanPayload(request, onEvent, onCreated) {
    if (!xumm?.payload) throw new Error('Xaman payload service is unavailable.');
    if (xamanPayloadInFlight) throw new Error('A Xaman request is already active. Complete or reject it in Xaman before creating another.');
    xamanPayloadInFlight = true;
    let subscription = null;
    try {
      const receive = event => {
        const data = event?.data || event || {};
        if (data.signed === true) setXamanSignStatus('Signed in Xaman. Checking the transaction details…', 'signed');
        if (data.expired === true && !('signed' in data)) {
          setXamanSignStatus('This request has expired. If you already opened it in Xaman, check its outcome there before trying again.', 'expired');
          return data;
        }
        return onEvent?.(event);
      };
      let created;
      if (typeof xumm.payload.create === 'function' && typeof xumm.payload.subscribe === 'function') {
        // Show the QR/deeplink immediately; a delayed status WebSocket must not hide the handoff.
        created = await xumm.payload.create(request, true);
        if (!created) throw new Error('Xaman returned no payload.');
        onCreated?.(created);
        subscription = await withTimeout(xumm.payload.subscribe(created, receive), 20000,
          'The request is in Xaman, but its status connection could not open. Check this request in Xaman.');
      } else if (typeof xumm.payload.createAndSubscribe === 'function') {
        subscription = await xumm.payload.createAndSubscribe(request, receive);
        created = subscription?.created;
        if (!created) throw new Error('Xaman returned no payload.');
        onCreated?.(created);
      } else throw new Error('Xaman live signing status is unavailable. Reload the page before trying again.');
      if (!subscription?.resolved) throw new Error('Xaman returned no signing-status subscription.');
      const resolution = await withTimeout(subscription.resolved, 210000,
        'Signing status timed out. Check this request in Xaman before starting another.');
      let details = null;
      try { details = await xumm.payload.get(created); } catch {}
      return { created, resolution, details };
    } catch (error) {
      setXamanSignStatus(error?.message || 'The signing request could not be completed. Check Xaman.', 'error');
      throw error;
    } finally {
      try { subscription?.websocket?.close(); } catch {}
      xamanPayloadInFlight = false;
    }
  }

  function xamanPayloadWasSigned(resolution, details) {
    return Boolean(
      resolution?.signed ??
      resolution?.data?.signed ??
      details?.meta?.signed ??
      false
    );
  }

  async function disconnectXaman() {
    window.__jcsManualDisconnect = true;

    disconnectButtons.forEach((button) => {
      button.disabled = true;
      button.textContent = 'Disconnecting…';
    });

    try {
      await Promise.resolve(xumm?.logout());
    } catch (error) {
      console.warn('Xaman logout returned an error:', error);
    } finally {
      setDisconnected();

      disconnectButtons.forEach((button) => {
        button.textContent = 'Disconnect';
        button.disabled = true;
      });
    }
  }

  if (typeof window.Xumm === 'function' && XUMM_API_KEY) {
    xamanAvailable = true;
    xumm = new window.Xumm(XUMM_API_KEY);
    updateWalletButtons();

    xumm.on('ready', async () => {
      xamanReady = true;
      updateWalletButtons();

      const connected = await applyXamanIdentity();

      if (!connected && !currentAccount) {
        setStatus(walletStatus, 'Status: Not connected');
      }
    });

    xumm.on('success', async (event) => {
      await applyXamanIdentity(event);
    });

    xumm.on('retrieved', async (event) => {
      await applyXamanIdentity(event);
    });

    xumm.on('logout', () => {
      setDisconnected();
    });

    xumm.on('loggedout', () => {
      setDisconnected();
    });

    xumm.on('error', (error) => {
      setStatus(
        walletStatus,
        'Xaman connection error: ' +
          (error?.message || error || 'Unknown error'),
        'err'
      );
      console.error('JCS Xaman SDK error:', error);
    });

    window.addEventListener('pageshow', () => {
      applyXamanIdentity().catch(() => {});
    });

    window.addEventListener('focus', () => {
      applyXamanIdentity().catch(() => {});
    });

    connectButtons.forEach((button) => {
      button.addEventListener('click', beginXamanConnection);
    });

    disconnectButtons.forEach((button) => {
      button.addEventListener('click', disconnectXaman);
    });

    if (setTrustBtn) {
      setTrustBtn.addEventListener('click', async () => {
        try {
          const account =
            currentAccount ||
            window.__jcsWallet ||
            await xumm.user.account;

          if (!account) {
            setStatus(trustlineMsg, 'Connect Xaman first, then try again.', 'err');
            connectBtn && connectBtn.focus();
            return;
          }

          setTrustBtn.disabled = true;
          setStatus(trustlineMsg, 'Checking for an existing JCS trustline…');

          const exists = await checkTrustline(account);
          if (exists) {
            HAS_TRUSTLINE = true;
            setStatus(trustlineMsg, '✅ JCS trustline already present.', 'ok');
            updateWalletButtons();
            return;
          }

          const code = genCode();
          const txjson = {
            TransactionType: 'TrustSet',
            Account: account,
            LimitAmount: {
              currency: CURRENCY_HEX,
              issuer: ISSUER,
              value: '21000000'
            },
            Memos: buildSentinelMemos(code)
          };

          setStatus(
            walletStatus,
            'Verify code ' + code + ' and the JCS trustline details in Xaman.'
          );
          setStatus(trustlineMsg, 'Preparing the Xaman trustline request…');

          const request = {
            txjson,
            options: {
              submit: true,
              expire: 3,
              force_network: 'MAINNET'
            },
            custom_meta: {
              instruction:
                'Verify code ' + code + ' and every transaction field before signing.',
              identifier: 'jcs:trust:' + code
            }
          };

          const { resolution: result, details } =
            await createAndResolveXamanPayload(
              request,
              (eventMessage) => {
                const eventData =
                  eventMessage?.data ||
                  eventMessage ||
                  {};

                if (eventData.opened === true) {
                  setStatus(
                    trustlineMsg,
                    'The trustline request is open in Xaman. Verify the code and details.'
                  );
                }

                if ('signed' in eventData && eventData.signed === false) {
                  setStatus(
                    trustlineMsg,
                    'Trustline request rejected or canceled.',
                    'err'
                  );
                  setXamanSignStatus(
                    'The request was rejected or canceled.',
                    'rejected'
                  );
                }

                if ('signed' in eventData) return eventData;
              },
              (created) => showXamanSignRequest(created, code, 'trust', txjson)
            );

          if (!xamanPayloadWasSigned(result, details)) {
            setStatus(trustlineMsg, 'Trustline request was not signed.', 'err');
            setXamanSignStatus('The request was not signed.', 'rejected');
            return;
          }

          setXamanSignStatus(
            'Trustline request signed and submitted to XRPL Mainnet.',
            'signed'
          );

          await new Promise((resolve) => setTimeout(resolve, 1500));
          HAS_TRUSTLINE = await checkTrustline(account);

          if (HAS_TRUSTLINE) {
            setStatus(trustlineMsg, '✅ JCS trustline confirmed on-ledger.', 'ok');
          } else {
            setStatus(
              trustlineMsg,
              'The request was signed. Waiting for the validated trustline; refresh shortly.'
            );
          }

          updateWalletButtons();
          await refreshAll({ force: true });
        } catch (error) {
          setStatus(
            trustlineMsg,
            'Trustline error: ' + (error?.message || error),
            'err'
          );
          setXamanSignStatus(
            'The trustline request could not be completed.',
            'rejected'
          );
        } finally {
          setSecurityCodeDisplay(null);
          updateWalletButtons();
        }
      });
    }
  } else {
    xamanAvailable = false;
    xamanReady = false;
    console.warn('Xaman SDK not loaded — wallet actions disabled.');
    if (setTrustBtn) setTrustBtn.disabled = true;
    setStatus(
      walletStatus,
      'Wallet features are unavailable because the Xaman SDK did not load.',
      'err'
    );
    setStatus(
      trustlineMsg,
      'Wallet features are unavailable because the Xaman SDK did not load.',
      'err'
    );
    updateWalletButtons();
  }

  async function signWithSentinel(baseTx, purpose) {
    if (!xumm) throw new Error('Xaman SDK is not available.');

    const account =
      currentAccount ||
      window.__jcsWallet ||
      await xumm.user.account;

    if (!account) throw new Error('Connect Xaman first.');

    const code = genCode();
    const memos = buildSentinelMemos(code);
    const txjson = {
      Account: account,
      ...baseTx,
      Memos: [
        ...(Array.isArray(baseTx.Memos) ? baseTx.Memos : []),
        ...memos
      ]
    };

    setStatus(
      walletStatus,
      'Verify code ' + code + ' and every transaction field in Xaman.'
    );

    const request = {
      txjson,
      options: {
        submit: true,
        expire: 3,
        force_network: 'MAINNET'
      },
      custom_meta: {
        instruction:
          'Verify code ' + code + ' and every transaction field before signing.',
        identifier: 'jcs:' + purpose + ':' + code
      }
    };

    const { resolution, details: payloadDetails } =
      await createAndResolveXamanPayload(
        request,
        (eventMessage) => {
          const eventData =
            eventMessage?.data ||
            eventMessage ||
            {};

          if (eventData.opened === true) {
            setStatus($('tradeMsg'), 'The request is open in Xaman. Verify the code and details.');
            setXamanSignStatus(
              'The request is open in Xaman. Verify the code and details.',
              'opened'
            );
          }

          if ('signed' in eventData && eventData.signed === false) {
            setStatus($('tradeMsg'), 'The Xaman request was rejected or canceled.', 'err');
            setXamanSignStatus(
              'The request was rejected or canceled.',
              'rejected'
            );
          }

          if ('signed' in eventData) return eventData;
        },
        (created) => showXamanSignRequest(created, code, purpose, txjson)
      );

    if (!xamanPayloadWasSigned(resolution, payloadDetails)) {
      setXamanSignStatus('The request was not signed.', 'rejected');
      setSecurityCodeDisplay(null);
      throw new Error('The Xaman request was not signed.');
    }

    setXamanSignStatus('Signed in Xaman. Checking the returned transaction details…', 'signed');

    const nodeType =
      payloadDetails?.response?.dispatched_nodetype ||
      '';

    if (
      nodeType &&
      !String(nodeType).toUpperCase().includes('MAINNET')
    ) {
      setSecurityCodeDisplay(null);
      setXamanSignStatus('The request was not dispatched to XRPL Mainnet. Check its outcome in Xaman.', 'error');
      throw new Error('The request was not dispatched to XRPL Mainnet.');
    }

    const txid =
      payloadDetails?.response?.txid ||
      resolution?.txid ||
      resolution?.data?.txid ||
      '';

    if (!txid) {
      setXamanSignStatus('Xaman reported a signature without a transaction ID. Check the outcome in your wallet before starting again.', 'error');
      setSecurityCodeDisplay(null);
      throw new Error(
        'Xaman signed the request but returned no transaction ID.'
      );
    }

    setXamanSignStatus(
      txid
        ? 'Signed and submitted to XRPL Mainnet. Transaction: ' +
          txid.slice(0, 10) + '…' + txid.slice(-8)
        : 'Signed and submitted to XRPL Mainnet.',
      'signed'
    );

    setSecurityCodeDisplay(null);

    return {
      resolution,
      payloadDetails,
      txid
    };
  }

  const sideEl = $('side');
  const buyTab = $('buyTab');
  const sellTab = $('sellTab');
  const amountEl = $('amount');
  const priceEl = $('price');
  const totalXrpEl = $('totalXrp');
  const suggestBtn = $('suggestPriceBtn');
  const placeOfferBtn = $('placeOfferBtn');
  const marketBtn = $('marketTradeBtn');
  const tradeMsg = $('tradeMsg');

  function updateExplainer(side) {
    const buyNote = document.querySelector('#sideExplain .note.buy');
    const sellNote = document.querySelector('#sideExplain .note.sell');
    const hint = $('amountHint');
    const label = $('amountLabel');
    const showBuy = side === 'buy';

    if (buyNote) {
      buyNote.hidden = !showBuy;
      buyNote.classList.toggle('active', showBuy);
      buyNote.setAttribute('aria-hidden', (!showBuy).toString());
    }

    if (sellNote) {
      sellNote.hidden = showBuy;
      sellNote.classList.toggle('active', !showBuy);
      sellNote.setAttribute('aria-hidden', showBuy.toString());
    }

    if (label) {
      label.textContent = showBuy
        ? 'JCS amount to buy'
        : 'JCS amount to sell';
    }

    if (hint) {
      hint.textContent = showBuy
        ? 'Select 25, 50, 75, or 100 JCS, or enter a custom amount.'
        : 'Use a balance percentage or enter the exact JCS amount to sell.';
    }

    if (quickAmountMode) {
      quickAmountMode.textContent = showBuy
        ? 'Quick JCS amounts'
        : 'Percentage of JCS balance';
    }

    document.querySelectorAll('.quick-amounts .qa').forEach((button) => {
      if (showBuy) {
        button.textContent = button.dataset.buyAmount + ' JCS';
      } else {
        button.textContent =
          button.dataset.sellPct === '100'
            ? 'Max'
            : button.dataset.sellPct + '%';
      }
    });

    if (marketBtn) {
      marketBtn.textContent = showBuy
        ? 'Review Buy in Xaman'
        : 'Review Sell in Xaman';
    }

    if (placeOfferBtn) {
      placeOfferBtn.textContent = showBuy
        ? 'Review Buy Limit Order in Xaman'
        : 'Review Sell Limit Order in Xaman';
    }
  }

  function setSide(side) {
    if (sideEl) sideEl.value = side;

    if (buyTab) {
      buyTab.classList.toggle('active', side === 'buy');
      buyTab.setAttribute('aria-pressed', side === 'buy' ? 'true' : 'false');
    }

    if (sellTab) {
      sellTab.classList.toggle('active', side === 'sell');
      sellTab.setAttribute('aria-pressed', side === 'sell' ? 'true' : 'false');
    }

    const tradeCard = $('trade');
    if (tradeCard) {
      tradeCard.classList.toggle('buy', side === 'buy');
      tradeCard.classList.toggle('sell', side === 'sell');
    }

    updateExplainer(side);
    recalcTotals();
  }

  function formatTradeNumber(value, digits = 6) {
    if (!Number.isFinite(Number(value))) return '—';
    return Number(value).toLocaleString('en-US', {
      maximumFractionDigits: digits
    });
  }

  function recalcTotals() {
    const side = (sideEl && sideEl.value) || 'buy';
    const amount = Number(amountEl && amountEl.value) || 0;
    const price = Number(priceEl && priceEl.value) || 0;
    const total = amount * price;

    if (totalXrpEl) {
      totalXrpEl.textContent =
        (Number.isFinite(total) ? total : 0).toFixed(6) + ' XRP';
    }

    if (side === 'buy') {
      if (tradePayLabel) tradePayLabel.textContent = 'Estimated XRP cost';
      if (tradeReceiveLabel) tradeReceiveLabel.textContent = 'JCS requested';
      if (tradePayValue) {
        tradePayValue.textContent =
          amount > 0 && price > 0
            ? formatTradeNumber(total, 6) + ' XRP'
            : '— XRP';
      }
      if (tradeReceiveValue) {
        tradeReceiveValue.textContent =
          amount > 0
            ? formatTradeNumber(amount, 6) + ' JCS'
            : '— JCS';
      }
    } else {
      if (tradePayLabel) tradePayLabel.textContent = 'JCS offered';
      if (tradeReceiveLabel) tradeReceiveLabel.textContent = 'Estimated XRP received';
      if (tradePayValue) {
        tradePayValue.textContent =
          amount > 0
            ? formatTradeNumber(amount, 6) + ' JCS'
            : '— JCS';
      }
      if (tradeReceiveValue) {
        tradeReceiveValue.textContent =
          amount > 0 && price > 0
            ? formatTradeNumber(total, 6) + ' XRP'
            : '— XRP';
      }
    }

    if (tradeQuoteNote) {
      tradeQuoteNote.textContent =
        amount <= 0
          ? 'Enter an amount to load a live AMM or order-book estimate.'
          : price > 0
            ? 'Live reference: ' + formatTradeNumber(price, 9) +
              ' XRP per JCS. The quote is rechecked before the Xaman request is created.'
            : 'Refresh the live quote before submitting the request.';
    }
  }

  if (buyTab) buyTab.addEventListener('click', () => setSide('buy'));
  if (sellTab) sellTab.addEventListener('click', () => setSide('sell'));
  setSide('buy');

  if (amountEl) amountEl.addEventListener('input', recalcTotals);
  if (priceEl) priceEl.addEventListener('input', recalcTotals);

  async function fetchBalances() {
    if (!currentAccount) {
      BAL.xrp = 0;
      BAL.jcs = 0;
      if (tradeXrpBalance) tradeXrpBalance.textContent = '—';
      if (tradeJcsBalance) tradeJcsBalance.textContent = '—';
      return BAL;
    }

    try {
      const info = await call('account_info', { account: currentAccount });
      BAL.xrp = Number(info.account_data.Balance || 0) / XRP_TO_DROPS;
    } catch {
      BAL.xrp = 0;
    }

    try {
      const r = await xrplRequest({
        method: 'account_lines',
        params: [{
          account: currentAccount,
          peer: ISSUER,
          ledger_index: 'validated',
          limit: 400
        }]
      });

      const lines = (r.result && r.result.lines) || [];
      const trustline = lines.find((line) =>
        line.account === ISSUER &&
        normalizeHexCurrency(line.currency) === CURRENCY_HEX_NORM
      );

      BAL.jcs = trustline
        ? Math.max(0, Number(trustline.balance || 0))
        : 0;
    } catch {
      BAL.jcs = 0;
    }

    if (tradeXrpBalance) {
      tradeXrpBalance.textContent =
        formatTradeNumber(BAL.xrp, 6) + ' XRP';
    }

    if (tradeJcsBalance) {
      tradeJcsBalance.textContent =
        formatTradeNumber(BAL.jcs, 6) + ' JCS';
    }

    return BAL;
  }

  (function initQuickAmounts() {
    const chips = document.querySelectorAll('.quick-amounts .qa');
    if (!chips.length) return;

    chips.forEach((button) => {
      button.addEventListener('click', async () => {
        const side = (sideEl && sideEl.value) || 'buy';
        button.disabled = true;

        try {
          if (side === 'buy') {
            const amount = Number(button.dataset.buyAmount || 0);
            if (amountEl && amount > 0) {
              amountEl.value = amount.toFixed(6);
              recalcTotals();
              await fillBestPrice();
            }
            return;
          }

          if (!currentAccount) {
            setStatus(tradeMsg, 'Connect Xaman before using balance percentages.', 'err');
            connectBtn && connectBtn.focus();
            return;
          }

          const pct = Number(button.dataset.sellPct || 0);
          if (!pct) return;

          await fetchBalances();
          const amount = BAL.jcs * (pct / 100);

          if (amountEl) {
            amountEl.value = amount.toFixed(6);
            recalcTotals();
            await fillBestPrice();
          }
        } finally {
          button.disabled = false;
        }
      });
    });
  })();

  function amountToNumber(amount) {
    if (amount == null) return NaN;
    if (typeof amount === 'string') {
      return Number(amount) / XRP_TO_DROPS;
    }
    if (typeof amount === 'object' && amount.value != null) {
      return Number(amount.value);
    }
    return NaN;
  }

  async function getTopOfBook() {
    const [askRes, bidRes] = await Promise.all([
      xrplRequest({
        method: 'book_offers',
        params: [{
          taker_gets: { currency: CURRENCY_HEX, issuer: ISSUER },
          taker_pays: { currency: 'XRP' },
          limit: 5,
          ledger_index: 'validated'
        }]
      }),
      xrplRequest({
        method: 'book_offers',
        params: [{
          taker_gets: { currency: 'XRP' },
          taker_pays: { currency: CURRENCY_HEX, issuer: ISSUER },
          limit: 5,
          ledger_index: 'validated'
        }]
      })
    ]);

    const ask = (askRes.result.offers || [])[0];
    const bid = (bidRes.result.offers || [])[0];

    const askGets = ask ? amountToNumber(ask.TakerGets) : NaN;
    const askPays = ask ? amountToNumber(ask.TakerPays) : NaN;
    const bidGets = bid ? amountToNumber(bid.TakerGets) : NaN;
    const bidPays = bid ? amountToNumber(bid.TakerPays) : NaN;

    const bestAsk =
      Number.isFinite(askGets) &&
      Number.isFinite(askPays) &&
      askGets > 0
        ? askPays / askGets
        : null;

    const bestBid =
      Number.isFinite(bidGets) &&
      Number.isFinite(bidPays) &&
      bidPays > 0
        ? bidGets / bidPays
        : null;

    return { bestAsk, bestBid };
  }

  let ammSnapshotCache = null;
  let ammSnapshotPromise = null;
  const AMM_SNAPSHOT_CACHE_MS = 5000;

  function isXrpCurrencyAmount(amount) {
    return typeof amount === 'string' ||
      !!(amount && typeof amount === 'object' && amount.currency === 'XRP');
  }

  function isJcsCurrencyAmount(amount) {
    return !!(
      amount &&
      typeof amount === 'object' &&
      amount.issuer === ISSUER &&
      normalizeHexCurrency(amount.currency) === CURRENCY_HEX_NORM
    );
  }

  function readJcsAmmReserves(amm) {
    if (!amm) return null;

    const first = amm.amount;
    const second = amm.amount2;
    let reserveXrp = NaN;
    let reserveJcs = NaN;

    if (isXrpCurrencyAmount(first) && isJcsCurrencyAmount(second)) {
      reserveXrp = amountToNumber(first);
      reserveJcs = amountToNumber(second);
    } else if (isJcsCurrencyAmount(first) && isXrpCurrencyAmount(second)) {
      reserveJcs = amountToNumber(first);
      reserveXrp = amountToNumber(second);
    }

    if (
      !Number.isFinite(reserveXrp) ||
      !Number.isFinite(reserveJcs) ||
      reserveXrp <= 0 ||
      reserveJcs <= 0
    ) {
      return null;
    }

    return {
      reserveXrp,
      reserveJcs,
      feeRate: Math.max(0, Math.min(0.999999, Number(amm.trading_fee || 0) / 100000))
    };
  }

  async function getJcsAmmSnapshot() {
    const now = Date.now();
    if (
      ammSnapshotCache &&
      now - ammSnapshotCache.cachedAt < AMM_SNAPSHOT_CACHE_MS
    ) {
      return ammSnapshotCache.value;
    }

    if (ammSnapshotPromise) return ammSnapshotPromise;

    ammSnapshotPromise = (async () => {
      const response = await xrplRequest({
        method: 'amm_info',
        params: [{
          asset: { currency: 'XRP' },
          asset2: { currency: CURRENCY_HEX, issuer: ISSUER },
          ledger_index: 'validated'
        }]
      });

      const snapshot = readJcsAmmReserves(response?.result?.amm);
      if (!snapshot) throw new Error('The JCS/XRP AMM reserves are unavailable.');

      ammSnapshotCache = {
        cachedAt: Date.now(),
        value: snapshot
      };
      return snapshot;
    })();

    try {
      return await ammSnapshotPromise;
    } finally {
      ammSnapshotPromise = null;
    }
  }

  function quoteJcsAmmTrade(side, amountJcs, snapshot) {
    const amount = Number(amountJcs);
    if (!snapshot || !Number.isFinite(amount) || amount <= 0) return null;

    const { reserveXrp, reserveJcs, feeRate } = snapshot;
    const feeMultiplier = 1 - feeRate;
    if (feeMultiplier <= 0) return null;

    const invariant = reserveXrp * reserveJcs;
    let totalXrp = NaN;

    if (side === 'buy') {
      if (amount >= reserveJcs) return null;
      const effectiveXrpIn = invariant / (reserveJcs - amount) - reserveXrp;
      totalXrp = effectiveXrpIn / feeMultiplier;
    } else {
      const effectiveJcsIn = amount * feeMultiplier;
      totalXrp = reserveXrp - invariant / (reserveJcs + effectiveJcsIn);
    }

    if (!Number.isFinite(totalXrp) || totalXrp <= 0) return null;

    return {
      totalXrp,
      unitPrice: totalXrp / amount,
      source: 'AMM'
    };
  }

  async function getMarketPrice(side, requestedAmount) {
    const amount = Number(
      requestedAmount != null
        ? requestedAmount
        : (amountEl && amountEl.value)
    );

    if (!Number.isFinite(amount) || amount <= 0) return null;

    try {
      const snapshot = await getJcsAmmSnapshot();
      const quote = quoteJcsAmmTrade(side, amount, snapshot);
      if (quote) return quote.unitPrice;
    } catch (error) {
      console.warn('JCS AMM quote unavailable; checking the order book.', error);
    }

    const { bestAsk, bestBid } = await getTopOfBook();
    return side === 'buy' ? bestAsk : bestBid;
  }

  async function fillBestPrice() {
    if (!amountEl || !priceEl) return null;

    const side = sideEl.value;
    const amount = Number(amountEl.value);

    if (!amount || amount <= 0) {
      setStatus(tradeMsg, 'Enter an JCS amount before refreshing the quote.');
      return null;
    }

    setStatus(tradeMsg, 'Querying XRPL for the live ' + side + ' quote…');

    try {
      const price = await getMarketPrice(side);
      if (!price || price <= 0) throw new Error('No live market price is available.');

      priceEl.value = Number(price).toFixed(9);

      if (tradeLivePrice) {
        tradeLivePrice.textContent =
          formatTradeNumber(price, 9) + ' XRP / JCS';
      }

      recalcTotals();
      setStatus(tradeMsg, 'Live ' + side + ' quote refreshed.', 'ok');
      return price;
    } catch (error) {
      if (tradeLivePrice) tradeLivePrice.textContent = 'Unavailable';
      setStatus(
        tradeMsg,
        'Live quote error: ' + (error?.message || error),
        'err'
      );
      return null;
    }
  }

  if (suggestBtn) suggestBtn.addEventListener('click', () => fillBestPrice());
  setInterval(() => {
    const amt = Number(amountEl && amountEl.value);
    if (document.visibilityState === 'visible' && amt > 0) fillBestPrice().catch(() => {});
  }, 60000);

  if (placeOfferBtn) {
    placeOfferBtn.addEventListener('click', async () => {
      try {
        if (!currentAccount) throw new Error('Connect wallet first');
        if (!HAS_TRUSTLINE) throw new Error('Add ' + APP_NAME + ' trustline first');
        const side = sideEl.value;
        const amt = Number(amountEl.value);
        const px = Number(priceEl.value);
        if (!amt || !px || amt <= 0 || px <= 0) throw new Error('Enter Amount and Price');
        const xrpTotal = px * amt;
        let tx;
        if (side === 'sell') {
          tx = {
            TransactionType: 'OfferCreate',
            TakerGets: { currency: CURRENCY_HEX, issuer: ISSUER, value: String(amt) },
            TakerPays: toDrops(xrpTotal),
            Flags: 0x00080000
          };
        } else {
          tx = {
            TransactionType: 'OfferCreate',
            TakerGets: toDrops(xrpTotal),
            TakerPays: { currency: CURRENCY_HEX, issuer: ISSUER, value: String(amt) },
            Flags: 0
          };
        }
        setStatus(tradeMsg, 'Open Xaman to review limit order.');
        const signed = await signWithSentinel(tx, 'offer');
        const txid = signed && signed.txid;
        if (!txid) throw new Error('Xaman returned no transaction ID for the limit order.');
        setStatus(tradeMsg, 'Limit order submitted. Waiting for validated XRPL confirmation…');
        await waitForQuickBuyValidation(txid);
        setStatus(
          tradeMsg,
          'Limit order transaction validated on XRPL Mainnet · ' +
            txid.slice(0, 10) + '…' + txid.slice(-8),
          'ok'
        );
        setResult('Validated limit-order transaction: ' + txid);
        document.dispatchEvent(new CustomEvent('jcs:validated-transaction', {
          detail: { kind:'limit-order', txid, side, amountJcs:amt, referencePriceXrpPerJcs:px }
        }));
        await Promise.allSettled([refreshAll({ force: true }), fetchBalances()]);
      } catch (e) {
        setStatus(tradeMsg, 'Error: ' + (e.message || e), 'err');
      }
    });
  }

  if (marketBtn) {
    marketBtn.addEventListener('click', async () => {
      try {
        if (!currentAccount) throw new Error('Connect wallet first');
        if (!HAS_TRUSTLINE) throw new Error('Add ' + APP_NAME + ' trustline first');

        const side = sideEl.value;
        const amt = Number(amountEl.value);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter Amount');

        setStatus(
          tradeMsg,
          'Preparing an AMM/DEX quote from validated XRPL liquidity…'
        );

        const basePx = await getMarketPrice(side, amt);
        if (!basePx || basePx <= 0) {
          throw new Error('No executable AMM or order-book price is available.');
        }

        const slip = SLIPPAGE_PCT / 100;
        const estimatedXrp = amt * basePx;
        let tx;

        if (side === 'buy') {
          const maximumXrp = estimatedXrp * (1 + slip);
          const maximumDrops = Math.max(1, Math.ceil(maximumXrp * XRP_TO_DROPS));

          tx = {
            TransactionType: 'OfferCreate',
            TakerGets: String(maximumDrops),
            TakerPays: {
              currency: CURRENCY_HEX,
              issuer: ISSUER,
              value: String(amt)
            },
            // Fill or Kill: receive the full JCS amount or execute nothing.
            Flags: 0x00040000
          };
        } else {
          await fetchBalances();
          if (BAL.jcs + 1e-12 < amt) {
            throw new Error('The connected wallet does not hold enough JCS.');
          }

          const minimumXrp = estimatedXrp * (1 - slip);
          const minimumDrops = Math.max(1, Math.floor(minimumXrp * XRP_TO_DROPS));

          tx = {
            TransactionType: 'OfferCreate',
            TakerGets: {
              currency: CURRENCY_HEX,
              issuer: ISSUER,
              value: String(amt)
            },
            TakerPays: String(minimumDrops),
            // Fill or Kill + Sell: spend the full JCS amount or execute nothing.
            Flags: 0x00040000 | 0x00080000
          };
        }

        setStatus(
          tradeMsg,
          'Open Xaman and review the AMM/DEX market order. XRPL will use the best available order-book, AMM, or combined liquidity.'
        );

        const signed = await signWithSentinel(tx, 'swap');
        const txid = signed && signed.txid;
        if (!txid) throw new Error('Xaman returned no transaction ID for the market order.');

        setStatus(tradeMsg, 'AMM/DEX market order submitted. Waiting for validated XRPL confirmation…');
        await waitForQuickBuyValidation(txid);

        setStatus(
          tradeMsg,
          'AMM/DEX market transaction validated on XRPL Mainnet · ' +
            txid.slice(0, 10) + '…' + txid.slice(-8),
          'ok'
        );

        setResult('Validated AMM/DEX market transaction: ' + txid);
        document.dispatchEvent(new CustomEvent('jcs:validated-transaction', {
          detail: { kind:'market-swap', txid, side, amountJcs:amt, referencePriceXrpPerJcs:basePx }
        }));

        ammSnapshotCache = null;
        await Promise.allSettled([refreshAll({ force: true }), fetchBalances()]);
      } catch (e) {
        setStatus(tradeMsg, 'Error: ' + (e.message || e), 'err');
      }
    });
  }

  const offersWrap = $('offersWrap');
  const offersStatus = $('offersStatus');
  const offersProgress = $('progressBar');
  const btnRefreshOffers = $('btnRefresh');
  const btnCancelAll = $('btnCancelAll');

  function setOffersStatus(msg, cls) { setStatus(offersStatus, msg, cls); }
  function setOffersProgress(pct) {
    if (!offersProgress) return;
    const v = Math.max(0, Math.min(100, pct));
    offersProgress.style.width = v + '%';
  }

  function isJcsAmount(amount) {
    return !!(
      amount &&
      typeof amount === 'object' &&
      amount.issuer === ISSUER &&
      normalizeHexCurrency(amount.currency) === CURRENCY_HEX_NORM
    );
  }

  function isXrpAmount(amount) {
    return typeof amount === 'string' ||
      (amount && amount.currency === 'XRP');
  }

  async function fetchOffers(acct) {
    if (!acct) {
      setOffersStatus('Connect Xaman first.', 'err');
      renderOffers([]);
      return;
    }

    setOffersStatus('Checking your unfinished JCS buy and sell orders…');
    setOffersProgress(10);

    try {
      const r = await xrplRequest({
        method: 'account_offers',
        params: [{
          account: acct,
          ledger_index: 'validated',
          limit: 500
        }]
      });

      const allOffers = (r.result && r.result.offers) || [];
      const offers = allOffers.filter((offer) =>
        isJcsAmount(offer.taker_gets) ||
        isJcsAmount(offer.taker_pays)
      );

      renderOffers(offers);
      setOffersStatus(
        'You have ' + offers.length + ' unfinished JCS order(s). Canceling stops the remaining trade; it does not undo completed trades.',
        'ok'
      );
      setOffersProgress(100);
      setTimeout(() => setOffersProgress(0), 400);
    } catch (error) {
      renderOffers([]);
      setOffersStatus(
        'Open-order error: ' + (error?.message || error),
        'err'
      );
      setOffersProgress(0);
    }
  }

  function renderOffers(offers) {
    if (!offersWrap) return;

    offersWrap.innerHTML = '';

    if (!offers.length) {
      offersWrap.textContent = 'You have no unfinished JCS orders. A limit order waits for your chosen price until it fills or you cancel it.';
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.overflow = 'auto';

    const table = document.createElement('table');
    const caption = document.createElement('caption');
    caption.className = 'sr-only';
    caption.textContent = 'Open JCS orders for the connected public XRP Ledger account';
    table.appendChild(caption);
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    ['Order', 'You give', 'You receive', 'XRP per JCS', 'Action']
      .forEach((text) => {
        const th = document.createElement('th');
        th.scope = 'col';
        th.textContent = text;
        headerRow.appendChild(th);
      });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    const number = (value) =>
      Number.isFinite(Number(value)) ? Number(value) : 0;

    const amountText = (amount) => {
      if (typeof amount === 'string') {
        return (number(amount) / XRP_TO_DROPS).toFixed(6) + ' XRP';
      }

      if (amount && amount.currency === 'XRP') {
        return number(amount.value).toFixed(6) + ' XRP';
      }

      if (amount && amount.value != null) {
        const name = isJcsAmount(amount)
          ? 'JCS'
          : (amount.currency || 'IOU');
        return number(amount.value).toFixed(6) + ' ' + name;
      }

      return '—';
    };

    const priceXrpPerJcs = (gets, pays) => {
      const getsXrp = isXrpAmount(gets)
        ? amountToNumber(gets)
        : null;
      const paysXrp = isXrpAmount(pays)
        ? amountToNumber(pays)
        : null;
      const getsToken = isJcsAmount(gets)
        ? number(gets.value)
        : null;
      const paysToken = isJcsAmount(pays)
        ? number(pays.value)
        : null;

      if (getsXrp !== null && paysToken && paysToken > 0) {
        return getsXrp / paysToken;
      }

      if (paysXrp !== null && getsToken && getsToken > 0) {
        return paysXrp / getsToken;
      }

      return null;
    };

    offers.forEach((offer) => {
      const row = document.createElement('tr');
      row.dataset.seq = offer.seq;

      const seq = document.createElement('td');
      seq.className = 'mono';
      seq.textContent = offer.seq;
      row.appendChild(seq);

      const gets = document.createElement('td');
      gets.textContent = amountText(offer.taker_gets);
      row.appendChild(gets);

      const pays = document.createElement('td');
      pays.textContent = amountText(offer.taker_pays);
      row.appendChild(pays);

      const price = document.createElement('td');
      const value = priceXrpPerJcs(
        offer.taker_gets,
        offer.taker_pays
      );
      price.textContent =
        value && Number.isFinite(value)
          ? value.toFixed(9)
          : '—';
      row.appendChild(price);

      const action = document.createElement('td');
      const cancel = document.createElement('button');
      cancel.className = 'btn';
      cancel.type = 'button';
      cancel.textContent = 'Cancel order';
      cancel.addEventListener('click', () => cancelOne(offer.seq));
      action.appendChild(cancel);
      row.appendChild(action);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    offersWrap.appendChild(wrap);
  }

  async function cancelOne(seq) {
    try {
      const tx = { TransactionType: 'OfferCancel', OfferSequence: Number(seq) };
      const signed = await signWithSentinel(tx, 'cancel');
      const txid = signed && signed.txid;
      if (!txid) throw new Error('Xaman returned no transaction ID for the cancellation.');
      setOffersStatus('Cancellation submitted. Waiting for validated XRPL confirmation…');
      await waitForQuickBuyValidation(txid);
      setOffersStatus('Cancellation transaction validated · ' + txid.slice(0, 10) + '…', 'ok');
      document.dispatchEvent(new CustomEvent('jcs:validated-transaction', {
        detail: { kind:'offer-cancel', txid, offerSequence:Number(seq) }
      }));
      await fetchOffers(currentAccount);
    } catch (e) {
      setOffersStatus('Cancel error: ' + (e.message || e), 'err');
    }
  }

  async function cancelAll() {
    if (!offersWrap) return;
    const rows = offersWrap.querySelectorAll('tbody tr');
    const count = rows.length;
    if (!count) {
      setOffersStatus('No open offers to cancel.');
      return;
    }
    if (!confirm('Cancel ' + count + ' offer(s)?')) return;
    let i = 0;
    for (const r of rows) {
      const seq = r.dataset.seq;
      if (!seq) continue;
      i++;
      setOffersProgress(((i - 1) / count) * 100);
      try { await cancelOne(seq); } catch {}
    }
    setOffersProgress(100);
    setTimeout(() => setOffersProgress(0), 400);
  }

  if (btnRefreshOffers) btnRefreshOffers.addEventListener('click', () => {
    if (!currentAccount) setOffersStatus('Connect first.', 'err');
    else fetchOffers(currentAccount);
  });
  if (btnCancelAll) btnCancelAll.addEventListener('click', cancelAll);

  const ledgerOut = $('ledgerOutput');
  const bookOut = $('priceOutput');
  const spotEl = $('jcsSpot');
  const ammEl = $('jcsAmm');
  const spreadEl = $('jcsSpread');
  const ledMiniEl = $('jcsLedgerMini');

  async function getLedgerSummary() {
    const r = await xrplRequest({
      method: 'ledger',
      params: [{ ledger_index: 'validated' }]
    });
    const res = r.result || {};
    const led = res.ledger || {};
    return {
      index: res.ledger_index || res.validated_ledger_index || led.ledger_index,
      hash: res.ledger_hash || led.ledger_hash,
      close: led.close_time_human || '',
      validated: res.validated === true
    };
  }

  async function refreshLedger() {
    try {
      const s = await getLedgerSummary();
      if (ledgerOut) ledgerOut.textContent = JSON.stringify(s, null, 2);
    } catch (e) {
      if (ledgerOut) ledgerOut.textContent = 'Ledger error: ' + (e.message || e);
    }
  }

  async function getOrderBookHtml() {
    const [askResult, bidResult] = await Promise.all([
      xrplRequest({
        method: 'book_offers',
        params: [{
          taker_gets: { currency: CURRENCY_HEX, issuer: ISSUER },
          taker_pays: { currency: 'XRP' },
          limit: 5,
          ledger_index: 'validated'
        }]
      }),
      xrplRequest({
        method: 'book_offers',
        params: [{
          taker_gets: { currency: 'XRP' },
          taker_pays: { currency: CURRENCY_HEX, issuer: ISSUER },
          limit: 5,
          ledger_index: 'validated'
        }]
      })
    ]);

    const asks = (askResult.result.offers || []);
    const bids = (bidResult.result.offers || []);
    const rows = [];

    const render = (offer, side) => {
      const gets = amountToNumber(offer.TakerGets);
      const pays = amountToNumber(offer.TakerPays);
      const isBid = side === 'Bid';

      const price =
        Number.isFinite(gets) &&
        Number.isFinite(pays) &&
        gets > 0 &&
        pays > 0
          ? (isBid ? gets / pays : pays / gets)
          : NaN;

      const amount =
        isBid
          ? pays
          : gets;

      return (
        '<tr>' +
          '<td>' + side + '</td>' +
          '<td>' + (Number.isFinite(price) ? price.toFixed(9) : '—') + '</td>' +
          '<td>' + (Number.isFinite(amount) ? amount.toFixed(6) : '—') + '</td>' +
        '</tr>'
      );
    };

    if (!asks.length && !bids.length) {
      return '<div class="hint">No JCS/XRP order-book data is available.</div>';
    }

    asks.forEach((offer) => rows.push(render(offer, 'Ask')));
    bids.forEach((offer) => rows.push(render(offer, 'Bid')));

    return (
      '<div style="overflow:auto">' +
        '<table>' +
          '<caption class="sr-only">Visible JCS and XRP order-book levels</caption>' +
          '<thead><tr><th scope="col">Side</th><th scope="col">Price (XRP/JCS)</th><th scope="col">JCS amount</th></tr></thead>' +
          '<tbody>' + rows.join('') + '</tbody>' +
        '</table>' +
      '</div>'
    );
  }

  async function refreshBook() {
    try {
      const html = await getOrderBookHtml();
      if (bookOut) bookOut.innerHTML = html;
    } catch (e) {
      if (bookOut) bookOut.textContent = 'Book error: ' + (e.message || e);
    }
  }

  function formatJcsPrice(value) {
    return Number.isFinite(value) && value > 0
      ? value.toLocaleString('en-US', { maximumSignificantDigits: 8, useGrouping: false })
      : '—';
  }

  async function refreshSummary() {
    try {
      const ledInfo = await getLedgerSummary();
      if (!ledInfo.validated || !ledInfo.index) throw new Error('A validated ledger is unavailable.');
      const [ob, ammWrap] = await Promise.allSettled([
        getTopOfBook(),
        xrplRequest({ method: 'amm_info', params: [{
          asset: { currency: 'XRP' },
          asset2: { currency: CURRENCY_HEX, issuer: ISSUER },
          ledger_index: Number(ledInfo.index)
        }] })
      ]);
      const bestAsk = ob.status === 'fulfilled' ? ob.value.bestAsk : null;
      const bestBid = ob.status === 'fulfilled' ? ob.value.bestBid : null;
      const spot = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : bestAsk || bestBid || null;
      const ammResult = ammWrap.status === 'fulfilled' ? ammWrap.value.result : null;
      const reserves = ammResult?.validated === true && Number(ammResult.ledger_index) === Number(ledInfo.index)
        ? readJcsAmmReserves(ammResult.amm) : null;
      const ammPx = reserves ? reserves.reserveXrp / reserves.reserveJcs : null;
      const spread = bestAsk && bestBid && bestBid <= bestAsk ? ((bestAsk - bestBid) / bestAsk) * 100 : null;
      if (spotEl) spotEl.textContent = 'Order book: ' + formatJcsPrice(spot) + ' XRP / JCS';
      if (ammEl) ammEl.textContent = ammPx ? formatJcsPrice(ammPx) + ' XRP / JCS' : 'Pool price unavailable';
      if (spreadEl) spreadEl.textContent = 'Buy/sell price gap: ' + (spread != null ? spread.toFixed(2) + '%' : '—');
      if (ledMiniEl) ledMiniEl.textContent = 'Verified ledger #' + ledInfo.index;
      if (reserves) window.dispatchEvent(new CustomEvent('jcs:market-snapshot', { detail: {
        ledgerIndex: Number(ledInfo.index), ledgerHash: ledInfo.hash, validated: true,
        observedAt: Date.now(), priceXrpPerJcs: ammPx,
        reserveXrp: reserves.reserveXrp, reserveJcs: reserves.reserveJcs, source: 'XRPL AMM'
      } }));
    } catch {
      if (ammEl) ammEl.textContent = 'Live pool data unavailable';
      if (ledMiniEl) ledMiniEl.textContent = 'Ledger check unavailable';
    }
  }

  const healthProgress = $('healthProgress');
  const healthStatus = $('healthStatus');
  const healthTable = $('healthTable');
  const healthBody = $('healthBody');
  const healthNote = $('healthNote');
  const ledgerPill = $('ledgerPill');
  const riskOnly = $('riskOnly');
  const watchOnly = $('watchOnly');
  const autoRefresh = $('autoRefresh');
  const autoEvery = $('autoEvery');
  const lastScanEl = $('lastScan');
  const btnHealthScan = $('btnHealthScan');
  const btnHealthRetry = $('btnHealthRetry');
  const btnExportJson = $('btnExportJson');
  const btnCopyJson = $('btnCopyJson');
  const btnClearLog = $('btnClearLog');
  const btnRefreshEst = $('btnRefreshEst');
  const btnTrustJCS = $('btnTrustJCS');
  const buyStatus = $('buyStatus');
  const est1 = $('est1'), est25 = $('est25'), est50 = $('est50'), est100 = $('est100');
  const buy1 = $('buy1'), buy25 = $('buy25'), buy50 = $('buy50'), buy100 = $('buy100');

  const state = {
    scanning: false,
    lastScanTs: 0,
    prevSnap: loadPrevSnap(),
    watchlist: loadWatchlist(),
    scanTimerId: null
  };

  function setHealthProgress(pct) {
    if (!healthProgress) return;
    const v = Math.max(0, Math.min(100, pct));
    healthProgress.style.width = v + '%';
  }

  function renderLedgerPillFromServer(r) {
    try {
      const info = r.result.state || {};
      const v = info.validated_ledger || {};
      const idx = v.seq || v.ledger_index;
      const age = v.age;
      ledgerPill.textContent = idx
        ? ('Ledger ' + idx + (age != null ? (' · ' + age + 's') : ''))
        : 'Ledger: —';
    } catch {
      ledgerPill.textContent = 'Ledger: —';
    }
  }

  function Nnum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function deltaBadge(curr, prev) {
    if (!isFinite(curr) || !isFinite(prev)) return '<span class="delta neutral">•</span>';
    const d = curr - prev;
    if (Math.abs(d) < 1e-9) return '<span class="delta neutral">•</span>';
    const cls = d > 0 ? 'up' : 'down';
    const sym = d > 0 ? '▲' : '▼';
    return `<span class="delta ${cls}">${sym} ${Math.abs(d).toFixed(2)}</span>`;
  }

  function tokenKey(hex, issuer) {
    return (hex || '') + '|' + (issuer || '');
  }

  function savePrevSnap(obj) {
    try { localStorage.setItem('jcs.prevHealth', JSON.stringify(obj)); } catch {}
  }

  function loadPrevSnap() {
    try { return JSON.parse(localStorage.getItem('jcs.prevHealth') || '{}'); } catch { return {}; }
  }

  function saveWatchlist(set) {
    try { localStorage.setItem('jcs.watchlist', JSON.stringify([...set])); } catch {}
  }

  function loadWatchlist() {
    try {
      return new Set(JSON.parse(localStorage.getItem('jcs.watchlist') || '[]'));
    } catch {
      return new Set();
    }
  }

  function applyFilters() {
    const onlyRisk = riskOnly && riskOnly.checked;
    const onlyWatch = watchOnly && watchOnly.checked;
    if (!healthBody) return;
    const rows = healthBody.querySelectorAll('tr');
    rows.forEach(tr => {
      const isRisk = tr.dataset.status === 'R';
      const key = tr.dataset.key || '';
      const inWatch = state.watchlist.has(key);
      let show = true;
      if (onlyRisk && !isRisk) show = false;
      if (onlyWatch && !inWatch) show = false;
      tr.style.display = show ? '' : 'none';
    });
  }

  function toggleWatch(key, starEl) {
    if (state.watchlist.has(key)) state.watchlist.delete(key);
    else state.watchlist.add(key);
    saveWatchlist(state.watchlist);
    if (starEl) {
      const watched = state.watchlist.has(key);
      const tokenLabel = starEl.dataset.tokenLabel || 'token';
      starEl.classList.toggle('on', watched);
      starEl.setAttribute('aria-pressed', String(watched));
      starEl.setAttribute(
        'aria-label',
        watched ? `Remove ${tokenLabel} from watchlist` : `Add ${tokenLabel} to watchlist`
      );
    }
    applyFilters();
  }

  function saveRowsSnapshot(rows) {
    const map = {};
    rows.forEach(r => {
      const k = tokenKey(r.hex, r.issuer);
      map[k] = {
        xrpRes: r.xrpRes,
        slip10: r.slip10Pct,
        slip100: r.slip100Pct
      };
    });
    state.prevSnap = map;
    savePrevSnap(map);
  }

  async function ammInfoXrpIou(hex, issuer) {
    try {
      const r = await xrplRequest({
        method: 'amm_info',
        params: [{ asset: { currency: 'XRP' }, asset2: { currency: hex, issuer } }]
      });
      return r.result.amm || null;
    } catch {
      return null;
    }
  }

  function scoreHealth(row) {
    let s = 0;
    if (row.poolExists) s += 1;
    if (row.xrpRes >= 500) s += 2;
    else if (row.xrpRes >= 100) s += 1;
    if (row.feePct <= 0.3) s += 1;
    else if (row.feePct > 0.5) s -= 1;
    if (row.slip10Pct <= 1) s += 2;
    else if (row.slip10Pct <= 3) s += 1;
    if (row.slip100Pct <= 10) s += 1;
    let cls = 'C', text = 'Caution';
    if (s >= 6) { cls = 'H'; text = 'Healthy'; }
    else if (s <= 2) { cls = 'R'; text = 'Risk'; }
    return { score: s, cls, status: text };
  }

  async function refreshHealth() {
    if (!currentAccount) {
      setStatus(healthStatus, 'Connect wallet to scan.');
      return;
    }
    if (state.scanning) return;
    state.scanning = true;
    setHealthProgress(8);
    setStatus(healthStatus, 'Fetching trustlines.');
    try {
      const srv = await xrplRequest({ method: 'server_state', params: [{}] }).catch(() => null);
      if (srv && ledgerPill) renderLedgerPillFromServer(srv);

      const linesWrap = await xrplRequest({
        method: 'account_lines',
        params: [{ account: currentAccount, limit: 400, ledger_index: 'validated' }]
      });
      const lines = (linesWrap.result && linesWrap.result.lines) || [];
      if (!lines.length) {
        if (healthNote) healthNote.textContent = 'No trustlines found.';
        if (healthTable) healthTable.style.display = 'none';
        setHealthProgress(0);
        state.scanning = false;
        return;
      }

      const rows = [];
      let i = 0;

      for (const l of lines) {
        i++;
        if (i % 3 === 0) {
          setHealthProgress(8 + Math.min(70, Math.floor((i / lines.length) * 70)));
        }

        const hex = (l.currency || '').toUpperCase();
        const issuer = l.account || l.issuer;
        if (!hex || !issuer) continue;

        const label = getDisplayTicker(hex, issuer);
        const amm = await ammInfoXrpIou(hex, issuer);

        if (!amm) {
          rows.push({
            key: tokenKey(hex, issuer),
            label,
            issuer,
            hex,
            pool: 'XRP/IOU',
            xrpRes: 0,
            iouRes: 0,
            feePct: 0,
            slip10Pct: 0,
            slip100Pct: 0,
            poolExists: false,
            score: 0,
            status: 'Caution',
            cls: 'C'
          });
          continue;
        }

        let xrpRes = 0, iouRes = 0;
        if (typeof amm.amount === 'string') xrpRes = Number(amm.amount) / XRP_TO_DROPS;
        else if (amm.amount && amm.amount.value) xrpRes = Number(amm.amount.value);
        if (amm.amount2 && amm.amount2.value) iouRes = Number(amm.amount2.value);

        const feeUnits = typeof amm.trading_fee === 'number' ? amm.trading_fee : 30;
        const feePct = feeUnits / 1000;

        function estSlip(xrpIn) {
          if (xrpIn <= 0 || xrpRes <= 0 || iouRes <= 0) return 0;
          const dy = (iouRes * xrpIn) / (xrpRes + xrpIn);
          const spot = iouRes / xrpRes;
          const eff = dy / xrpIn;
          return Math.max(0, (spot - eff) / spot);
        }

        const slip10Pct = estSlip(10) * 100;
        const slip100Pct = estSlip(100) * 100;
        const h = scoreHealth({
          poolExists: true,
          xrpRes,
          feePct,
          slip10Pct,
          slip100Pct
        });

        rows.push({
          key: tokenKey(hex, issuer),
          label,
          issuer,
          hex,
          pool: 'XRP/IOU',
          xrpRes,
          iouRes,
          feePct,
          slip10Pct,
          slip100Pct,
          score: h.score,
          status: h.status,
          cls: h.cls,
          poolExists: true
        });
      }

      setHealthProgress(82);
      setStatus(healthStatus, 'Resolving issuer TOML token images.');
      await hydrateTokenMetadata(rows);

      if (healthBody) {
        const prev = state.prevSnap || {};
        healthBody.innerHTML = rows.map(r => {
          const p = prev[r.key] || {};
          const dRes = deltaBadge(Nnum(r.xrpRes), Nnum(p.xrpRes));
          const d10 = deltaBadge(Nnum(r.slip10Pct), Nnum(p.slip10));
          const d100 = deltaBadge(Nnum(r.slip100Pct), Nnum(p.slip100));
          const isWatched = state.watchlist.has(r.key);
          const starOn = isWatched ? 'on' : '';
          const watchLabel = isWatched
            ? `Remove ${r.label} from watchlist`
            : `Add ${r.label} to watchlist`;
          return `
          <tr data-key="${r.key}" data-status="${r.cls}">
            <td><button class="icon-star ${starOn}" type="button" aria-pressed="${isWatched}" aria-label="${escapeHtml(watchLabel)}" data-token-label="${escapeHtml(r.label)}">★</button></td>
            <td>
              <div class="token-project-cell">
                <img
                  class="token-project-icon"
                  src="${escapeHtml(r.icon || iconUrlForToken(r.hex, r.issuer))}"
                  data-fallback="${escapeHtml(fallbackIconForToken(r.hex, r.issuer))}"
                  alt="${escapeHtml((r.projectName || r.label) + ' token icon')}"
                  width="24"
                  height="24"
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="no-referrer"
                >
                <div class="token-project-copy">
                  <div class="mono token-project-ticker">${escapeHtml(r.label)}</div>
                  ${r.projectName && r.projectName !== r.label
                    ? `<div class="token-project-name">${escapeHtml(r.projectName)}</div>`
                    : ''}
                  ${r.projectDomain
                    ? `<div class="token-project-domain">${escapeHtml(r.projectDomain)}</div>`
                    : ''}
                  <div class="hint token-project-ledger-id">
                    ${escapeHtml(r.hex)}<br>
                    Issuer: ${escapeHtml(r.issuer)}
                  </div>
                </div>
              </div>
            </td>
            <td>${r.pool}</td>
            <td>${r.xrpRes.toFixed(2)} XRP / ${r.iouRes.toFixed(2)} ${dRes}</td>
            <td>${r.feePct.toFixed(2)}%</td>
            <td>${r.slip10Pct.toFixed(2)}% / ${r.slip100Pct.toFixed(2)}% ${d10}</td>
            <td class="mono">${r.score}</td>
            <td><span class="pill ${r.cls}">${r.status}</span></td>
          </tr>`;
        }).join('');

        if (healthTable) healthTable.style.display = '';
        if (healthNote) healthNote.textContent = 'Use filters or export JSON for records.';

        healthBody.querySelectorAll('.token-project-icon').forEach(image => {
          image.addEventListener('error', () => {
            if (image.dataset.fallback && image.src !== image.dataset.fallback) {
              image.src = image.dataset.fallback;
            }
          }, { once: true });
        });

        healthBody.querySelectorAll('.icon-star').forEach(star => {
          star.addEventListener('click', () => {
            const tr = star.closest('tr');
            const k = tr.dataset.key;
            toggleWatch(k, star);
          });
        });
      }

      state.lastScanTs = Date.now();
      saveRowsSnapshot(rows);
      applyFilters();
      setStatus(healthStatus, 'Scan complete.', 'ok');
      setHealthProgress(100);
      setTimeout(() => setHealthProgress(0), 400);
    } catch (e) {
      setStatus(healthStatus, 'Health error: ' + (e.message || e), 'err');
      setHealthProgress(0);
    } finally {
      state.scanning = false;
    }
  }

  function updateLastScan() {
    if (!lastScanEl) return;
    if (!state.lastScanTs) {
      lastScanEl.textContent = 'Last scan: —';
      return;
    }
    const diff = Math.max(0, Math.floor((Date.now() - state.lastScanTs) / 1000));
    const m = String(Math.floor(diff / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    lastScanEl.textContent = 'Last scan: ' + m + ':' + s + ' ago';
  }

  if (lastScanEl) setInterval(updateLastScan, 60000);

  function currentRowsJson() {
    if (!healthBody) return [];
    const rows = healthBody.querySelectorAll('tr');
    const data = [];
    rows.forEach(tr => {
      if (tr.style.display === 'none') return;
      const key = tr.dataset.key;
      const tds = tr.querySelectorAll('td');
      if (!key || tds.length < 8) return;
      data.push({
        key,
        status: tds[7].innerText.trim()
      });
    });
    return data;
  }
  if (btnHealthScan) btnHealthScan.addEventListener('click', () => refreshHealth());
  if (btnHealthRetry) btnHealthRetry.addEventListener('click', () => refreshHealth());
  if (riskOnly) riskOnly.addEventListener('change', applyFilters);
  if (watchOnly) watchOnly.addEventListener('change', applyFilters);
  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const arr = currentRowsJson();
      const blob = new Blob([JSON.stringify(arr, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'liquidity-health.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  if (btnCopyJson) {
    btnCopyJson.addEventListener('click', async () => {
      try {
        const arr = currentRowsJson();
        await navigator.clipboard.writeText(JSON.stringify(arr, null, 2));
        setStatus(healthStatus, 'JSON copied.', 'ok');
      } catch {
        setStatus(healthStatus, 'Copy failed.', 'err');
      }
    });
  }

  if (btnClearLog) {
    btnClearLog.addEventListener('click', () => {
      if (logEl) logEl.textContent = '';
      setResult('Log cleared.');
    });
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    if (!healthStatus) return;
    const sentinelRefreshMs = 10 * 60 * 1000;
    state.scanTimerId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshHealth().catch(() => {});
    }, sentinelRefreshMs);
  }

  function stopAutoRefresh() {
    if (state.scanTimerId) {
      clearInterval(state.scanTimerId);
      state.scanTimerId = null;
    }
  }

  if (autoRefresh) {
    autoRefresh.checked = true;
    autoRefresh.disabled = true;
  }
  startAutoRefresh();

  async function hasTrustline() {
    return HAS_TRUSTLINE || await checkTrustline(currentAccount);
  }

  async function estimateBuy(units) {
    if (!currentAccount) return null;

    try {
      const price = await getMarketPrice('buy', units);
      if (!Number.isFinite(price) || price <= 0) return null;
      return Number(units) * price;
    } catch {
      return null;
    }
  }

  async function refreshEstimates() {
    const outEls = [est1, est25, est50, est100];
    if (!outEls.some(Boolean)) return;
    if (!currentAccount) {
      outEls.forEach(el => { if (el) el.textContent = '≈ — XRP'; });
      return;
    }
    outEls.forEach(el => { if (el) el.textContent = '…'; });
    try {
      const vals = await Promise.all([1, 25, 50, 100].map(estimateBuy));
      vals.forEach((v, i) => {
        const el = outEls[i];
        if (!el) return;
        el.textContent = '≈ ' + (typeof v === 'number' ? v.toFixed(6) + ' XRP' : '—');
      });
    } catch {
      outEls.forEach(el => { if (el) el.textContent = '≈ — XRP'; });
    }
  }

  async function quickTrust() {
    if (!setTrustBtn) return;
    setTrustBtn.click();
  }

  async function waitForQuickBuyValidation(txid) {
    let lastError = null;
    for (let attempt = 0; attempt < 36; attempt++) {
      try {
        const response = await xrplRequest({
          method: 'tx',
          params: [{ transaction: txid, binary: false }]
        });
        const result = response?.result || {};
        if (result.validated !== true) {
          await new Promise(resolve => window.setTimeout(resolve, 1400));
          continue;
        }
        const metadata = result.meta || result.metaData || {};
        const transactionResult =
          metadata.TransactionResult || metadata.transaction_result;
        if (transactionResult !== 'tesSUCCESS') {
          const error = new Error('The validated XRPL transaction did not succeed: ' + (transactionResult || 'missing result code'));
          error.finalLedgerResult = true;
          throw error;
        }
        return {
          transaction: result,
          delivered: metadata.delivered_amount || metadata.DeliveredAmount || null
        };
      } catch (error) {
        if (error.finalLedgerResult) throw error;
        lastError = error;
      }
      await new Promise(resolve => window.setTimeout(resolve, 1400));
    }
    throw lastError || new Error(
      'The transaction was submitted, but validation is not confirmed yet. Check the transaction ID before trying again.'
    );
  }

  async function quickBuy(units) {
    try {
      if (!currentAccount) throw new Error('Connect Xaman first.');
      if (!await hasTrustline()) throw new Error('Add the JCS trustline first.');

      const requestedJcs = Number(units);
      if (!Number.isFinite(requestedJcs) || requestedJcs <= 0) {
        throw new Error('Enter a valid JCS amount.');
      }

      setStatus(
        buyStatus,
        'Preparing a validated JCS/XRP AMM and DEX quote…'
      );

      const price = await getMarketPrice('buy', requestedJcs);
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error('No executable JCS/XRP AMM or order-book price is available.');
      }

      const estimatedXrp = requestedJcs * price;
      const maximumXrp = estimatedXrp * (1 + SLIPPAGE_PCT / 100);
      const maximumDrops = Math.max(
        1,
        Math.ceil(maximumXrp * XRP_TO_DROPS)
      );

      const transaction = {
        TransactionType: 'OfferCreate',
        TakerGets: String(maximumDrops),
        TakerPays: {
          currency: CURRENCY_HEX,
          issuer: ISSUER,
          value: String(requestedJcs)
        },
        // Fill or Kill prevents an unfilled remainder from becoming an open order.
        Flags: 0x00040000
      };

      setStatus(
        buyStatus,
        'Review the exact JCS amount and maximum XRP cost in Xaman. XRPL will use the best available AMM, order-book, or combined liquidity.'
      );

      const signed = await signWithSentinel(transaction, 'quickbuy');
      const txid = signed?.txid;

      if (!txid) {
        throw new Error(
          'Xaman did not return a transaction ID for the Quick Buy.'
        );
      }

      setStatus(
        buyStatus,
        'Quick Buy submitted. Waiting for validated XRPL confirmation…'
      );

      await waitForQuickBuyValidation(txid);
      const deliveredText = formatTradeNumber(requestedJcs, 6) + ' ' + APP_NAME;

      setStatus(
        buyStatus,
        'Quick Buy validated: ' + deliveredText +
          ' · ' + txid.slice(0, 10) + '…' + txid.slice(-8),
        'ok'
      );

      setResult(
        'Validated AMM/DEX Quick Buy · ' + deliveredText +
          ' · Transaction: ' + txid
      );
      document.dispatchEvent(new CustomEvent('jcs:validated-transaction', {
        detail: { kind:'quick-buy', txid, side:'buy', amountJcs:requestedJcs, referencePriceXrpPerJcs:price }
      }));

      ammSnapshotCache = null;
      await Promise.allSettled([
        refreshAll(),
        fetchBalances(),
        refreshEstimates()
      ]);
    } catch (error) {
      setStatus(
        buyStatus,
        'Quick Buy error: ' + (error?.message || error),
        'err'
      );
    }
  }

  if (btnRefreshEst) btnRefreshEst.addEventListener('click', () => refreshEstimates());
  if (btnTrustJCS) btnTrustJCS.addEventListener('click', () => quickTrust());
  if (buy1) buy1.addEventListener('click', () => quickBuy(1));
  if (buy25) buy25.addEventListener('click', () => quickBuy(25));
  if (buy50) buy50.addEventListener('click', () => quickBuy(50));
  if (buy100) buy100.addEventListener('click', () => quickBuy(100));

  let liquiditySigning = false;
  window.JCSWallet = Object.freeze({
    getAccount: () => currentAccount,
    request: xrplRequest,
    async submitLiquidity(transaction) {
      if (liquiditySigning) throw new Error('A liquidity request is already awaiting your review.');
      const account = currentAccount;
      if (!account || transaction.Account !== account) throw new Error('Your connected wallet changed. Review again.');
      const allowed = new Set(['TransactionType', 'Account', 'Asset', 'Asset2', 'Amount', 'Amount2', 'LPTokenIn', 'Flags', 'Fee', 'LastLedgerSequence']);
      if (Object.keys(transaction).some(key => !allowed.has(key))) throw new Error('Unexpected liquidity transaction field.');
      if (transaction.Asset?.currency !== 'XRP' || Object.keys(transaction.Asset).length !== 1 ||
          transaction.Asset2?.currency !== CURRENCY_HEX || transaction.Asset2?.issuer !== ISSUER || Object.keys(transaction.Asset2).length !== 2) {
        throw new Error('The transaction must use the configured JCS/XRP pool.');
      }
      const deposit = transaction.TransactionType === 'AMMDeposit' && transaction.Flags === 1048576 &&
        typeof transaction.Amount === 'string' && /^\d+$/.test(transaction.Amount) && BigInt(transaction.Amount) > 0n &&
        transaction.Amount2?.currency === CURRENCY_HEX && transaction.Amount2?.issuer === ISSUER &&
        Number.isFinite(Number(transaction.Amount2.value)) && Number(transaction.Amount2.value) > 0 && !transaction.LPTokenIn;
      const withdraw = transaction.TransactionType === 'AMMWithdraw' && transaction.Flags === 65536 &&
        transaction.LPTokenIn?.issuer && /^03[0-9A-F]{38}$/.test(transaction.LPTokenIn.currency || '') &&
        Number.isFinite(Number(transaction.LPTokenIn.value)) && Number(transaction.LPTokenIn.value) > 0 && !transaction.Amount && !transaction.Amount2;
      if (!deposit && !withdraw) throw new Error('Unsupported liquidity operation.');
      if (!Number.isInteger(transaction.LastLedgerSequence) || !/^\d+$/.test(transaction.Fee) ||
          Number(transaction.Fee) < 1 || Number(transaction.Fee) > 10000) throw new Error('A bounded fee and ledger expiry are required.');
      const last = await getLedgerSummary();
      if (!last.validated || transaction.LastLedgerSequence <= Number(last.index) || transaction.LastLedgerSequence > Number(last.index) + 25) {
        throw new Error('This review has expired. Prepare it again.');
      }
      if (currentAccount !== account) throw new Error('Your connected wallet changed. Review again.');
      liquiditySigning = true;
      let submittedTxid = null;
      let receiptValidated = false;
      try {
        const signed = await signWithSentinel(transaction, deposit ? 'liquidity-add' : 'liquidity-remove');
        if (!/^[A-F0-9]{64}$/i.test(signed.txid || '')) throw new Error('Xaman returned an invalid transaction ID.');
        submittedTxid = signed.txid;
        const receipt = await waitForQuickBuyValidation(signed.txid);
        const actual = receipt.transaction.tx_json || receipt.transaction;
        const confirmedHash = String(receipt.transaction.hash || actual.hash || '');
        if (confirmedHash.toUpperCase() !== signed.txid.toUpperCase()) {
          throw new Error('The ledger response could not be matched to the submitted transaction. Check transaction ' + signed.txid + '.');
        }
        receiptValidated = true;
        const normalizedDecimal = (value) => {
          const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
          if (!match) return String(value);
          let digits = (match[2] + (match[3] || '')).replace(/^0+/, '') || '0';
          let exponent = Number(match[4] || 0) - (match[3] || '').length;
          while (digits.length > 1 && digits.endsWith('0')) { digits = digits.slice(0, -1); exponent++; }
          return digits === '0' ? '0' : match[1] + digits + 'e' + exponent;
        };
        const same = (a, b) => {
          if (a && b && typeof a === 'object' && typeof b === 'object') {
            return Object.keys(a).every(key => same(a[key], b[key]));
          }
          return normalizedDecimal(a) === normalizedDecimal(b);
        };
        if (!Object.keys(transaction).every(key => key === 'Flags'
          ? (Number(actual[key]) & 0x7fffffff) === transaction[key]
          : same(transaction[key], actual[key]))) {
          throw new Error('The validated transaction differs from the reviewed request. Inspect transaction ' + signed.txid + ' before doing anything else.');
        }
        document.dispatchEvent(new CustomEvent('jcs:validated-transaction', {
          detail: { kind: deposit ? 'liquidity-add' : 'liquidity-remove', txid: signed.txid }
        }));
        await refreshAll({ force: true });
        return { txid: signed.txid, validated: true, ledgerIndex: receipt.transaction.ledger_index };
      } catch (error) {
        if (submittedTxid) {
          error.txid = submittedTxid;
          error.unconfirmed = !receiptValidated && !error.finalLedgerResult;
        }
        throw error;
      } finally { liquiditySigning = false; }
    }
  });

  let refreshing = false;
  let lastRefreshStarted = 0;

  async function refreshAll({ force = false } = {}) {
    if (refreshing || (!force && Date.now() - lastRefreshStarted < 60000)) return;
    lastRefreshStarted = Date.now();
    refreshing = true;
    try {
      await Promise.allSettled([
        refreshLedger(),
        refreshBook(),
        refreshSummary(),
        currentAccount ? fetchBalances() : Promise.resolve(),
        currentAccount ? fetchOffers(currentAccount) : Promise.resolve(),
        currentAccount ? refreshEstimates() : Promise.resolve()
      ]);
    } finally {
      refreshing = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAll().catch(() => {});
  });
  window.addEventListener('focus', () => { refreshAll().catch(() => {}); });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') refreshAll().catch(() => {});
  }, 60000);

  APP_INITIALIZED = true;
  updateWalletButtons();
  refreshAll().catch(() => {});
})();
