import {LedgerClient,ISSUER,parseAmm,summarizeBook} from './jcs-metrics-ledger.js?v=5';
import {summarizeCommunity,verifyPrayerMint,classifyWalletNfts} from './jcs-metrics-community.js?v=4';
const $=id=>document.getElementById(id),DAY=86400000;
const number=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
const fmt=(value,digits=0)=>number(value)===null?'Unavailable':new Intl.NumberFormat(undefined,{maximumFractionDigits:digits}).format(Number(value));
const price=value=>number(value)===null?'Unavailable':Number(value)>0&&Number(value)<1e-8?Number(value).toExponential(4):fmt(value,9);
const percent=value=>number(value)===null?'Unavailable':fmt(value,1)+'%';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=iso=>iso?new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Not loaded';
const stamp=iso=>iso?new Date(iso).toLocaleString(): 'Date unavailable';
const explorer=hash=>'https://livenet.xrpl.org/transactions/'+encodeURIComponent(hash);
const write=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
const setStatus=(id,label,state='')=>{write(id,label);$(id).dataset.state=state;};
const store={snapshot:null,parts:{},community:null,trust:null,project:null,proofs:[],proofCache:new Map(),period:90,auto:true,busy:false,checking:false,lastCore:0,lastHistory:0,lastTrust:0,historyEntries:[],historyCursor:null,historySnapshot:null,historyPages:0,historyBusy:false,historyError:'',historyCooldownUntil:0,account:'',walletEpoch:0,walletBusy:false,xaman:null,connection:'connecting',sources:{}};
const HISTORY_PAGE_CAP=10;
let historyCooldownTimer;
const features=[
 {name:'DynamicNFT',title:'NFT metadata updates',id:'C1CE18F2A268E6A849C27B3DE485006771B4C01B2FCEC4F18356FE92ECD6BB74',text:'Allows the URI of an NFT minted with the mutable flag to be changed.',note:'A fixed URI does not guarantee that a web server’s contents cannot change.',anchor:'dynamicnft'},
 {name:'NFTokenMintOffer',title:'Mint & offer together',id:'EE3CF852F0506782D05E65D49E5DCC3D16D50898CD1B646BAE274863401CC3CE',text:'Allows an NFT mint and its sell offer to be created in one transaction.',note:'Availability is reported here; this page does not mint or sell NFTs.',anchor:'nftokenmintoffer'},
 {name:'TokenEscrow',title:'Issued-token escrow',id:'138B968F25822EFBF54C00F97031221C47B1EAB8321D93C7C2AEAF85F04EC5DF',text:'Extends escrow to supported issued tokens, subject to issuer settings.',note:'Network activation alone does not establish JCS eligibility.',anchor:'tokenescrow'},
 {name:'BatchV1_1',title:'Grouped transactions',id:'9F287AED3CDB50A7BD1ACEC24296A30C9B5230CCD136219317AC790E3B884377',text:'Supports processing a group of transactions using the revised Batch design.',note:'This is the revised amendment; the original Batch was replaced.',anchor:'batchv1_1'}
];
let client;const clientCallbacks={onStatus:event=>{
 store.connection=event.state;write('connectionText',event.message);$('connectionPill').dataset.state=event.state==='connected'?'live':['unavailable','disconnected'].includes(event.state)?'error':'';
 if(event.state==='disconnected'){store.auto=false;updateAuto();markRetained('Ledger connection closed.');write('refreshNote','Connection closed. Existing readings are retained; use Refresh to reconnect.');renderSources();}
},onLedger:event=>{if(store.auto&&event.ledger_index)write('connectionText','Mainnet connected · newest ledger '+fmt(event.ledger_index));}};
client=new LedgerClient(clientCallbacks);
function source(key,label,state,scope,at=null,ledger=null,error=null){store.sources[key]={label,state,scope,at,ledger,error};renderSources();}
function renderSources(){
 const rows=Object.values(store.sources);$('sourceTable').innerHTML=rows.map(s=>'<tr><th scope="row">'+esc(s.label)+'</th><td>'+esc(s.state)+'</td><td>'+esc(s.scope)+(s.at?' · read '+esc(time(s.at)):'')+(s.error?'<br><span class="muted">'+esc(s.error)+'</span>':'')+'</td></tr>').join('');
}

function markRetained(reason){
 for(const [key,part] of Object.entries(store.parts))if(part.value)store.parts[key]={...part,retained:true,error:reason};
 if(store.community){store.community.retained=true;store.community.error=reason;renderCommunity();}
 if(store.trust){store.trust.retained=true;store.trust.error=reason;renderTrust();}
 if(store.market){renderMarket();renderIssuer();renderFeatures();}
 for(const s of Object.values(store.sources))if(s.ledger){s.state='Retained · connection unavailable';s.error=reason;}
 renderSources();
}

