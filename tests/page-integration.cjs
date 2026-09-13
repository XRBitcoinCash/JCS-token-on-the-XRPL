const fs=require('fs'), path=require('path'), assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const dom=new JSDOM(html,{url:'https://jesuschristsavestoken.com/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,errors=[], requests=[], intervals=[];
w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;
let now=Date.now(), seq=100000001, price=.00004;
const RealDate=Date; w.Date=class extends RealDate{constructor(...v){super(...(v.length?v:[now]));}static now(){return now}};
w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
w.ResizeObserver=class{observe(){}disconnect(){}};
w.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length};w.clearInterval=()=>{};
w.setTimeout=(fn,ms)=>{if(ms<=100)queueMicrotask(fn);return 1};w.clearTimeout=()=>{};
w.confirm=()=>false;w.alert=()=>{};w.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>({ripple:{usd:1.4,last_updated_at:now/1000},bitcoin:{usd:77000,last_updated_at:now/1000}})}};
w.HTMLMediaElement.prototype.load=function(){};
w.HTMLMediaElement.prototype.pause=function(){};
w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};
w.addEventListener('error',e=>errors.push(e.error?.message||e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
const issuer='rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd',asset={currency:'JCS',issuer};
class WS extends w.EventTarget{
 static OPEN=1;
 constructor(){super();this.readyState=0;queueMicrotask(()=>{this.readyState=1;this.dispatchEvent(new w.Event('open'))})}
 send(body){const q=JSON.parse(body);requests.push(q.command);let r={validated:true,ledger_index:seq,ledger_hash:'A'.repeat(64)};
  switch(q.command){
   case 'ledger': r.ledger={ledger_index:seq,ledger_hash:'A'.repeat(64),close_time_human:new RealDate(now).toISOString()};break;
   case 'amm_info': r.amm={account:'rPoolFixture',amount:'400000000',amount2:{...asset,value:String(400/price)},lp_token:{currency:'03'+'A'.repeat(38),issuer:'rPoolFixture',value:'10000'},trading_fee:500};break;
   case 'book_offers':r.offers=[];break;
   case 'gateway_balances':r.obligations={JCS:'10000000'};break;
   case 'server_info':r.info={server_state:'full',validated_ledger:{seq,reserve_base_xrp:1,reserve_inc_xrp:.2,base_fee_xrp:.00001}};break;
   case 'account_lines':r.lines=[];break;
   case 'account_offers':r.offers=[];break;
   case 'account_nfts':r.account_nfts=[];break;
   case 'fee':r.drops={open_ledger_fee:'12',minimum_fee:'10'};break;
   case 'account_info':r.account_data={Balance:'100000000',OwnerCount:0,Flags:0,Sequence:1};break;
  }
  queueMicrotask(()=>this.dispatchEvent(new w.MessageEvent('message',{data:JSON.stringify({id:q.id,status:'success',result:r})})));
 }
 close(){this.readyState=3;this.dispatchEvent(new w.Event('close'))}
}w.WebSocket=WS;
async function flush(){for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r))}
(async()=>{
 const scripts=[...w.document.querySelectorAll('script')].filter(s=>!['application/json','application/ld+json'].includes(s.type));
 for(const s of scripts){let code=s.textContent;if(s.src){const u=new URL(s.src);if(u.origin!==w.location.origin)continue;code=fs.readFileSync(path.join(root,u.pathname),'utf8')}try{w.eval(code)}catch(e){errors.push(e.stack)}}
 await flush();
 assert.deepEqual(errors,[],'No initialization errors');
 assert.equal(w.document.querySelectorAll('h1').length,1);
 assert.ok(!w.document.getElementById('sentinel'));
 assert.ok(!w.document.getElementById('ww-live-intel'));
 assert.ok(!w.document.getElementById('buy25'));
 assert.ok(w.document.getElementById('homeMarketPrice').textContent.includes('$'),'Real derived USD reference reaches hero');
 assert.ok(w.document.getElementById('jcsChartStatus').textContent.includes('1 observation'),'Initial real sample');
 assert.ok(!requests.some(x=>/gdelt|rss2json/.test(x)),'No broken news requests');
 assert.ok(!intervals.some(i=>i.ms>0&&i.ms<60000),'No frequent periodic page refreshes');
 const firstCount=requests.filter(x=>String(x).includes('coingecko')).length;
 now+=61000;seq++;price*=1.01;
 for(const i of [...intervals])if(i.ms===60000)i.fn();await flush();
 assert.equal(requests.filter(x=>String(x).includes('coingecko')).length,firstCount+1,'Only one USD request per refresh');
 assert.equal(w.document.querySelectorAll('#jcsComparisonChart svg path').length,3,'Three observed comparison lines');
 assert.ok(w.document.getElementById('jcsChartStatus').textContent.includes('2 observations'));
 const priceLabel=w.document.getElementById('homeMarketPrice').textContent;
 assert.ok(priceLabel.includes('$'),priceLabel);
 assert.ok(w.document.getElementById('integrityQuoteAge').textContent.includes('60 seconds'));
 w.document.getElementById('jcsChartReset').click();assert.equal(w.document.querySelectorAll('#jcsComparisonChart svg').length,0);
 console.log(JSON.stringify({result:'PASS',checks:14,errors,intervals:intervals.map(x=>x.ms),priceLabel,requestCounts:requests.reduce((a,q)=>(a[q]=(a[q]||0)+1,a),{})},null,2));
 dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
