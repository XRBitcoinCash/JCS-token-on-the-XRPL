/* Native JCS/XRP AMM tools. Transaction modes follow xrpl.org AMMDeposit / AMMWithdraw.
 * Amounts are calculated as exact BigInt fractions; floating point is display-only. */
(function (root) {
  'use strict';
  function decimal(value) {
    const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
    if (!match || String(value).length > 180) throw new Error('Enter a valid decimal amount.');
    const exponent = Number(match[4] || 0) - (match[3] || '').length;
    if (exponent < -110 || exponent > 80) throw new Error('Amount is outside the supported range.');
    let n = BigInt(match[2] + (match[3] || '')) * (match[1] ? -1n : 1n);
    return exponent >= 0 ? { n: n * 10n ** BigInt(exponent), d: 1n } : { n, d: 10n ** BigInt(-exponent) };
  }
  const mul = (a, b) => ({ n: a.n * b.n, d: a.d * b.d });
  const div = (a, b) => { if (b.n <= 0n) throw new Error('Pool amount is unavailable.'); return { n: a.n * b.d, d: a.d * b.n }; };
  const add = (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
  const cmp = (a, b) => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
  const positive = value => { const v = decimal(value); if (v.n <= 0n) throw new Error('Amount must be greater than zero.'); return v; };
  // Round down, never exceeding a reviewed maximum or a wallet balance.
  function tokenValue(fraction, digits = 15) {
    if (fraction.n <= 0n) throw new Error('Amount is too small.');
    let exponent = fraction.n.toString().length - fraction.d.toString().length;
    const power = x => x >= 0 ? { n: 10n ** BigInt(x), d: 1n } : { n: 1n, d: 10n ** BigInt(-x) };
    if (cmp(fraction, power(exponent)) < 0) exponent--;
    const shift = digits - 1 - exponent;
    const coefficient = shift >= 0 ? fraction.n * 10n ** BigInt(shift) / fraction.d : fraction.n / (fraction.d * 10n ** BigInt(-shift));
    if (coefficient <= 0n || exponent < -81 || exponent > 95) throw new Error('Amount is outside XRPL token precision.');
    const text = coefficient.toString();
    if (shift <= 0) return text + '0'.repeat(-shift);
    if (shift >= text.length) return ('0.' + '0'.repeat(shift - text.length) + text).replace(/0+$/, '');
    return (text.slice(0, -shift) + '.' + text.slice(-shift)).replace(/0+$/, '').replace(/\.$/, '');
  }
  function xrpDrops(value) {
    if (!/^\d+(?:\.\d{1,6})?$/.test(String(value))) throw new Error('Use up to six decimal places for XRP.');
    const v = positive(value);
    const drops = v.n * 1000000n / v.d;
    if (drops <= 0n || drops > 100000000000000000n) throw new Error('Enter an XRP amount between 0.000001 and 100 billion.');
    return drops.toString();
  }
  function buildDeposit(pool, inputXrp, asset, maximumJcs) {
    const drops = xrpDrops(inputXrp);
    const ratio = div(decimal(drops), positive(pool.xrpDrops));
    const jcs = maximumJcs == null ? tokenValue(mul(positive(pool.jcs), ratio)) : tokenValue(positive(maximumJcs));
    const tokenRatio = div(decimal(jcs), positive(pool.jcs));
    const actualRatio = cmp(ratio, tokenRatio) < 0 ? ratio : tokenRatio;
    return {
      transaction: { TransactionType: 'AMMDeposit', Asset: { currency: 'XRP' }, Asset2: { ...asset }, Flags: 1048576,
        Amount: drops, Amount2: { ...asset, value: jcs } },
      xrpDrops: drops, jcs, lp: tokenValue(mul(positive(pool.totalLP), actualRatio))
    };
  }
  function buildWithdrawal(pool, walletLP, inputPercent, asset) {
    const pct = positive(inputPercent);
    if (cmp(pct, decimal('100')) > 0) throw new Error('Choose between 0.01% and 100% of your pool share.');
    if (cmp(pct, decimal('0.01')) < 0) throw new Error('Choose at least 0.01% of your pool share.');
    const lp = tokenValue(mul(positive(walletLP), div(pct, decimal('100'))), 16);
    if (cmp(decimal(lp), decimal(walletLP)) > 0 || cmp(decimal(lp), decimal(pool.totalLP)) > 0) throw new Error('LP amount exceeds your available share.');
    const ratio = div(decimal(lp), positive(pool.totalLP));
    const xrp = mul(positive(pool.xrpDrops), ratio);
    const drops = (xrp.n / xrp.d).toString();
    if (BigInt(drops) <= 0n) throw new Error('Withdrawal is too small to return one drop of XRP.');
    return { transaction: { TransactionType: 'AMMWithdraw', Asset: { currency: 'XRP' }, Asset2: { ...asset }, Flags: 65536,
      LPTokenIn: { currency: pool.lpCurrency, issuer: pool.account, value: lp } },
      xrpDrops: drops, jcs: tokenValue(mul(positive(pool.jcs), ratio)), lp };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { decimal, cmp, tokenValue, xrpDrops, buildDeposit, buildWithdrawal };
    return;
  }
  const doc = root.document;
  const trade = doc.getElementById('trade');
  const api = root.JCSWallet;
  if (!trade || !api) return;
  let config;
  try { config = JSON.parse(doc.getElementById('app-config').textContent); } catch { return; }
  const asset = Object.freeze({ currency: String(config.asset?.currencyHex || '').toUpperCase(), issuer: String(config.asset?.issuer || '') });
  if (!asset.currency || !asset.issuer) return;
  const byId = id => doc.getElementById(id);
  const fmt = (value, digits = 7) => Number(value).toLocaleString('en-US', { maximumSignificantDigits: digits });
  const xrpText = drops => fmt(Number(drops) / 1000000);
  const exactXrp = drops => { const value = BigInt(drops); return (value / 1000000n).toString() + ((value % 1000000n) ? '.' + (value % 1000000n).toString().padStart(6, '0').replace(/0+$/, '') : ''); };
  const escapeText = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let snapshot = null, review = null, loading = false, signing = false, active = 'trade', generation = 0, reviewVersion = 0, manualJcs = false;

  const tradePanel = doc.createElement('div');
  tradePanel.id = 'jcsTradePanel';
  tradePanel.setAttribute('role', 'tabpanel');
  tradePanel.setAttribute('aria-labelledby', 'jcsTabTrade');
  while (trade.firstChild) tradePanel.appendChild(trade.firstChild);
  trade.appendChild(tradePanel);
  const tabs = doc.createElement('div');
  tabs.className = 'jcs-exchange-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'JCS exchange tools');
  tabs.innerHTML = '<button type="button" id="jcsTabTrade" role="tab" aria-selected="true" aria-controls="jcsTradePanel" data-panel="trade">Trade</button><button type="button" id="jcsTabLiquidity" role="tab" aria-selected="false" tabindex="-1" aria-controls="jcsLiquidityPanel" data-panel="liquidity">Liquidity</button><button type="button" id="jcsTabNfts" role="tab" aria-selected="false" tabindex="-1" aria-controls="jcsNftsPanel" data-panel="nfts">My NFTs</button>';
  trade.prepend(tabs);
  const liquidityPanel = doc.createElement('div');
  liquidityPanel.id = 'jcsLiquidityPanel';
  liquidityPanel.className = 'jcs-liquidity';
  liquidityPanel.hidden = true;
  liquidityPanel.setAttribute('role', 'tabpanel');
  liquidityPanel.setAttribute('aria-labelledby', 'jcsTabLiquidity');
  liquidityPanel.innerHTML = `
    <div class="jcs-tool-heading"><div><span class="jcs-tool-eyebrow">Native XRP Ledger pool</span><h2 class="jcs-pair-title"><span class="jcs-pair-logos" aria-hidden="true"><img class="jcs-token-logo" src="jcs-logo.png" alt="" aria-hidden="true" width="38" height="38"><img class="jcs-token-logo" src="assets/tokens/xrp.svg" alt="" aria-hidden="true" width="38" height="38"></span><span>JCS / XRP liquidity</span></h2></div><button class="btn" type="button" id="jcsPoolRefresh">Refresh pool</button></div>
    <p class="jcs-tool-copy">Add both assets to receive pool-share tokens, or redeem your existing share. Connect the same wallet you used elsewhere: your liquidity is already on the XRP Ledger.</p>
    <div class="jcs-liquidity-workspace">
      <div class="jcs-liquidity-overview">
        <section class="jcs-pool-card" aria-labelledby="jcsPoolTitle"><div class="jcs-card-heading"><h3 id="jcsPoolTitle">Pool overview</h3><span class="jcs-pool-badge">JCS / XRP</span></div>
          <div class="jcs-pool-stats"><div><span><img class="jcs-token-logo" src="assets/tokens/xrp.svg" alt="" aria-hidden="true" width="20" height="20">XRP in the pool</span><strong id="jcsPoolXrp">—</strong></div><div><span><img class="jcs-token-logo" src="jcs-logo.png" alt="" aria-hidden="true" width="20" height="20">JCS in the pool</span><strong id="jcsPoolJcs">—</strong></div></div>
          <dl class="jcs-readout"><div><dt>Pool rate</dt><dd id="jcsPoolRate">—</dd></div><div><dt>Pool trading fee</dt><dd id="jcsPoolFee">—</dd></div><div><dt>Total LP tokens</dt><dd id="jcsPoolTotalLP">—</dd></div></dl>
          <p class="jcs-tool-small" id="jcsPoolEvidence">Checking the current validated ledger…</p>
        </section>
        <section class="jcs-position-card" aria-labelledby="jcsPositionTitle"><div class="jcs-card-heading"><h3 id="jcsPositionTitle">Your position</h3><span class="jcs-pool-badge" id="jcsWalletState">Wallet not connected</span></div>
          <div class="jcs-position-share"><strong id="jcsPoolShare">—</strong><span>of this pool</span></div>
          <dl class="jcs-readout"><div><dt>Your LP tokens</dt><dd id="jcsWalletLP">—</dd></div><div><dt>Estimated XRP in your share</dt><dd id="jcsPositionXrp">—</dd></div><div><dt>Estimated JCS in your share</dt><dd id="jcsPositionJcs">—</dd></div></dl>
          <p class="jcs-tool-small">LP tokens are your claim on the pool. The amounts above change with trading activity.</p>
        </section>
        <details class="jcs-ledger-details"><summary>Wallet balances &amp; exact ledger details</summary><dl class="jcs-readout" id="jcsLiquidityDetails"><div><dt>Wallet</dt><dd>Connect Xaman to see your balances.</dd></div></dl></details>
      </div>
      <section class="jcs-liquidity-order" aria-labelledby="jcsOrderTitle"><span class="jcs-tool-eyebrow">Manage liquidity</span><h3 id="jcsOrderTitle">Your next move</h3>
        <div class="jcs-action-tabs" role="group" aria-label="Liquidity action"><button type="button" id="jcsActionDeposit" data-action="deposit" aria-pressed="true"><strong>Add liquidity</strong><span>Put both assets in</span></button><button type="button" id="jcsActionWithdraw" data-action="withdraw" aria-pressed="false"><strong>Withdraw liquidity</strong><span>Redeem your pool share</span></button></div>
        <select id="jcsLiquidityAction" hidden aria-label="Liquidity action"><option value="deposit">Add XRP and JCS</option><option value="withdraw">Withdraw my XRP and JCS</option></select>
        <div class="jcs-liquidity-form">
          <div id="jcsDepositInput"><p class="jcs-action-explanation">Set the maximum of each asset to deposit. The pool uses both in its current proportion and may use less of one.</p>
            <label for="jcsDepositXrp">Maximum XRP to deposit</label><div class="jcs-amount-field"><input id="jcsDepositXrp" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-describedby="jcsDepositXrpAvailable"><span><img class="jcs-token-logo" src="assets/tokens/xrp.svg" alt="" aria-hidden="true" width="20" height="20">XRP</span></div><p class="jcs-balance-hint" id="jcsDepositXrpAvailable">Connect your wallet to see available XRP.</p>
            <label for="jcsDepositJcs">Maximum JCS to deposit</label><div class="jcs-amount-field"><input id="jcsDepositJcs" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-describedby="jcsDepositJcsAvailable jcsDepositHelp"><span><img class="jcs-token-logo" src="jcs-logo.png" alt="" aria-hidden="true" width="20" height="20">JCS</span></div><p class="jcs-balance-hint" id="jcsDepositJcsAvailable">Connect your wallet to see available JCS.</p>
            <div class="jcs-percentage-options" role="group" aria-label="Use available balance"><button type="button" data-deposit-percent="25">25%</button><button type="button" data-deposit-percent="50">50%</button><button type="button" data-deposit-percent="75">75%</button><button type="button" data-deposit-percent="100">Max</button></div>
            <button class="btn jcs-match-amount" type="button" id="jcsMatchDeposit">Match JCS to XRP</button><p class="jcs-tool-small" id="jcsDepositHelp">JCS matches XRP automatically until you edit JCS. Balance shortcuts allow for wallet reserves, the network fee and an extra 1 XRP buffer.</p>
          </div>
          <div id="jcsWithdrawInput" hidden><p class="jcs-action-explanation">Choose how much of your position to redeem. XRP and JCS return to the same wallet.</p><label for="jcsWithdrawPercent">Percentage of your pool share</label><div class="jcs-amount-field"><input id="jcsWithdrawPercent" type="text" inputmode="decimal" value="25" autocomplete="off"><span>%</span></div><div class="jcs-percentage-options" role="group" aria-label="Share to withdraw"><button type="button" data-percent="25">25%</button><button type="button" data-percent="50">50%</button><button type="button" data-percent="75">75%</button><button type="button" data-percent="100">100%</button></div></div>
          <div class="jcs-amount-preview"><span class="jcs-tool-eyebrow">Estimated outcome</span><dl class="jcs-readout" id="jcsLiquidityEstimate"><div><dt>LP tokens received</dt><dd>Enter an amount</dd></div></dl><p class="jcs-tool-small" id="jcsEstimateNote">Review refreshes the ledger and checks your balances before signing.</p></div>
          <button class="btn primary" type="button" id="jcsLiquidityPreview">Preview deposit</button>
        </div>
        <div class="jcs-liquidity-review" id="jcsLiquidityReview" hidden><h3>Review your request</h3><dl id="jcsLiquidityReviewRows"></dl><p class="jcs-tool-small" id="jcsLiquidityReviewNote"></p><label class="jcs-review-accept"><input type="checkbox" id="jcsLiquidityAccept"><span>I have checked these amounts and understand that my pool share can change in value.</span></label><button class="btn primary" type="button" id="jcsLiquiditySign" disabled>Review &amp; sign in Xaman</button></div>
        <p role="status" aria-live="polite" id="jcsLiquidityStatus" class="jcs-tool-status">Connect Xaman above to add or withdraw liquidity.</p>
        <p class="jcs-tool-small jcs-signing-hint">Desktop: scan the signing QR with Xaman. Phone: open the request in the Xaman app. Nothing moves until you approve it.</p>
      </section>
    </div>
    <p class="jcs-tool-small jcs-liquidity-footnote">Pool-share values and asset proportions can change; returns are not guaranteed. Pool trading fees are paid by swaps, separately from the XRP network fee for your deposit or withdrawal.</p>`;
  trade.appendChild(liquidityPanel);
  const nftPanel = doc.createElement('div');
  nftPanel.id = 'jcsNftsPanel';
  nftPanel.className = 'jcs-nfts';
  nftPanel.hidden = true;
  nftPanel.setAttribute('role', 'tabpanel');
  nftPanel.setAttribute('aria-labelledby', 'jcsTabNfts');
  nftPanel.innerHTML = '<div class="jcs-tool-heading"><div><span class="jcs-tool-eyebrow">Held in your wallet</span><h2>My NFTs</h2></div><button class="btn" id="jcsNftRefresh" type="button">Refresh NFTs</button></div><p class="jcs-tool-copy">See NFT identifiers, issuers and published metadata for the NFTs your connected wallet holds on the validated XRP Ledger.</p><p class="jcs-tool-small">After a confirmed trade or liquidity action, you can choose to mint a separate personal receipt NFT.</p><p role="status" aria-live="polite" id="jcsNftStatus" class="jcs-tool-status">Connect Xaman to view your NFTs.</p><div class="jcs-nft-grid" id="jcsNftGrid"></div>';
  trade.appendChild(nftPanel);

  function status(message, error = false) {
    const el = byId('jcsLiquidityStatus'); el.textContent = message; el.classList.toggle('err', error);
  }
  function invalidateReview() {
    reviewVersion++;
    review = null; byId('jcsLiquidityReview').hidden = true;
    byId('jcsLiquidityAccept').checked = false; byId('jcsLiquiditySign').disabled = true;
  }
  function setBusy(value) {
    loading = value;
    byId('jcsLiquidityPreview').disabled = value || signing;
    byId('jcsPoolRefresh').disabled = value || signing;
    liquidityPanel.querySelectorAll('[data-action], [data-percent], [data-deposit-percent], #jcsDepositXrp, #jcsDepositJcs, #jcsWithdrawPercent, #jcsMatchDeposit').forEach(control => { control.disabled = signing; });
  }

  document.addEventListener('jcs:signing-reset', event => {
    if (!signing && !loading) return;
    signing = false;
    invalidateReview();
    setBusy(false);
    status((event.detail?.reason || 'Xaman request canceled.') + ' Liquidity controls reset. Review the amounts again when ready.', true);
  });
  async function request(method, params = {}) {
    const response = await api.request({ method, params: [params] });
    return response?.result || {};
  }
  function verified(result, ledgerIndex) {
    if (result.validated !== true || !Number.isInteger(Number(result.ledger_index)) ||
        (ledgerIndex && Number(result.ledger_index) !== ledgerIndex)) throw new Error('The ledger could not verify the latest data. Try refreshing.');
    return result;
  }
  async function peerLines(account, peer, ledgerIndex) {
    let marker, output = [];
    for (let page = 0; page < 10; page++) {
      const result = verified(await request('account_lines', { account, peer, ledger_index: ledgerIndex, limit: 400, ...(marker ? { marker } : {}) }), ledgerIndex);
      if (!Array.isArray(result.lines)) throw new Error('Wallet trustline data is missing.');
      output.push(...result.lines);
      marker = result.marker;
      if (!marker) return output;
    }
    throw new Error('This wallet has too many matching trustlines to verify in one review.');
  }
  async function loadSnapshot(requireWallet = false) {
    const account = api.getAccount();
    if (requireWallet && !account) throw new Error('Connect Xaman above, then review again.');
    const ledger = verified(await request('ledger', { ledger_index: 'validated' }));
    const ledgerIndex = Number(ledger.ledger_index);
    const result = verified(await request('amm_info', { asset: { currency: 'XRP' }, asset2: asset, ledger_index: ledgerIndex }), ledgerIndex);
    const amm = result.amm;
    if (!amm || !amm.account || !amm.lp_token || amm.lp_token.issuer !== amm.account || !/^03[0-9A-F]{38}$/.test(amm.lp_token.currency || '')) throw new Error('No verified JCS/XRP pool was found.');
    let xrp, jcs;
    for (const amount of [amm.amount, amm.amount2]) {
      if (typeof amount === 'string' && /^\d+$/.test(amount)) xrp = amount;
      else if (amount?.currency === asset.currency && amount.issuer === asset.issuer) jcs = amount.value;
    }
    positive(xrp); positive(jcs); positive(amm.lp_token.value);
    if (amm.asset_frozen || amm.asset2_frozen) throw new Error('The pool has a frozen asset; this interface cannot prepare a deposit or withdrawal.');
    const pool = { account: amm.account, xrpDrops: xrp, jcs, totalLP: amm.lp_token.value, lpCurrency: amm.lp_token.currency, tradingFee: amm.trading_fee };
    const data = { ledgerIndex, pool, account, fetchedAt: Date.now(), wallet: null };
    if (account) {
      const values = await Promise.all([
        request('account_info', { account, ledger_index: ledgerIndex }),
        request('account_info', { account: asset.issuer, ledger_index: ledgerIndex }),
        peerLines(account, asset.issuer, ledgerIndex), peerLines(account, pool.account, ledgerIndex),
        request('server_state', { ledger_index: 'current' }), request('fee', { ledger_index: 'current' })
      ]);
      const walletInfo = verified(values[0], ledgerIndex).account_data;
      const issuerInfo = verified(values[1], ledgerIndex).account_data;
      const jcsLine = values[2].find(line => line.account === asset.issuer && line.currency === asset.currency);
      const lpLine = values[3].find(line => line.account === pool.account && line.currency === pool.lpCurrency);
      const validated = values[4].state?.validated_ledger;
      const base = validated?.reserve_base, increment = validated?.reserve_inc;
      const fee = values[5].drops?.open_ledger_fee;
      if (walletInfo?.Account !== account || !/^\d+$/.test(walletInfo.Balance || '') || !Number.isInteger(walletInfo.OwnerCount)) throw new Error('The wallet balance could not be verified.');
      if (!Number.isFinite(Number(base)) || Number(base) <= 0 || !Number.isFinite(Number(increment)) || Number(increment) <= 0 || !Number.isInteger(Number(validated?.seq)) || Math.abs(Number(validated.seq) - ledgerIndex) > 25) throw new Error('Current XRP reserve requirements are unavailable.');
      if (!/^\d+$/.test(String(fee || '')) || Number(fee) < 1 || Number(fee) > 10000) throw new Error('The network fee is unavailable or exceeds this tool’s 0.01 XRP fee cap.');
      if (!issuerInfo || !Number.isInteger(issuerInfo.Flags)) throw new Error('JCS issuer settings are unavailable.');
      if ((issuerInfo.Flags & 0x00400000) !== 0) throw new Error('The JCS issuer has globally frozen this asset.');
      if (!jcsLine) throw new Error('Add the exact JCS trustline using the wallet setup above, then review again.');
      if (jcsLine.freeze || jcsLine.freeze_peer || jcsLine.deep_freeze || jcsLine.deep_freeze_peer || lpLine?.freeze_peer || lpLine?.deep_freeze_peer) throw new Error('A wallet trustline is frozen; a liquidity request cannot be prepared.');
      if ((issuerInfo.Flags & 0x00040000) !== 0 && jcsLine.peer_authorized !== true) throw new Error('The issuer has not authorized this wallet to hold JCS.');
      data.wallet = { xrpDrops: walletInfo.Balance, jcs: jcsLine.balance, jcsLimit: jcsLine.limit, lp: lpLine?.balance || '0',
        reserveDrops: BigInt(base) + BigInt(increment) * BigInt(walletInfo.OwnerCount),
        newLineReserve: lpLine && cmp(decimal(lpLine.balance), decimal('0')) > 0 ? 0n : BigInt(increment), fee: String(fee) };
    }
    if (account !== api.getAccount()) throw new Error('Your wallet changed. Refresh and review again.');
    return data;
  }
  function readout(rows) {
    return rows.map(([label, value]) => '<div><dt>' + escapeText(label) + '</dt><dd>' + escapeText(value) + '</dd></div>').join('');
  }
  function depositAvailable(data, buffer = 0n) {
    if (!data?.wallet) return 0n;
    const amount = BigInt(data.wallet.xrpDrops) - data.wallet.reserveDrops - data.wallet.newLineReserve - BigInt(data.wallet.fee) - buffer;
    return amount > 0n ? amount : 0n;
  }
  function depositInput() {
    return { xrp: byId('jcsDepositXrp').value.trim(), jcs: manualJcs ? byId('jcsDepositJcs').value.trim() : null };
  }
  function matchDeposit() {
    if (manualJcs) return;
    try { byId('jcsDepositJcs').value = buildDeposit(snapshot.pool, byId('jcsDepositXrp').value.trim(), asset).jcs; }
    catch { byId('jcsDepositJcs').value = ''; }
  }
  function renderEstimate() {
    const mode = byId('jcsLiquidityAction').value;
    const label = mode === 'deposit' ? 'LP tokens received' : 'LP tokens redeemed';
    let rows = [[label, 'Enter an amount']];
    try {
      if (!snapshot) throw new Error('Pool unavailable');
      const input = depositInput();
      const built = mode === 'deposit' ? buildDeposit(snapshot.pool, input.xrp, asset, input.jcs) : buildWithdrawal(snapshot.pool, snapshot.wallet?.lp || '0', byId('jcsWithdrawPercent').value.trim(), asset);
      rows = [[label, fmt(built.lp, 10)]];
      if (mode === 'deposit') {
        const ratio = div(decimal(built.lp), positive(snapshot.pool.totalLP));
        const consumedXrp = mul(positive(snapshot.pool.xrpDrops), ratio);
        rows.unshift(['Estimated XRP used', xrpText((consumedXrp.n / consumedXrp.d).toString()) + ' XRP'], ['Estimated JCS used', fmt(tokenValue(mul(positive(snapshot.pool.jcs), ratio)), 10) + ' JCS']);
        if (snapshot.wallet) rows.push(['Your share after deposit', fmt((Number(snapshot.wallet.lp) + Number(built.lp)) / (Number(snapshot.pool.totalLP) + Number(built.lp)) * 100, 6) + '%']);
      } else {
        rows.unshift(['Estimated XRP returned', xrpText(built.xrpDrops) + ' XRP'], ['Estimated JCS returned', fmt(built.jcs, 10) + ' JCS']);
      }
      rows.push(['Network fee', snapshot.wallet ? exactXrp(snapshot.wallet.fee) + ' XRP' : 'Connect wallet']);
    } catch { if (mode === 'withdraw' && snapshot?.wallet && cmp(decimal(snapshot.wallet.lp), decimal('0')) <= 0) rows = [[label, 'No LP tokens in this wallet']]; }
    byId('jcsLiquidityEstimate').innerHTML = readout(rows);
  }
  function clearWalletReadout() {
    byId('jcsWalletState').textContent = 'Wallet not connected';
    for (const id of ['jcsPoolShare', 'jcsWalletLP', 'jcsPositionXrp', 'jcsPositionJcs']) byId(id).textContent = '—';
    byId('jcsDepositXrpAvailable').textContent = 'Connect your wallet to see available XRP.';
    byId('jcsDepositJcsAvailable').textContent = 'Connect your wallet to see available JCS.';
    byId('jcsLiquidityDetails').innerHTML = readout([['Wallet', 'Connect Xaman to see your balances.']]);
    renderEstimate();
  }
  function renderSnapshot(data) {
    snapshot = data;
    byId('jcsPoolXrp').textContent = xrpText(data.pool.xrpDrops) + ' XRP';
    byId('jcsPoolJcs').textContent = fmt(data.pool.jcs, 9) + ' JCS';
    byId('jcsPoolRate').textContent = '1 XRP ≈ ' + fmt(Number(data.pool.jcs) * 1000000 / Number(data.pool.xrpDrops), 8) + ' JCS';
    byId('jcsPoolFee').textContent = Number.isInteger(data.pool.tradingFee) ? fmt(data.pool.tradingFee / 1000, 5) + '%' : 'Unavailable';
    byId('jcsPoolTotalLP').textContent = fmt(data.pool.totalLP, 10);
    byId('jcsPoolEvidence').textContent = 'Verified ledger #' + data.ledgerIndex + ' · ' + new Date(data.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · Refreshes every 60 seconds';
    const details = [['Pool XRP balance', exactXrp(data.pool.xrpDrops) + ' XRP'], ['Pool JCS balance', data.pool.jcs + ' JCS'], ['Total LP tokens', data.pool.totalLP], ['JCS issuer', asset.issuer], ['Pool account', data.pool.account], ['Validated ledger', '#' + data.ledgerIndex]];
    if (data.wallet) {
      const share = Number(data.wallet.lp) / Number(data.pool.totalLP);
      byId('jcsPoolShare').textContent = fmt(share * 100, 6) + '%';
      byId('jcsWalletState').textContent = 'Wallet connected';
      byId('jcsWalletLP').textContent = fmt(data.wallet.lp, 10);
      byId('jcsPositionXrp').textContent = fmt(Number(data.pool.xrpDrops) / 1000000 * share, 9) + ' XRP';
      byId('jcsPositionJcs').textContent = fmt(Number(data.pool.jcs) * share, 9) + ' JCS';
      byId('jcsDepositXrpAvailable').textContent = 'Available after reserve & fee: ' + exactXrp(depositAvailable(data)) + ' XRP';
      byId('jcsDepositJcsAvailable').textContent = 'Available: ' + fmt(data.wallet.jcs, 10) + ' JCS';
      details.unshift(['Connected wallet', data.account], ['Wallet XRP balance', exactXrp(data.wallet.xrpDrops) + ' XRP'], ['Wallet JCS balance', data.wallet.jcs + ' JCS'], ['Wallet LP tokens', data.wallet.lp], ['Required wallet reserve', exactXrp(data.wallet.reserveDrops) + ' XRP'], ['Possible new LP-line reserve', exactXrp(data.wallet.newLineReserve) + ' XRP'], ['Network fee', exactXrp(data.wallet.fee) + ' XRP']);
    } else clearWalletReadout();
    byId('jcsLiquidityDetails').innerHTML = readout(details);
    matchDeposit(); renderEstimate();
  }
  async function refreshPool() {
    if (loading || signing) return;
    setBusy(true);
    const token = generation;
    try { const next = await loadSnapshot(); if (token !== generation) return; renderSnapshot(next); status(next.account ? 'Pool and wallet balances are ready. Choose an amount to review.' : 'Connect Xaman above to manage an existing pool share.'); }
    catch (error) { if (token === generation) { snapshot = null; clearWalletReadout(); byId('jcsWalletState').textContent = api.getAccount() ? 'Wallet check unavailable' : 'Wallet not connected'; status(error.message || String(error), true); byId('jcsPoolEvidence').textContent = 'Live pool check unavailable. Any pool figures above are from the previous check. Refresh to retry.'; } }
    finally { setBusy(false); if (token !== generation && active === 'liquidity') refreshPool(); }
  }
  function operation(data, mode, input) {
    if (!data.wallet || !data.account) throw new Error('Connect Xaman first.');
    const built = mode === 'deposit' ? buildDeposit(data.pool, input.xrp, asset, input.jcs) : buildWithdrawal(data.pool, data.wallet.lp, input, asset);
    const fee = BigInt(data.wallet.fee);
    if (mode === 'deposit') {
      const needed = BigInt(built.xrpDrops) + data.wallet.reserveDrops + data.wallet.newLineReserve + fee;
      if (needed > BigInt(data.wallet.xrpDrops)) throw new Error('Not enough spendable XRP after the network fee and wallet reserve. Lower the XRP amount.');
      if (cmp(decimal(built.jcs), decimal(data.wallet.jcs)) > 0) throw new Error('This needs ' + fmt(built.jcs) + ' JCS; your wallet has ' + fmt(data.wallet.jcs) + '. Lower the XRP amount.');
    } else {
      if (BigInt(data.wallet.xrpDrops) < data.wallet.reserveDrops + fee) throw new Error('Keep enough XRP outside the pool for your wallet reserve and transaction fee.');
      if (cmp(add(decimal(data.wallet.jcs), decimal(built.jcs)), decimal(data.wallet.jcsLimit)) > 0) throw new Error('Your JCS trustline limit is too small to receive this withdrawal. Increase it in Xaman first.');
    }
    built.transaction.Account = data.account;
    built.transaction.Fee = data.wallet.fee;
    built.transaction.LastLedgerSequence = data.ledgerIndex + 20;
    return built;
  }
  function showReview(data, built, mode, input) {
    review = { data, built, mode, input, createdAt: Date.now() };
    const rows = [[mode === 'deposit' ? 'Maximum XRP added' : 'Estimated XRP returned', exactXrp(built.xrpDrops) + ' XRP'],
      [mode === 'deposit' ? 'Maximum JCS added' : 'Estimated JCS returned', built.jcs + ' JCS'],
      [mode === 'deposit' ? 'Estimated LP tokens received' : 'LP tokens redeemed', built.lp], ['Network fee', exactXrp(data.wallet.fee) + ' XRP'], ['Wallet', data.account]];
    rows.splice(rows.length - 1, 0, ['Verified ledger', '#' + data.ledgerIndex]);
    byId('jcsLiquidityReviewRows').innerHTML = readout(rows);
    byId('jcsLiquidityReviewNote').textContent = mode === 'deposit'
      ? 'These are hard maximum inputs. XRPL adds both assets in the current pool proportion and may use less of one. LP tokens are estimated; this deposit mode cannot enforce a minimum LP output. The review expires after 60 seconds.'
      : 'Both assets return to this wallet in the pool’s proportion at execution. These are estimates: proportional redemption cannot enforce minimum XRP/JCS outputs. We recheck the pool before Xaman and use a short transaction expiry.';
    byId('jcsLiquidityAccept').checked = false;
    byId('jcsLiquiditySign').disabled = true;
    byId('jcsLiquidityReview').hidden = false;
    status('Check the amounts, then open the request in Xaman. Nothing moves until you sign.');
  }
  byId('jcsLiquidityPreview').addEventListener('click', async () => {
    if (loading || signing) return;
    invalidateReview(); setBusy(true);
    const mode = byId('jcsLiquidityAction').value;
    const input = mode === 'deposit' ? depositInput() : byId('jcsWithdrawPercent').value.trim();
    const token = generation, version = reviewVersion;
    try { const data = await loadSnapshot(true); if (token !== generation || version !== reviewVersion) { status('The wallet or amount changed. Review the current amount again.'); return; } renderSnapshot(data); showReview(data, operation(data, mode, input), mode, input); }
    catch (error) { status(error.message || String(error), true); }
    finally { setBusy(false); }
  });
  byId('jcsLiquidityAccept').addEventListener('change', event => { byId('jcsLiquiditySign').disabled = !event.target.checked || !review || signing; });
  byId('jcsLiquiditySign').addEventListener('click', async () => {
    if (!review || signing || !byId('jcsLiquidityAccept').checked) return;
    const accepted = review;
    signing = true; setBusy(true); byId('jcsLiquiditySign').disabled = true;
    try {
      if (Date.now() - accepted.createdAt > 60000) throw new Error('This review expired. Review the amounts again.');
      status('Rechecking the wallet, pool, reserve and fee before Xaman…');
      const fresh = await loadSnapshot(true);
      if (fresh.account !== accepted.data.account || fresh.pool.account !== accepted.data.pool.account || review !== accepted) throw new Error('The wallet or review changed. Review again.');
      const next = operation(fresh, accepted.mode, accepted.input);
      if (fresh.wallet.fee !== accepted.data.wallet.fee) throw new Error('The network fee changed. Review the new fee before signing.');
      const drift = (a, b) => { const ratio = div(positive(a), positive(b)); return cmp(ratio, decimal('0.99')) < 0 || cmp(ratio, decimal('1.01')) > 0; };
      if (drift(next.jcs, accepted.built.jcs) || drift(next.lp, accepted.built.lp) || drift(next.xrpDrops, accepted.built.xrpDrops)) throw new Error('The pool changed by more than 1%. Review the current amounts again.');
      // Preserve the exact inputs the visitor accepted; only expiry advances with the fresh ledger.
      const tx = { ...accepted.built.transaction, LastLedgerSequence: fresh.ledgerIndex + 20 };
      // Reprice the exact accepted amounts, rather than a fresh percentage of a changed wallet balance.
      if (accepted.mode === 'deposit') {
        const rx = div(decimal(tx.Amount), positive(fresh.pool.xrpDrops));
        const rt = div(decimal(tx.Amount2.value), positive(fresh.pool.jcs));
        const lpNow = tokenValue(mul(positive(fresh.pool.totalLP), cmp(rx, rt) < 0 ? rx : rt));
        if (drift(lpNow, accepted.built.lp)) throw new Error('The expected pool share changed by more than 1%. Review again.');
      } else {
        const ratio = div(positive(tx.LPTokenIn.value), positive(fresh.pool.totalLP));
        const xr = mul(positive(fresh.pool.xrpDrops), ratio);
        const expectedXrp = (xr.n / xr.d).toString();
        const expectedJcs = tokenValue(mul(positive(fresh.pool.jcs), ratio));
        if (drift(expectedXrp, accepted.built.xrpDrops) || drift(expectedJcs, accepted.built.jcs)) throw new Error('The expected withdrawal changed by more than 1%. Review again.');
        if (cmp(add(decimal(fresh.wallet.jcs), decimal(expectedJcs)), decimal(fresh.wallet.jcsLimit)) > 0) throw new Error('Your JCS trustline limit is too small for the updated withdrawal.');
      }
      if (accepted.mode === 'deposit' && cmp(decimal(tx.Amount2.value), decimal(fresh.wallet.jcs)) > 0) throw new Error('Your JCS balance changed. Review again.');
      if (accepted.mode === 'withdraw' && cmp(decimal(tx.LPTokenIn.value), decimal(fresh.wallet.lp)) > 0) throw new Error('Your available LP tokens changed. Review again.');
      status('Open Xaman and check the exact amounts. Waiting for your signature and ledger confirmation…');
      const result = await api.submitLiquidity(tx);
      invalidateReview();
      status('Confirmed on the XRP Ledger. ' + (accepted.mode === 'deposit' ? 'Your pool share has been updated.' : 'Your redeemed XRP and JCS have returned to your wallet.'));
      const link = doc.createElement('a'); link.href = 'https://livenet.xrpl.org/transactions/' + result.txid; link.textContent = ' View transaction ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer'; byId('jcsLiquidityStatus').appendChild(link);
      try { renderSnapshot(await loadSnapshot(true)); }
      catch {
        snapshot = null;
        byId('jcsPoolEvidence').textContent = 'Your transaction is confirmed. Refresh the pool to check its new state; a final withdrawal may close an empty pool.';
      }
    } catch (error) {
      invalidateReview();
      status(error.unconfirmed
        ? 'Submitted to XRPL; confirmation is not available yet. Check this transaction before trying again.'
        : error.message || String(error), true);
      if (/^[A-F0-9]{64}$/i.test(error.txid || '')) {
        const link = doc.createElement('a'); link.href = 'https://livenet.xrpl.org/transactions/' + error.txid;
        link.textContent = ' Check transaction ' + error.txid + ' ↗'; link.target = '_blank'; link.rel = 'noopener noreferrer';
        byId('jcsLiquidityStatus').appendChild(link);
      }
    }
    finally { signing = false; setBusy(false); }
  });
  byId('jcsDepositXrp').addEventListener('input', () => { invalidateReview(); matchDeposit(); renderEstimate(); });
  byId('jcsDepositJcs').addEventListener('input', () => { manualJcs = true; invalidateReview(); renderEstimate(); });
  byId('jcsWithdrawPercent').addEventListener('input', () => { invalidateReview(); renderEstimate(); });
  function selectAction(mode) {
    if (signing) return;
    invalidateReview(); const deposit = mode === 'deposit';
    byId('jcsLiquidityAction').value = mode;
    byId('jcsDepositInput').hidden = !deposit; byId('jcsWithdrawInput').hidden = deposit;
    liquidityPanel.querySelectorAll('[data-action]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.action === mode)));
    byId('jcsLiquidityPreview').textContent = deposit ? 'Preview deposit' : 'Preview withdrawal';
    renderEstimate();
  }
  byId('jcsLiquidityAction').addEventListener('change', () => selectAction(byId('jcsLiquidityAction').value));
  liquidityPanel.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => selectAction(button.dataset.action)));
  byId('jcsMatchDeposit').addEventListener('click', () => { manualJcs = false; invalidateReview(); matchDeposit(); renderEstimate(); if (!snapshot) status('Refresh the pool before matching the amounts.'); });
  liquidityPanel.querySelectorAll('[data-percent]').forEach(button => button.addEventListener('click', () => { byId('jcsWithdrawPercent').value = button.dataset.percent; invalidateReview(); renderEstimate(); }));
  liquidityPanel.querySelectorAll('[data-deposit-percent]').forEach(button => button.addEventListener('click', () => {
    invalidateReview();
    try {
      if (!snapshot?.wallet || snapshot.account !== api.getAccount()) throw new Error('Connect your wallet and refresh the pool before using balance shortcuts.');
      const available = depositAvailable(snapshot, 1000000n);
      const tokenLimited = mul(div(positive(snapshot.wallet.jcs), positive(snapshot.pool.jcs)), positive(snapshot.pool.xrpDrops));
      const limitedDrops = tokenLimited.n / tokenLimited.d;
      const maxDrops = available < limitedDrops ? available : limitedDrops;
      const chosen = maxDrops * BigInt(button.dataset.depositPercent) / 100n;
      if (chosen <= 0n) throw new Error('There is not enough available XRP and JCS after reserves and the 1 XRP buffer.');
      byId('jcsDepositXrp').value = exactXrp(chosen); manualJcs = false; matchDeposit(); renderEstimate();
      status('Amounts matched to your available XRP and JCS. Preview to refresh and check them.');
    } catch (error) { status(error.message || String(error), true); }
  }));
  byId('jcsPoolRefresh').addEventListener('click', () => { invalidateReview(); refreshPool(); });

  function refreshNfts() {
    if (root.JCSNft) return root.JCSNft.refresh();
    byId('jcsNftStatus').textContent = 'NFT tools are loading. Try Refresh NFTs in a moment.';
  }
  byId('jcsNftRefresh').addEventListener('click', refreshNfts);
  doc.addEventListener('jcs:open-nfts', () => { activate('nfts'); byId('jcsTabNfts').focus(); });
  function activate(name) {
    active = name;
    const panels = { trade: tradePanel, liquidity: liquidityPanel, nfts: nftPanel };
    Object.entries(panels).forEach(([key, panel]) => { panel.hidden = name !== key; });
    tabs.querySelectorAll('[role="tab"]').forEach(button => { const selected = button.dataset.panel === name; button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; });
    if (name === 'liquidity' && (!snapshot || Date.now() - snapshot.fetchedAt >= 60000)) refreshPool();
    if (name === 'nfts') refreshNfts();
  }
  tabs.querySelectorAll('[role="tab"]').forEach((button, index, buttons) => {
    button.addEventListener('click', () => activate(button.dataset.panel));
    button.addEventListener('keydown', event => { let target;
      if (event.key === 'ArrowRight') target = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') target = (index + buttons.length - 1) % buttons.length;
      if (event.key === 'Home') target = 0; if (event.key === 'End') target = buttons.length - 1;
      if (target !== undefined) { event.preventDefault(); buttons[target].focus(); activate(buttons[target].dataset.panel); }
    });
  });
  doc.addEventListener('jcs:wallet-changed', () => { generation++; snapshot = null; invalidateReview(); byId('jcsNftGrid').replaceChildren(); clearWalletReadout(); if (active === 'liquidity') refreshPool(); if (active === 'nfts') refreshNfts(); });
  root.setInterval(() => { if (doc.visibilityState === 'visible' && active === 'liquidity' && !review && !signing) refreshPool(); }, 60000);
  // Pool data loads when its tab is first opened; the main market has its own immediate refresh.
})(typeof window !== 'undefined' ? window : globalThis);
