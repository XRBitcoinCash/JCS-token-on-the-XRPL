/* JCS public ledger adapter. Read-only; no signing, proxy, or automatic RPC retries. */
export const ISSUER = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
export const CURRENCY = 'JCS';
const ENDPOINTS = ['wss://xrplcluster.com/', 'wss://s2.ripple.com/', 'wss://s1.ripple.com/'];
const AMENDMENTS = '7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4';
const CANDIDATE_TAXONS = new Set([1246974803, 1245926211, 20260913]);
const READ_ONLY = new Set(['server_info', 'ledger', 'account_info', 'amm_info', 'book_offers', 'ledger_entry', 'account_lines', 'account_tx', 'account_nfts', 'tx']);
const HASH = /^[A-Fa-f0-9]{64}$/;
const ADDRESS = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const NUMBER = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?$/;
const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const errorText = error => String(error?.message || error || 'Source unavailable');
const finite = value => (typeof value === 'number' || (typeof value === 'string' && value.length < 100 && NUMBER.test(value))) && Number.isFinite(Number(value)) ? Number(value) : null;
const positiveInteger = value => { const n = finite(value); return Number.isSafeInteger(n) && n > 0 ? n : null; };
const pagesLimit = (value, cap) => Number.isInteger(value) ? Math.max(1, Math.min(cap, value)) : cap;
const isJcs = amount => amount && typeof amount === 'object' && amount.currency === CURRENCY && amount.issuer === ISSUER;

function amountValue(amount, asset) {
  if (asset === 'XRP') {
    if (typeof amount !== 'string' || !/^\d+$/.test(amount)) return null;
    const drops = finite(amount);
    return drops !== null && Number.isSafeInteger(drops) ? drops / 1e6 : null;
  }
  return isJcs(amount) ? finite(amount.value) : null;
}

/** Pool identity must match JCS's exact issuer and currency, not just its ticker. */
export function parseAmm(input) {
  const amm = input?.amm || input;
  if (!amm || typeof amm !== 'object') return null;
  const a = amm.amount ?? amm.Amount, b = amm.amount2 ?? amm.Amount2;
  const xrp = amountValue(typeof a === 'string' ? a : b, 'XRP');
  const jcs = amountValue(typeof a === 'string' ? b : a, CURRENCY);
  if (xrp === null || jcs === null || xrp < 0 || jcs < 0) return null;
  const rawFee = finite(amm.trading_fee ?? amm.TradingFee);
  const fee = Number.isInteger(rawFee) && rawFee >= 0 && rawFee <= 1000 ? rawFee : null;
  const price = jcs > 0 && Number.isFinite(xrp / jcs) ? xrp / jcs : null;
  return {xrp, jcs, fee, feePercent: fee === null ? null : fee / 1000, price,
    account: typeof amm.account === 'string' ? amm.account : null, lpToken: amm.lp_token || null};
}

