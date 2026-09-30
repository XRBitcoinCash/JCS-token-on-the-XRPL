/**
 * Pure, read-only JCS registry metrics. No network calls, DOM, storage or signing.
 * Protocol authority: deployed verify.html and prayer.map.html, 2026-09-30.
 * Registry publication is not proof that an NFT minted or that a prayer was answered.
 */
export const JCS_COLLECTOR = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd';
export const PRAYER_TAXON = 1246974803;
export const CAPSULE_TAXON = 1245926211;
export const RECEIPT_TAXON = 20260913;
const CURRENT_TAG = 'JCS_SOCIAL_V6';
const LEGACY_TAG = 'JCS_VERIFY_V1';
const TAGS = new Set([CURRENT_TAG, 'JCS_SOCIAL_V5', 'JCS_SOCIAL_V4', 'JCS_SOCIAL_V3', 'JCS_SOCIAL_V2', LEGACY_TAG]);
const HASH = /^[A-F0-9]{64}$/;
const DAY = 86400000;
const MAX_ENTRIES = 10000;
const REGIONS = new Set(['worldwide','north-america','latin-america-caribbean','europe','africa','middle-east-north-africa','south-asia','east-southeast-asia','oceania']);
const FORBIDDEN_LOCATION = new Set(['lat','lng','latitude','longitude','gps','coords','coordinate','city','postal','postcode','ip','node','relay']);
const EXTREME_COUNTRIES = new Set(['PRK','SOM','YEM','SDN','ERI','SYR','NGA','PAK','LBY','IRN','AFG','IND','SAU','MMR','MLI']);
const PRAYER_URI = 'https://jesuschristsavestoken.com/jcs-prayer-nft-v1.json#jcs-prayer-';
const RECEIPT_URI = 'https://jesuschristsavestoken.com/jcs-receipt-nft-v1.json#tx=';
const RECEIPT_BACKEND = 'https://xrbitcoincash-github-io.onrender.com';
const upperHash = value => typeof value === 'string' && HASH.test(value.toUpperCase()) ? value.toUpperCase() : '';
const boundedInt = value => value !== null && value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const roundPublic = value => Math.floor(value / 5) * 5;

