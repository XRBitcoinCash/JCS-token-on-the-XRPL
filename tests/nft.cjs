const fs = require('fs'), assert = require('assert/strict');
const { JSDOM } = require('jsdom');
const { TextEncoder, TextDecoder } = require('util');
const path = require('path');
const root = path.resolve(__dirname, '..');
const helpers = require(root + '/js/jcs-nft.js');
const liquidity = fs.readFileSync(root + '/js/jcs-liquidity.js', 'utf8');
const source = fs.readFileSync(root + '/js/jcs-nft.js', 'utf8');
const issuer = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd', account = 'rWalletTest111111111111111111111';
const currency = '4A4353000000000000000000000000000000000000';
const hash = 'A'.repeat(64), mintHash = 'B'.repeat(64), nftId = 'C'.repeat(64), ownId = 'D'.repeat(64), ledgerIndex = 100000004;
const flush = async () => { for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve)); };
async function fixture(overrides = {}) {
  const dom = new JSDOM('<section id="trade"></section><dialog id="xamanSignPanel" hidden></dialog><script id="app-config" type="application/json">' + JSON.stringify({ asset: { issuer, currencyHex: currency } }) + '</script>', { url: 'https://jesuschristsavestoken.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document; w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.setInterval = () => 1;
  const state = { account, index: ledgerIndex, owned: [{ NFTokenID: ownId, Issuer: 'rCollectionIssuer', Flags: 8, NFTokenTaxon: 12, URI: helpers.hex('javascript:alert(1)') }], sourceTx: { TransactionType: 'OfferCreate', Account: account, TakerGets: '1000000', TakerPays: { currency, issuer, value: '6000000' }, Flags: 0x40000 }, ...overrides };
  const requests = [], signed = [], downloads = []; let now = Date.now(); w.Date.now = () => now;
  w.URL.createObjectURL = blob => { downloads.push(blob); return 'blob:fixture'; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = () => {};
  w.JCSWallet = { getAccount: () => state.account, request: async query => {
    requests.push(query); const p = query.params[0];
    if (state.gate && query.method === state.gateMethod) { const gate = state.gate; state.gate = null; await gate; }
    if (query.method === 'tx') {
      if (p.transaction === hash) return { result: { validated: state.sourceValidated ?? true, ledger_index: ledgerIndex, hash: state.sourceHash || hash, tx_json: state.sourceTx, meta: { TransactionResult: state.sourceResult || 'tesSUCCESS' } } };
      return { result: state.savedResult || { ...state.lastResult.transaction, validated: true, ledger_index: ledgerIndex, meta: state.lastResult.meta } };
    }
    if (query.method === 'ledger') return { result: { validated: true, ledger_index: p.ledger_index === 'validated' ? state.index : Number(p.ledger_index), ledger: { close_time: 800000000 } } };
    if (query.method === 'fee') return { result: { drops: { open_ledger_fee: '12' } } };
    if (query.method === 'account_info') return { result: { validated: true, ledger_index: p.ledger_index, account_data: { Account: p.account, Balance: '100000000', OwnerCount: 1 } } };
    if (query.method === 'server_state') return { result: { state: { validated_ledger: { seq: state.index, reserve_base: 1000000, reserve_inc: 200000 } } } };
    if (query.method === 'account_nfts') return { result: { validated: true, ledger_index: p.ledger_index, account_nfts: p.marker ? state.moreOwned || [] : state.owned, ...(state.moreOwned && !p.marker ? { marker: 'next-page' } : {}) } };
    if (query.method === 'account_tx') return { result: state.history || { account, ledger_index_min: p.ledger_index_min, ledger_index_max: p.ledger_index_max, transactions: [] } };
    throw new Error('Unexpected query ' + query.method);
  }, submitNft: async tx => {
    signed.push(JSON.parse(JSON.stringify(tx))); d.getElementById('xamanSignPanel').hidden = false;
    const persisted = JSON.parse(w.localStorage.getItem('jcs.receiptNftMints.v1') || '{}');
    if (tx.TransactionType === 'NFTokenMint') assert(persisted[account + ':' + hash], 'pending saved before opening Xaman');
    if (state.signGate) await state.signGate;
    if (state.signError) throw state.signError;
    const result = { txid: mintHash, validated: true, ledgerIndex, transaction: { ...JSON.parse(JSON.stringify(tx)), hash: mintHash }, meta: { TransactionResult: 'tesSUCCESS' }, nftId };
    if (state.resultChange) state.resultChange(result);
    state.lastResult = result; return result;
  } };
  if (state.storage) for (const [key, value] of Object.entries(state.storage)) w.localStorage.setItem(key, value);
  w.eval(liquidity); w.eval(source);
  const click = id => d.getElementById(id).click();
  const emit = async (kind = 'market-swap') => { d.dispatchEvent(new w.CustomEvent('jcs:validated-transaction', { detail: { txid: hash, kind } })); await flush(); };
  const prepare = async () => { click('jcsReceiptMint'); await flush(); };
  const sign = async () => { click('jcsReceiptSign'); await flush(); };
  const value = (id, text) => { const input = d.getElementById(id); input.value = text; input.dispatchEvent(new w.Event('input', { bubbles: true })); };
  return { dom, w, d, state, requests, signed, downloads, click, emit, prepare, sign, value, advance: ms => now += ms, status: () => d.getElementById('jcsReceiptStatus').textContent, saved: () => JSON.parse(w.localStorage.getItem('jcs.receiptNftMints.v1') || '{}')[account + ':' + hash] };
}
(async () => {
  let checks = 0, f;
  const base = { txid: hash, ledgerIndex, validatedAt: '2025-05-08T06:13:20.000Z', transaction: { TransactionType: 'AMMDeposit', Account: account, Amount: '1000000', Amount2: { currency, issuer, value: '6000000' } } };
  const metadata = helpers.buildMetadata(base), mint = helpers.buildMint(metadata, account, '12', ledgerIndex + 20);
  assert.equal(mint.TransactionType, 'NFTokenMint'); assert.equal(mint.Flags, 0); assert.equal(mint.NFTokenTaxon, 20260913); assert.equal(mint.URI.length / 2, 216);
  assert.equal(helpers.safeUri(mint.URI).metadata.source_transaction, hash); assert.match(metadata.wallet, /…/); assert.notEqual(metadata.wallet, account); assert.equal(helpers.buildMetadata(base, 'public').wallet, account);
  assert.equal(Buffer.from(mint.Memos[0].Memo.MemoType, 'hex').toString(), 'application/json'); assert.deepEqual(JSON.parse(Buffer.from(mint.Memos[0].Memo.MemoData, 'hex').toString()), metadata); checks++;
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'https://127.0.0.1/private', 'http://example.com', 'https://name:password@example.com']) assert.equal(helpers.safeUri(helpers.hex(unsafe)), null);
  assert.equal(helpers.safeUri(helpers.hex('https://example.com/metadata.json')).href, 'https://example.com/metadata.json'); checks++;
  f = await fixture(); await f.emit(); assert.equal(f.d.getElementById('jcsReceiptActions').hidden, false); assert.match(f.status(), /Transaction confirmed/); assert.equal(f.signed.length, 0);
  await f.prepare(); assert.equal(f.d.getElementById('jcsReceiptReview').hidden, false); assert.equal(f.signed.length, 0); assert.match(f.d.getElementById('jcsReceiptJson').textContent, /market-swap/);
  f.click('jcsReceiptPreviewDownload'); assert.equal(f.downloads.length, 1); await f.sign(); assert.equal(f.signed.length, 1); assert.equal(f.signed[0].TransactionType, 'NFTokenMint'); assert.match(f.status(), /mint confirmed/); assert.equal(f.d.getElementById('xamanSignPanel').hidden, false); assert.equal(f.saved().status, 'validated'); f.dom.window.close(); checks++;
  f = await fixture(); f.state.sourceTx.Flags = 0; await f.emit('limit-order'); assert.match(f.d.getElementById('jcsReceiptMeaning').textContent, /does not prove.*filled/); await f.prepare(); assert.match(f.d.getElementById('jcsReceiptJson').textContent, /limit-order/); f.dom.window.close(); checks++;
  for (const type of ['AMMDeposit', 'AMMWithdraw']) { f = await fixture(); f.state.sourceTx = { TransactionType: type, Account: account, Asset: { currency: 'XRP' }, Asset2: { currency, issuer } }; await f.emit(type === 'AMMDeposit' ? 'add-liquidity' : 'withdraw-liquidity'); await f.prepare(); assert.equal(f.d.getElementById('jcsReceiptReview').hidden, false); assert.equal(f.signed.length, 0); f.dom.window.close(); checks++; }
  for (const change of [{ sourceValidated: false }, { sourceResult: 'tecUNFUNDED_OFFER' }, { sourceHash: 'F'.repeat(64) }, { sourceTx: { TransactionType: 'OfferCreate', Account: account, TakerGets: { currency: 'USD', issuer: 'rOther', value: '1' }, TakerPays: { currency, issuer, value: '2' }, Flags: 0x40000 } }]) {
    f = await fixture(change); await f.emit(); assert.equal(f.d.getElementById('jcsReceiptMint').disabled, true); assert.equal(f.signed.length, 0); f.dom.window.close(); checks++;
  }
  f = await fixture(); let release; f.state.signGate = new Promise(resolve => release = resolve); await f.emit(); await f.prepare(); f.click('jcsReceiptSign'); await flush(); assert.equal(f.saved().status, 'awaiting-signature'); assert.doesNotMatch(f.status(), /mint confirmed/); assert.equal(f.d.getElementById('xamanSignPanel').hidden, false); release(); await flush(); assert.match(f.status(), /mint confirmed/); f.dom.window.close(); checks++;
  f = await fixture({ signError: Object.assign(new Error('Pending confirmation'), { txid: mintHash, unconfirmed: true }) }); await f.emit(); await f.prepare(); await f.sign(); assert.equal(f.saved().txid, mintHash); assert.doesNotMatch(f.status(), /mint confirmed/); await f.prepare(); assert.equal(f.signed.length, 1); f.dom.window.close(); checks++;
  f = await fixture({ signError: Object.assign(new Error('Signature outcome is unknown'), { outcomeUnknown: true, requiresReconciliation: true }) }); await f.emit(); await f.prepare(); await f.sign(); assert.equal(f.saved().status, 'unknown'); await f.prepare(); assert.equal(f.signed.length, 1); assert.match(f.status(), /earlier mint request/); f.state.index += 30; await f.prepare(); assert.equal(f.saved(), null); assert.match(f.status(), /expired/); f.dom.window.close(); checks++;
  f = await fixture({ signError: Object.assign(new Error('You rejected the request'), { definitelyNotSubmitted: true }) }); await f.emit(); await f.prepare(); await f.sign(); assert.equal(f.saved(), null); f.state.signError = null; await f.prepare(); await f.sign(); assert.equal(f.signed.length, 2); assert.match(f.status(), /mint confirmed/); f.dom.window.close(); checks++;
  f = await fixture({ resultChange: r => r.transaction.URI = helpers.hex('https://malicious.example/wrong') }); await f.emit(); await f.prepare(); await f.sign(); assert.equal(f.saved().txid, mintHash); assert.doesNotMatch(f.status(), /mint confirmed/); assert.match(f.status(), /differs/); await f.prepare(); assert.doesNotMatch(f.status(), /mint confirmed/); assert.equal(f.signed.length, 1); f.dom.window.close(); checks++;
  f = await fixture(); await f.emit(); await f.prepare(); f.advance(61000); await f.sign(); assert.equal(f.signed.length, 0); assert.match(f.status(), /expired/); f.dom.window.close(); checks++;
  f = await fixture(); await f.emit(); await f.prepare(); f.state.account = 'rChangedWallet'; f.d.dispatchEvent(new f.w.Event('jcs:wallet-changed')); await f.sign(); assert.equal(f.signed.length, 0); assert.equal(f.d.getElementById('jcsReceiptActions').hidden, true); f.dom.window.close(); checks++;
  f = await fixture({ moreOwned: [{ NFTokenID: nftId, Issuer: account, Flags: 0, NFTokenTaxon: 20260913, URI: mint.URI }] }); f.click('jcsTabNfts'); await flush(); assert.equal(f.requests.some(q => q.method === 'account_nfts'), true); assert.equal(f.d.querySelectorAll('.jcs-nft-card').length, 1); assert.match(f.d.getElementById('jcsNftGrid').textContent, /Unsupported or unsafe URI/); f.click('jcsNftMore'); await flush(); assert.equal(f.d.querySelectorAll('.jcs-nft-card').length, 2); assert.equal(f.d.querySelectorAll('.jcs-nft-card button').length, 1); assert.match(f.d.getElementById('jcsNftGrid').textContent, /Personal receipt/); f.dom.window.close(); checks++;
  f = await fixture(); f.click('jcsTabNfts'); await flush(); f.d.querySelector('.jcs-nft-card button').click(); f.value('jcsNftSalePrice', '1.5'); f.click('jcsNftSalePreview'); await flush(); assert.equal(f.signed.length, 0); assert.equal(f.d.getElementById('jcsNftSaleReview').hidden, false); f.click('jcsNftSaleSign'); await flush(); assert.equal(f.signed.length, 1); assert.equal(f.signed[0].TransactionType, 'NFTokenCreateOffer'); assert.equal(f.signed[0].Amount, '1500000'); assert.equal(f.signed[0].Flags, 1); assert.match(f.d.getElementById('jcsNftSaleStatus').textContent, /has not sold yet/); assert.equal(f.d.getElementById('xamanSignPanel').hidden, false); f.dom.window.close(); checks++;
  f = await fixture(); f.click('jcsTabNfts'); await flush(); f.d.querySelector('.jcs-nft-card button').click(); f.value('jcsNftSalePrice', '1'); f.click('jcsNftSalePreview'); await flush(); f.state.owned = []; f.click('jcsNftSaleSign'); await flush(); assert.equal(f.signed.length, 0); assert.match(f.d.getElementById('jcsNftSaleStatus').textContent, /no longer holds/); f.dom.window.close(); checks++;
  f = await fixture(); await f.emit(); await f.prepare(); f.w.localStorage.setItem('jcs.receiptNftMints.v1', JSON.stringify({ [account + ':' + hash]: { status: 'awaiting-signature', firstLedger: ledgerIndex, lastLedger: ledgerIndex + 20 } })); await f.sign(); assert.equal(f.signed.length, 0); assert.match(f.status(), /Another mint request/); f.dom.window.close(); checks++;
  f = await fixture(); await f.emit(); f.d.getElementById('jcsReceiptPrivacy').value = 'public'; let unlock; f.state.gateMethod = 'fee'; f.state.gate = new Promise(resolve => unlock = resolve); f.click('jcsReceiptMint'); await flush(); f.d.getElementById('jcsReceiptPrivacy').value = 'masked'; f.d.getElementById('jcsReceiptPrivacy').dispatchEvent(new f.w.Event('change')); await flush(); unlock(); await flush(); assert.equal(JSON.parse(f.d.getElementById('jcsReceiptJson').textContent).wallet.includes('…'), true); f.dom.window.close(); checks++;
  f = await fixture({ storage: { 'jcs.validatedReceipts.v1': JSON.stringify([{ txid: hash, kind: 'market-swap', account }]) } }); await flush(); assert.equal(f.requests.some(q => q.method === 'tx'), true); assert.match(f.status(), /Transaction confirmed/); f.dom.window.close(); checks++;
  console.log('NFT flow PASS:', checks, 'cases: receipt events, mint metadata/URI, deliberate signing, ledger validation, ownership, sale offer, pagination, safe URI, source/account guards, stale review, pending/reload recovery, duplicate and privacy races.');
})().catch(error => { console.error(error); process.exitCode = 1; });