function setPart(key,value,snapshot){
 const old=store.parts[key];
 if(value!==null&&value!==undefined)store.parts[key]={value,at:snapshot.at,ledger:snapshot.ledger,error:null,retained:false};
 else if(old)store.parts[key]={...old,error:snapshot.errors[key]||'No response',retained:true};
 else store.parts[key]={value:null,at:null,ledger:null,error:snapshot.errors[key]||'No response',retained:false};
 return store.parts[key];
}
function tokenCurrency(c){return c==='JCS'||c==='0000000000000000000000004A4353000000000000';}
function renderSnapshot(snapshot){
 for(const key of ['server','account','amm','asks','bids','amendments'])setPart(key,snapshot[key],snapshot);
 store.snapshot=snapshot;const ledger=snapshot.ledger;const info=store.parts.server.value?.info||{},v=info.validated_ledger||{};
 write('heroLedger','#'+fmt(ledger.index));write('heroLedgerNote','Validated '+stamp(ledger.closeTime));write('ledgerIndex',fmt(ledger.index));write('ledgerHash',ledger.hash);write('endpointLabel',client.endpoint+' · '+(info.server_state||'State unavailable')+' · server '+(info.build_version||info.clio_version||'build unavailable'));
 write('ledgerFee',number(v.base_fee_xrp)===null?'Unavailable':fmt(v.base_fee_xrp,8)+' XRP');write('ledgerReserve',number(v.reserve_base_xrp)===null?'Unavailable':fmt(v.reserve_base_xrp,4)+' XRP');write('ledgerOwnerReserve',number(v.reserve_inc_xrp)===null?'Unavailable':fmt(v.reserve_inc_xrp,4)+' XRP');
 const stale=number(ledger.age)===null||ledger.age>60;setStatus('ledgerStatus',stale?'Validated snapshot · check age':'Validated · '+time(snapshot.at),stale?'partial':'ok');
 source('ledger','XRPL ledger',stale?'Snapshot is older or age unknown':'Validated','Ledger '+fmt(ledger.index),snapshot.at,ledger.index);
 source('server','Fees & reserves','Server-reported','server_info · ledger '+fmt(v.seq),snapshot.at,number(v.seq));
 renderMarket();renderIssuer();renderFeatures();
}
function renderMarket(){
 const a=store.parts.amm,b=store.parts.bids,s=store.parts.asks;const amm=parseAmm(a?.value),bid=summarizeBook(b?.value,'bid'),ask=summarizeBook(s?.value,'ask');
 store.market={amm,bid,ask};
 write('poolPrice',price(amm?.price));write('poolJcs',fmt(amm?.jcs,3));write('poolXrp',fmt(amm?.xrp,3));write('poolFee',percent(amm?.feePercent));
 write('bestBid',bid?.best==null?(bid?'No funded bids':'Unavailable'):price(bid.best)+' XRP');write('bestAsk',ask?.best==null?(ask?'No funded asks':'Unavailable'):price(ask.best)+' XRP');
 const same=b?.ledger?.hash&&b.ledger.hash===s?.ledger?.hash;
 const spread=same&&bid?.best>0&&ask?.best>0?(ask.best-bid.best)/((ask.best+bid.best)/2)*100:null;
 write('bookSpread',spread<0?'Crossed snapshot':percent(spread));write('bidDepth',bid?fmt(bid.jcs,3)+' JCS':'Unavailable');write('askDepth',ask?fmt(ask.jcs,3)+' JCS':'Unavailable');
 const unavailable=[a,b,s].some(p=>!p?.value),retained=[a,b,s].some(p=>p?.retained);
 setStatus('marketStatus',retained?'Some readings retained':unavailable?'Some sources unavailable':'Validated · '+time(a?.at),retained?'retained':unavailable?'partial':'ok');
 for(const [key,label,p]of[['amm','JCS / XRP pool',a],['bids','Order book · bids',b],['asks','Order book · asks',s]])source(key,label,p?.retained?'Retained reading':p?.value?'Validated':'Unavailable',p?.ledger?'Ledger '+fmt(p.ledger.index):'No snapshot',p?.at,p?.ledger?.index,p?.error);
 renderTrust();
}
function renderIssuer(){
 const p=store.parts.account,r=p?.value,d=r?.account_data,f=r?.account_flags||{};
 if(!d){$('issuerSettings').innerHTML='<p class="empty">Issuer settings are unavailable from this source.</p>';return;}
 const flag=(name,bit)=>typeof f[name]==='boolean'?f[name]:number(d.Flags)!==null?Boolean(Number(d.Flags)&bit):null;
 const rows=[['Global freeze',flag('globalFreeze',0x00400000),'An enabled freeze restricts transfers of the issued asset.'],['No Freeze',flag('noFreeze',0x00200000),'If set, the issuer has given up the ability to freeze trust lines.'],['Holder authorization',flag('requireAuthorization',0x00040000),'If required, the issuer must authorize holders.'],['Default Ripple',flag('defaultRipple',0x00800000),'Issuer setting used for normal issued-token movement.'],['Master key disabled',flag('disableMasterKey',0x00100000),'One signing route is disabled; this is not a full blackhole check.'],['Clawback permission',flag('allowTrustLineClawback',0x80000000),'If enabled, the issuer can reclaim eligible issued balances.']];
 $('issuerSettings').innerHTML=rows.map(([label,value,note])=>'<div class="setting-item"><strong>'+esc(label)+'</strong><span>'+(value===null?'Unavailable':value?'Enabled':'Not enabled')+'</span><p>'+esc(note)+'</p></div>').join('')+'<div class="setting-item"><strong>Issuer transfer fee</strong><span>'+percent(((number(d.TransferRate)??1000000000)/1000000000-1)*100)+'</span><p>Issuer transfer fee is separate from the pool fee.</p></div>';
 source('issuer','Issuer settings',p.retained?'Retained reading':'Validated','Ledger '+fmt(p.ledger?.index),p.at,p.ledger?.index,p.error);
}
function renderFeatures(){
 const p=store.parts.amendments,node=p?.value?.node,known=Array.isArray(node?.Amendments),enabled=new Set(known?node.Amendments:[]),majorities=new Set((node?.Majorities||[]).map(x=>x.Majority?.Amendment));
 $('capabilityCards').innerHTML=features.map(f=>{const on=known&&enabled.has(f.id),status=!known?'Status unavailable':on?'Enabled on this ledger':majorities.has(f.id)?'Majority recorded · not enabled':'Not enabled in this snapshot';return '<article class="capability-card"><span class="capability-status '+(on?'enabled':'')+'">'+esc(status)+(p?.retained?' · retained':'')+'</span><h3>'+esc(f.title)+'</h3><p>'+esc(f.text)+'</p><small>'+esc(f.note)+'</small><a href="https://xrpl.org/resources/known-amendments#'+f.anchor+'" target="_blank" rel="noopener noreferrer">'+esc(f.name)+' · official documentation ↗</a></article>';}).join('');
 source('amendments','Network capabilities',p?.retained?'Retained reading':known?'Validated':'Unavailable',p?.ledger?'Amendments entry · ledger '+fmt(p.ledger.index):'Awaiting public Amendments entry',p?.at,p?.ledger?.index,p?.error);
}
function summarizeLines(scan){
 if(!Array.isArray(scan.lines))return null;
 const lines=scan.lines.filter(l=>tokenCurrency(l.currency)),seen=new Set(),balances=[];let zero=0,invalid=0;
 for(const l of lines){if(!l.account||seen.has(l.account))continue;seen.add(l.account);const n=number(l.balance);if(n===null){invalid++;continue;}if(n<0)balances.push({account:l.account,balance:-n});else if(n===0)zero++;}
 const total=balances.reduce((s,b)=>s+b.balance,0),finiteTotal=Number.isFinite(total)?total:null;
 balances.sort((a,b)=>b.balance-a.balance);
 return {trustlines:seen.size,holders:balances.length,obligations:finiteTotal,zero,invalid,topTen:finiteTotal>0?balances.slice(0,10).reduce((s,b)=>s+b.balance,0)/finiteTotal*100:null,balances,complete:scan.complete&&invalid===0,ledger:scan.ledger,ledgerHash:scan.ledgerHash,pages:scan.pages,error:scan.error||null,at:new Date().toISOString()};
}
function renderTrust(){
 const t=store.trust;if(!t)return;const prefix=t.complete?'':'≥ ';
 write('headlineHolders',prefix+fmt(t.holders));write('holderCount',prefix+fmt(t.holders));write('trustCount',prefix+fmt(t.trustlines));write('obligations',t.obligations===null?'Unavailable':prefix+fmt(t.obligations,3)+' JCS');write('topTenShare',percent(t.topTen)+(t.complete?'':' of sample'));
 const poolAccount=store.market?.amm?.account;const pool=poolAccount?t.balances.find(b=>b.account===poolAccount):null;
 write('poolShare',pool&&t.obligations>0?percent(pool.balance/t.obligations*100)+(t.complete?'':' of sample'):poolAccount&&t.complete&&t.obligations>0?'0%':'Unavailable');
 setStatus('holdersStatus',t.retained?'Retained · '+time(t.at):t.complete?'Complete scan · '+time(t.at):'Partial scan · '+time(t.at),t.retained?'retained':t.complete?'ok':'partial');
 write('holdersNote',(t.complete?'All returned JCS trust lines at ledger '+fmt(t.ledger)+'.':'Partial sample at ledger '+fmt(t.ledger)+'; totals are lower bounds and shares refer only to that sample.')+' Includes pool and service accounts. Amounts are rounded for display.');
 source('holders','JCS participation',t.retained?'Retained reading':t.complete?'Complete at this ledger':'Partial scan',fmt(t.pages)+' pages · ledger '+fmt(t.ledger),t.at,t.ledger,t.error);
}
function renderCommunity(){
 const c=store.community;if(!c)return;const n=c.counts,prefix=c.coverage.complete?'':'≥ ';
 write('headlinePosts',prefix+fmt(n.posts));write('headlineParticipants',prefix+fmt(n.participants));write('countAmens',prefix+fmt(n.amens));write('countReplies',prefix+fmt(n.replies));write('countSupport',prefix+fmt(n.support));write('proofRegistered',fmt(n.posts));write('proofLinked',fmt(n.nftLinkedPosts));
 const status=c.retained?'Retained':c.coverage.complete?'Scanned range complete':'Partial history';setStatus('communityStatus',status+' · '+time(c.at),c.retained?'retained':c.coverage.complete?'ok':'partial');
 source('community','Prayer registry',status,'Ledgers '+fmt(c.coverage.ledgerMin)+'–'+fmt(c.coverage.ledgerMax)+' · '+fmt(c.coverage.scanned)+' transactions scanned',c.at,c.coverage.ledger,c.error);
 renderResponseRate();renderChart();renderRecent();renderGroups();
 const eligible=c.posts.some(p=>p.nftId&&p.minttx&&p.contentHash);$('verifyMintsBtn').disabled=!eligible||store.checking;
 if(!eligible){write('proofVerified','No sample');write('proofNote','No records with complete NFT, mint and commitment references were found in this scan. Registrations are still shown above.');}
 $('downloadActivityBtn').disabled=false;
 updateHistoryControl();
}
function updateHistoryControl(){
 const waiting=Math.max(0,store.historyCooldownUntil-Date.now());
 const more=Boolean(store.historyCursor)&&store.historyPages<HISTORY_PAGE_CAP;
 $('moreHistoryBtn').disabled=!more||store.historyBusy||store.busy||waiting>0;
 write('moreHistoryBtn',store.historyBusy?'Reading…':'Load older records');
 write('historyPageNote',store.historyError
   ? (waiting>0?'Provider limit; wait about '+Math.ceil(waiting/1000)+' seconds before trying again. ': 'Older records unavailable; you can try again. ')+store.historyError
   : store.historyPages>=HISTORY_PAGE_CAP?'Ten-page scan limit reached; counts remain partial.'
   : more?'Showing '+store.historyPages+' page'+(store.historyPages===1?'':'s')+'. Load one older page when needed.'
   : store.community?'The returned history range is complete at its recorded snapshot.':'');
}
function renderResponseRate(){
 const c=store.community;if(!c)return;
 const aliases=new Map(c.posts.map(p=>[p.hash,p.hash]));for(const result of store.proofs.filter(p=>p.verified)){const p=c.posts.find(p=>p.minttx===result.minttx&&p.nftId===result.nftId);if(p){aliases.set(p.nftId,p.hash);aliases.set(p.minttx,p.hash);}}
 const matched=new Set(c.interactions.map(i=>aliases.get(i.parent)).filter(Boolean)),rate=c.counts.posts?matched.size/c.counts.posts*100:null;
 write('responseRate',percent(rate));$('responseBar').style.width=(rate??0)+'%';
 const unresolved=c.interactions.some(i=>i.parent&&!aliases.has(i.parent));document.querySelector('.response-meter small').textContent=unresolved?'Confirmed links in this scan only. Some NFT-referenced responses remain unmatched until their mint is checked.':'Share of scanned posts with a directly matched reply, Amen or support record.';
}
function chartRows(){
 const c=store.community;if(!c)return[];const earliest=c.coverage.earliestScannedDate?.slice(0,10),complete=c.coverage.complete;
 return c.dayBuckets.slice(-store.period).map(d=>({...d,responses:d.amens+d.replies+d.support,observed:Boolean(earliest&&d.day>earliest)}));
}
function renderChart(){
 const rows=chartRows();if(!rows.length)return;
 const known=rows.filter(d=>d.observed);write('periodPosts',known.length?fmt(known.reduce((s,d)=>s+d.posts,0)):'Unknown');write('periodResponses',known.length?fmt(known.reduce((s,d)=>s+d.responses,0)):'Unknown');
 write('activitySubtitle','Last '+store.period+' calendar days · UTC · publications and public responses');
 if(!known.length){$('activityChart').innerHTML='<p class="empty">This bounded scan does not establish a full day of coverage. No zero-activity line is inferred.</p>';}
 else{
 const w=680,h=194,l=32,r=10,t=14,b=29,max=Math.max(1,...known.flatMap(d=>[d.posts,d.responses])),x=i=>l+i/(rows.length-1)*(w-l-r),y=n=>t+(1-n/max)*(h-t-b);
 let paths='';for(const [key,cls]of[['posts','series-post'],['responses','series-response']]){let line='',open=false;rows.forEach((d,i)=>{if(!d.observed){open=false;return;}line+=(open?' L':' M')+x(i).toFixed(1)+' '+y(d[key]).toFixed(1);open=true;});paths+='<path class="'+cls+'" d="'+line+'"/>';}
 const grid=[0,max].map(v=>'<line class="grid-line" x1="'+l+'" x2="'+(w-r)+'" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="0" y="'+(y(v)+4)+'">'+fmt(v)+'</text>').join('');
 const unknown=rows.findIndex(d=>d.observed),shade=unknown>0?'<rect x="'+l+'" y="'+t+'" width="'+(x(unknown)-l)+'" height="'+(h-t-b)+'" fill="currentColor" opacity=".04"/>':'';
 $('activityChart').innerHTML='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Daily public activity. Gold publications, blue responses. Uncovered dates have no line."><title>Public activity by ledger date</title>'+shade+grid+paths+'<text x="'+l+'" y="'+(h-3)+'">'+rows[0].day+'</text><text x="'+(w-r)+'" y="'+(h-3)+'" text-anchor="end">'+rows.at(-1).day+'</text></svg>';
 }
 write('chartCaption','Dates before the first fully covered day are unknown and left blank. Zero within covered days means no recognized records.'+' Today is a partial day. This is not a visitor counter.');
 $('activityTable').innerHTML=rows.slice().reverse().map(d=>'<tr><th scope="row">'+d.day+'</th><td>'+ (d.observed?fmt(d.posts):'Unknown')+'</td><td>'+(d.observed?fmt(d.responses):'Unknown')+'</td></tr>').join('');
}
function renderRecent(){
 const all=store.community?.activity||[],filter=$('activityFilter').value,rows=all.filter(r=>filter==='all'||(filter==='post'?r.kind==='post':r.kind!=='post'));
 const labels={post:'Published prayer / testimony',amen:'Amen',reply:'Public reply',support:'Support response'};
 $('recentActivity').innerHTML=rows.length?rows.map(r=>'<div class="recent-record"><span>'+labels[r.kind]+'</span><a href="'+explorer(r.hash)+'" target="_blank" rel="noopener noreferrer">View record ↗</a><small>'+esc(stamp(r.created))+' · ledger '+fmt(r.ledgerIndex)+'</small></div>').join(''):'<p class="empty">No matching records in the latest 20 recognized public transactions.</p>';
}
function renderGroups(){
 const groups=store.community?.mapGroups||[];
 $('mapGroups').innerHTML=groups.length?groups.map(g=>'<div class="focus-group">'+esc(g.label.replaceAll('-',' '))+'<strong>'+fmt(g.count)+'+</strong><span class="sr-only"> public records; at least '+fmt(g.distinctAccounts)+' distinct wallets</span></div>').join(''):'<p class="empty">No public focus groups meet the release thresholds in this scan. Small groups remain undisclosed.</p>';
}
async function loadCommunity(snapshot,{append=false}={}){
 if(store.historyBusy||append&&(!store.historyCursor||!store.historySnapshot||store.historyPages>=HISTORY_PAGE_CAP||Date.now()<store.historyCooldownUntil))return;
 store.historyBusy=true;updateHistoryControl();
 if(!append)setStatus('communityStatus','Reading public history','');
 try{
 const pin=append?store.historySnapshot:snapshot;
 const scan=await client.scanHistory(pin,{maxPages:1,cursor:append?store.historyCursor:null});
 if(!Array.isArray(scan.entries))throw new Error(scan.error||'No history returned');
 const entries=append?[...store.historyEntries,...scan.entries]:scan.entries;
 const community=summarizeCommunity(entries,{complete:scan.complete,ledger:scan.ledger,ledgerMin:scan.ledgerMin,ledgerMax:scan.ledgerMax});
 store.historySnapshot=pin;store.historyEntries=entries;store.historyCursor=scan.cursor;store.historyPages=append?store.historyPages+scan.pages:scan.pages;
 store.historyError=scan.error||'';store.historyCooldownUntil=0;
 store.community={...community,at:new Date().toISOString(),error:scan.error||null,retained:false};
 store.lastHistory=Date.now();renderCommunity();
 }catch(e){
 store.lastHistory=Date.now();store.historyError=e.message;
 const match=/retry in\s*~?(\d+)\s*ms/i.exec(e.message);
 store.historyCooldownUntil=match?Date.now()+Math.min(60000,Number(match[1])):0;
 clearTimeout(historyCooldownTimer);
 if(store.historyCooldownUntil)historyCooldownTimer=setTimeout(updateHistoryControl,store.historyCooldownUntil-Date.now()+50);
 if(store.community){if(!append)store.community.retained=true;store.community.error=e.message;renderCommunity();}
 else{setStatus('communityStatus','History unavailable','error');source('community','Prayer registry','Unavailable','No history loaded',null,null,e.message);$('recentActivity').innerHTML='<p class="empty">Public history could not be loaded. Use Refresh to try again.</p>';}
 }finally{store.historyBusy=false;updateHistoryControl();}
}
async function loadHolders(snapshot){
 try{const scan=await client.scanLines(snapshot),t=summarizeLines(scan);if(!t)throw new Error(scan.error||'No trust-line response');store.trust=t;store.lastTrust=Date.now();renderTrust();}
 catch(e){store.lastTrust=Date.now();if(store.trust){store.trust.retained=true;store.trust.error=e.message;renderTrust();}else{setStatus('holdersStatus','Balances unavailable','error');source('holders','JCS participation','Unavailable','No balances loaded',null,null,e.message);}}
}
async function checkMints(){
 if(store.checking||!store.community)return;store.checking=true;$('verifyMintsBtn').disabled=true;const byNft=new Map();
 for(const p of store.community.posts.slice().sort((a,b)=>(b.ledgerIndex||0)-(a.ledgerIndex||0)))if(p.nftId&&p.minttx&&p.contentHash&&!byNft.has(p.nftId))byNft.set(p.nftId,p);
 const sample=[...byNft.values()].slice(0,8),results=[];
 try{for(let i=0;i<sample.length;i++){const p=sample[i],key=p.hash+':'+p.minttx;write('proofVerified',(i+1)+' / '+sample.length);write('proofNote','Checking a sample of up to eight recent unique NFT references against validated mint transactions…');let result=store.proofCache.get(key);if(!result){try{result=verifyPrayerMint(p,await client.rpc('tx',{transaction:p.minttx,binary:false}));}catch(e){result={verified:false,status:'unavailable',reason:e.message,minttx:p.minttx,nftId:p.nftId};}if(result.status!=='unavailable')store.proofCache.set(key,result);}results.push(result);}
 store.proofs=results;const passed=results.filter(r=>r.verified).length;write('proofVerified',sample.length?passed+' / '+sample.length:'No sample');write('proofNote',sample.length?passed+' of '+sample.length+' sampled unique references match their validated mint. This sample does not establish the total number of JCS prayer NFTs or whether they still exist.':'No complete mint references were found.');
 $('proofResults').innerHTML=results.map(r=>'<div><a href="'+explorer(r.minttx)+'" target="_blank" rel="noopener noreferrer">'+esc(r.minttx.slice(0,10))+'… ↗</a> · '+(r.verified?'Mint matched':r.status==='mismatch'?'Reference mismatch':'Check unavailable')+'<br>'+esc(r.reason)+'</div>').join('');renderResponseRate();
 source('proofs','Prayer NFT mint sample',sample.length?'Checked '+results.length+' references':'No eligible references',passed+' matched · sample only',new Date().toISOString(),store.community.coverage.ledger);
 }finally{store.checking=false;$('verifyMintsBtn').disabled=!sample.length;}
}
async function loadProject(){
 try{const r=await fetch('./data/jcs-metrics-project.json',{cache:'no-cache'});if(!r.ok)throw new Error('Coverage manifest unavailable');const d=await r.json();if(d.schema!=='jcs-observatory-project-coverage-v1')throw new Error('Unknown project coverage format');store.project=d;
 write('headlineAccounts',fmt(d.counts.historicalAccounts));write('coverageEvents',fmt(d.counts.historicalAccounts));write('coverageUcdp',fmt(d.counts.modernConflictRecords));write('coveragePolities',fmt(d.counts.polityAreaRecords));write('coverageCities',fmt(d.counts.cityNameRecords));
 write('coverageNote','Catalogue snapshot '+d.generatedAt+' · UCDP source coverage '+d.modernSource.range.join('–')+'. Counts are records, not unique places or people.');
 $('coverageSources').innerHTML=d.sources.filter(s=>/^https:\/\//.test(s.url)).map(s=>'<a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.name)+' ↗</a>').join('');
 source('project','Map project catalogue','Published snapshot','Map commit '+d.sourceCommit.slice(0,7)+' · '+d.generatedAt);}
 catch(e){write('coverageNote','Project coverage could not be loaded. The interactive map remains available.');source('project','Map project catalogue','Unavailable','Manifest not loaded',null,null,e.message);}
}
function updateAuto(){write('autoBtn',store.auto?'Live updates on':'Live updates paused');$('autoBtn').setAttribute('aria-pressed',String(store.auto));}
async function refresh(manual=false){
 if(store.busy)return;store.busy=true;$('refreshBtn').disabled=true;write('refreshBtn','Refreshing…');const now=Date.now();
 try{
 const snapshot=await client.snapshot();store.lastCore=Date.now();
 if(!snapshot.ledger){store.auto=false;updateAuto();const why=snapshot.errors.ledger||snapshot.errors.server||'Validated data unavailable';markRetained(why);write('refreshNote','Public ledger data is unavailable. Live updates paused; use Refresh when ready.');setStatus('ledgerStatus','No fresh ledger','error');source('ledger','XRPL ledger',store.snapshot?'Retained · source unavailable':'Unavailable',store.snapshot?'Last successful ledger '+fmt(store.snapshot.ledger.index):'No validated snapshot',store.snapshot?.at,store.snapshot?.ledger.index,why);return;}
 renderSnapshot(snapshot);
 const tasks=[];if((manual||!store.lastHistory)&&now>=store.historyCooldownUntil)tasks.push(loadCommunity(snapshot));if(manual||!store.lastTrust||now-store.lastTrust>300000)tasks.push(loadHolders(snapshot));await Promise.allSettled(tasks);
 const errors=Object.keys(snapshot.errors).filter(k=>k!=='subscription');write('refreshNote',errors.length?'Snapshot loaded with '+errors.length+' unavailable source'+(errors.length===1?'':'s')+'. See Sources, freshness & coverage below.':'Updated '+time(snapshot.at)+' · read-only Mainnet data · history and balances carry their own ledger references.');
 if(store.account&&(manual||$('walletResults').hidden))await loadWallet();
 }catch(e){store.auto=false;updateAuto();write('refreshNote','Refresh stopped: '+e.message+'. Existing readings are retained.');}
 finally{store.busy=false;$('refreshBtn').disabled=false;write('refreshBtn','Refresh');updateHistoryControl();}
}
function buildSnapshot(){
 const c=store.community,t=store.trust,m=store.market;
 return {schema:'jcs-observatory-snapshot-v2',generated_at_utc:new Date().toISOString(),network:'XRPL Mainnet',issuer:ISSUER,sources:store.sources,
 ledger:store.snapshot?.ledger||null,community:c?{counts:c.counts,coverage:c.coverage,protocols:c.perProtocol,activity:c.activity,qualifiedMapGroups:c.mapGroups,retained:Boolean(c.retained)}:null,
 mintEvidence:{scope:'At most eight recent unique referenced NFTs; not a global issuance total',results:store.proofs},
 participation:t?{trustlines:t.trustlines,positiveBalanceAccounts:t.holders,obligations:t.obligations,topTenSharePercent:t.topTen,complete:t.complete,ledger:t.ledger,at:t.at,retained:Boolean(t.retained)}:null,
 market:m?{amm:m.amm,bids:m.bid?{best:m.bid.best,jcsDepth:m.bid.jcs,offers:m.bid.offerCount}:null,asks:m.ask?{best:m.ask.best,jcsDepth:m.ask.jcs,offers:m.ask.offerCount}:null}:null,
 capabilities:features.map(f=>({name:f.name,id:f.id,enabled:Array.isArray(store.parts.amendments?.value?.node?.Amendments)?store.parts.amendments.value.node.Amendments.includes(f.id):null})),
 project:store.project,privacy:{connected_wallet_exported:false,private_contents_read:false,public_map_counts_rounded_down_to:5},limitations:['Wallets are not people; registrations are not verified NFT mints.','Source range, incomplete scans and retained readings are recorded separately.','Token quantities use rounded floating-point display calculations, not settlement amounts.','Historical coverage and scriptural imagery are not blockchain evidence or a claim of historical causation.']};
}
function download(name,value,type){const url=URL.createObjectURL(new Blob([value],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportSnapshot(){try{const snapshot=buildSnapshot(),text=JSON.stringify(snapshot),digest=globalThis.crypto?.subtle?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join(''):null;download('jcs-observatory-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({snapshot,integrity:{algorithm:'SHA-256',serialization:'UTF-8 JSON.stringify(snapshot), no trailing newline',digest}},null,2)+'\n','application/json');write('exportStatus','Snapshot downloaded.'+(digest?' SHA-256: '+digest:' Digest unavailable in this browser.'));}catch(e){write('exportStatus','Download unavailable: '+e.message);}}
async function copy(text){if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);return;}const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.opacity='0';document.body.append(t);t.select();const ok=document.execCommand('copy');t.remove();if(!ok)throw new Error('Select and copy the text manually.');}
function toast(text){write('toast',text);$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{$('toast').hidden=true;},3500);}
async function loadWallet(){
 if(!store.account||!store.snapshot?.ledger||store.walletBusy)return;store.walletBusy=true;const account=store.account,epoch=store.walletEpoch;write('walletStatus','Reading JCS balances and NFT category candidates…');
 try{const r=await client.wallet(account,store.snapshot);if(epoch!==store.walletEpoch||account!==store.account)return;const n=classifyWalletNfts(r.nfts),line=r.lines?.find(l=>tokenCurrency(l.currency)&&l.account===ISSUER);const balance=Array.isArray(r.lines)?line?fmt(line.balance,6)+' JCS':'No JCS trust line':'Unavailable';
 $('walletResults').innerHTML=[['JCS balance',balance],['Prayer NFT candidates',Array.isArray(r.nfts)?(r.nftsComplete?'':'≥ ')+fmt(n.counts.prayerCandidates):'Unavailable'],['Capsule receipt candidates',Array.isArray(r.nfts)?(r.nftsComplete?'':'≥ ')+fmt(n.counts.capsuleCandidates):'Unavailable'],['Trade / LP receipt candidates',Array.isArray(r.nfts)?(r.nftsComplete?'':'≥ ')+fmt(n.counts.receiptCandidates):'Unavailable']].map(([label,value])=>'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');$('walletResults').hidden=false;write('walletStatus',(r.complete?'Account scan complete':'Partial or unavailable account data')+' · ledger '+fmt(r.ledger)+'. '+fmt(n.counts.taxonOnly)+' taxon-only matches are unverified and excluded from the category counts.');}
 catch(e){if(epoch===store.walletEpoch)write('walletStatus','Wallet data unavailable: '+e.message);}
 finally{store.walletBusy=false;if(store.account&&account!==store.account)loadWallet();}
}
function updateWallet(){const connected=Boolean(store.account);$('connectBtn').hidden=connected;$('disconnectBtn').hidden=!connected;write('walletPill',connected?store.account.slice(0,7)+'…'+store.account.slice(-7):'Wallet disconnected');if(!connected){$('walletResults').hidden=true;$('walletResults').replaceChildren();write('walletStatus','Wallet disconnected. Public metrics work without connecting.');}}
function initXaman(){
 if(!window.Xumm){$('connectBtn').disabled=true;$('connectBtn').title='Xaman authorization library unavailable; public data remains available.';return;}
 try{store.xaman=new window.Xumm('5b8499a9-ae28-4050-ac09-45efa948eced');const identified=async event=>{const epoch=store.walletEpoch;try{const d=event?.data||event||{},account=d.account||d.me?.account||await store.xaman.user.account;if(epoch!==store.walletEpoch||!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account||''))return;if(store.account!==account)store.walletEpoch++;store.account=account;updateWallet();loadWallet();}catch{write('walletStatus','Could not read the authorized public account.');}};
 store.xaman.on('ready',()=>{$('connectBtn').disabled=false;});store.xaman.on('success',identified);store.xaman.on('retrieved',identified);store.xaman.on('logout',()=>{store.walletEpoch++;store.account='';updateWallet();});store.xaman.on('error',()=>write('walletStatus','Xaman connection unavailable. Public metrics still work.'));
 $('connectBtn').addEventListener('click',async()=>{try{await store.xaman.authorize();await identified();$('personal-footprint').open=true;}catch{write('walletStatus','Connection cancelled or unavailable.');}});
 $('disconnectBtn').addEventListener('click',async()=>{store.walletEpoch++;store.account='';updateWallet();try{await store.xaman.logout();}catch{}});
 }catch{write('walletStatus','Xaman is unavailable. Public metrics still work.');}
}
function initHeader(){
 const header=document.querySelector('.jcs-index-header'),toggle=$('mobileNavToggle'),nav=$('primaryNav'),media=matchMedia('(max-width:980px)');const setOpen=open=>{const next=Boolean(open&&media.matches);nav.classList.toggle('is-open',next);header.classList.toggle('menu-open',next);toggle.setAttribute('aria-expanded',String(next));toggle.querySelector('.menu-label').textContent=next?'Close':'Menu';};toggle.addEventListener('click',()=>setOpen(toggle.getAttribute('aria-expanded')!=='true'));nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});media.addEventListener?.('change',()=>setOpen(false));setOpen(false);
 const theme=()=>{const dark=document.documentElement.dataset.theme!=='light';write('themeToggleText',dark?'Light mode':'Dark mode');write('themeToggleIcon',dark?'☀':'◐');$('themeToggle').setAttribute('aria-pressed',String(dark));$('themeToggle').setAttribute('aria-label',dark?'Switch to light mode':'Switch to dark mode');};$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('jcs-ledger-theme',next);}catch{}theme();});theme();
 const mode=value=>{document.body.classList.toggle('metrics-sanctuary-mode',value==='sanctuary');document.body.classList.toggle('metrics-ledger-focus',value==='ledger');$('quietModeBtn').setAttribute('aria-pressed',String(value==='sanctuary'));$('ledgerFocusBtn').setAttribute('aria-pressed',String(value==='ledger'));write('quietModeBtn',value==='sanctuary'?'Show all sections':'Sanctuary mode');write('ledgerFocusBtn',value==='ledger'?'Show all sections':'Ledger focus');try{localStorage.setItem('jcs.metrics.focus.v1',value);}catch{}};
 $('quietModeBtn').addEventListener('click',()=>mode(document.body.classList.contains('metrics-sanctuary-mode')?'full':'sanctuary'));$('ledgerFocusBtn').addEventListener('click',()=>mode(document.body.classList.contains('metrics-ledger-focus')?'full':'ledger'));try{mode(localStorage.getItem('jcs.metrics.focus.v1')||'full');}catch{mode('full');}
}
initHeader();initXaman();updateWallet();renderFeatures();
$('refreshBtn').addEventListener('click',()=>refresh(true));$('autoBtn').addEventListener('click',()=>{store.auto=!store.auto;updateAuto();if(store.auto)refresh(false);});
$('moreHistoryBtn').addEventListener('click',()=>loadCommunity(store.historySnapshot,{append:true}));
for(const button of document.querySelectorAll('[data-period]'))button.addEventListener('click',()=>{store.period=Number(button.dataset.period);for(const b of document.querySelectorAll('[data-period]'))b.setAttribute('aria-pressed',String(b===button));renderChart();});
$('activityFilter').addEventListener('change',renderRecent);$('verifyMintsBtn').addEventListener('click',checkMints);$('downloadSnapshotBtn').addEventListener('click',exportSnapshot);
$('downloadActivityBtn').addEventListener('click',()=>{const rows=chartRows();download('jcs-public-activity-'+store.period+'-days.csv','date_utc,publications,responses,coverage\r\n'+rows.map(r=>[r.day,r.observed?r.posts:'',r.observed?r.responses:'',r.observed?'observed':'unknown'].join(',')).join('\r\n')+'\r\n','text/csv;charset=utf-8');});
$('copyIssuer').addEventListener('click',async()=>{try{await copy(ISSUER);toast('Official JCS issuer copied.');}catch(e){toast(e.message);}});
$('copySummaryBtn').addEventListener('click',async()=>{const c=store.community,t=store.trust;const text=['JCS Observatory','Read at: '+new Date().toISOString(),'Ledger: '+fmt(store.snapshot?.ledger?.index),'Public records in scanned range: '+fmt(c?.counts.posts),'Participating wallets: '+fmt(c?.counts.participants),'History coverage: '+(c?(c.coverage.complete?'provider range exhausted':'partial sample'):'unavailable'),'Positive JCS accounts: '+fmt(t?.holders)+(t&&!t.complete?' (lower bound)':''),'Mint sample: '+store.proofs.filter(p=>p.verified).length+' / '+store.proofs.length+' matched','Historical accounts in project dataset: '+fmt(store.project?.counts.historicalAccounts),'Sources: '+Object.values(store.sources).map(s=>s.label+' — '+s.state).join('; '),'https://jesuschristsavestoken.com/metrics.html'].join('\n');try{await copy(text);write('exportStatus','Plain-language summary copied.');}catch(e){write('exportStatus',e.message);}});
loadProject();refresh(false);
let timer=setInterval(()=>{if(store.auto&&!store.busy&&!store.historyBusy&&document.visibilityState==='visible'&&Date.now()-store.lastCore>=60000)refresh(false);},15000);
let mapChannel;try{mapChannel=new BroadcastChannel('jcs-prayer-map');mapChannel.onmessage=e=>{if(e.data?.type==='jcs-prayer-map-signal'&&e.data?.signal?.schema==='jcs-prayer-map-refresh-v1')store.lastHistory=0;};}catch{}
window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(historyCooldownTimer);client.close();mapChannel?.close();});
window.addEventListener('pageshow',e=>{if(e.persisted){client=new LedgerClient(clientCallbacks);store.auto=false;updateAuto();markRetained('Page restored from browser memory.');write('refreshNote','Readings restored from browser memory. Use Refresh or turn on live updates for fresh data.');timer=setInterval(()=>{if(store.auto&&!store.busy&&!store.historyBusy&&document.visibilityState==='visible'&&Date.now()-store.lastCore>=60000)refresh(false);},15000);}});
