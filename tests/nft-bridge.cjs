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
const sourceHash = 'A'.repeat(64), nftId = 'C'.repeat(64), offerId = 'D'.repeat(64);
const date = 800000000;
const hex = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').toString('hex').toUpperCase();
const metadata = {
  schema: 'jcs-validated-receipt-nft-v1', network: 'XRPL Mainnet', source_transaction: sourceHash,
  source_kind: 'market-swap', validated_at_utc: new Date((date + 946684800) * 1000).toISOString(),
  wallet: account, jcs_issuer: issuer, asset: 'JCS/XRP', amounts: {TakerPays:'10',TakerGets_drops:'1000000'}, ledger_index: seq - 5,
  disclaimer: 'Receipt only; not a spiritual reward or investment guarantee.'
};
const pointer = {schema:metadata.schema,network:metadata.network,source_transaction:sourceHash};
const tx = {
  TransactionType: 'NFTokenMint', Account: account, Flags: 0, NFTokenTaxon: 20260913,
  URI: hex('data:application/json,' + encodeURIComponent(JSON.stringify(pointer))),
  Memos: [{Memo:{MemoType:hex('application/json'),MemoData:hex(metadata)}}],
  Fee:'12', LastLedgerSequence:seq+20
};
const sellTx = {TransactionType:'NFTokenCreateOffer',Account:account,Flags:1,NFTokenID:nftId,
  Amount:'1000000',Expiration:Math.floor(Date.now()/1000)-946684800+86400,Fee:'12',LastLedgerSequence:seq+20};

async function flush() {
  for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
}