/** Approximate displayed funding; never an executable quote or proof of all market depth. */
export function summarizeBook(input, side = 'ask') {
  if (!['ask', 'bid'].includes(side)) throw new Error('Book side must be ask or bid');
  const rows = Array.isArray(input) ? input : input?.offers;
  if (!Array.isArray(rows)) return null;
  const result = {best: null, jcs: 0, xrp: 0, offerCount: 0, totalOffers: rows.length, excluded: 0, offers: []};
  const budgets = new Map(), spent = new Map();
  const getsAsset = side === 'ask' ? CURRENCY : 'XRP', paysAsset = side === 'ask' ? 'XRP' : CURRENCY;
  // An owner_funds budget covers all this owner's offers in this returned book.
  for (const offer of rows) {
    if (!offer || !owns(offer, 'owner_funds') || !ADDRESS.test(offer.Account || '')) continue;
    const value = finite(offer.owner_funds);
    const budget = value !== null && value >= 0 ? value / (getsAsset === 'XRP' ? 1e6 : 1) : 0;
    const previous = budgets.get(offer.Account);
    budgets.set(offer.Account, previous === undefined ? budget : Math.min(previous, budget));
  }
  for (const offer of rows) {
    if (!offer || !ADDRESS.test(offer.Account || '')) { result.excluded++; continue; }
    const gets = amountValue(offer.TakerGets, getsAsset), pays = amountValue(offer.TakerPays, paysAsset);
    if (!(gets > 0) || !(pays > 0)) { result.excluded++; continue; }
    // XRPL omits funded fields for fully funded offers; zero funded is never a fallback.
    let ratio = 1;
    for (const [key, asset, nominal] of [['taker_gets_funded', getsAsset, gets], ['taker_pays_funded', paysAsset, pays]]) {
      if (!owns(offer, key)) continue;
      const funded = amountValue(offer[key], asset);
      ratio = funded !== null && funded >= 0 ? Math.min(ratio, funded / nominal) : 0;
    }
    if (budgets.has(offer.Account)) ratio = Math.min(ratio, Math.max(0, budgets.get(offer.Account) - (spent.get(offer.Account) || 0)) / gets);
    const fundedGets = gets * ratio, fundedPays = pays * ratio;
    const jcs = side === 'ask' ? fundedGets : fundedPays, xrp = side === 'ask' ? fundedPays : fundedGets;
    const price = xrp / jcs;
    if (!(jcs > 0) || !(xrp > 0) || !Number.isFinite(price) || !Number.isFinite(result.jcs + jcs) || !Number.isFinite(result.xrp + xrp)) { result.excluded++; continue; }
    spent.set(offer.Account, (spent.get(offer.Account) || 0) + fundedGets);
    result.jcs += jcs; result.xrp += xrp; result.offerCount++;
    result.best = result.best === null ? price : side === 'ask' ? Math.min(result.best, price) : Math.max(result.best, price);
    result.offers.push({account: offer.Account, sequence: positiveInteger(offer.Sequence), jcs, xrp, price});
  }
  return result;
}

class RpcError extends Error {
  constructor(message, kind = 'rpc') { super(message); this.name = 'LedgerError'; this.kind = kind; }
}

class Socket {
  constructor(url, onEvent, onClosed) {
    this.url = url; this.onEvent = onEvent; this.onClosed = onClosed;
    this.ws = null; this.pending = new Map(); this.nextId = 1; this.disposed = false;
  }
  get open() { return this.ws?.readyState === 1 && !this.disposed; }
  async connect() {
    if (typeof WebSocket !== 'function') throw new RpcError('This browser does not provide WebSocket access.', 'transport');
    await new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return; settled = true; clearTimeout(timer);
        if (error) { reject(error); this.close(); } else resolve();
      };
      const timer = setTimeout(() => finish(new RpcError('Connection timed out after 8 seconds.', 'transport')), 8000);
      try { this.ws = new WebSocket(this.url); } catch (error) { finish(new RpcError(errorText(error), 'transport')); return; }
      this.ws.addEventListener('open', () => finish());
      this.ws.addEventListener('error', () => finish(new RpcError('Public ledger endpoint could not be reached.', 'transport')));
      this.ws.addEventListener('close', () => {
        finish(new RpcError('Ledger connection closed.', 'transport'));
        this.rejectPending(new RpcError('Ledger connection closed before the response.', 'transport'));
        this.onClosed?.();
      });
      this.ws.addEventListener('message', event => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (!data || typeof data !== 'object') return;
        if (owns(data, 'id') && this.pending.has(data.id)) {
          const request = this.pending.get(data.id); this.pending.delete(data.id); clearTimeout(request.timer);
          const response = data.result || data;
          if (data.error || data.status === 'error' || response.error || response.status === 'error') request.reject(new RpcError(response.error_message || data.error_message || response.error || data.error || 'Ledger request rejected.'));
          else request.resolve(response);
        } else if (data.type === 'ledgerClosed') this.onEvent?.(data);
      });
    });
    return this;
  }
  call(command, params = {}) {
    if (!this.open) return Promise.reject(new RpcError('Ledger socket is not connected.', 'transport'));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new RpcError(`${command}: no response within 12 seconds.`, 'timeout')); }, 12000);
      this.pending.set(id, {resolve, reject, timer});
      try { this.ws.send(JSON.stringify({...params, id, command, api_version: 2})); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(new RpcError(errorText(error), 'transport')); }
    });
  }
  rejectPending(error) { for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); } this.pending.clear(); }
  close() { this.disposed = true; this.rejectPending(new RpcError('Ledger connection stopped.', 'transport')); try { this.ws?.close(); } catch {} }
}

