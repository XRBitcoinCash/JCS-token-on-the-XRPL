// Real page/core integration with fake wallet and ledger services. No network or signing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.resolve(__dirname, '..');
const issuer = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
const account = 'rSigningFixtureWallet';
const asset = { currency: 'JCS', issuer };
const hash = 'B'.repeat(64);
const seq = 100000001;
const payloadUrl = 'https://xumm.app/sign/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const qrUrl = 'https://xumm.app/sign/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee_q.png';
const tx = {
  TransactionType: 'AMMDeposit', Account: account,
  Asset: { currency: 'XRP' }, Asset2: asset,
  Flags: 1048576, Amount: '400000', Amount2: { ...asset, value: '10000' },
  Fee: '12', LastLedgerSequence: seq + 20
};

async function flush() {
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
}

async function fixture({ mobile = false, pushed = true, createSubscribe = true,
  signedResponse = { txid: hash, dispatched_nodetype: 'MAINNET' } } = {}) {
  const errors = [], navigation = [], timers = new Map(), calls = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', error => {
    if (/navigation/i.test(error.message)) navigation.push(error.message);
    else errors.push(error.message);
  });
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://jesuschristsavestoken.com/', runScripts: 'outside-only',
    pretendToBeVisual: true, virtualConsole
  });
  const w = dom.window;
  const state = { callback: null, resolve: null, details: { meta: { resolved: false, signed: false } } };
  let timer = 0, sdk;
  Object.defineProperty(w.navigator, 'userAgent', {
    configurable: true,
    value: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0 Safari/537.36'
  });
  w.matchMedia = query => ({ matches: mobile && /pointer: ?coarse|max-width/.test(query), addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.setInterval = () => ++timer;
  w.clearInterval = () => {};
  w.setTimeout = (fn, ms = 0) => {
    const id = ++timer;
    if (ms < 100) queueMicrotask(fn);
    else timers.set(id, { fn, ms });
    return id;
  };
  w.clearTimeout = id => timers.delete(id);
  w.open = (...args) => { navigation.push(args); return null; };
  w.confirm = () => false;
  w.fetch = async () => { throw new Error('Unexpected external request'); };
  w.addEventListener('error', event => errors.push(event.error?.message || event.message));
  w.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  w.xrpl = {
    Client: class {
      async connect() { this.connected = true; }
      async disconnect() { this.connected = false; }
      isConnected() { return this.connected; }
      async request(q) {
        let r = { validated: true, ledger_index: seq, ledger_hash: 'A'.repeat(64) };
        switch (q.command) {
          case 'ledger': r.ledger = { ledger_index: seq, ledger_hash: 'A'.repeat(64), close_time_human: new Date().toISOString() }; break;
          case 'amm_info': r.amm = { account: 'rPoolFixture', amount: '400000000', amount2: { ...asset, value: '10000000' }, lp_token: { currency: '03' + 'A'.repeat(38), issuer: 'rPoolFixture', value: '10000' }, trading_fee: 500 }; break;
          case 'account_lines': r.lines = q.peer === 'rPoolFixture' ? [{ account: 'rPoolFixture', currency: '03' + 'A'.repeat(38), balance: '100', limit: '1000000' }] : [{ account: issuer, currency: 'JCS', balance: '1000000', limit: '21000000' }]; break;
          case 'account_info': r.account_data = { Balance: '100000000', OwnerCount: 2, Flags: 0, Sequence: 1 }; break;
          case 'server_info': r.info = { server_state: 'full', validated_ledger: { seq, reserve_base_xrp: 1, reserve_inc_xrp: .2, base_fee_xrp: .00001 } }; break;
          case 'fee': r.drops = { open_ledger_fee: '12', minimum_fee: '10' }; break;
          case 'book_offers': case 'account_offers': r.offers = []; break;
          case 'gateway_balances': r.obligations = { JCS: '10000000' }; break;
          case 'account_nfts': r.account_nfts = []; break;
          case 'tx': r = { ...calls.at(-1).txjson, hash, validated: true, ledger_index: seq + 2, meta: { TransactionResult: 'tesSUCCESS' } }; break;
          default: throw new Error('Unhandled ledger command: ' + q.command);
        }
        return { result: r };
      }
    }
  };
  w.Xumm = class {
    constructor() {
      sdk = this;
      this.events = {};
      this.user = { account: Promise.resolve(account) };
      const create = async request => {
        calls.push(request);
        state.details = { meta: { resolved: false, signed: false } };
        return { uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', pushed, refs: { qr_png: qrUrl }, next: { always: payloadUrl } };
      };
      const subscribe = async (created, callback) => {
        state.callback = callback;
        const resolved = new Promise(resolve => { state.resolve = resolve; });
        return { created, resolved, websocket: { close() {} } };
      };
      this.payload = {
        ...(createSubscribe ? { create, subscribe } : {}),
        createAndSubscribe: async (request, callback) => subscribe(await create(request), callback),
        get: async () => state.details
      };
    }
    on(name, callback) { this.events[name] = callback; }
    async authorize() { return { account }; }
    async logout() { this.events.logout?.(); }
  };
  w.eval(fs.readFileSync(path.join(root, 'js/jcs-core.js'), 'utf8'));
  w.eval(fs.readFileSync(path.join(root, 'js/jcs-liquidity.js'), 'utf8'));
  await sdk.events.ready();
  await flush();
  const $ = id => w.document.getElementById(id);
  $('jcsTabLiquidity').click();
  await flush();
  assert.equal($('jcsTradePanel').hidden, true, 'Regression setup selects Liquidity and hides Trade');
  assert.deepEqual(errors, [], 'Real core initializes without runtime errors');

  async function start() {
    // Attach the rejection handler immediately so reject/expiry tests never leak a rejection.
    const result = w.JCSWallet.submitLiquidity({ ...tx }).then(value => ({ value }), error => ({ error }));
    await flush();
    return { result };
  }
  async function event(data) {
    if ('signed' in data || data.expired) {
      state.details = {
        meta: { resolved: true, signed: data.signed === true, expired: data.expired === true },
        response: data.signed ? signedResponse : {}
      };
    }
    const resolution = await state.callback({ data });
    if (resolution !== undefined) state.resolve(resolution);
    await flush();
  }
  function assertNoActiveQr() {
    assert.equal($('xamanPayloadQr').hidden, true, 'Terminal request hides its QR');
    assert.equal($('xamanPayloadQr').hasAttribute('src'), false, 'Terminal request removes the stale QR URL');
    assert.equal($('xamanOpenPayload').hidden, true, 'Terminal request hides the old signing link');
    assert.ok(!['https:', 'xumm:', 'xaman:'].some(protocol => String($('xamanOpenPayload').getAttribute('href')).startsWith(protocol)), 'Terminal request removes the signing target');
  }
  return { dom, w, $, calls, errors, navigation, timers, state, start, event, assertNoActiveQr, close: () => dom.window.close() };
}

const suiteTimeout = setTimeout(() => {
  console.error('Xaman signing regression timed out; a lifecycle promise never resolved.');
  process.exit(1);
}, 15000);
(async () => {
  let checks = 0, f;
  try {
    f = await fixture();
    let pending = await f.start();
    const panel = f.$('xamanSignPanel');
    assert.equal(panel.hidden, false, 'Signing is visible while the Liquidity tab is active');
    assert.equal(panel.parentElement.closest('[hidden]'), null, 'Signing has no hidden trade-tab ancestor');
    assert.ok(panel.tagName === 'DIALOG' || panel.getAttribute('role') === 'dialog');
    if (panel.tagName === 'DIALOG') assert.equal(panel.open, true, 'Native dialog is actually open');
    else assert.equal(panel.getAttribute('aria-modal'), 'true');
    assert.equal(f.$('xamanPayloadQr').hidden, false, 'Desktop gets the QR even when provider push succeeds');
    assert.equal(f.$('xamanPayloadQr').src, qrUrl);
    assert.equal(f.$('xamanOpenPayload').href, payloadUrl);
    assert.equal(f.calls[0].options.expire, 3, 'Provider expiry is minutes, not seconds');
    assert.ok(/\d{6}/.test(f.$('xamanSecurityCode').textContent), 'Verification code is visible');
    const memoCode = Buffer.from(f.calls[0].txjson.Memos[0].Memo.MemoData, 'hex').toString();
    assert.ok(f.$('xamanSecurityCode').textContent.includes(memoCode), 'Visible verification code matches the request memo');
    assert.equal(f.w.document.activeElement.id, 'xamanSignTitle', 'Desktop dialog receives keyboard focus');
    assert.deepEqual(f.navigation, [], 'Desktop never opens a signing page automatically');
    checks++;

    const second = await f.start();
    assert.match((await second.result).error.message, /already/i);
    assert.equal(f.calls.length, 1, 'Repeated submit cannot create a second signing payload');
    checks++;

    const qr = f.$('xamanPayloadQr').getAttribute('src');
    f.$('xamanClosePanel').click();
    assert.equal(panel.hidden, true, 'Hide dismisses only the dialog');
    const reopen = f.$('xamanReopenPanel');
    assert.ok(reopen && !reopen.hidden, 'Pending signing can be reopened');
    reopen.click();
    assert.equal(panel.hidden, false);
    assert.equal(f.$('xamanPayloadQr').getAttribute('src'), qr, 'Reopening preserves the same request QR');
    assert.equal(f.calls.length, 1);
    checks++;

    await f.event({ opened: true });
    assert.match(f.$('xamanSignStatus').textContent, /open/i);
    assert.equal(f.$('xamanPayloadQr').hidden, false, 'Opening in wallet does not prematurely clear QR');
    await f.event({ signed: false });
    assert.match((await pending.result).error.message, /not signed|reject|cancel/i);
    f.assertNoActiveQr();
    checks++;

    pending = await f.start();
    assert.equal(f.calls.length, 2, 'A rejected request releases the signing lock');
    await f.event({ signed: true });
    const signed = await pending.result;
    assert.equal(signed.error, undefined);
    assert.equal(signed.value.validated, true);
    assert.equal(signed.value.txid, hash);
    f.assertNoActiveQr();
    checks++;
    f.close();

    f = await fixture({ mobile: true });
    pending = await f.start();
    assert.equal(f.$('xamanOpenPayload').hidden, false);
    assert.equal(f.$('xamanOpenPayload').href, payloadUrl, 'Phone uses the provider universal link');
    assert.equal(f.$('xamanOpenPayload').target, '_self', 'Phone opens Xaman in the same-device navigation context');
    assert.equal(f.w.document.activeElement.id, 'xamanOpenPayload', 'Phone focuses its explicit handoff link');
    assert.equal(f.calls[0].options.return_url, undefined, 'Payload does not redirect a second page over the waiting original tab');
    assert.equal(f.$('xamanQrArea').hidden, true, 'Phone puts same-device handoff first');
    f.$('xamanShowQr').click();
    assert.equal(f.$('xamanQrArea').hidden, false, 'Phone can reveal QR to use another device');
    assert.equal(f.$('xamanShowQr').getAttribute('aria-expanded'), 'true');
    assert.deepEqual(f.navigation, [], 'Phone waits for an explicit Open in Xaman tap');
    assert.equal(f.w.location.href, 'https://jesuschristsavestoken.com/');
    await f.event({ expired: true });
    assert.match((await pending.result).error.message, /expir|not signed/i);
    f.assertNoActiveQr();
    checks++;
    f.close();

    f = await fixture({ pushed: false, createSubscribe: false });
    pending = await f.start();
    assert.equal(f.$('xamanPayloadQr').hidden, false, 'Desktop QR works when push is unavailable too');
    await f.event({ signed: false });
    await pending.result;
    checks++;
    f.close();

    f = await fixture({ signedResponse: { dispatched_nodetype: 'MAINNET' } });
    pending = await f.start();
    await f.event({ signed: true });
    assert.match((await pending.result).error.message, /transaction ID/i);
    f.assertNoActiveQr();
    checks++;
    f.close();
    console.log('Xaman signing integration PASS:', checks, 'cases: visible independent dialog, desktop QR regardless of push, duplicate lock, hide/reopen, rejection cleanup, validated signing cleanup, mobile explicit universal link, provider expiry.');
  } finally { f?.close(); clearTimeout(suiteTimeout); }
})().catch(error => { console.error(error); process.exitCode = 1; });
