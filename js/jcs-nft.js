/* Optional ledger receipts and wallet-owned NFTs. Each write is a separate reviewed Xaman request. */
(function (root) {
  'use strict';
  const SCHEMA = 'jcs-validated-receipt-nft-v1', NETWORK = 'XRPL Mainnet', TAXON = 20260913;
  const ISSUER = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
  const HASH = /^[A-F0-9]{64}$/i;
  const KIND = { 'market-swap': 'market-swap', 'quick-buy': 'market-swap', 'limit-order': 'limit-order', 'liquidity-add': 'add-liquidity', 'add-liquidity': 'add-liquidity', 'liquidity-remove': 'withdraw-liquidity', 'withdraw-liquidity': 'withdraw-liquidity' };
  const TYPE = { Payment: 'market-swap', OfferCreate: 'limit-order', AMMDeposit: 'add-liquidity', AMMWithdraw: 'withdraw-liquidity' };
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
    const uri = 'data:application/json,' + encodeURIComponent(JSON.stringify({ schema: SCHEMA, network: NETWORK, source_transaction: metadata.source_transaction }));
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
  function confirmedResult(result, transaction) {
    if (result?.validated !== true || !HASH.test(result.txid || '') || !Number.isSafeInteger(Number(result.ledgerIndex))) throw new Error('The NFT transaction has not been confirmed on the validated ledger.');
    const tx = result.transaction?.tx_json || result.transaction;
    const meta = result.meta || result.transaction?.meta;
    if (!tx || meta?.TransactionResult !== 'tesSUCCESS' || tx.TransactionType !== transaction.TransactionType || tx.Account !== transaction.Account) throw new Error('The ledger result does not match this NFT request.');
    const actualHash = result.transaction?.hash || tx.hash;
    if (!HASH.test(actualHash || '') || actualHash.toUpperCase() !== result.txid.toUpperCase()) throw new Error('The NFT transaction hash does not match the ledger result.');
    for (const key of Object.keys(transaction)) {
      if (key === 'Memos') {
        if (!transaction.Memos.every(expected => (tx.Memos || []).some(actual => JSON.stringify(actual.Memo) === JSON.stringify(expected.Memo)))) throw new Error('The receipt metadata differs from the reviewed request.');
      } else if (key === 'Flags' ? (Number(tx.Flags) & 0x7fffffff) !== transaction.Flags : tx[key] !== transaction[key]) throw new Error('The NFT transaction differs from the reviewed request.');
    }
    return result;
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { hex, unhex, safeUri, buildMetadata, buildMint, buildSell, confirmedResult, drops }; return; }
  const doc = root.document, api = root.JCSWallet, trade = doc.getElementById('trade'), gallery = doc.getElementById('jcsNftGrid');
  if (!api || !trade || !gallery) return;
  let config; try { config = JSON.parse(doc.getElementById('app-config').textContent); } catch { return; }
  const currency = String(config.asset?.currencyHex || '').toUpperCase();
  if (config.asset?.issuer !== ISSUER || !currency) return;
  const byId = id => doc.getElementById(id);
  const message = byId('jcsNftStatus');
  let version = 0, source = null, prepared = null, signing = false, loading = false, saved = null, collection = new Map(), pageState = null;
  let receiptSequence = 0, preparationSequence = 0;
  const receiptPanel = doc.createElement('section');
  receiptPanel.id = 'jcsReceiptActions'; receiptPanel.className = 'jcs-receipt-actions'; receiptPanel.hidden = true;
  receiptPanel.setAttribute('aria-labelledby', 'jcsReceiptHeading');
  receiptPanel.innerHTML = `<div class="jcs-receipt-heading"><div><span class="jcs-tool-eyebrow">Your ledger record</span><h3 id="jcsReceiptHeading">Transaction receipt</h3></div><span class="jcs-pool-badge" id="jcsReceiptNetwork"></span></div>
    <p id="jcsReceiptStatus" role="status" aria-live="polite"></p><a id="jcsReceiptHash" class="jcs-nft-id" target="_blank" rel="noopener noreferrer"></a>
    <p class="jcs-tool-small" id="jcsReceiptMeaning">An optional personal record of your transaction. Minting is a separate network transaction with its own fee.</p>
    <div class="jcs-nft-actions"><button type="button" class="btn primary" id="jcsReceiptMint">Mint receipt NFT</button><button type="button" class="btn" id="jcsReceiptDownload">Download receipt JSON</button><button type="button" class="btn" id="jcsReceiptOpenNfts">Open My NFTs</button></div>
    <div id="jcsReceiptReview" class="jcs-nft-review" hidden><h4>Review your receipt NFT</h4><p class="jcs-tool-small">The compact receipt identity is stored inside the NFT URI. The complete JSON below is stored in the mint transaction memo on the ledger. Amount fields are transaction limits, not proof of a particular fill. No metadata host is required.</p>
      <label for="jcsReceiptPrivacy">Wallet shown in receipt metadata</label><select id="jcsReceiptPrivacy"><option value="masked">Masked address</option><option value="public">Full address</option></select><p class="jcs-tool-small">The signing account and source transaction remain public on the XRP Ledger, even with a masked metadata address.</p>
      <dl class="jcs-readout" id="jcsMintReadout"></dl><details><summary>Receipt JSON &amp; permanent URI</summary><pre id="jcsReceiptJson"></pre><code class="jcs-nft-id" id="jcsReceiptUri"></code></details>
      <p class="jcs-tool-small">Personal receipt: general transfer flag off. XRPL still permits transfers involving its original issuer. This receipt is not a spiritual reward or an investment guarantee.</p>
      <div class="jcs-nft-actions"><button type="button" class="btn" id="jcsReceiptPreviewDownload">Download reviewed JSON</button><button type="button" class="btn primary" id="jcsReceiptSign">Review &amp; sign mint in Xaman</button><button type="button" class="btn" id="jcsReceiptCancel">Close review</button></div></div>`;
  trade.querySelector('.jcs-exchange-tabs').insertAdjacentElement('afterend', receiptPanel);
  const more = doc.createElement('button'); more.type = 'button'; more.className = 'btn'; more.id = 'jcsNftMore'; more.textContent = 'Load more NFTs'; more.hidden = true; gallery.after(more);
  const sale = doc.createElement('section'); sale.id = 'jcsNftSale'; sale.className = 'jcs-nft-review'; sale.hidden = true;
  sale.innerHTML = `<h3>Create an NFT sell offer</h3><p class="jcs-tool-small">This lists an NFT you own at an XRP price for 24 hours. A listing does not mean it has sold. A buyer must accept the offer on the ledger.</p><code id="jcsNftSaleId" class="jcs-nft-id"></code><label for="jcsNftSalePrice">Asking price in XRP</label><div class="jcs-amount-field"><input id="jcsNftSalePrice" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00"><span>XRP</span></div><button type="button" class="btn" id="jcsNftSalePreview">Review sell offer</button><div id="jcsNftSaleReview" hidden><dl class="jcs-readout" id="jcsNftSaleRows"></dl><button type="button" class="btn primary" id="jcsNftSaleSign">Review &amp; sign offer in Xaman</button></div><p id="jcsNftSaleStatus" role="status" aria-live="polite"></p><button type="button" class="btn" id="jcsNftSaleClose">Close offer review</button>`;
  gallery.before(sale);
  let saleNft = null, saleReview = null;
  const request = async (method, params = {}) => { const response = await api.request({ method, params: [params] }); const result = response?.result; if (!result || result.error) throw new Error(result?.error_message || 'The ledger did not return usable data.'); return result; };
  const verified = (result, index) => { if (result.validated !== true || !Number.isSafeInteger(Number(result.ledger_index)) || (index && Number(result.ledger_index) !== index)) throw new Error('The ledger could not verify this data. Refresh and try again.'); return result; };
  function status(text) { byId('jcsReceiptStatus').textContent = text; }
  function row(target, label, value) { const div = doc.createElement('div'), dt = doc.createElement('dt'), dd = doc.createElement('dd'); dt.textContent = label; dd.textContent = value; div.append(dt, dd); target.appendChild(div); }
  function assertAccount(account, token) { if (!account || api.getAccount() !== account || token !== version) throw new Error('Your wallet changed. Review this request again.'); }
  function readSaved(account, sourceHash) { try { return JSON.parse(root.localStorage.getItem('jcs.receiptNftMints.v1') || '{}')[account + ':' + sourceHash] || null; } catch { return null; } }
  function remember(account, sourceHash, value) { try { const values = JSON.parse(root.localStorage.getItem('jcs.receiptNftMints.v1') || '{}'); values[account + ':' + sourceHash] = value; const entries = Object.entries(values).slice(-50); root.localStorage.setItem('jcs.receiptNftMints.v1', JSON.stringify(Object.fromEntries(entries))); } catch {} }
  function download(metadata) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }));
    const a = doc.createElement('a'); a.href = url; a.download = 'jcs-receipt-' + metadata.source_transaction + '.json'; a.click(); root.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function verifySource(detail, account) {
    if (!HASH.test(detail.txid || '') || !KIND[detail.kind]) throw new Error('This is not a supported trade or liquidity receipt.');
    const result = verified(await request('tx', { transaction: detail.txid, binary: false }));
    const tx = result.tx_json || result;
    const hash = result.hash || tx.hash;
    if (!HASH.test(hash || '') || hash.toUpperCase() !== detail.txid.toUpperCase() || result.meta?.TransactionResult !== 'tesSUCCESS') throw new Error('The source transaction has not validated successfully.');
    if (tx.Account !== account || sourceKind(tx) !== KIND[detail.kind]) throw new Error('The source transaction does not match this wallet or action.');
    const isJcs = amount => amount && typeof amount === 'object' && amount.currency === currency && amount.issuer === ISSUER;
    const native = value => typeof value === 'string' && /^\d+$/.test(value);
    const pair = (a, b) => (isJcs(a) && native(b)) || (native(a) && isJcs(b));
    const validPair = tx.TransactionType === 'OfferCreate' ? pair(tx.TakerGets, tx.TakerPays) : tx.TransactionType === 'Payment' ? tx.Destination === account && pair(tx.Amount, tx.SendMax) :
      (isJcs(tx.Asset) && tx.Asset2?.currency === 'XRP' && Object.keys(tx.Asset2).length === 1) || (isJcs(tx.Asset2) && tx.Asset?.currency === 'XRP' && Object.keys(tx.Asset).length === 1);
    if (!validPair) throw new Error('The source transaction does not use the configured JCS/XRP pair.');
    const ledger = await request('ledger', { ledger_index: Number(result.ledger_index) }); verified(ledger, Number(result.ledger_index));
    const close = ledger.ledger?.close_time ?? result.date;
    if (!Number.isInteger(close) || close < 0) throw new Error('The ledger did not supply the confirmation time.');
    return { txid: hash.toUpperCase(), kind: detail.kind, transaction: tx, ledgerIndex: Number(result.ledger_index), validatedAt: new Date((close + 946684800) * 1000).toISOString() };
  }
  async function acceptReceipt(detail) {
    if (!HASH.test(detail?.txid || '') || !KIND[detail.kind] || signing) return;
    const token = version, sequence = ++receiptSequence, account = api.getAccount();
    if (!account) return;
    source = null; prepared = null; saved = null; receiptPanel.hidden = false; byId('jcsReceiptReview').hidden = true;
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptDownload').disabled = true; byId('jcsReceiptHash').textContent = detail.txid;
    byId('jcsReceiptHash').href = 'https://livenet.xrpl.org/transactions/' + detail.txid;
    byId('jcsReceiptNetwork').textContent = 'Checking ledger'; status('Checking the confirmed transaction before offering an NFT receipt…');
    try {
      const result = await verifySource(detail, account); assertAccount(account, token); if (sequence !== receiptSequence) return;
      source = result; saved = readSaved(account, source.txid);
      byId('jcsReceiptNetwork').textContent = NETWORK + ' · ledger #' + source.ledgerIndex;
      byId('jcsReceiptMeaning').textContent = source.kind === 'limit-order' ? 'This records the creation of a limit order. It does not prove that the order filled. Minting is a separate optional transaction.' : 'This records a confirmed trade or liquidity action. Minting is a separate optional transaction with its own network fee.';
      byId('jcsReceiptMint').textContent = saved ? 'Check receipt mint on ledger' : 'Mint receipt NFT';
      byId('jcsReceiptMint').disabled = false; byId('jcsReceiptDownload').disabled = false;
      status('Transaction confirmed. You can download its JSON record or choose to create a separate receipt NFT.');
    } catch (error) { if (token === version && sequence === receiptSequence) { byId('jcsReceiptNetwork').textContent = 'Verification unavailable'; status(error.message || String(error)); } }
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
    if (!source || signing) return;
    const account = api.getAccount(), token = version, selected = source, sequence = ++preparationSequence, privacy = byId('jcsReceiptPrivacy').value;
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptSign').disabled = true; prepared = null;
    try {
      if (saved) { await checkSavedMint(saved, selected, account, token); return; }
      status('Preparing your permanent receipt JSON and checking the current network fee…');
      const metadata = buildMetadata(selected, privacy);
      const limits = await preflight(account); assertAccount(account, token); if (source !== selected || sequence !== preparationSequence || privacy !== byId('jcsReceiptPrivacy').value) return;
      const transaction = buildMint(metadata, account, limits.fee, limits.lastLedger);
      // Create the complete JSON artifact before exposing the mint confirmation.
      const artifact = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
      prepared = { metadata, artifact, transaction, account, token, source: selected, ...limits };
      byId('jcsReceiptJson').textContent = JSON.stringify(metadata, null, 2); byId('jcsReceiptUri').textContent = unhex(transaction.URI);
      const readout = byId('jcsMintReadout'); readout.replaceChildren();
      row(readout, 'Network fee', Number(limits.fee) / 1000000 + ' XRP'); row(readout, 'Possible extra account reserve', limits.extraReserve + ' XRP (held in your wallet)'); row(readout, 'Available balance buffer', '1 XRP kept available'); row(readout, 'NFT issuer', account); row(readout, 'Taxon', String(TAXON));
      byId('jcsReceiptReview').hidden = false; byId('jcsReceiptSign').disabled = false;
      status('Your receipt is ready to review. Minting requires another signature in Xaman.');
    } catch (error) { if (token === version) status(error.message || String(error)); }
    finally { if (token === version && sequence === preparationSequence) byId('jcsReceiptMint').disabled = false; }
  }
  async function checkSavedMint(record, selected, account, token) {
    status('Checking the earlier mint request on the ledger…');
    if (!HASH.test(record.txid || '')) {
      const current = Number(verified(await request('ledger', { ledger_index: 'validated' })).ledger_index);
      const minimum = Number(record.firstLedger), maximum = Number(record.lastLedger);
      if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum) || minimum < 1 || maximum < minimum || current <= maximum) {
        await refresh();
        throw new Error('An earlier mint request may still be open in Xaman. Check it in the app. This page will check the ledger again after the request expires; no second request has been created.');
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
          saved = { ...record, txid: hash, status: 'unconfirmed' }; remember(account, selected.txid, saved);
          return checkSavedMint(saved, selected, account, token);
        }
        marker = history.marker; if (!marker) { complete = true; break; }
      }
      if (!complete) throw new Error('The complete request history could not be checked. Check Xaman before trying again.');
      saved = null; remember(account, selected.txid, null); byId('jcsReceiptMint').textContent = 'Mint receipt NFT';
      status('The earlier request expired, and its complete ledger window contains no matching mint. You can review a new receipt mint.'); return;
    }
    let result;
    try { result = await request('tx', { transaction: record.txid, binary: false }); }
    catch (error) { if (/txnNotFound|^Transaction not found\.?$/i.test(error.message || '') && Number.isSafeInteger(record.firstLedger) && Number.isSafeInteger(record.lastLedger)) return checkSavedMint({ ...record, txid: null }, selected, account, token); throw error; }
    assertAccount(account, token);
    if (result.validated !== true) throw new Error('That mint is still unconfirmed. Check Xaman and retry this status check; a second mint has not been created.');
    const tx = result.tx_json || result;
    const uri = safeUri(tx.URI);
    if ((result.hash || tx.hash)?.toUpperCase() !== record.txid.toUpperCase() || tx.TransactionType !== 'NFTokenMint' || tx.Account !== account || uri?.metadata?.source_transaction !== selected.txid) throw new Error('The earlier transaction does not match this receipt. Inspect its ledger record.');
    if (result.meta?.TransactionResult !== 'tesSUCCESS') { saved = null; remember(account, selected.txid, null); byId('jcsReceiptMint').textContent = 'Mint receipt NFT'; throw new Error('The earlier mint did not succeed. You can now review a new mint request.'); }
    if (!record.transaction) throw new Error('The original mint review is unavailable. Inspect this transaction in Xaman before taking another action.');
    confirmedResult({ txid: record.txid, validated: true, ledgerIndex: Number(result.ledger_index), transaction: { ...tx, hash: result.hash || tx.hash }, meta: result.meta }, record.transaction);
    byId('jcsReceiptMint').disabled = true; byId('jcsReceiptMint').textContent = 'Receipt mint confirmed';
    status('Receipt NFT mint confirmed at ledger #' + result.ledger_index + '. Open My NFTs to view your wallet.');
  }
  byId('jcsReceiptMint').addEventListener('click', prepareMint);
  byId('jcsReceiptPrivacy').addEventListener('change', () => { if (!signing) prepareMint(); });
  byId('jcsReceiptDownload').addEventListener('click', () => { if (source) { try { download(buildMetadata(source, byId('jcsReceiptPrivacy').value)); } catch (error) { status(error.message); } } });
  byId('jcsReceiptPreviewDownload').addEventListener('click', () => { if (prepared) download(prepared.metadata); });
  byId('jcsReceiptOpenNfts').addEventListener('click', () => doc.dispatchEvent(new root.CustomEvent('jcs:open-nfts')));
  byId('jcsReceiptCancel').addEventListener('click', () => { if (!signing) { preparationSequence++; prepared = null; byId('jcsReceiptReview').hidden = true; } });
  byId('jcsReceiptSign').addEventListener('click', async () => {
    if (!prepared || signing) return;
    const review = prepared; signing = true; byId('jcsReceiptSign').disabled = true; byId('jcsReceiptMint').disabled = true; byId('jcsReceiptPrivacy').disabled = true;
    try {
      assertAccount(review.account, review.token);
      if (Date.now() - review.createdAt > 60000) throw new Error('The fee review expired. Select Mint receipt NFT to review again.');
      status('Review this separate NFT mint in Xaman. Waiting for your signature and ledger confirmation…');
      const existing = readSaved(review.account, review.source.txid);
      if (existing) { saved = existing; throw new Error('Another mint request already exists for this receipt. Check its ledger status first.'); }
      saved = { status: 'awaiting-signature', firstLedger: review.index, lastLedger: review.transaction.LastLedgerSequence, transaction: review.transaction };
      remember(review.account, review.source.txid, saved);
      let result = await api.submitNft(review.transaction);
      try { result = confirmedResult(result, review.transaction); }
      catch (error) { error.txid = result?.txid; error.requiresReconciliation = true; throw error; }
      const confirmed = { ...saved, txid: result.txid, status: 'validated' }; remember(review.account, review.source.txid, confirmed);
      if (review.token !== version || api.getAccount() !== review.account) return;
      saved = confirmed; byId('jcsReceiptReview').hidden = true; byId('jcsReceiptMint').textContent = 'Check receipt mint on ledger';
      status('Receipt NFT mint confirmed at ledger #' + result.ledgerIndex + '. ' + (result.nftId ? 'NFT ID: ' + result.nftId + '.' : 'Open My NFTs to view the new record.'));
      prepared = null; await refresh();
    } catch (error) {
      if (HASH.test(error.txid || '') && (error.unconfirmed || error.requiresReconciliation)) {
        saved = { ...saved, txid: error.txid, status: 'unconfirmed' }; remember(review.account, review.source.txid, saved);
      } else if (error.definitelyNotSubmitted || error.finalLedgerResult) { saved = null; remember(review.account, review.source.txid, null); }
      else if (saved) { saved = { ...saved, status: 'unknown' }; remember(review.account, review.source.txid, saved); }
      if (review.token === version) { status((error.unconfirmed ? 'Mint submitted, but confirmation is not available. ' : '') + (error.message || String(error))); if (saved) byId('jcsReceiptMint').textContent = 'Check receipt mint on ledger'; }
    } finally { signing = false; if (review.token === version) { byId('jcsReceiptMint').disabled = false; byId('jcsReceiptPrivacy').disabled = false; byId('jcsReceiptSign').disabled = !!saved; } }
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
    if (uri?.metadata) { const note = doc.createElement('p'); note.className = 'jcs-tool-small'; note.textContent = 'JCS receipt identity. The full JSON is preserved in the original mint transaction memo.'; card.appendChild(note); }
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
      const result = confirmedResult(await api.submitNft(review.transaction), review.transaction);
      if (review.token !== version) return;
      saleReview = null; byId('jcsNftSaleReview').hidden = true;
      byId('jcsNftSaleStatus').textContent = 'Sell offer created at ledger #' + result.ledgerIndex + '. It has not sold yet. Transaction: ' + result.txid;
    } catch (error) { if (review.token === version) { byId('jcsNftSaleStatus').textContent = (error.unconfirmed ? 'Offer submitted; ledger confirmation is unavailable. Check this transaction before creating another offer: ' + error.txid + '. ' : '') + (error.message || String(error)); saleReview = null; byId('jcsNftSaleReview').hidden = true; } }
    finally { signing = false; byId('jcsNftSaleSign').disabled = false; byId('jcsNftSalePrice').disabled = false; }
  });
  doc.addEventListener('jcs:validated-transaction', event => acceptReceipt(event.detail));
  async function restoreReceipt() {
    let records; try { records = JSON.parse(root.localStorage.getItem('jcs.validatedReceipts.v1') || '[]'); } catch { return; }
    if (!Array.isArray(records)) return;
    const account = api.getAccount(); if (!account) return;
    const record = records.find(item => KIND[item.kind] && HASH.test(item.txid || '') && (!item.account || item.account === account));
    if (record) await acceptReceipt(record);
  }
  doc.addEventListener('jcs:wallet-changed', () => {
    version++; receiptSequence++; preparationSequence++; source = null; prepared = null; saved = null; receiptPanel.hidden = true; sale.hidden = true; saleReview = null; saleNft = null; collection.clear(); gallery.replaceChildren(); more.hidden = true; pageState = null;
    byId('jcsReceiptPrivacy').disabled = false; byId('jcsReceiptMint').textContent = 'Mint receipt NFT'; restoreReceipt();
  });
  root.JCSNft = Object.freeze({ refresh });
  restoreReceipt();
})(typeof window !== 'undefined' ? window : globalThis);