/** One client instance owns one shared handshake, at most three requests, and one subscription. */
export class LedgerClient {
  constructor({onStatus, onLedger} = {}) {
    this.onStatus = onStatus; this.onLedger = onLedger;
    this._socket = null; this._connecting = null; this._snapshot = null; this._opening = null;
    this._active = 0; this._waiting = []; this._closed = false; this._generation = 0;
    this._endpoint = ''; this._subscriptionError = null;
  }
  get endpoint() { return this._endpoint; }
  _status(state, message) { try { this.onStatus?.({state, message, endpoint: this.endpoint}); } catch {} }
  connect() {
    if (this._closed) return Promise.reject(new RpcError('Ledger client is closed.', 'transport'));
    if (this._socket?.open) return Promise.resolve(this);
    if (!this._connecting) {
      const task = this._connectNetwork(); this._connecting = task;
      task.finally(() => { if (this._connecting === task) this._connecting = null; }).catch(() => {});
    }
    return this._connecting;
  }
  async _connectNetwork() {
    const generation = this._generation;
    let lastError;
    for (const endpoint of ENDPOINTS) {
      if (this._closed || generation !== this._generation) throw new RpcError('Ledger connection canceled.', 'transport');
      this._endpoint = endpoint; this._status('connecting', 'Connecting to a public Mainnet source…');
      const socket = new Socket(endpoint, event => {
        if (this._socket !== socket || !positiveInteger(event.ledger_index)) return;
        try { this.onLedger?.(event); } catch {}
      }, () => { if (this._socket === socket && !this._closed) this._status('disconnected', 'Connection closed. Refresh to reconnect.'); });
      this._opening = socket;
      try {
        await socket.connect();
        const result = await socket.call('server_info');
        const info = result?.info;
        if (!info || typeof info !== 'object') throw new RpcError('Mainnet server information is unavailable.');
        if (info.network_id !== undefined && finite(info.network_id) !== 0) throw new RpcError('The source reports a non-Mainnet network. Refusing its data.', 'network');
        if (this._closed || generation !== this._generation) throw new RpcError('Ledger connection canceled.', 'transport');
        this._socket = socket; this._opening = null; this._subscriptionError = null;
        try { await socket.call('subscribe', {streams: ['ledger']}); }
        catch (error) { this._subscriptionError = errorText(error); }
        this._status('connected', this._subscriptionError ? 'Connected; live ledger notifications unavailable. Manual refresh remains available.' : 'Connected to XRPL Mainnet.');
        return this;
      } catch (error) {
        socket.close(); if (this._opening === socket) this._opening = null;
        if (this._socket === socket) this._socket = null;
        lastError = error;
        // A deterministic API rejection is not solved by resending it to other servers.
        if (!['transport', 'timeout', 'network'].includes(error.kind)) break;
      }
    }
    this._status('unavailable', errorText(lastError));
    throw lastError || new RpcError('No public Mainnet connection is available.', 'transport');
  }
  async rpc(command, params = {}) {
    if (!READ_ONLY.has(command)) throw new RpcError('This adapter supports only public read-only methods.');
    await this.connect();
    if (this._active >= 3) await new Promise((resolve, reject) => this._waiting.push({resolve, reject}));
    else this._active++;
    try {
      if (this._closed || !this._socket?.open) throw new RpcError('Ledger connection is no longer available. Refresh to reconnect.', 'transport');
      return await this._socket.call(command, params);
    } finally {
      const next = this._waiting.shift(); if (next) next.resolve(); else this._active--;
    }
  }
  snapshot() {
    if (!this._snapshot) {
      const task = this._takeSnapshot(); this._snapshot = task;
      task.finally(() => { if (this._snapshot === task) this._snapshot = null; }).catch(() => {});
    }
    return this._snapshot;
  }
  async _takeSnapshot() {
    const output = {at: new Date().toISOString(), ledger: null, server: null, account: null, amm: null, asks: null, bids: null, amendments: null, errors: {}};
    try { output.server = await this.rpc('server_info'); }
    catch (error) { output.errors.server = errorText(error); output.errors.ledger = 'No Mainnet connection could be established.'; return output; }
    try {
      const result = await this.rpc('ledger', {ledger_index: 'validated', transactions: false, expand: false});
      const header = result.ledger || {};
      const index = positiveInteger(result.ledger_index ?? header.ledger_index), hash = result.ledger_hash || header.ledger_hash || header.hash;
      if (result.validated !== true || !index || !HASH.test(hash || '')) throw new RpcError('The source did not provide a validated ledger hash.');
      const seconds = finite(header.close_time);
      const milliseconds = seconds === null ? NaN : (seconds + 946684800) * 1000;
      const closeTime = Number.isFinite(milliseconds) && !Number.isNaN(new Date(milliseconds).getTime()) ? new Date(milliseconds).toISOString() : null;
      output.ledger = {index, hash: hash.toUpperCase(), closeTime, age: closeTime ? Math.max(0, (Date.now() - milliseconds) / 1000) : null};
    } catch (error) { output.errors.ledger = errorText(error); return output; }
    const pin = {ledger_hash: output.ledger.hash};
    const requests = [
      ['account', 'account_info', {account: ISSUER, ...pin}],
      ['amm', 'amm_info', {asset: {currency: 'XRP'}, asset2: {currency: CURRENCY, issuer: ISSUER}, ...pin}],
      ['asks', 'book_offers', {taker_gets: {currency: CURRENCY, issuer: ISSUER}, taker_pays: {currency: 'XRP'}, limit: 40, ...pin}],
      ['bids', 'book_offers', {taker_gets: {currency: 'XRP'}, taker_pays: {currency: CURRENCY, issuer: ISSUER}, limit: 40, ...pin}],
      ['amendments', 'ledger_entry', {index: AMENDMENTS, binary: false, ...pin}]
    ];
    await Promise.all(requests.map(async ([key, method, params]) => {
      try { const result = await this.rpc(method, params); this._validatePin(result, output); output[key] = result; }
      catch (error) { output.errors[key] = errorText(error); }
    }));
    if (this._subscriptionError) output.errors.subscription = this._subscriptionError;
    return output;
  }
  _pin(snapshot) {
    const ledger = snapshot?.ledger;
    if (!ledger || !positiveInteger(ledger.index) || !HASH.test(ledger.hash || '')) throw new RpcError('Load a validated snapshot before scanning.');
    return ledger;
  }
  _validatePin(result, snapshot) {
    const pin = this._pin(snapshot);
    if (result?.validated === false || (result?.ledger_hash && result.ledger_hash.toUpperCase() !== pin.hash.toUpperCase()) || (result?.ledger_index !== undefined && positiveInteger(result.ledger_index) !== pin.index) || result?.ledger_current_index !== undefined) throw new RpcError('The source returned data outside the requested validated snapshot.');
  }
  async _pages(method, params, key, snapshot, maxPages) {
    const ledger = this._pin(snapshot), values = [], seen = new Set();
    let marker, pages = 0, complete = false, error = null;
    for (let page = 0; page < maxPages; page++) {
      try {
        const result = await this.rpc(method, {...params, ledger_hash: ledger.hash, limit: 400, ...(marker === undefined ? {} : {marker})});
        this._validatePin(result, snapshot);
        if (!Array.isArray(result[key])) throw new RpcError(`${method}: expected records were missing.`);
        values.push(...result[key]); pages++;
        marker = result.marker;
        if (marker === undefined || marker === null) { complete = true; break; }
        const signature = JSON.stringify(marker);
        if (seen.has(signature)) throw new RpcError(`${method}: source repeated a pagination marker.`);
        seen.add(signature);
      } catch (failure) { error = errorText(failure); break; }
    }
    return {ledger: ledger.index, ledgerHash: ledger.hash, complete, values: pages ? values : null, pages, error, truncated: !complete && !error};
  }
  async scanLines(snapshot, {maxPages = 12} = {}) {
    const {values, ...rest} = await this._pages('account_lines', {account: ISSUER}, 'lines', snapshot, pagesLimit(maxPages, 12));
    return {...rest, lines: values?.filter(line => line.currency === CURRENCY) ?? null};
  }
  async scanHistory(snapshot, {maxPages = 10} = {}) {
    const ledger = this._pin(snapshot), entries = [], markers = new Set();
    let marker, pages = 0, complete = false, error = null, ledgerMin = null, ledgerMax = null;
    for (let page = 0; page < pagesLimit(maxPages, 10); page++) {
      try {
        const result = await this.rpc('account_tx', {account: ISSUER, ledger_index_min: ledgerMin ?? -1, ledger_index_max: ledger.index, binary: false, forward: false, limit: 200, ...(marker === undefined ? {} : {marker})});
        const minimum = positiveInteger(result.ledger_index_min), maximum = positiveInteger(result.ledger_index_max);
        if (!minimum || !maximum || minimum > maximum || maximum > ledger.index || !Array.isArray(result.transactions)) throw new RpcError('History response did not report a valid bounded ledger range.');
        if (pages && (minimum !== ledgerMin || maximum !== ledgerMax)) throw new RpcError('The source changed history coverage while paginating.');
        ledgerMin = minimum; ledgerMax = maximum; pages++; entries.push(...result.transactions);
        marker = result.marker;
        if (marker === undefined || marker === null) { complete = true; break; }
        const signature = JSON.stringify(marker);
        if (markers.has(signature)) throw new RpcError('History source repeated a pagination marker.');
        markers.add(signature);
      } catch (failure) { error = errorText(failure); break; }
    }
    return {ledger: ledger.index, ledgerHash: ledger.hash, complete, entries: pages ? entries : null, pages, ledgerMin, ledgerMax, error, truncated: !complete && !error};
  }
  async wallet(account, snapshot) {
    if (!ADDRESS.test(account || '')) throw new RpcError('A valid classic XRPL account address is required.');
    const ledger = this._pin(snapshot);
    const [lines, nfts] = await Promise.all([
      this._pages('account_lines', {account, peer: ISSUER}, 'lines', snapshot, 8),
      this._pages('account_nfts', {account}, 'account_nfts', snapshot, 8)
    ]);
    return {account, ledger: ledger.index, ledgerHash: ledger.hash,
      lines: lines.values?.filter(line => line.account === ISSUER && line.currency === CURRENCY) ?? null,
      // A matching taxon is only a candidate: self-minted prayer NFTs need registration verification.
      nfts: nfts.values?.filter(nft => CANDIDATE_TAXONS.has(finite(nft.NFTokenTaxon ?? nft.nft_taxon))) ?? null,
      complete: lines.complete && nfts.complete, linesComplete: lines.complete, nftsComplete: nfts.complete,
      pages: {lines: lines.pages, nfts: nfts.pages}, errors: {lines: lines.error, nfts: nfts.error}};
  }
  close() {
    this._closed = true; this._generation++;
    this._opening?.close(); this._socket?.close(); this._opening = null; this._socket = null;
    for (const waiter of this._waiting.splice(0)) waiter.reject(new RpcError('Ledger client closed.', 'transport'));
  }
}
