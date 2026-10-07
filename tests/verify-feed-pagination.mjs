import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../verify.html', import.meta.url), 'utf8');
const section = (start, end) => {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing source section: ${start}`);
  return html.slice(from, to);
};
const historySource = section('  async function fetchRecentCollectorHistory(previous=null) {', "  window.addEventListener('beforeunload'");
const renderSource = section('  function renderFeedHistoryState() {', '  async function subscribeToCollector()');
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, {textContent:'', disabled:false, hidden:false, setAttribute(){}});
  return elements.get(id);
};
let calls = [], response, retryTimer, status = '';
const state = {feedHistory:null, feedDiagnostics:{}, feedState:'partial', feedError:'',
  feedLoading:false, feedPromise:null, feedRetryAfter:0, feedRetryTimer:null,
  feedChecked:'', posts:[], activeEndpoint:''};
const context = vm.createContext({
  state, COLLECTOR:'rCollector', RECENT_HISTORY_PAGES:1,
  FEED_RATE_LIMIT_RETRY_MS:30_000, XRPL_SERVERS:['wss://example/'], FEED_HTTP_SERVERS:[],
  feedRequestAt:async (endpoint, params) => {calls.push({endpoint, params}); return response;},
  setFeedStatus:(value) => {status=value;}, $:element,
  window:{setTimeout:(callback, delay) => {retryTimer={callback,delay}; return 1;}},
  clearTimeout:() => {}, parseFeed:async () => [{key:'prayer'}],
  renderPrayerPulse:()=>{}, updateMapPublicationPreview:()=>{},
  renderVerificationCenter:()=>{}, updateStats:()=>{}, renderFeed:()=>{}
});
vm.runInContext(historySource + renderSource + '\nthis.fetchHistory=fetchRecentCollectorHistory; this.loadFeed=loadFeed;', context);

response={result:{ledger_index_min:100,ledger_index_max:200,
  transactions:[{tx_json:{hash:'FIRST'}}],marker:{ledger:150,seq:1}}};
const first=await context.fetchHistory();
assert.equal(first.pages,1,'automatic history read stays to one page');
assert.equal(first.complete,false);
assert.equal(first.entries.length,1);
assert.equal(calls.length,1);
assert.equal(calls[0].params.limit,200);

response={result:{ledger_index_min:100,ledger_index_max:200,
  transactions:[{tx_json:{hash:'SECOND'}}]}};
const second=await context.fetchHistory(first);
assert.equal(second.complete,true,'next click resumes and completes the same range');
assert.equal(second.entries.length,2);
assert.deepEqual(JSON.parse(JSON.stringify(calls[1].params.marker)),{ledger:150,seq:1});
assert.equal(calls[1].params.ledger_index_min,100);
assert.equal(calls[1].params.ledger_index_max,200);

state.feedHistory=first;
state.posts=[{key:'prayer'}];
context.feedRequestAt=async (endpoint, params) => {calls.push({endpoint,params}); throw new Error('You are placing too much load on the server.');};
await context.loadFeed(true,true);
assert.equal(state.feedState,'partial');
assert.equal(state.feedHistory.entries.length,1,'quota preserves validated entries');
assert.deepEqual(JSON.parse(JSON.stringify(state.feedHistory.marker)),{ledger:150,seq:1});
assert.equal(element('olderHistoryBtn').disabled,true);
assert.equal(element('refreshFeedBtn').disabled,true);
assert.match(status,/try again in about 30 seconds/);
assert.equal(retryTimer.delay,30_000);
const callCount=calls.length;
await context.loadFeed(true,true);
assert.equal(calls.length,callCount,'cooldown prevents another rejected request');
retryTimer.callback();
assert.equal(element('olderHistoryBtn').disabled,false);
assert.equal(element('refreshFeedBtn').disabled,false);
console.log('JCS prayer feed pagination and quota recovery: 3 cases passed');