async function fixture({ mobile = false, pushed = true, createSubscribe = true,
  signedResponse = { txid: hash, dispatched_nodetype: 'MAINNET' }, sourceChange = {}, actualChange = {}, nftChange = {}, sell = false, noOwnership = false, balance = '100000000', race = false, accountChange = {}, neverValidate = false, missingMint = false, nftUi = false, api2 = false } = {}) {
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
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.URL.createObjectURL = ()=>'blob:fixture'; w.URL.revokeObjectURL = ()=>{};
  w.matchMedia = query => ({ matches: mobile && /pointer: ?coarse|max-width/.test(query), addEventListener() {}, removeEventListener() {} });
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.setInterval = () => ++timer;
  w.clearInterval = () => {};
  w.setTimeout = (fn, ms = 0) => {
    const id = ++timer;
    if (ms < 100 || ms === 1400) queueMicrotask(fn);
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
          case 'ledger': if(typeof q.ledger_index==='number')r.ledger_index=q.ledger_index; r.ledger = { ledger_index: r.ledger_index, ledger_hash: 'A'.repeat(64), close_time:date,close_time_human: new Date().toISOString() }; break;
          case 'amm_info': r.amm = { account: 'rPoolFixture', amount: '400000000', amount2: { ...asset, value: '10000000' }, lp_token: { currency: '03' + 'A'.repeat(38), issuer: 'rPoolFixture', value: '10000' }, trading_fee: 500 }; break;
          case 'account_lines': r.lines = q.peer === 'rPoolFixture' ? [{ account: 'rPoolFixture', currency: '03' + 'A'.repeat(38), balance: '100', limit: '1000000' }] : [{ account: issuer, currency: 'JCS', balance: '1000000', limit: '21000000' }]; break;
          case 'account_info': r.account_data = { Account: account, Balance: balance, OwnerCount: 2, Flags: 0, Sequence: 1 }; Object.assign(r, accountChange); break;
          case 'server_state': r.state={validated_ledger:{reserve_base:'1000000',reserve_inc:'200000'}};break;
          case 'server_info': r.info = { server_state: 'full', validated_ledger: { seq, reserve_base_xrp: 1, reserve_inc_xrp: .2, base_fee_xrp: .00001 } }; break;
          case 'fee': r.drops = { open_ledger_fee: '12', minimum_fee: '10' }; break;
          case 'book_offers': case 'account_offers': r.offers = []; break;
          case 'gateway_balances': r.obligations = { JCS: '10000000' }; break;
          case 'account_nfts':
            r.ledger_index = q.ledger_index;
            r.account_nfts = noOwnership || (!sell && (q.ledger_index !== seq + 2 || missingMint)) ? [] : [{NFTokenID:nftId,Issuer:account,NFTokenTaxon:sell?1:20260913,Flags:sell?8:0,URI:tx.URI,...nftChange}];
            if (race) await sdk.logout();
            break;
          case 'tx':
            if (q.transaction === sourceHash) {
              r = {TransactionType:'OfferCreate', Account:account,Flags:262144,TakerGets:'1000000',TakerPays:{...asset,value:'10'},date,
                hash:sourceHash,validated:true,ledger_index:seq-5,meta:{TransactionResult:'tesSUCCESS'},...sourceChange};
            } else r = {...calls.at(-1).txjson,hash,validated:!neverValidate,ledger_index:seq+2,meta:{TransactionResult:'tesSUCCESS',
              ...(sell?{AffectedNodes:[{CreatedNode:{LedgerEntryType:'NFTokenOffer',LedgerIndex:offerId,NewFields:{Owner:account,NFTokenID:nftId,Amount:sellTx.Amount}}}]}:{nftoken_id:nftId})},...actualChange};
            if(api2 && q.transaction===hash){const {hash:confirmedHash,validated,ledger_index,meta,...tx_json}=r;r={hash:confirmedHash,validated,ledger_index,meta,tx_json};}
            break;
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
  if(nftUi) w.eval(fs.readFileSync(path.join(root, 'js/jcs-nft.js'), 'utf8'));
  await sdk.events.ready();
  await flush();
  const $ = id => w.document.getElementById(id);
  $('jcsTabLiquidity').click();
  await flush();
  assert.equal($('jcsTradePanel').hidden, true, 'Regression setup selects Liquidity and hides Trade');
  assert.deepEqual(errors, [], 'Real core initializes without runtime errors');

  async function start(input = sell ? sellTx : tx) {
    // Attach the rejection handler immediately so reject/expiry tests never leak a rejection.
    const result = w.JCSWallet.submitNft({ ...input }).then(value => ({ value }), error => ({ error }));
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


const suiteTimeout = setTimeout(() => { console.error('NFT bridge timed out'); process.exit(1); }, 15000);
(async () => {
  let checks=0,f;
  async function refused(options, pattern, input) {
    f=await fixture(options);const pending=await f.start(input);const outcome=await pending.result;
    assert.match(outcome.error?.message||'',pattern);assert.equal(outcome.error.definitelyNotSubmitted,true);assert.equal(f.calls.length,0,'Invalid requests never reach Xaman');
    f.close();checks++;
  }
  async function rejectedResult(options,pattern) {
    f=await fixture(options);const pending=await f.start();assert.equal(f.calls.length,1);
    await f.event({signed:true});const outcome=await pending.result;assert.match(outcome.error?.message||'',pattern);if (!outcome.error.finalLedgerResult) assert.equal(outcome.error.requiresReconciliation,true);
    f.close();checks++;
  }
  try {
    for (const mobile of [false,true]) {
      f=await fixture({mobile});const pending=await f.start();
      assert.equal(f.$('xamanSignPanel').hidden,false,'NFT signing dialog visible from outside Trade');
      assert.equal(f.$('xamanSignPanel').parentElement.closest('[hidden]'),null);
      assert.match(f.$('xamanSignTitle').textContent,/receipt NFT/i);
      assert.equal(f.$('xamanQrArea').hidden,mobile);
      assert.equal(f.$('xamanOpenPayload').hidden,false);
      assert.equal(f.$('xamanOpenPayload').target,mobile?'_self':'_blank');
      assert.deepEqual(f.navigation,[],'No automatic desktop/mobile navigation');
      const payload=f.calls[0].txjson;
      assert.equal(payload.TransactionType,'NFTokenMint');assert.ok(payload.URI.length<=512);
      assert.deepEqual(JSON.parse(decodeURIComponent(Buffer.from(payload.URI,'hex').toString().slice('data:application/json,'.length))),pointer);
      assert.deepEqual(JSON.parse(Buffer.from(payload.Memos[0].Memo.MemoData,'hex').toString()),metadata);
      assert.equal(payload.Memos.length,3,'Full receipt plus both sentinel memos preserved');
      assert.equal(payload.Flags,0);assert.equal(payload.NFTokenTaxon,20260913);
      const second=await f.start();assert.match((await second.result).error.message,/already/);assert.equal(f.calls.length,1);
      await f.event({signed:true});const result=await pending.result;
      assert.equal(result.error,undefined);assert.equal(result.value.validated,true);assert.equal(result.value.nftId,nftId);
      assert.equal(result.value.txid,hash);assert.equal(result.value.ledgerIndex,seq+2);
      f.close();checks++;
    }
    f=await fixture({nftUi:true,api2:true});
    f.w.document.dispatchEvent(new f.w.CustomEvent('jcs:validated-transaction',{detail:{kind:'market-swap',txid:sourceHash,validated:true}}));
    await flush();assert.equal(f.$('jcsReceiptActions').hidden,false);assert.equal(f.$('jcsReceiptMint').disabled,false,'Validated source enables receipt actions');
    f.$('jcsReceiptMint').click();await flush();assert.equal(f.$('jcsReceiptReview').hidden,false,f.$('jcsReceiptStatus').textContent);
    f.$('jcsReceiptSign').click();await flush();assert.equal(f.calls.length,1,f.$('jcsReceiptStatus').textContent);
    assert.equal(f.$('xamanSignPanel').hidden,false);await f.event({signed:true});
    assert.match(f.$('jcsReceiptStatus').textContent,/mint confirmed/i);assert.equal(f.errors.length,0);f.close();checks++;
    f=await fixture({sell:true});let pending=await f.start();
    assert.equal(f.calls[0].txjson.TransactionType,'NFTokenCreateOffer');
    assert.match(f.$('xamanSignSummary').textContent,/1.000000 XRP/);
    await f.event({signed:true});assert.equal((await pending.result).value.offerId,offerId);f.close();checks++;
    await refused({},/Unexpected/,{...tx,Amount:'1000000'});
    await refused({},/Unexpected/,{...tx,Issuer:'rOther'});
    await refused({},/settings/,{...tx,Flags:8});
    const changedMetadata = patch => ({...tx,Memos:[{Memo:{MemoType:hex('application/json'),MemoData:hex({...metadata,...patch})}}]});
    await refused({},/Receipt wallet/,changedMetadata({wallet:'rFake'}));
    await refused({},/amount limits/,changedMetadata({amounts:{TakerPays:'99999',TakerGets_drops:'1'}}));
    await refused({},/date differs/,changedMetadata({validated_at_utc:new Date().toISOString()}));
    await refused({},/URI length/,{...tx,URI:'41'.repeat(257)});
    await refused({},/bounded fee/,{...tx,Fee:'10001'});
    await refused({},/expired/,{...tx,LastLedgerSequence:seq});
    await refused({sourceChange:{validated:false}},/source receipt/);
    await refused({sourceChange:{meta:{TransactionResult:'tecPATH_DRY'}}},/source receipt/);
    await refused({sourceChange:{hash:'F'.repeat(64)}},/source receipt/);
    await refused({sourceChange:{Account:'rOther'}},/source receipt/);
    await refused({sourceChange:{TakerPays:{...asset,issuer:'rOther',value:'10'}}},/Only JCS/);
    await refused({balance:'10000'},/Insufficient XRP/);
    await refused({accountChange:{validated:false}},/reserves/);
    await refused({race:true},/wallet changed/);
    await refused({sell:true,noOwnership:true},/does not own/);
    await refused({sell:true,nftChange:{Flags:0,Issuer:'rOther'}},/cannot be transferred/);
    await refused({sell:true,nftChange:{Flags:0,NFTokenTaxon:20260913}},/Receipt NFTs/);
    await rejectedResult({actualChange:{Account:'rOther'}},/differs/);
    await rejectedResult({actualChange:{URI:hex('https://example.com/changed')}},/differs/);
    await rejectedResult({actualChange:{Amount:'100'}},/differs/);
    await rejectedResult({actualChange:{Memos:[]}},/differs/);
    await rejectedResult({actualChange:{hash:'E'.repeat(64)}},/could not be matched/);
    await rejectedResult({actualChange:{meta:{TransactionResult:'tecINSUFFICIENT_RESERVE'}}},/did not succeed/);
    await rejectedResult({neverValidate:true},/not confirmed/);
    await rejectedResult({missingMint:true},/identity could not be verified/);
    await rejectedResult({signedResponse:{dispatched_nodetype:'MAINNET'}},/no transaction ID/);
    await rejectedResult({signedResponse:{txid:hash,dispatched_nodetype:'TESTNET'}},/not dispatched/);
    f=await fixture();pending=await f.start();await f.event({signed:false});assert.match((await pending.result).error.message,/not signed/);f.close();checks++;
    console.log('NFT core bridge PASS:',checks,'cases: exact source verification, immutable URI/memos, ownership and reserves, explicit desktop/mobile Xaman signing, rejection, validation and exact result matching.');
  } finally { f?.close();clearTimeout(suiteTimeout); }
})().catch(error=>{console.error(error);process.exitCode=1;});