function decodeHex(value, maxBytes = 4096) {
  if (typeof value !== 'string' || value.length > maxBytes * 2 || !/^(?:[A-Fa-f0-9]{2})*$/.test(value)) return null;
  try { return new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(value.match(/../g) || [], byte => parseInt(byte,16))); }
  catch { return null; }
}
function parseMemos(items) {
  if (!Array.isArray(items) || items.length > 64) return null;
  const result = Object.create(null);
  for (const item of items) {
    const memo = item?.Memo;
    if (!memo || typeof memo !== 'object') return null;
    if (memo.MemoFormat !== undefined && decodeHex(memo.MemoFormat) === null) return null;
    const rawType = decodeHex(memo.MemoType || ''), rawData = decodeHex(memo.MemoData || '');
    if (rawType === null || rawData === null) return null;
    const type = rawType.trim().toLowerCase(), data = rawData.trim();
    if (!type || type.length > 64 || Object.hasOwn(result,type)) return null;
    result[type] = data;
  }
  return result;
}
function normalize(entry) {
  const tx = entry?.tx_json || entry?.tx || entry?.transaction || entry || {};
  const meta = entry?.meta || entry?.metaData || {};
  return {tx, meta, validated:entry?.validated === true,
    hash:upperHash(tx.hash || tx.Hash || entry?.hash),
    ledgerIndex:boundedInt(tx.ledger_index ?? entry?.ledger_index),
    txIndex:boundedInt(meta.TransactionIndex ?? meta.transaction_index),
    closeTime:entry?.close_time_iso || tx.close_time_iso,
    rippleTime:tx.date ?? entry?.date};
}
function ledgerIso(record) {
  if (typeof record.closeTime === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(record.closeTime)) {
    const time = Date.parse(record.closeTime);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  const seconds = record.rippleTime;
  if (seconds === null || seconds === undefined || seconds === '' || !Number.isFinite(Number(seconds)) || Number(seconds) < 0) return null;
  const time = (Number(seconds) + 946684800) * 1000;
  return Number.isFinite(time) && Math.abs(time) <= 8640000000000000 ? new Date(time).toISOString() : null;
}
function isOneDrop(tx, meta) {
  if ((tx.DeliverMax ?? tx.Amount) !== '1') return false;
  if (tx.DeliverMax !== undefined && tx.Amount !== undefined && tx.DeliverMax !== tx.Amount) return false;
  if ((Number(tx.Flags || 0) & 0x00020000) !== 0) return false;
  const delivered = meta.delivered_amount ?? meta.DeliveredAmount;
  return delivered === undefined || delivered === '1';
}
function focusFromMemos(memos, app, role) {
  if ([...FORBIDDEN_LOCATION].some(key => Object.hasOwn(memos,key))) return null;
  if (app === CURRENT_TAG) {
    if (memos.map !== '1' || memos.role !== role || memos.policy !== 'JCS_MAP_1') return null;
    if (memos.scope === 'region' && REGIONS.has(memos.region) && !Object.hasOwn(memos,'country')) return {scope:'region',code:memos.region};
    if (memos.scope === 'country' && !Object.hasOwn(memos,'region')) {
      const input = String(memos.country || '').toUpperCase();
      const code = COUNTRY_CODES[input] || (COUNTRY_NAMES[input] ? input : '');
      if (code) return {scope:'country',code};
    }
    return null;
  }
  // Same legacy rule as Prayer Map: only V5 carried a supported region focus.
  return app === 'JCS_SOCIAL_V5' && role === 'prayer-focus' && REGIONS.has(memos.region)
    ? {scope:'region',code:memos.region} : null;
}
function threshold(focus) { return focus.scope === 'region' ? 5 : EXTREME_COUNTRIES.has(focus.code) ? 20 : 10; }
function focusKey(focus) { return focus ? focus.scope + ':' + focus.code : ''; }
function addGroup(groups, focus, account) {
  if (!focus) return;
  const key = focusKey(focus), item = groups.get(key) || {...focus, count:0, accounts:new Set()};
  item.count++;
  if (account) item.accounts.add(account);
  groups.set(key,item);
}
function publicGroups(groups) {
  return [...groups.values()].filter(group => group.accounts.size >= threshold(group)).map(group => ({
    scope:group.scope,code:group.code,label:group.scope === 'country' ? COUNTRY_NAMES[group.code] : group.code,
    count:roundPublic(group.count),distinctAccounts:roundPublic(group.accounts.size),threshold:threshold(group),
    countsRoundedDownTo:5
  })).sort((a,b) => b.count-a.count || a.code.localeCompare(b.code));
}

/**
 * Returned posts expose only already-public proof references, never prayer text or focus.
 * Treat account fields as internal proof inputs; activity/mapGroups omit wallet addresses.
 * complete means the provider exhausted the requested ledger range, not genesis coverage.
 */
export function summarizeCommunity(entries, {complete=false,ledger=null,ledgerMin=null,ledgerMax=null,now=Date.now()} = {}) {
  const source = Array.isArray(entries) ? entries : [], rows = source.slice(0,MAX_ENTRIES);
  const posts = [], interactions = [], participants = new Set(), seen = new Set(), groups = new Map(), focuses = new Map();
  const perProtocol = Object.fromEntries([...TAGS].map(tag => [tag,{posts:0,interactions:0}]));
  const skipped = Object.create(null), skip = reason => { skipped[reason] = (skipped[reason] || 0)+1; };
  const upperLedger = boundedInt(ledgerMax ?? ledger), snapshotLedger = boundedInt(ledger);
  let earliestScannedDate = null, latestScannedDate = null;
  for (const raw of rows) {
    const n = normalize(raw), {tx,meta} = n;
    if (!n.validated) { skip('notValidated'); continue; }
    if (upperLedger !== null && n.ledgerIndex !== null && n.ledgerIndex > upperLedger) { skip('afterSnapshot'); continue; }
    // Scan coverage includes unrelated and unsuccessful validated transactions,
    // independently of whether the record is a recognized JCS publication.
    const scannedDate = ledgerIso(n);
    if (scannedDate) {
      if (!earliestScannedDate || scannedDate < earliestScannedDate) earliestScannedDate = scannedDate;
      if (!latestScannedDate || scannedDate > latestScannedDate) latestScannedDate = scannedDate;
    }
    if ((meta.TransactionResult || meta.transaction_result) !== 'tesSUCCESS') { skip('notSuccessful'); continue; }
    if (tx.TransactionType !== 'Payment' || tx.Destination !== JCS_COLLECTOR || !isOneDrop(tx,meta)) { skip('notRegistryPayment'); continue; }
    if (!n.hash) { skip('missingHash'); continue; }
    if (seen.has(n.hash)) { skip('duplicate'); continue; }
    seen.add(n.hash);
    const memos = parseMemos(tx.Memos);
    if (!memos) { skip('malformedMemos'); continue; }
    const app = memos.app;
    if (!TAGS.has(app)) { skip('unsupportedProtocol'); continue; }
    const kind = app === LEGACY_TAG ? 'post' : memos.kind || 'post';
    if (!['post','amen','reply','support'].includes(kind)) { skip('unsupportedKind'); continue; }
    const account = typeof tx.Account === 'string' ? tx.Account.slice(0,64) : '';
    if (!account) { skip('missingAccount'); continue; }
    const base = {hash:n.hash,app,account,created:ledgerIso(n),ledgerIndex:n.ledgerIndex,transactionIndex:n.txIndex};
    participants.add(account);
    if (kind === 'post') {
      const post = {...base,nftId:upperHash(memos.nft),minttx:upperHash(memos.minttx),contentHash:upperHash(memos.hash)};
      posts.push(post); perProtocol[app].posts++;
      const focus = app === LEGACY_TAG ? null : focusFromMemos(memos,app,'prayer-focus');
      if (focus) { focuses.set(n.hash,focus); addGroup(groups,focus,account); }
    } else {
      interactions.push({...base,kind,parent:upperHash(memos.parent || memos.nft)});
      perProtocol[app].interactions++;
    }
  }
  const mapGroups = publicGroups(groups), qualifiedKeys = new Set(mapGroups.map(focusKey));
  const sorted = [...posts.map(post => ({kind:'post',...post})),...interactions].sort((a,b) => (b.ledgerIndex || 0)-(a.ledgerIndex || 0) || (b.transactionIndex || 0)-(a.transactionIndex || 0) || a.hash.localeCompare(b.hash));
  const chronological = sorted.filter(row => row.created).sort((a,b) => b.created.localeCompare(a.created));
  const today = new Date(now); today.setUTCHours(0,0,0,0);
  const days = new Map(Array.from({length:90},(_,i) => {
    const day = new Date(today.getTime()-(89-i)*DAY).toISOString().slice(0,10);
    return [day,{day,posts:0,amens:0,replies:0,support:0,total:0}];
  }));
  for (const row of sorted) {
    const day = row.created && days.get(row.created.slice(0,10));
    if (!day) continue;
    const key = row.kind === 'post' ? 'posts' : row.kind === 'amen' ? 'amens' : row.kind === 'reply' ? 'replies' : 'support';
    day[key]++; day.total++;
  }
  // NFT and mint aliases are claims until independently checked. Direct registry hashes are unambiguous.
  const registryHashes = new Set(posts.map(post => post.hash)), responded = new Set();
  let amens=0,replies=0,support=0,linkedResponses=0;
  for (const interaction of interactions) {
    if (interaction.kind === 'amen') amens++;
    else if (interaction.kind === 'reply') replies++;
    else support++;
    if (registryHashes.has(interaction.parent)) { responded.add(interaction.parent); linkedResponses++; }
  }
  const inPeriod = (post,start,end) => post.created && Date.parse(post.created) >= start && Date.parse(post.created) < end;
  const current30 = posts.filter(post => inPeriod(post,now-30*DAY,now+1)).length;
  const previous30 = posts.filter(post => inPeriod(post,now-60*DAY,now-30*DAY)).length;
  const mapOptIns = focuses.size, qualifiedMapRecords = [...focuses.values()].filter(focus => qualifiedKeys.has(focusKey(focus))).length;
  const completeRange = complete === true && source.length <= MAX_ENTRIES;
  return {
    schema:'jcs-community-metrics-v1',collector:JCS_COLLECTOR,
    counts:{posts:posts.length,participants:participants.size,amens,replies,support,responses:replies+support,
      interactions:interactions.length,respondedPosts:responded.size,registryLinkedInteractions:linkedResponses,
      nftLinkedPosts:posts.filter(post => post.nftId && post.minttx).length,
      contentCommitments:posts.filter(post => post.contentHash).length,
      mapOptIns,qualifiedMapGroups:mapGroups.length,qualifiedMapRecords,suppressedMapRecords:mapOptIns-qualifiedMapRecords,
      current30,previous30,undatedRecords:sorted.length-chronological.length},
    posts,interactions,perProtocol,mapGroups,dayBuckets:[...days.values()],
    latest:chronological[0]?.created || null,
    activity:sorted.slice(0,20).map(({kind,hash,created,ledgerIndex}) => ({kind,hash,created,ledgerIndex})),
    coverage:{complete:completeRange,ledger:snapshotLedger,ledgerMin:boundedInt(ledgerMin),ledgerMax:upperLedger,
      scanned:rows.length,inputTruncated:source.length>MAX_ENTRIES,recognized:sorted.length,
      earliest:chronological.at(-1)?.created || null,latest:chronological[0]?.created || null,
      earliestScannedDate,latestScannedDate,
      historyBasis:'Provider-returned validated account history; completeness is limited to the requested ledger range.',
      timelineBasis:'Ledger close dates only. Author-supplied dates are not used.',skipped},
    nftVerification:null,
    limitations:['Registry posts are not verified NFT mints.','Wallet counts are signing accounts, not people.',
      'Content commitment presence does not establish that the content is true or that its digest was independently recomputed.',
      'Response linkage in this summary uses registry transaction hashes only; NFT and mint aliases need independent proof.',
      'Zero activity in a bounded or incomplete history does not establish that no activity occurred.',
      'Map focus is a volunteered prayer subject, not the author’s physical location.']
  };
}

function mintedNftIds(result) {
  const meta = result?.meta || result?.metaData || {};
  const direct = upperHash(meta.nftoken_id || meta.NFTokenID || result?.nftoken_id);
  if (direct) return [direct];
  const before = new Set(), after = new Set();
  for (const wrap of Array.isArray(meta.AffectedNodes) ? meta.AffectedNodes : []) {
    const node = wrap.ModifiedNode || wrap.CreatedNode || wrap.DeletedNode;
    if (node?.LedgerEntryType !== 'NFTokenPage') continue;
    for (const item of node.PreviousFields?.NFTokens || []) { const id=upperHash(item?.NFToken?.NFTokenID); if (id) before.add(id); }
    if (wrap.DeletedNode) {
      for (const item of node.FinalFields?.NFTokens || []) { const id=upperHash(item?.NFToken?.NFTokenID); if (id) before.add(id); }
    } else {
      for (const item of (node.FinalFields || node.NewFields)?.NFTokens || []) {
        const id=upperHash(item?.NFToken?.NFTokenID);
        if (!id) continue;
        after.add(id);
        // A modified page without PreviousFields.NFTokens did not change its
        // NFT list (for example, only a page link changed during a split).
        // Its retained NFTs cannot count as newly minted.
        if (wrap.ModifiedNode && !Object.hasOwn(node.PreviousFields || {},'NFTokens')) before.add(id);
      }
    }
  }
  return [...after].filter(id => !before.has(id));
}

/** Verifies a registry claim against an independently fetched mint transaction, not NFT ownership today. */
export function verifyPrayerMint(post, txResponse) {
  const expectedHash=upperHash(post?.minttx), expectedId=upperHash(post?.nftId), commitment=upperHash(post?.contentHash);
  const outcome = (status,reason,extra={}) => ({verified:status==='verified',status,reason,minttx:expectedHash,nftId:expectedId,...extra});
  if (!expectedHash || !expectedId || !post?.account) return outcome('unavailable','Registry record lacks a complete mint reference.');
  const n=normalize(txResponse), {tx,meta}=n;
  if (!n.validated || !n.hash) return outcome('unavailable','The mint response is not explicitly validated with a transaction hash.');
  if (n.hash!==expectedHash) return outcome('mismatch','Returned transaction hash does not match the registry claim.');
  if ((meta.TransactionResult || meta.transaction_result)!=='tesSUCCESS') return outcome('mismatch','The referenced mint did not validate successfully.');
  if (tx.TransactionType!=='NFTokenMint' || tx.Account!==post.account || Number(tx.NFTokenTaxon)!==PRAYER_TAXON) return outcome('mismatch','Mint type, author or prayer taxon does not match.');
  if (n.ledgerIndex!==null && post.ledgerIndex!==null && Number.isSafeInteger(post.ledgerIndex) && n.ledgerIndex>post.ledgerIndex) return outcome('mismatch','The claimed mint is later than its registry publication.');
  const memos=parseMemos(tx.Memos);
  if (!memos || !TAGS.has(memos.app) || memos.app!==post.app || memos.kind!=='mint') return outcome('mismatch','Project protocol or mint memo does not match the registry.');
  if (!commitment || !upperHash(memos.hash)) return outcome('unavailable','A matching public content commitment is unavailable.');
  if (upperHash(memos.hash)!==commitment) return outcome('mismatch','Mint and registry content commitments differ.');
  const ids=mintedNftIds(txResponse);
  if (ids.length!==1) return outcome('unavailable','The mint response does not identify one newly minted NFT.');
  if (ids[0]!==expectedId) return outcome('mismatch','Minted NFT ID does not match the registry claim.');
  return outcome('verified','Validated mint, author, taxon, project memos, commitment and NFT ID match the registry.',{ledgerIndex:n.ledgerIndex});
}

function receiptPointer(uri) {
  if (uri.startsWith(RECEIPT_URI) && upperHash(uri.slice(RECEIPT_URI.length))) return 'legacy-receipt-pointer';
  if (uri.startsWith('data:application/json,')) {
    try {
      const value=JSON.parse(decodeURIComponent(uri.slice(22)));
      if (value.schema==='jcs-validated-receipt-nft-v1' && value.network==='XRPL Mainnet' && upperHash(value.source_transaction)) return 'receipt-schema-pointer';
    } catch { /* Untrusted URI text is never executed or fetched. */ }
  }
  try {
    const url=new URL(uri);
    if (url.origin===RECEIPT_BACKEND && /^\/api\/jcs-receipts-v1\/[A-Fa-f0-9]{64}\.json$/.test(url.pathname) &&
      /^[a-f0-9]{64}$/.test(url.searchParams.get('d') || '') && url.searchParams.size===1 && !url.hash && !url.username && !url.password) return 'receipt-digest-pointer';
  } catch { /* No network access. */ }
  return '';
}

/** Ownership records can expose candidate categories; a matching taxon or URI cannot authenticate project provenance. */
export function classifyWalletNfts(nfts) {
  const rows=Array.isArray(nfts) ? nfts.slice(0,MAX_ENTRIES) : [], seen=new Set(), items=[];
  const counts={prayerCandidates:0,capsuleCandidates:0,receiptCandidates:0,taxonOnly:0,unclassified:0};
  for (const nft of rows) {
    const id=upperHash(nft?.NFTokenID || nft?.nft_id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const taxon=Number(nft.NFTokenTaxon ?? nft.nft_taxon), uri=decodeHex(nft.URI ?? nft.uri ?? '',256) || '';
    let category='',basis='';
    if (taxon===PRAYER_TAXON) {
      category='prayer';
      if (uri.startsWith(PRAYER_URI) && upperHash(uri.slice(PRAYER_URI.length))) basis='prayer-commitment-pointer';
      else if (/^jcs:testimony:v2:[^\s]{1,230}$/.test(uri) || uri==='https://jesuschristsavestoken.com/jcs-logo.png' || uri.startsWith('https://jesuschristsavestoken.com/jcs-logo.png#')) basis='legacy-prayer-pointer';
    } else if (taxon===CAPSULE_TAXON) {
      category='capsule';
      if (/^jcs:receipt:v1:[a-fA-F0-9]{64}$/.test(uri)) basis='capsule-commitment-pointer';
    } else if (taxon===RECEIPT_TAXON) {
      category='receipt'; basis=receiptPointer(uri);
    }
    if (!category) { counts.unclassified++; continue; }
    if (!basis) counts.taxonOnly++;
    else counts[category+'Candidates']++;
    // No URI, private capsule contents, plaintext, owner or external link is returned.
    items.push({id,category,basis:basis || 'taxon-only',verified:false});
  }
  return {schema:'jcs-wallet-nft-candidates-v1',scanned:seen.size,counts,items,
    inputTruncated:Array.isArray(nfts) && nfts.length>MAX_ENTRIES,
    verified:0,limitation:'Candidates only. Taxons and metadata pointers can be copied; mint provenance and source transactions have not been verified. Holdings are not lifetime issuance.'};
}

// Country names/codes copied from the deployed Prayer Map geometry; no geolocation is inferred.
const COUNTRY_CODES = Object.freeze({"ID":"IDN","MY":"MYS","CL":"CHL","BO":"BOL","PE":"PER","AR":"ARG","CY":"CYP","IN":"IND","CN":"CHN","IL":"ISR","PS":"PSE","LB":"LBN","ET":"ETH","SS":"SSD","SO":"SOM","KE":"KEN","MW":"MWI","TZ":"TZA","SY":"SYR","FR":"FRA","SR":"SUR","GY":"GUY","KR":"KOR","KP":"PRK","MA":"MAR","EH":"ESH","CR":"CRI","NI":"NIC","CG":"COG","CD":"COD","BT":"BTN","UA":"UKR","BY":"BLR","NA":"NAM","ZA":"ZAF","MF":"MAF","SX":"SXM","OM":"OMN","UZ":"UZB","KZ":"KAZ","TJ":"TJK","LT":"LTU","BR":"BRA","UY":"URY","MN":"MNG","RU":"RUS","CZ":"CZE","DE":"DEU","EE":"EST","LV":"LVA","NO":"NOR","SE":"SWE","FI":"FIN","VN":"VNM","KH":"KHM","LU":"LUX","AE":"ARE","BE":"BEL","GE":"GEO","MK":"MKD","AL":"ALB","AZ":"AZE","XK":"KOS","TR":"TUR","ES":"ESP","LA":"LAO","KG":"KGZ","AM":"ARM","DK":"DNK","LY":"LBY","TN":"TUN","RO":"ROU","HU":"HUN","SK":"SVK","PL":"POL","IE":"IRL","GB":"GBR","GR":"GRC","ZM":"ZMB","SL":"SLE","GN":"GIN","LR":"LBR","CF":"CAF","SD":"SDN","DJ":"DJI","ER":"ERI","AT":"AUT","IQ":"IRQ","IT":"ITA","CH":"CHE","IR":"IRN","NL":"NLD","LI":"LIE","CI":"CIV","RS":"SRB","ML":"MLI","SN":"SEN","NG":"NGA","BJ":"BEN","AO":"AGO","HR":"HRV","SI":"SVN","QA":"QAT","SA":"SAU","BW":"BWA","ZW":"ZWE","PK":"PAK","BG":"BGR","TH":"THA","SM":"SMR","HT":"HTI","DO":"DOM","TD":"TCD","KW":"KWT","SV":"SLV","GT":"GTM","TL":"TLS","BN":"BRN","MC":"MCO","DZ":"DZA","MZ":"MOZ","SZ":"SWZ","BI":"BDI","RW":"RWA","MM":"MMR","BD":"BGD","AD":"AND","AF":"AFG","ME":"MNE","BA":"BIH","UG":"UGA","CU":"CUB","HN":"HND","EC":"ECU","CO":"COL","PY":"PRY","PT":"PRT","MD":"MDA","TM":"TKM","JO":"JOR","NP":"NPL","LS":"LSO","CM":"CMR","GA":"GAB","NE":"NER","BF":"BFA","TG":"TGO","GH":"GHA","GW":"GNB","GI":"GIB","US":"USA","CA":"CAN","MX":"MEX","BZ":"BLZ","PA":"PAN","VE":"VEN","PG":"PNG","EG":"EGY","YE":"YEM","MR":"MRT","GQ":"GNQ","GM":"GMB","HK":"HKG","VA":"VAT","AU":"AUS","GL":"GRL","FJ":"FJI","NZ":"NZL","NC":"NCL","MG":"MDG","PH":"PHL","LK":"LKA","CW":"CUW","AW":"ABW","BS":"BHS","TC":"TCA","TW":"TWN","JP":"JPN","PM":"SPM","IS":"ISL","PN":"PCN","PF":"PYF","TF":"ATF","SC":"SYC","KI":"KIR","MH":"MHL","TT":"TTO","GD":"GRD","VC":"VCT","BB":"BRB","LC":"LCA","DM":"DMA","UM":"UMI","MS":"MSR","AG":"ATG","KN":"KNA","VI":"VIR","BL":"BLM","PR":"PRI","AI":"AIA","VG":"VGB","JM":"JAM","KY":"CYM","BM":"BMU","HM":"HMD","SH":"SHN","MU":"MUS","KM":"COM","ST":"STP","CV":"CPV","MT":"MLT","JE":"JEY","GG":"GGY","IM":"IMN","AX":"ALA","FO":"FRO","IO":"IOT","SG":"SGP","NF":"NFK","CK":"COK","TO":"TON","WF":"WLF","WS":"WSM","SB":"SLB","TV":"TUV","MV":"MDV","NR":"NRU","FM":"FSM","GS":"SGS","FK":"FLK","VU":"VUT","NU":"NIU","AS":"ASM","PW":"PLW","GU":"GUM","MP":"MNP","BH":"BHR","MO":"MAC"});
const COUNTRY_NAMES = Object.freeze({"IDN":"Indonesia","MYS":"Malaysia","CHL":"Chile","BOL":"Bolivia","PER":"Peru","ARG":"Argentina","ESB":"Dhekelia","CYP":"Cyprus","IND":"India","CHN":"China","ISR":"Israel","PSE":"Palestine","LBN":"Lebanon","ETH":"Ethiopia","SSD":"South Sudan","SOM":"Somalia","KEN":"Kenya","MWI":"Malawi","TZA":"Tanzania","SYR":"Syria","SOL":"Somaliland","FRA":"France","SUR":"Suriname","GUY":"Guyana","KOR":"Republic of Korea","PRK":"Dem. Rep. Korea","MAR":"Morocco","ESH":"Western Sahara","CRI":"Costa Rica","NIC":"Nicaragua","COG":"Republic of the Congo","COD":"Democratic Republic of the Congo","BTN":"Bhutan","UKR":"Ukraine","BLR":"Belarus","NAM":"Namibia","ZAF":"South Africa","MAF":"Saint-Martin","SXM":"Sint Maarten","OMN":"Oman","UZB":"Uzbekistan","KAZ":"Kazakhstan","TJK":"Tajikistan","LTU":"Lithuania","BRA":"Brazil","URY":"Uruguay","MNG":"Mongolia","RUS":"Russian Federation","CZE":"Czech Republic","DEU":"Germany","EST":"Estonia","LVA":"Latvia","NOR":"Norway","SWE":"Sweden","FIN":"Finland","VNM":"Vietnam","KHM":"Cambodia","LUX":"Luxembourg","ARE":"United Arab Emirates","BEL":"Belgium","GEO":"Georgia","MKD":"North Macedonia","ALB":"Albania","AZE":"Azerbaijan","KOS":"Kosovo","TUR":"Turkey","ESP":"Spain","LAO":"Lao PDR","KGZ":"Kyrgyzstan","ARM":"Armenia","DNK":"Denmark","LBY":"Libya","TUN":"Tunisia","ROU":"Romania","HUN":"Hungary","SVK":"Slovakia","POL":"Poland","IRL":"Ireland","GBR":"United Kingdom","GRC":"Greece","ZMB":"Zambia","SLE":"Sierra Leone","GIN":"Guinea","LBR":"Liberia","CAF":"Central African Republic","SDN":"Sudan","DJI":"Djibouti","ERI":"Eritrea","AUT":"Austria","IRQ":"Iraq","ITA":"Italy","CHE":"Switzerland","IRN":"Iran","NLD":"Netherlands","LIE":"Liechtenstein","CIV":"Côte d'Ivoire","SRB":"Serbia","MLI":"Mali","SEN":"Senegal","NGA":"Nigeria","BEN":"Benin","AGO":"Angola","HRV":"Croatia","SVN":"Slovenia","QAT":"Qatar","SAU":"Saudi Arabia","BWA":"Botswana","ZWE":"Zimbabwe","PAK":"Pakistan","BGR":"Bulgaria","THA":"Thailand","SMR":"San Marino","HTI":"Haiti","DOM":"Dominican Republic","TCD":"Chad","KWT":"Kuwait","SLV":"El Salvador","GTM":"Guatemala","TLS":"Timor-Leste","BRN":"Brunei Darussalam","MCO":"Monaco","DZA":"Algeria","MOZ":"Mozambique","SWZ":"Kingdom of eSwatini","BDI":"Burundi","RWA":"Rwanda","MMR":"Myanmar","BGD":"Bangladesh","AND":"Andorra","AFG":"Afghanistan","MNE":"Montenegro","BIH":"Bosnia and Herzegovina","UGA":"Uganda","USG":"US Naval Base Guantanamo Bay","CUB":"Cuba","HND":"Honduras","ECU":"Ecuador","COL":"Colombia","PRY":"Paraguay","PRT":"Portugal","MDA":"Moldova","TKM":"Turkmenistan","JOR":"Jordan","NPL":"Nepal","LSO":"Lesotho","CMR":"Cameroon","GAB":"Gabon","NER":"Niger","BFA":"Burkina Faso","TGO":"Togo","GHA":"Ghana","GNB":"Guinea-Bissau","GIB":"Gibraltar","USA":"United States","CAN":"Canada","MEX":"Mexico","BLZ":"Belize","PAN":"Panama","VEN":"Venezuela","PNG":"Papua New Guinea","EGY":"Egypt","YEM":"Yemen","MRT":"Mauritania","GNQ":"Equatorial Guinea","GMB":"The Gambia","HKG":"Hong Kong","VAT":"Vatican","CYN":"Northern Cyprus","CNM":"Cyprus U.N. Buffer Zone","KAS":"Siachen Glacier","WSB":"Akrotiri","SPI":"Southern Patagonian Ice Field","BRT":"Bir Tawil","AUS":"Australia","GRL":"Greenland","FJI":"Fiji","NZL":"New Zealand","NCL":"New Caledonia","MDG":"Madagascar","PHL":"Philippines","LKA":"Sri Lanka","CUW":"Curaçao","ABW":"Aruba","BHS":"Bahamas","TCA":"Turks and Caicos Islands","TWN":"Taiwan","JPN":"Japan","SPM":"Saint Pierre and Miquelon","ISL":"Iceland","PCN":"Pitcairn Islands","PYF":"French Polynesia","ATF":"French Southern and Antarctic Lands","SYC":"Seychelles","KIR":"Kiribati","MHL":"Marshall Islands","TTO":"Trinidad and Tobago","GRD":"Grenada","VCT":"Saint Vincent and the Grenadines","BRB":"Barbados","LCA":"Saint Lucia","DMA":"Dominica","UMI":"United States Minor Outlying Islands","MSR":"Montserrat","ATG":"Antigua and Barbuda","KNA":"Saint Kitts and Nevis","VIR":"United States Virgin Islands","BLM":"Saint-Barthélemy","PRI":"Puerto Rico","AIA":"Anguilla","VGB":"British Virgin Islands","JAM":"Jamaica","CYM":"Cayman Islands","BMU":"Bermuda","HMD":"Heard I. and McDonald Islands","SHN":"Saint Helena","MUS":"Mauritius","COM":"Comoros","STP":"São Tomé and Principe","CPV":"Republic of Cabo Verde","MLT":"Malta","JEY":"Jersey","GGY":"Guernsey","IMN":"Isle of Man","ALA":"Åland Islands","FRO":"Faeroe Islands","IOT":"British Indian Ocean Territory","SGP":"Singapore","NFK":"Norfolk Island","COK":"Cook Islands","TON":"Tonga","WLF":"Wallis and Futuna Islands","WSM":"Samoa","SLB":"Solomon Islands","TUV":"Tuvalu","MDV":"Maldives","NRU":"Nauru","FSM":"Federated States of Micronesia","SGS":"South Georgia and the Islands","FLK":"Falkland Islands / Malvinas","VUT":"Vanuatu","NIU":"Niue","ASM":"American Samoa","PLW":"Palau","GUM":"Guam","MNP":"Northern Mariana Islands","BHR":"Bahrain","PGA":"Spratly Islands","MAC":"Macao","BJN":"Bajo Nuevo Bank (Petrel Islands)","SER":"Serranilla Bank","SCR":"Scarborough Reef"});
