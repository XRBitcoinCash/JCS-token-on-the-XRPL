/* Optional ledger receipts and wallet-owned NFTs. Each write is a separate reviewed Xaman request. */
(function (root) {
  'use strict';
  const SCHEMA = 'jcs-validated-receipt-nft-v1', NETWORK = 'XRPL Mainnet', TAXON = 20260913;
  const ISSUER = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
  const METADATA_URL = 'https://jesuschristsavestoken.com/jcs-receipt-nft-v1.json'; // Read legacy receipt NFTs.
  const BACKEND_URL = 'https://xrbitcoincash-github-io.onrender.com';
  const RECEIPT_ROUTE = '/api/jcs-receipts-v1';
  const RECEIPT_RELEASE = 'jcs-nft-render-v5';
  const DISPLAY_METADATA = Object.freeze({ schema: 'jcs-receipt-display-v1', name: 'JCS Transaction Receipt',
    description: 'A personal record of a validated JCS/XRP transaction. The source transaction and full receipt details are recorded in the NFT mint transaction memo. Historical receipt only; not a claim to pool funds, a spiritual reward, or an investment guarantee.',
    image: 'https://jesuschristsavestoken.com/jcs-logo.png', network: NETWORK, jcs_issuer: ISSUER, asset: 'JCS/XRP' });
  const HASH = /^[A-F0-9]{64}$/i;
  const PAYLOAD_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  const KIND = { 'market-swap': 'market-swap', 'quick-buy': 'market-swap', 'limit-order': 'limit-order', 'liquidity-add': 'add-liquidity', 'add-liquidity': 'add-liquidity', 'liquidity-remove': 'withdraw-liquidity', 'withdraw-liquidity': 'withdraw-liquidity' };
  const TYPE = { Payment: 'market-swap', OfferCreate: 'limit-order', AMMDeposit: 'add-liquidity', AMMWithdraw: 'withdraw-liquidity' };
  const KIND_LABEL = { 'market-swap': 'Buy / sell transaction', 'limit-order': 'Limit order created', 'add-liquidity': 'Liquidity added', 'withdraw-liquidity': 'Liquidity withdrawn' };
  const sourceKind = tx => tx.TransactionType === 'OfferCreate' ? ((Number(tx.Flags || 0) & 0x60000) ? 'market-swap' : 'limit-order') : TYPE[tx.TransactionType];
  const personalReceipt = nft => Number(nft.NFTokenTaxon) === TAXON && !(Number(nft.Flags) & 8);
  const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
  const hex = value => Array.from(encoder.encode(value), byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  function unhex(value) {
    if (!/^(?:[A-Fa-f0-9]{2}){1,256}$/.test(value || '')) return null;
    try { return decoder.decode(Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16))); } catch { return null; }
  }
  function safeUri(value) {
    const text = unhex(value);
    if (!text) return null;
    if (text.startsWith(METADATA_URL + '#tx=')) {
      const hash = text.slice((METADATA_URL + '#tx=').length);
      return HASH.test(hash) ? { text, href: text, metadata: { schema: SCHEMA, network: NETWORK, source_transaction: hash.toUpperCase() } } : null;
    }
    try {
      const url = new URL(text);
      const match = url.pathname.match(/^\/api\/jcs-receipts-v1\/([A-Fa-f0-9]{64})\.json$/);
      if (url.origin === BACKEND_URL && match) {
        const digest = url.searchParams.get('d');
        if (!/^[a-f0-9]{64}$/.test(digest || '') || url.searchParams.size !== 1 || url.hash) return null;
        return { text, href: url.href, metadata: { schema: SCHEMA, network: NETWORK, source_transaction: match[1].toUpperCase(), sha256: digest } };
      }
    } catch {}
    if (text.startsWith('data:application/json,')) {
      try { const metadata = JSON.parse(decodeURIComponent(text.slice(22))); if (metadata.schema === SCHEMA && metadata.network === NETWORK && HASH.test(metadata.source_transaction)) return { text, metadata }; } catch {}
      return null;
    }
    try {
      const input = /^ipfs:\/\/[a-zA-Z0-9]+(?:\/[^\s]*)?$/.test(text) ? 'https://ipfs.io/ipfs/' + text.slice(7) : text;
      const url = new URL(input);
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname.includes('.') || /(^\d+\.\d+\.\d+\.\d+$|:|(^|\.)(localhost|local|internal|test|invalid)$)/i.test(url.hostname)) return null;
      return { text, href: url.href };
    } catch { return null; }
  }
  function requestedAmounts(tx) {
    const output = {};
    for (const key of ['Amount', 'Amount2', 'SendMax', 'DeliverMin', 'TakerPays', 'TakerGets', 'LPTokenIn', 'LPTokenOut']) {
      const value = tx[key];
      if (typeof value === 'string' && value.length <= 100) output[key + '_drops'] = value;
      else if (value && typeof value.value === 'string' && value.value.length <= 100) output[key] = value.value;
    }
    return output;
  }
  function buildMetadata(source, privacy = 'masked') {
    const tx = source.transaction;
    const metadata = { schema: SCHEMA, network: NETWORK, source_transaction: source.txid.toUpperCase(), source_kind: sourceKind(tx),
      validated_at_utc: source.validatedAt, wallet: privacy === 'public' ? tx.Account : tx.Account.slice(0, 5) + '…' + tx.Account.slice(-5),
      jcs_issuer: ISSUER, asset: 'JCS/XRP', amounts: requestedAmounts(tx), ledger_index: source.ledgerIndex,
      disclaimer: 'Receipt only; not a spiritual reward or investment guarantee.' };
    if (!HASH.test(metadata.source_transaction) || !metadata.source_kind || !Number.isSafeInteger(metadata.ledger_index) || !Number.isFinite(Date.parse(metadata.validated_at_utc))) throw new Error('Verified source details are incomplete.');
    return metadata;
  }
  function buildMint(metadata, account, fee, lastLedger) {
    if (!HASH.test(metadata.source_transaction || '')) throw new Error('The receipt source transaction is invalid.');
    const uri = METADATA_URL + '#tx=' + metadata.source_transaction.toUpperCase();
    if (encoder.encode(uri).length > 256) throw new Error('The NFT URI exceeds the XRP Ledger limit.');
    const json = JSON.stringify(metadata);
    if (encoder.encode(json).length > 750) throw new Error('Receipt metadata exceeds the supported memo size.');
    return { TransactionType: 'NFTokenMint', Account: account, NFTokenTaxon: TAXON, Flags: 0, URI: hex(uri),
      Memos: [{ Memo: { MemoType: hex('application/json'), MemoData: hex(json) } }], Fee: String(fee), LastLedgerSequence: lastLedger };
  }
  function drops(value) {
    if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('Enter an XRP price with up to six decimal places.');
    const [whole, fraction = ''] = value.split('.');
    const n = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0'));
    if (n <= 0n || n > 100000000000000000n) throw new Error('Enter a price greater than zero and no more than 100 billion XRP.');
    return String(n);
  }
  function buildSell(nft, account, price, fee, lastLedger, expires) {
    if (!HASH.test(nft.NFTokenID || '')) throw new Error('The NFT identifier is invalid.');
    if (personalReceipt(nft)) throw new Error('Personal receipt NFTs are not listed for sale here.');
    if (!(Number(nft.Flags) & 8) && nft.Issuer !== account) throw new Error('This NFT cannot be offered by this wallet because its general transfer flag is off.');
    return { TransactionType: 'NFTokenCreateOffer', Account: account, NFTokenID: nft.NFTokenID, Amount: drops(price), Flags: 1,
      Expiration: expires, Fee: String(fee), LastLedgerSequence: lastLedger };
  }
  function confirmedResult(result, transaction, reviewedLedger, recovery = false) {
    if (result?.validated !== true || !HASH.test(result.txid || '') || !Number.isSafeInteger(Number(result.ledgerIndex))) throw new Error('The NFT transaction has not been confirmed on the validated ledger.');
    const tx = result.transaction?.tx_json || result.transaction;
    const meta = result.meta || result.transaction?.meta;
    if (!tx || meta?.TransactionResult !== 'tesSUCCESS' || tx.TransactionType !== transaction.TransactionType || tx.Account !== transaction.Account) throw new Error('The ledger result does not match this NFT request.');
    const actualHash = result.transaction?.hash || tx.hash;
    if (!HASH.test(actualHash || '') || actualHash.toUpperCase() !== result.txid.toUpperCase()) throw new Error('The NFT transaction hash does not match the ledger result.');
    for (const key of Object.keys(transaction)) {
      if (key === 'LastLedgerSequence') continue;
      if (key === 'Memos') {
        if (!transaction.Memos.every(expected => (tx.Memos || []).some(actual => actual.Memo && Object.keys(actual.Memo).length === Object.keys(expected.Memo).length && Object.keys(expected.Memo).every(key => actual.Memo[key] === expected.Memo[key])))) throw new Error('The receipt metadata differs from the reviewed request.');
      } else if (key === 'Flags' ? (Number(tx.Flags) & 0x7fffffff) !== transaction.Flags : tx[key] !== transaction[key]) throw new Error('The NFT transaction differs from the reviewed request.');
    }
    const originalExpiry = transaction.LastLedgerSequence, walletExpiry = tx.LastLedgerSequence, confirmedLedger = Number(result.ledgerIndex);
    const uint32 = value => Number.isInteger(value) && value > 0 && value <= 0xffffffff;
    // Use the same completed-transaction policy as XRBC and the wallet bridge.
    // A delayed Xaman signature may extend the deadline; it cannot shorten it,
    // change the reviewed NFT fields, or exceed the supported 150-ledger offset.
    if (![originalExpiry, walletExpiry, confirmedLedger].every(uint32) || walletExpiry < originalExpiry || walletExpiry < confirmedLedger || walletExpiry > confirmedLedger + 150) throw new Error('The NFT transaction ledger expiry is invalid.');
    const reviewLedger = Number(reviewedLedger);
    if (Number.isSafeInteger(reviewLedger) && (!uint32(reviewLedger) || originalExpiry <= reviewLedger || originalExpiry > reviewLedger + 25 || confirmedLedger <= reviewLedger)) throw new Error('The NFT transaction ledger does not match this review.');
    if (confirmedLedger > originalExpiry) return { ...result, reviewWindowChanged: true };
    return result;
  }
  function validDisplayMetadata(value) {
    return value && !Array.isArray(value) && Object.keys(value).length === Object.keys(DISPLAY_METADATA).length &&
      Object.entries(DISPLAY_METADATA).every(([key, expected]) => Object.prototype.hasOwnProperty.call(value, key) && value[key] === expected);
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { hex, unhex, safeUri, buildMetadata, buildMint, buildSell, confirmedResult, drops, validDisplayMetadata, METADATA_URL, DISPLAY_METADATA, BACKEND_URL }; return; }
  const doc = root.document;
  if (!doc || root.JCSReceiptStartup) return;

  function startReceiptTools(dependencies) {
  const { api, trade, gallery, config, receipts } = dependencies;
  const byId = id => doc.getElementById(id);
  const message = byId('jcsNftStatus');
  let version = 0, source = null, prepared = null, signing = false, preparing = false, loading = false, saved = null, collection = new Map(), pageState = null;
  let receiptSequence = 0, preparationSequence = 0, observedAccount = api.getAccount() || null;
  const receiptEntry = doc.createElement('section');
  receiptEntry.id = 'jcsReceiptEntry'; receiptEntry.className = 'jcs-receipt-entry'; receiptEntry.setAttribute('aria-labelledby', 'jcsReceiptEntryHeading');
  receiptEntry.innerHTML = `<div class="jcs-receipt-entry-heading"><img src="jcs-logo.png" alt="" width="52" height="52"><div><span class="jcs-tool-eyebrow">Keep your transaction record</span><h3 id="jcsReceiptEntryHeading">Create an NFT receipt</h3></div></div>
    <p class="jcs-tool-small">After a JCS buy, sale, liquidity deposit or withdrawal, your confirmed transaction appears here. You can also find an earlier transaction by its hash.</p>
    <div class="jcs-receipt-service"><span id="jcsReceiptServiceStatus" class="jcs-tool-small" role="status" aria-live="polite">Checking NFT receipt service…</span><button type="button" class="btn" id="jcsReceiptServiceCheck">Check NFT service</button><small id="jcsReceiptRelease">Receipt tools v5</small></div>
    <form id="jcsReceiptLookup"><label for="jcsReceiptLookupHash">Earlier transaction hash</label><div class="jcs-receipt-lookup-row"><input id="jcsReceiptLookupHash" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="Paste the 64-character transaction hash" aria-describedby="jcsReceiptLookupStatus"><button type="submit" class="btn" id="jcsReceiptLookupCheck">Check transaction</button></div></form>
    <p id="jcsReceiptLookupStatus" class="jcs-tool-small" role="status" aria-live="polite"></p>`;
  trade.querySelector('.jcs-exchange-tabs').insertAdjacentElement('afterend', receiptEntry);
  receiptEntry.dataset.release = RECEIPT_RELEASE;
  const receiptPanel = doc.createElement('section');
  receiptPanel.id = 'jcsReceiptActions'; receiptPanel.className = 'jcs-receipt-actions'; receiptPanel.hidden = false;
  receiptPanel.setAttribute('aria-labelledby', 'jcsReceiptHeading');
  receiptPanel.innerHTML = `<div class="jcs-receipt-heading"><div><span class="jcs-tool-eyebrow">Your ledger record</span><h3 id="jcsReceiptHeading">Transaction receipt</h3></div><span class="jcs-pool-badge" id="jcsReceiptNetwork"></span></div>
    <div class="jcs-receipt-preview"><img id="jcsReceiptArtwork" src="jcs-logo.png" alt="Jesus Christ Saves Token receipt artwork" width="112" height="112"><div><span class="jcs-tool-eyebrow" id="jcsReceiptPreviewState">Receipt preview · not minted</span><h4 id="jcsReceiptActionLabel">JCS transaction</h4><p id="jcsReceiptConfirmation" class="jcs-tool-small"></p></div></div>
    <p id="jcsReceiptStatus" role="status" aria-live="polite"></p><a id="jcsReceiptHash" class="jcs-nft-id" target="_blank" rel="noopener noreferrer" hidden></a>
    <p class="jcs-tool-small" id="jcsReceiptMeaning">An optional personal record of your transaction. Minting is a separate network transaction with its own fee.</p>
    <div class="jcs-nft-actions"><button type="button" class="btn primary" id="jcsReceiptMint" aria-describedby="jcsReceiptStatus" disabled>Mint receipt NFT</button><button type="button" class="btn" id="jcsReceiptDownload" aria-describedby="jcsReceiptStatus" disabled>Download receipt JSON</button><button type="button" class="btn" id="jcsReceiptOpenNfts">Open My NFTs</button></div>
    <div id="jcsReceiptReview" class="jcs-nft-review" hidden><h4>Review your receipt NFT</h4><p class="jcs-tool-small">Your receipt has its own artwork and metadata on the existing receipt service. The values come from the validated transaction. Its URI and verification digest are included in the separate mint request.</p>
      <p class="jcs-tool-small">The receipt includes the public signing wallet and source transaction. It contains no private journal or worship activity.</p>
      <a id="jcsReceiptImageLink" target="_blank" rel="noopener noreferrer">Open full receipt artwork ↗</a><dl class="jcs-readout" id="jcsMintReadout"></dl><details><summary>Receipt JSON &amp; permanent URI</summary><pre id="jcsReceiptJson"></pre><code class="jcs-nft-id" id="jcsReceiptUri"></code></details>
      <p class="jcs-tool-small">Personal receipt: general transfer flag off. XRPL still permits transfers involving its original issuer. This receipt is not a spiritual reward or an investment guarantee.</p>
      <div class="jcs-nft-actions"><button type="button" class="btn" id="jcsReceiptPreviewDownload">Download reviewed JSON</button><button type="button" class="btn primary" id="jcsReceiptSign">Review &amp; sign mint in Xaman</button><button type="button" class="btn" id="jcsReceiptCancel">Close review</button></div></div>`;
  receiptEntry.insertAdjacentElement('afterend', receiptPanel);
  const more = doc.createElement('button'); more.type = 'button'; more.className = 'btn'; more.id = 'jcsNftMore'; more.textContent = 'Load more NFTs'; more.hidden = true; gallery.after(more);
  const sale = doc.createElement('section'); sale.id = 'jcsNftSale'; sale.className = 'jcs-nft-review'; sale.hidden = true;
  sale.innerHTML = `<h3>Create an NFT sell offer</h3><p class="jcs-tool-small">This lists an NFT you own at an XRP price for 24 hours. A listing does not mean it has sold. A buyer must accept the offer on the ledger.</p><code id="jcsNftSaleId" class="jcs-nft-id"></code><label for="jcsNftSalePrice">Asking price in XRP</label><div class="jcs-amount-field"><input id="jcsNftSalePrice" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"><span>XRP</span></div><button type="button" class="btn" id="jcsNftSalePreview">Review sell offer</button><div id="jcsNftSaleReview" hidden><dl class="jcs-readout" id="jcsNftSaleRows"></dl><button type="button" class="btn primary" id="jcsNftSaleSign">Review &amp; sign offer in Xaman</button></div><p id="jcsNftSaleStatus" role="status" aria-live="polite"></p><button type="button" class="btn" id="jcsNftSaleClose">Close offer review</button>`;
  gallery.before(sale);
  let saleNft = null, saleReview = null;
  const request = async (method, params = {}) => { const response = await api.request({ method, params: [params] }); const result = response?.result; if (!result || result.error) { const error = new Error(result?.error_message || 'The ledger did not return usable data.'); error.code = result?.error; throw error; } return result; };
  const verified = (result, index) => { if (result.validated !== true || !Number.isSafeInteger(Number(result.ledger_index)) || (index && Number(result.ledger_index) !== index)) throw new Error('The ledger could not verify this data. Refresh and try again.'); return result; };
  function status(text) { byId('jcsReceiptStatus').textContent = text; }
  function lookupStatus(text) { byId('jcsReceiptLookupStatus').textContent = text; }
  function updateEntry() {
    const connected = !!api.getAccount();
    byId('jcsReceiptLookupCheck').disabled = !connected || signing;
    lookupStatus(connected ? 'Wallet connected. Check a transaction made by this wallet. Checking creates no transaction and costs no XRP.' : 'Connect Xaman using Connect wallet above, then check a transaction made by that wallet. Your receipt can be minted only after a separate review and signature.');
  }
  function resetReceiptPanel() {
    const connected = !!api.getAccount();
    receiptPanel.hidden = false;
    receiptPanel.dataset.state = 'empty';
    byId('jcsReceiptReview').hidden = true;
    byId('jcsReceiptNetwork').textContent = NETWORK;
    byId('jcsReceiptPreviewState').textContent = 'Receipt preview · not minted';
    byId('jcsReceiptActionLabel').textContent = 'Waiting for a verified transaction';
    byId('jcsReceiptConfirmation').textContent = 'Buy, sell, add liquidity or withdraw liquidity to create a transaction record.';
    byId('jcsReceiptMeaning').textContent = 'An optional personal record of your transaction. Minting is a separate network transaction with its own fee.';
    const hash = byId('jcsReceiptHash'); hash.textContent = ''; hash.removeAttribute('href'); hash.hidden = true;
    byId('jcsReceiptMint').textContent = 'Mint receipt NFT';
    byId('jcsReceiptMint').disabled = true;
    byId('jcsReceiptDownload').disabled = true;
    byId('jcsReceiptSign').disabled = true;
    byId('jcsReceiptArtwork').src = 'jcs-logo.png';
    byId('jcsReceiptArtwork').removeAttribute('data-verified'); byId('jcsReceiptImageLink').removeAttribute('href');
    byId('jcsReceiptJson').textContent = '';
    byId('jcsReceiptUri').textContent = '';
    byId('jcsMintReadout').replaceChildren();
    status(connected
      ? 'Complete a JCS trade or liquidity transaction, or check an earlier transaction hash above. Mint and download become available after ledger verification.'
      : 'Connect your wallet above, then complete a JCS trade or liquidity transaction, or check an earlier transaction hash. Mint and download become available after ledger verification.');
  }
  function row(target, label, value) { const div = doc.createElement('div'), dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = label; dd.textContent = value; div.append(dt, dd); target.appendChild(div); }
  function assertAccount(account, token) { if (!account || api.getAccount() !== account || token !== version) throw new Error('Your wallet changed. Review this request again.'); }
  function readSaved(account, sourceHash) { try { return JSON.parse(root.localStorage.getItem('jcs.receiptNftMints.v1') || '{}')[account + ':' + sourceHash] || null; } catch { return null; } }
  function remember(account, sourceHash, value) { try { const values = JSON.parse(root.localStorage.getItem('jcs.receiptNftMints.v1') || '{}'); values[account + ':' + sourceHash] = value; const entries = Object.entries(values).slice(-50); root.localStorage.setItem('jcs.receiptNftMints.v1', JSON.stringify(Object.fromEntries(entries))); } catch {} }
  function rememberSource(value) {
    try {
      const previous = JSON.parse(root.localStorage.getItem('jcs.validatedReceipts.v1') || '[]');
      const record = { ...(Array.isArray(previous) ? previous.find(item => item?.txid === value.txid) : {}), txid: value.txid, kind: value.kind, account: value.transaction.Account, validated_at_utc: value.validatedAt, ledgerIndex: value.ledgerIndex };
      root.localStorage.setItem('jcs.validatedReceipts.v1', JSON.stringify([record, ...(Array.isArray(previous) ? previous : []).filter(item => item?.txid !== value.txid)].slice(0, 10)));
    } catch {}
  }
  function download(metadata) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }));
    const a = doc.createElement('a'); a.href = url; a.download = 'jcs-receipt-' + (metadata.source_transaction || metadata.jcs?.receipt?.source_transaction) + '.json'; a.click(); root.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function rememberCandidate(detail, account) {
    try {
      const values = JSON.parse(root.localStorage.getItem('jcs.receiptCandidates.v1') || '[]');
      const record = { txid: detail.txid.toUpperCase(), account, ...(detail.kind ? { kind: detail.kind } : {}) };
      root.localStorage.setItem('jcs.receiptCandidates.v1', JSON.stringify([record, ...(Array.isArray(values) ? values : []).filter(value => value?.txid !== record.txid)].slice(0, 10)));
    } catch {}
  }
  function forgetCandidate(txid, account) {
    try {
      const values = JSON.parse(root.localStorage.getItem('jcs.receiptCandidates.v1') || '[]');
      if (Array.isArray(values)) root.localStorage.setItem('jcs.receiptCandidates.v1', JSON.stringify(values.filter(value => value?.txid !== txid || value?.account !== account)));
    } catch {}
  }
  async function verifySource(detail, account) {
    if (!HASH.test(detail.txid || '') || (detail.kind !== undefined && !KIND[detail.kind])) throw new Error('This is not a supported trade or liquidity receipt.');
    let result;
    try { result = await request('tx', { transaction: detail.txid, binary: false }); }
    catch (error) { if (error.code === 'txnNotFound' || /txnNotFound|^Transaction not found\.?$/i.test(error.message || '')) error.pendingSource = true; throw error; }
    if (result.validated !== true) { const error = new Error('The transaction is still waiting for ledger validation.'); error.pendingSource = true; throw error; }
    const tx = result.tx_json || result;
    const kind = sourceKind(tx);
    if (tx.Account !== account || !kind || (detail.kind !== undefined && kind !== KIND[detail.kind])) throw new Error('The source transaction does not match this wallet or a supported buy, sale or liquidity action.');
    const hasIsoTime = typeof result.close_time_iso === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result.close_time_iso) && Number.isFinite(Date.parse(result.close_time_iso));
    if (!Number.isInteger(tx.date ?? result.date) && !hasIsoTime) {
      const ledger = verified(await request('ledger', { ledger_index: Number(result.ledger_index) }), Number(result.ledger_index));
      result = { ...result, date: ledger.ledger?.close_time };
    }
    // The shared browser/backend contract derives real balance changes from
    // AffectedNodes. Reviewed transaction limits are never receipt amounts.
    const record = receipts.fromLedger(result, detail.txid.toUpperCase());
    if (record.account !== account) throw new Error('Connect the wallet that made the source transaction.');
    return { txid: record.source_transaction, kind: record.source_kind, transaction: tx, ledgerIndex: record.ledger,
      validatedAt: record.validated_at_utc, record };
  }
  async function acceptReceipt(detail, retryPending = false) {
    // A wallet identity refresh can arrive while Render metadata or the fee
    // preflight is still being prepared. It is not a new source transaction;
    // resetting the panel here used to erase the review just as it became
    // ready (and could make the Xaman handoff appear to flash and vanish).
    if (!HASH.test(detail?.txid || '') || (detail.kind !== undefined && !KIND[detail.kind]) || signing || preparing) return;
    const token = version, sequence = ++receiptSequence, account = api.getAccount();
    if (!account || (detail.account && detail.account !== account)) { updateEntry(); return; }
    source = null; prepared = null; saved = null; receiptPanel.hidden = false; receiptPanel.dataset.state = 'checking'; byId('jcsReceiptReview').hidden = true;
    byId('jcsReceiptArtwork').src = 'jcs-logo.png'; byId('jcsReceiptArtwork').removeAttribute('data-verified'); byId('jcsReceiptImageLink').removeAttribute('href');
    byId('jcsReceiptPreviewState').textContent = 'Receipt preview · not minted';
    byId('jcsReceiptActionLabel').textContent = 'Checking transaction'; byId('jcsReceiptConfirmation').textContent = '';
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptSign').disabled = true; byId('jcsReceiptDownload').disabled = true; byId('jcsReceiptHash').textContent = detail.txid; byId('jcsReceiptHash').hidden = false;
    byId('jcsReceiptHash').href = 'https://livenet.xrpl.org/transactions/' + detail.txid;
    byId('jcsReceiptNetwork').textContent = 'Checking ledger'; status('Checking the transaction on the XRP Ledger before preparing its receipt…');
    try {
      let result;
      const delays = retryPending ? [0, 1000, 2000, 4000, 6000] : [0];
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt]) await new Promise(resolve => root.setTimeout(resolve, delays[attempt]));
        assertAccount(account, token); if (sequence !== receiptSequence) return;
        try { result = await verifySource(detail, account); break; }
        catch (error) {
          assertAccount(account, token); if (sequence !== receiptSequence) return;
          if (!error.pendingSource || attempt === delays.length - 1) throw error;
          status('Transaction submitted. Waiting for validated ledger evidence before enabling receipt actions…');
        }
      }
      assertAccount(account, token); if (sequence !== receiptSequence) return;
      source = result; saved = readSaved(account, source.txid); rememberSource(source); forgetCandidate(source.txid, account); receiptPanel.dataset.state = 'verified';
      byId('jcsReceiptLookupHash').value = source.txid;
      byId('jcsReceiptActionLabel').textContent = KIND_LABEL[source.kind];
      const amounts = source.record.assetA.value + ' JCS · ' + source.record.assetB.value + ' XRP' + (source.record.lp ? ' · ' + source.record.lp.value + ' LP tokens' : '');
      byId('jcsReceiptConfirmation').textContent = amounts + ' · Validated ledger #' + source.ledgerIndex + ' · ' + new Date(source.validatedAt).toLocaleString();
      byId('jcsReceiptNetwork').textContent = NETWORK + ' · ledger #' + source.ledgerIndex;
      byId('jcsReceiptMeaning').textContent = source.kind === 'limit-order' ? 'This records the limit order transaction and any amounts exchanged in that transaction. It does not prove that the remaining order filled. Minting is a separate optional transaction.' : 'This receipt records actual wallet movements from the confirmed transaction. It conveys no ownership of liquidity or redemption rights. Minting is a separate optional transaction.';
      byId('jcsReceiptMint').textContent = saved ? 'Check receipt mint on ledger' : 'Mint receipt NFT';
      byId('jcsReceiptMint').disabled = false; byId('jcsReceiptDownload').disabled = false;
      lookupStatus('Transaction verified. Your receipt actions are ready below.');
      status('Transaction confirmed. Download its JSON record or choose Mint receipt NFT to prepare its artwork and separate Xaman request.');
    } catch (error) { if (token === version && sequence === receiptSequence) {
      receiptPanel.dataset.state = error.pendingSource ? 'pending' : 'error'; byId('jcsReceiptNetwork').textContent = error.pendingSource ? 'Awaiting validation' : 'Verification unavailable';
      byId('jcsReceiptActionLabel').textContent = error.pendingSource ? 'Transaction awaiting confirmation' : 'Receipt not verified';
      status((error.message || String(error)) + (error.pendingSource ? ' Your transaction hash is saved. Choose Check transaction to retry; no second transaction will be submitted.' : ''));
      lookupStatus(error.pendingSource ? 'Confirmation is pending. Recheck this same hash shortly.' : 'The transaction could not be verified. Check the hash and connected wallet.');
    } }
  }
  let serviceCheck = null;
  function showServiceStatus(ready, explanation = '') {
    const element = byId('jcsReceiptServiceStatus');
    element.dataset.state = ready ? 'ready' : 'unavailable';
    element.textContent = ready ? 'NFT receipt service ready. Completed transactions can be used without making another deposit.'
      : 'NFT minting is unavailable. ' + explanation + ' Your completed transaction can be used when the service is ready; no new deposit is needed.';
  }
  function validateService(readiness) {
    if (readiness.ready !== true || readiness.service !== 'jcs-receipts-v1' || readiness.schema !== receipts.SCHEMA || readiness.receiptPolicy !== receipts.POLICY || readiness.publicBase !== BACKEND_URL) throw new Error('The JCS receipt route is not ready on the service.');
  }
  function checkReceiptService() {
    if (serviceCheck) return serviceCheck;
    byId('jcsReceiptServiceCheck').disabled = true;
    const controller = new AbortController(), timeout = root.setTimeout(() => controller.abort(), 20000);
    serviceCheck = (async () => {
      try {
        const url = BACKEND_URL + RECEIPT_ROUTE + '/status.json';
        const response = await root.fetch(url, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
        if (response.status === 404) throw new Error('The existing Render service needs the JCS receipt update (HTTP 404).');
        if (!response.ok) throw new Error('The receipt service returned HTTP ' + (response.status || 'error') + '.');
        if (response.url !== url || (response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim() !== 'application/json') throw new Error('The receipt service returned an unexpected response.');
        const text = await response.text();
        if (encoder.encode(text).length > 65536) throw new Error('The receipt service response is too large.');
        validateService(JSON.parse(text));
        showServiceStatus(true);
      } catch (error) {
        showServiceStatus(false, error.name === 'AbortError' ? 'The service check timed out. Retry the check.' : error.message || 'The service could not be reached.');
      } finally { root.clearTimeout(timeout); byId('jcsReceiptServiceCheck').disabled = false; serviceCheck = null; }
    })();
    return serviceCheck;
  }
  byId('jcsReceiptServiceCheck').addEventListener('click', checkReceiptService);
  async function verifyDisplayMetadata(selected, digest) {
    const expected = receipts.metadata(BACKEND_URL, selected.record, digest), urls = receipts.urls(BACKEND_URL, selected.record, digest);
    const controller = new AbortController(), timeout = root.setTimeout(() => controller.abort(), 20000);
    let serviceReady = false;
    const fetchExact = async (url, type) => {
      const response = await root.fetch(url, { credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal });
      if (response.status === 404) throw new Error(url.endsWith('/status.json')
        ? 'The JCS receipt endpoint is not deployed on the backend (HTTP 404). The existing Render service needs the JCS receipt update.'
        : 'The receipt service is ready, but this transaction’s metadata or artwork is currently unavailable (HTTP 404). Retry this same receipt shortly.');
      if (!response.ok) throw new Error('The receipt service returned HTTP ' + (response.status || 'error') + '. Please retry after the service is available.');
      if (response.url !== url) throw new Error('The receipt service returned an unexpected address.');
      if ((response.headers.get('content-type') || '').toLowerCase().split(';')[0].trim() !== type) throw new Error('The receipt service did not return the expected ' + type + ' file.');
      return response;
    };
    const readJSON = async url => {
      const response = await fetchExact(url, 'application/json'), text = await response.text();
      if (encoder.encode(text).length > 65536) throw new Error('The receipt metadata response is too large.');
      return JSON.parse(text);
    };
    try {
      const readiness = await readJSON(BACKEND_URL + RECEIPT_ROUTE + '/status.json');
      validateService(readiness); serviceReady = true; showServiceStatus(true);
      const metadata = await readJSON(urls.metadata);
      if (receipts.stable(metadata) !== receipts.stable(expected)) throw new Error('Published receipt metadata does not match the independently verified ledger record.');
      const response = await fetchExact(urls.image, 'image/png');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const signature = [137,80,78,71,13,10,26,10];
      if (bytes.length < 33 || bytes.length > 5000000 || !signature.every((byte, index) => bytes[index] === byte) || String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') throw new Error('The receipt artwork is not a valid PNG.');
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), width = view.getUint32(16), height = view.getUint32(20);
      if (width < 1 || width > 4096 || height < 1 || height > 4096) throw new Error('The receipt artwork dimensions are invalid.');
      return { metadata, urls };
    } catch (error) {
      if (!serviceReady) showServiceStatus(false, error.message || 'The service could not be reached.');
      throw new Error('Your transaction is verified, but its receipt artwork could not be verified. ' + (error.message || '') + ' You can download the verified JSON now and retry this receipt. No new deposit is needed.');
    } finally { root.clearTimeout(timeout); }
  }
  async function preflight(account, extraObjects = 2) {
    const ledger = verified(await request('ledger', { ledger_index: 'validated' })); const index = Number(ledger.ledger_index);
    const [fee, info, server] = await Promise.all([request('fee', { ledger_index: 'current' }), request('account_info', { account, ledger_index: index }), request('server_state', { ledger_index: 'current' })]);
    verified(info, index);
    const feeDrops = fee.drops?.open_ledger_fee, reserve = server.state?.validated_ledger;
    if (!/^\d+$/.test(feeDrops || '') || Number(feeDrops) < 1 || Number(feeDrops) > 10000 || !reserve || !/^\d+$/.test(String(reserve.reserve_base)) || !/^\d+$/.test(String(reserve.reserve_inc))) throw new Error('Current fees or reserves are unavailable. Try again shortly.');
    const owner = info.account_data?.OwnerCount, balance = info.account_data?.Balance;
    if (!Number.isSafeInteger(owner) || owner < 0 || !/^\d+$/.test(balance || '')) throw new Error('The wallet balance or owner count is unavailable.');
    const extraReserve = BigInt(reserve.reserve_inc);
    if (BigInt(balance) < BigInt(reserve.reserve_base) + BigInt(owner + extraObjects) * extraReserve + BigInt(feeDrops) + 1000000n) throw new Error('The wallet needs more available XRP for this fee and a possible new ledger object reserve.');
    return { fee: feeDrops, lastLedger: index + 20, index, extraReserve: extraObjects * Number(extraReserve) / 1000000, createdAt: Date.now() };
  }
  async function prepareMint() {
    if (!source || signing || preparing) return;
    const account = api.getAccount(), token = version, selected = source, sequence = ++preparationSequence;
    preparing = true;
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptSign').disabled = true; prepared = null;
    try {
      if (saved) { await checkSavedMint(saved, selected, account, token); return; }
      status('Preparing your transaction artwork and checking its published metadata against the validated ledger…');
      const digest = await receipts.digest(selected.record);
      assertAccount(account, token); if (source !== selected || sequence !== preparationSequence) return;
      const published = await verifyDisplayMetadata(selected, digest);
      assertAccount(account, token); if (source !== selected || sequence !== preparationSequence) return;
      const limits = await preflight(account);
      assertAccount(account, token); if (source !== selected || sequence !== preparationSequence) return;
      const transaction = { ...receipts.buildMint(account, selected.record, digest, BACKEND_URL), Fee: String(limits.fee), LastLedgerSequence: limits.lastLedger };
      receipts.assertMint(transaction, selected.record, digest, BACKEND_URL);
      const metadata = published.metadata;
      const artifact = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      prepared = { metadata, artifact, transaction, account, token, source: selected, digest, ...limits };
      byId('jcsReceiptJson').textContent = JSON.stringify(metadata, null, 2); byId('jcsReceiptUri').textContent = unhex(transaction.URI);
      byId('jcsReceiptArtwork').src = published.urls.image; byId('jcsReceiptArtwork').dataset.verified = 'true'; byId('jcsReceiptImageLink').href = published.urls.image;
      const readout = byId('jcsMintReadout'); readout.replaceChildren();
      row(readout, 'JCS moved', selected.record.assetA.value + ' JCS'); row(readout, 'XRP moved', selected.record.assetB.value + ' XRP (network fee excluded)');
      if (selected.record.lp) row(readout, selected.record.kind === 'deposit' ? 'LP tokens received' : 'LP tokens redeemed', selected.record.lp.value);
      row(readout, 'Network fee', Number(limits.fee) / 1000000 + ' XRP'); row(readout, 'Possible extra account reserve', limits.extraReserve + ' XRP (held in your wallet)'); row(readout, 'Available balance buffer', '1 XRP kept available'); row(readout, 'NFT issuer', account); row(readout, 'Taxon', String(TAXON));
      const review = byId('jcsReceiptReview'); review.hidden = false; byId('jcsReceiptSign').disabled = false;
      // The review is below the receipt action row. Bring the complete NFT
      // preview into view so a click never looks like a disappearing popup.
      if (typeof review.scrollIntoView === 'function') review.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const heading = review.querySelector('h4');
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      status('Your receipt artwork and metadata are verified. Review them below. Minting requires a separate signature in Xaman.');
    } catch (error) { if (token === version && sequence === preparationSequence) status(error.message || String(error)); }
    finally { if (token === version && sequence === preparationSequence && byId('jcsReceiptMint').textContent !== 'Receipt mint confirmed') byId('jcsReceiptMint').disabled = false; preparing = false; }
  }
  async function checkSavedMint(record, selected, account, token) {
    status('Checking the earlier mint request on the ledger…');
    if (!HASH.test(record.txid || '') && PAYLOAD_ID.test(record.payloadId || '') && typeof api.getNftRequest === 'function') {
      const payload = await api.getNftRequest(record.payloadId, record.transaction);
      assertAccount(account, token);
      if (!payload || payload.uuid !== record.payloadId) throw new Error('The earlier Xaman request could not be identified. A second mint has not been created.');
      if (payload.signed === true && HASH.test(payload.txid || '')) {
        saved = record = { ...record, txid: payload.txid.toUpperCase(), status: 'unconfirmed' };
        remember(account, selected.txid, saved);
      } else if (payload.resolved === true && payload.signed === false) {
        saved = null; remember(account, selected.txid, null); byId('jcsReceiptMint').textContent = 'Mint receipt NFT';
        status('Xaman confirms that the earlier request was resolved without a signature. You can review a new receipt mint.'); return;
      }
    }
    if (!HASH.test(record.txid || '')) {
      const current = Number(verified(await request('ledger', { ledger_index: 'validated' })).ledger_index);
      assertAccount(account, token);
      const minimum = Number(record.firstLedger), maximum = current;
      // Xaman can replace LastLedgerSequence. Search through the current ledger;
      // the original review's deadline cannot prove an unknown request expired.
      if (!Number.isSafeInteger(minimum) || minimum < 1 || maximum < minimum) {
        throw new Error('An earlier mint request may still be open in Xaman. Its outcome is unknown; no second request has been created.');
      }
      let marker, complete = false;
      for (let page = 0; page < 20; page++) {
        const history = await request('account_tx', { account, ledger_index_min: minimum, ledger_index_max: maximum, binary: false, limit: 100, ...(marker ? { marker } : {}) });
        assertAccount(account, token);
        if (history.account !== account || !Array.isArray(history.transactions) || !Number.isSafeInteger(Number(history.ledger_index_min)) || !Number.isSafeInteger(Number(history.ledger_index_max)) || Number(history.ledger_index_min) > minimum || Number(history.ledger_index_max) < maximum) throw new Error('Full ledger history is unavailable. Check the mint in Xaman before trying again.');
        for (const entry of history.transactions) {
          const tx = entry.tx_json || entry.tx;
          const includedAt = Number(entry.ledger_index ?? tx?.ledger_index);
          if (entry.validated !== true || !tx || typeof tx.TransactionType !== 'string' || typeof tx.Account !== 'string' || !Number.isSafeInteger(includedAt) || includedAt < minimum || includedAt > maximum) throw new Error('Ledger history contains an unverified entry. The earlier mint remains blocked until its outcome can be checked.');
          if (tx.Account !== account || tx.TransactionType !== 'NFTokenMint' || safeUri(tx.URI)?.metadata?.source_transaction !== selected.txid) continue;
          const hash = entry.hash || tx.hash;
          if (!HASH.test(hash || '')) continue;
          saved = { ...record, txid: hash.toUpperCase(), status: 'unconfirmed' }; remember(account, selected.txid, saved);
          return checkSavedMint(saved, selected, account, token);
        }
        marker = history.marker; if (!marker) { complete = true; break; }
      }
      if (!complete) throw new Error('The complete request history could not be checked. Check Xaman before trying again.');
      throw new Error('An earlier mint request has no verified outcome yet. Check or reject that request in Xaman, then check here again. Its original review deadline alone cannot release another mint.');
    }
    let result;
    try { result = await request('tx', { transaction: record.txid, binary: false }); }
    catch (error) { if (error.code === 'txnNotFound' || /txnNotFound|^Transaction not found\.?$/i.test(error.message || '')) throw new Error('The signed mint transaction is not available from this ledger server yet. Its outcome remains unknown; no second mint has been created.'); throw error; }
    assertAccount(account, token);
    if (result.validated !== true) throw new Error('That mint is still unconfirmed. Check Xaman and retry this status check; a second mint has not been created.');
    const tx = result.tx_json || result;
    const uri = safeUri(tx.URI);
    if ((result.hash || tx.hash)?.toUpperCase() !== record.txid.toUpperCase() || tx.TransactionType !== 'NFTokenMint' || tx.Account !== account || uri?.metadata?.source_transaction !== selected.txid) throw new Error('The earlier transaction does not match this receipt. Inspect its ledger record.');
    const meta = result.meta || result.metaData;
    if (/^tec[A-Z0-9_]+$/.test(meta?.TransactionResult || '')) { saved = null; remember(account, selected.txid, null); byId('jcsReceiptMint').textContent = 'Mint receipt NFT'; throw new Error('The earlier mint did not succeed. You can now review a new mint request.'); }
    if (meta?.TransactionResult !== 'tesSUCCESS') throw new Error('The earlier mint result is incomplete. Its outcome remains unknown; no second mint has been created.');
    if (!record.transaction) throw new Error('The original mint review is unavailable. Inspect this transaction in Xaman before taking another action.');
    const confirmed = confirmedResult({ txid: record.txid, validated: true, ledgerIndex: Number(result.ledger_index), transaction: { ...tx, hash: result.hash || tx.hash }, meta }, record.transaction, record.firstLedger, true);
    saved = { ...record, status: 'validated' }; remember(account, selected.txid, saved);
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptMint').textContent = 'Receipt mint confirmed';
    byId('jcsReceiptPreviewState').textContent = 'Receipt NFT mint confirmed';
    status('Receipt NFT mint confirmed at ledger #' + result.ledger_index + '. ' + (confirmed.reviewWindowChanged ? 'Xaman used a later ledger window than the original review. The NFT exists; no second mint will be created. ' : '') + 'Open My NFTs to view your wallet.');
  }
  byId('jcsReceiptLookup').addEventListener('submit', async event => {
    event.preventDefault(); if (signing) return;
    if (!api.getAccount()) { updateEntry(); return; }
    const input = byId('jcsReceiptLookupHash'), txid = input.value.trim().toUpperCase();
    if (!HASH.test(txid)) { input.setAttribute('aria-invalid', 'true'); lookupStatus('Paste the complete 64-character transaction hash from Xaman or your transaction history.'); return; }
    input.removeAttribute('aria-invalid'); input.value = txid;
    const token = version; byId('jcsReceiptLookupCheck').disabled = true; lookupStatus('Checking this transaction on the validated XRP Ledger…');
    try { await acceptReceipt({ txid }); }
    finally { if (token === version) byId('jcsReceiptLookupCheck').disabled = signing || !api.getAccount(); }
  });
  byId('jcsReceiptMint').addEventListener('click', prepareMint);
  byId('jcsReceiptDownload').addEventListener('click', () => { if (source) { try { download(source.record); } catch (error) { status(error.message); } } });
  byId('jcsReceiptPreviewDownload').addEventListener('click', () => { if (prepared) download(prepared.metadata); });
  byId('jcsReceiptOpenNfts').addEventListener('click', () => doc.dispatchEvent(new root.CustomEvent('jcs:open-nfts')));
  byId('jcsReceiptCancel').addEventListener('click', () => { if (!signing) { preparationSequence++; prepared = null; byId('jcsReceiptReview').hidden = true; } });
  byId('jcsReceiptSign').addEventListener('click', async () => {
    if (!prepared || signing) return;
    const review = prepared; let pendingRecord = null; signing = true; byId('jcsReceiptLookupCheck').disabled = true; byId('jcsReceiptSign').disabled = true; byId('jcsReceiptMint').disabled = true;
    try {
      assertAccount(review.account, review.token);
      if (Date.now() - review.createdAt > 60000) throw new Error('The fee review expired. Select Mint receipt NFT to review again.');
      status('Review this separate NFT mint in Xaman. Waiting for your signature and ledger confirmation…');
      const existing = readSaved(review.account, review.source.txid);
      if (existing) { saved = existing; throw new Error('Another mint request already exists for this receipt. Check its ledger status first.'); }
      saved = pendingRecord = { status: 'awaiting-signature', firstLedger: review.index, lastLedger: review.transaction.LastLedgerSequence, transaction: review.transaction };
      remember(review.account, review.source.txid, saved);
      let result = await api.submitNft(review.transaction, request => {
        if (!PAYLOAD_ID.test(request?.uuid || '')) return;
        pendingRecord = { ...pendingRecord, payloadId: request.uuid.toLowerCase() };
        remember(review.account, review.source.txid, pendingRecord);
        if (review.token === version && api.getAccount() === review.account) saved = pendingRecord;
      });
      try { result = confirmedResult(result, review.transaction, review.index); }
      catch (error) { error.txid = result?.txid; error.requiresReconciliation = true; throw error; }
      const confirmed = { ...pendingRecord, txid: result.txid, status: 'validated' }; remember(review.account, review.source.txid, confirmed);
      if (review.token !== version || api.getAccount() !== review.account) return;
      saved = confirmed; byId('jcsReceiptReview').hidden = true; byId('jcsReceiptMint').textContent = 'Check receipt mint on ledger';
      byId('jcsReceiptPreviewState').textContent = 'Receipt NFT mint confirmed';
      status('Receipt NFT mint confirmed at ledger #' + result.ledgerIndex + '. ' + (result.nftId ? 'NFT ID: ' + result.nftId + '.' : 'Open My NFTs to view the new record.'));
      prepared = null; await refresh();
    } catch (error) {
      let outcome = pendingRecord || readSaved(review.account, review.source.txid);
      if (HASH.test(error.txid || '') && (error.unconfirmed || error.requiresReconciliation)) {
        outcome = { ...outcome, txid: error.txid, status: 'unconfirmed' }; remember(review.account, review.source.txid, outcome);
      } else if (error.definitelyNotSubmitted || error.finalLedgerResult) { outcome = null; remember(review.account, review.source.txid, null); }
      else if (outcome) { outcome = { ...outcome, status: 'unknown' }; remember(review.account, review.source.txid, outcome); }
      if (review.token === version && api.getAccount() === review.account) {
        saved = outcome; status((error.unconfirmed ? 'Mint submitted, but confirmation is not available. ' : '') + (error.message || String(error)));
        if (saved) byId('jcsReceiptMint').textContent = 'Check receipt mint on ledger';
      }
    } finally { signing = false; byId('jcsReceiptLookupCheck').disabled = !api.getAccount(); if (review.token === version) { byId('jcsReceiptMint').disabled = false; byId('jcsReceiptSign').disabled = !!saved; } }
  });
  function addCard(item) {
    const card = doc.createElement('article'); card.className = 'jcs-nft-card';
    const title = doc.createElement('h3'); title.textContent = 'NFT ' + item.NFTokenID.slice(0, 8) + '…';
    const readout = doc.createElement('dl'); readout.className = 'jcs-nft-details';
    row(readout, 'NFT ID', item.NFTokenID); row(readout, 'Issuer', item.Issuer || 'Not supplied'); row(readout, 'Taxon', String(item.NFTokenTaxon ?? 'Not supplied'));
    const uri = safeUri(item.URI);
    row(readout, 'URI', uri?.text || (item.URI ? 'Unsupported or unsafe URI; view the ledger record.' : 'No URI published'));
    card.append(title, readout);
    const link = doc.createElement('a'); link.className = 'btn'; link.href = 'https://livenet.xrpl.org/nft/' + item.NFTokenID; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View ledger record ↗'; card.appendChild(link);
    if (uri?.href) { const metadata = doc.createElement('a'); metadata.href = uri.href; metadata.target = '_blank'; metadata.rel = 'noopener noreferrer'; metadata.textContent = 'Open published metadata ↗'; card.appendChild(metadata); }
    if (uri?.metadata) { const note = doc.createElement('p'); note.className = 'jcs-tool-small'; note.textContent = uri?.metadata?.sha256 ? 'JCS receipt. Its published artwork and JSON describe this source transaction; the verification digest is recorded in the mint memo.' : 'Legacy JCS receipt. Its full JSON is preserved in the original mint transaction memo.'; card.appendChild(note); }
    if (!personalReceipt(item) && ((Number(item.Flags) & 8) || item.Issuer === api.getAccount())) {
      const button = doc.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = 'Create sell offer';
      button.addEventListener('click', () => { if (signing) return; saleNft = item; saleReview = null; byId('jcsNftSaleId').textContent = item.NFTokenID; byId('jcsNftSalePrice').value = ''; byId('jcsNftSaleReview').hidden = true; byId('jcsNftSaleStatus').textContent = ''; sale.hidden = false; byId('jcsNftSalePrice').focus(); }); card.appendChild(button);
    } else { const note = doc.createElement('p'); note.className = 'jcs-tool-small'; note.textContent = personalReceipt(item) ? 'Personal receipt. Trading these records is not offered here.' : 'This wallet cannot list this NFT: its general transfer flag is off.'; card.appendChild(note); }
    gallery.appendChild(card);
  }
  async function refresh(append = false) {
    if (loading) return;
    const account = api.getAccount(), token = version; loading = true; byId('jcsNftRefresh').disabled = true; more.disabled = true;
    if (!append) { gallery.replaceChildren(); collection = new Map(); pageState = null; more.hidden = true; }
    if (!account) { message.textContent = 'Connect Xaman above to view your NFTs.'; loading = false; byId('jcsNftRefresh').disabled = false; return; }
    message.textContent = 'Reading wallet NFTs from the validated ledger…';
    try {
      const index = append && pageState?.account === account ? pageState.index : Number(verified(await request('ledger', { ledger_index: 'validated' })).ledger_index);
      const marker = append ? pageState?.marker : null;
      const result = verified(await request('account_nfts', { account, ledger_index: index, limit: 100, ...(marker ? { marker } : {}) }), index);
      assertAccount(account, token); if (!Array.isArray(result.account_nfts)) throw new Error('The ledger did not return an NFT list.');
      for (const nft of result.account_nfts) { if (HASH.test(nft.NFTokenID || '') && !collection.has(nft.NFTokenID)) { collection.set(nft.NFTokenID, nft); addCard(nft); } }
      pageState = { account, index, marker: result.marker }; more.hidden = !result.marker;
      message.textContent = collection.size + ' NFT' + (collection.size === 1 ? '' : 's') + (result.marker ? ' shown; load more below.' : ' in this wallet.') + ' Verified at ledger #' + index + '.';
    } catch (error) { if (token === version) message.textContent = error.message || String(error); }
    finally { loading = false; byId('jcsNftRefresh').disabled = false; more.disabled = false; if (token !== version && !byId('jcsNftsPanel').hidden) refresh(); }
  }
  async function checkOwnership(id, account, index) {
    let marker;
    for (let page = 0; page < 100; page++) {
      const result = verified(await request('account_nfts', { account, ledger_index: index, limit: 100, ...(marker ? { marker } : {}) }), index);
      if (!Array.isArray(result.account_nfts)) throw new Error('NFT ownership could not be verified.');
      const found = result.account_nfts.find(item => item.NFTokenID === id); if (found) return found;
      marker = result.marker; if (!marker) break;
    }
    throw new Error('This wallet no longer holds that NFT, or its ownership could not be verified. Refresh My NFTs.');
  }
  more.addEventListener('click', () => refresh(true));
  byId('jcsNftSalePrice').addEventListener('input', () => { saleReview = null; byId('jcsNftSaleReview').hidden = true; });
  byId('jcsNftSaleClose').addEventListener('click', () => { if (!signing) { sale.hidden = true; saleReview = null; saleNft = null; } });
  byId('jcsNftSalePreview').addEventListener('click', async () => {
    if (!saleNft || signing) return;
    const account = api.getAccount(), token = version, nft = saleNft, price = byId('jcsNftSalePrice').value;
    saleReview = null; byId('jcsNftSaleReview').hidden = true; byId('jcsNftSalePreview').disabled = true;
    try {
      drops(price); const limits = await preflight(account, 1); const owned = await checkOwnership(nft.NFTokenID, account, limits.index); assertAccount(account, token);
      if (nft !== saleNft || price !== byId('jcsNftSalePrice').value) throw new Error('Your offer changed. Review it again.');
      const expires = Math.floor(Date.now() / 1000) - 946684800 + 86400;
      const transaction = buildSell(owned, account, price, limits.fee, limits.lastLedger, expires);
      saleReview = { transaction, account, token, ...limits };
      const rows = byId('jcsNftSaleRows'); rows.replaceChildren(); row(rows, 'Asking price', price + ' XRP'); row(rows, 'Network fee', Number(limits.fee) / 1000000 + ' XRP'); row(rows, 'Possible extra account reserve', limits.extraReserve + ' XRP'); row(rows, 'Available balance buffer', '1 XRP kept available'); row(rows, 'Expires', new Date((expires + 946684800) * 1000).toLocaleString());
      byId('jcsNftSaleReview').hidden = false; byId('jcsNftSaleStatus').textContent = 'Ownership verified. Check the price before opening Xaman.';
    } catch (error) { if (token === version) byId('jcsNftSaleStatus').textContent = error.message || String(error); }
    finally { byId('jcsNftSalePreview').disabled = false; }
  });
  byId('jcsNftSaleSign').addEventListener('click', async () => {
    if (!saleReview || signing) return;
    const review = saleReview; signing = true; byId('jcsNftSaleSign').disabled = true; byId('jcsNftSalePrice').disabled = true;
    try {
      assertAccount(review.account, review.token);
      if (Date.now() - review.createdAt > 60000) throw new Error('This offer review expired. Review its price and fee again.');
      const index = Number(verified(await request('ledger', { ledger_index: 'validated' })).ledger_index);
      await checkOwnership(review.transaction.NFTokenID, review.account, index); assertAccount(review.account, review.token);
      byId('jcsNftSaleStatus').textContent = 'Review this sell offer in Xaman. Waiting for signature and ledger confirmation…';
      const result = confirmedResult(await api.submitNft(review.transaction), review.transaction, review.index);
      if (review.token !== version) return;
      saleReview = null; byId('jcsNftSaleReview').hidden = true;
      byId('jcsNftSaleStatus').textContent = 'Sell offer created at ledger #' + result.ledgerIndex + '. It has not sold yet. Transaction: ' + result.txid;
    } catch (error) { if (review.token === version) { byId('jcsNftSaleStatus').textContent = (error.unconfirmed ? 'Offer submitted; ledger confirmation is unavailable. Check this transaction before creating another offer: ' + error.txid + '. ' : '') + (error.message || String(error)); saleReview = null; byId('jcsNftSaleReview').hidden = true; } }
    finally { signing = false; byId('jcsNftSaleSign').disabled = false; byId('jcsNftSalePrice').disabled = false; }
  });
  doc.addEventListener('jcs:validated-transaction', event => acceptReceipt(event.detail));
  doc.addEventListener('jcs:submitted-transaction', event => {
    const detail = event.detail, account = api.getAccount();
    if (!account || detail?.account !== account || !HASH.test(detail.txid || '') || (detail.kind !== undefined && !KIND[detail.kind]) || (detail.network && detail.network !== NETWORK)) return;
    rememberCandidate(detail, account);
    acceptReceipt(detail, true);
  });
  async function restoreReceipt() {
    const connected = api.getAccount(); if (!connected) return;
    let candidates; try { candidates = JSON.parse(root.localStorage.getItem('jcs.receiptCandidates.v1') || '[]'); } catch {}
    const candidate = Array.isArray(candidates) && candidates.find(item => item?.account === connected && HASH.test(item.txid || '') && (!item.kind || KIND[item.kind]));
    if (candidate) { await acceptReceipt(candidate, true); return; }
    let records; try { records = JSON.parse(root.localStorage.getItem('jcs.validatedReceipts.v1') || '[]'); } catch { return; }
    if (!Array.isArray(records)) return;
    const account = api.getAccount(); if (!account) return;
    const record = records.find(item => KIND[item.kind] && HASH.test(item.txid || '') && (!item.account || item.account === account));
    if (record) await acceptReceipt(record);
  }
  doc.addEventListener('jcs:wallet-changed', event => {
    const detailAccount = event?.detail && Object.prototype.hasOwnProperty.call(event.detail, 'account') ? event.detail.account : api.getAccount();
    const nextAccount = detailAccount ? String(detailAccount) : null;
    // Xaman emits identity refreshes on focus/retrieved/success. An unchanged
    // account is not a wallet change and must not reset an active receipt or
    // signing review. A real account transition still clears all account-bound
    // state below.
    if (nextAccount === observedAccount) { updateEntry(); return; }
    observedAccount = nextAccount;
    version++; receiptSequence++; preparationSequence++; source = null; prepared = null; saved = null; sale.hidden = true; saleReview = null; saleNft = null; collection.clear(); gallery.replaceChildren(); more.hidden = true; pageState = null;
    byId('jcsReceiptLookupHash').value = ''; byId('jcsReceiptLookupHash').removeAttribute('aria-invalid'); resetReceiptPanel(); updateEntry(); restoreReceipt();
  });
  root.JCSNft = Object.freeze({ refresh });
  resetReceiptPanel(); updateEntry(); checkReceiptService(); restoreReceipt();
  }

  let startupState = 'waiting', startupTimer = null, deadline = 0;
  let startupNotice = null, startupMessage = null, startupRetry = null;
  let startupCrashed = false;
  const outerErrorText = 'JCS receipt tools could not load. Refresh the page. If this continues, check that the complete replacement index.html was uploaded.';

  function showStartup(message, failed = false) {
    const trade = doc.getElementById('trade');
    if (!startupNotice) {
      startupNotice = doc.createElement('section');
      startupNotice.id = 'jcsReceiptStartup'; startupNotice.className = 'jcs-receipt-entry';
      startupNotice.setAttribute('aria-labelledby', 'jcsReceiptStartupHeading');
      const heading = doc.createElement('h3');
      heading.id = 'jcsReceiptStartupHeading'; heading.textContent = 'Create an NFT receipt';
      startupMessage = doc.createElement('p');
      startupMessage.setAttribute('role', 'status'); startupMessage.setAttribute('aria-live', 'polite');
      startupRetry = doc.createElement('button');
      startupRetry.type = 'button'; startupRetry.className = 'btn';
      startupRetry.addEventListener('click', retryStartup);
      startupNotice.append(heading, startupMessage, startupRetry);
    }
    const tabs = trade && trade.querySelector('.jcs-exchange-tabs');
    if (tabs) tabs.insertAdjacentElement('afterend', startupNotice);
    else if (trade) trade.prepend(startupNotice);
    else if (doc.body && !startupNotice.isConnected) doc.body.appendChild(startupNotice);
    startupMessage.textContent = message;
    startupRetry.hidden = !failed;
    startupRetry.textContent = startupCrashed ? 'Reload page to retry' : 'Retry receipt tools';
  }

  function readDependencies() {
    const trade = doc.getElementById('trade');
    if (!trade) throw new Error('The exchange section is missing.');
    const api = root.JCSWallet;
    if (!api || ['getAccount', 'request', 'submitNft'].some(name => typeof api[name] !== 'function')) {
      throw new Error('The wallet bridge with NFT signing is not ready.');
    }
    const configElement = doc.getElementById('app-config'); let config;
    try { config = JSON.parse(configElement ? configElement.textContent : ''); }
    catch { throw new Error('The JCS configuration is missing or invalid.'); }
    const currency = String(config && config.asset && config.asset.currencyHex || '').toUpperCase();
    if (!config || !config.asset || config.asset.issuer !== ISSUER ||
        !currency) {
      throw new Error('The configured JCS token identity is invalid.');
    }
    const gallery = doc.getElementById('jcsNftGrid'), panel = doc.getElementById('jcsNftsPanel');
    if (!trade.querySelector('.jcs-exchange-tabs') || !gallery || !panel ||
        !trade.contains(panel) || !panel.contains(gallery) ||
        !['jcsNftRefresh', 'jcsNftStatus'].every(id => {
          const element = doc.getElementById(id);
          return element && panel.contains(element);
        })) throw new Error('The exchange tabs and NFT gallery are not ready.');
    const receipts = root.JCS_RECEIPTS;
    if (!receipts || ['fromLedger', 'stable', 'urls', 'metadata', 'mintPayload'].some(name => typeof receipts[name] !== 'function')) throw new Error('The JCS receipt service module is not ready.');
    api.getAccount();
    return { api, trade, gallery, config, receipts };
  }

  function finishStartup() {
    startupState = 'ready'; root.clearTimeout(startupTimer); startupTimer = null;
    if (startupNotice) startupNotice.remove();
    doc.documentElement.dataset.jcsNftBundle = 'ready';
    // Remove only the enclosing bundle's exact, now-resolved startup notice.
    doc.querySelectorAll('p[role="alert"]').forEach(element => {
      if (element.textContent === outerErrorText) element.remove();
    });
  }

  function attemptStartup() {
    startupTimer = null;
    if (startupState === 'ready' || startupState === 'starting' || startupCrashed) return;
    if (root.JCSNft && doc.getElementById('jcsReceiptEntry') &&
        doc.getElementById('jcsReceiptActions')) { finishStartup(); return; }
    let dependencies;
    try { dependencies = readDependencies(); }
    catch (error) {
      const expired = Date.now() >= deadline;
      startupState = expired ? 'error' : 'waiting';
      showStartup((expired ? 'NFT receipt tools could not start. ' : 'Loading NFT receipt tools. ') +
        (error.message || String(error)), expired);
      if (!expired) startupTimer = root.setTimeout(attemptStartup, 250);
      return;
    }
    if (doc.getElementById('jcsReceiptEntry') || doc.getElementById('jcsReceiptActions')) {
      startupCrashed = true; startupState = 'error';
      showStartup('An incomplete receipt interface is already present. Reload the page before retrying.', true);
      return;
    }
    startupState = 'starting';
    try {
      startReceiptTools(dependencies); finishStartup();
    } catch (error) {
      // Partial initialization may have registered listeners: retry by reloading.
      startupCrashed = true; startupState = 'error';
      showStartup('NFT receipt tools encountered an error. Reload the page to retry. ' +
        (error.message || String(error)), true);
      root.console.error('JCS receipt startup:', error);
    }
  }

  function retryStartup() {
    if (startupState === 'ready' || startupState === 'starting') return;
    if (startupCrashed) { root.location.reload(); return; }
    root.clearTimeout(startupTimer); deadline = Date.now() + 15000; startupState = 'waiting';
    attemptStartup();
  }

  root.JCSReceiptStartup = Object.freeze({ get status() { return startupState; }, retry: retryStartup });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', retryStartup, { once: true });
  retryStartup();
})(typeof window !== 'undefined' ? window : globalThis);
