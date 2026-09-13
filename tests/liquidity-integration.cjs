const fs = require('fs'), assert = require('assert/strict');
const { JSDOM } = require('jsdom');
const root = require('path').resolve(__dirname, '..');
const source = fs.readFileSync(root + '/js/jcs-liquidity.js', 'utf8');
const issuer = 'rPU6sXCNzsjcTUEmgJQ5SxDUzY2y1RyYKd', account = 'rWalletTest', poolAccount='rPoolTest', lpCurrency='03'+'A'.repeat(38);
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
async function fixture(overrides={}) {
 const dom = new JSDOM('<section id="trade"></section><script id="app-config" type="application/json">'+JSON.stringify({asset:{issuer,currencyHex:'JCS'}})+'</script>',{url:'https://jesuschristsavestoken.com/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;let now=Date.now();w.Date.now=()=>now;w.setInterval=()=>1;
 const state={account,poolGone:false,jcs:'10000000',xrp:'400000000',walletXrp:'100000000',walletJcs:'20000',lp:'100',frozen:false,issuerFlags:0,validated:true,...overrides};
 const submitted=[],requests=[];
 w.JCSWallet={getAccount:()=>state.account,request:async q=>{requests.push(q);if(state.requestGate){const gate=state.requestGate;delete state.requestGate;await gate;}const p=q.params[0];let result={validated:state.validated,ledger_index:100000001};switch(q.method){
 case 'ledger':break;
 case 'amm_info':if(state.poolGone)throw new Error('AMM not found');result.amm={account:poolAccount,amount:state.xrp,amount2:{currency:'JCS',issuer,value:state.jcs},lp_token:{currency:lpCurrency,issuer:poolAccount,value:'10000'}};break;
 case 'account_info':result.account_data={Account:p.account,Balance:state.walletXrp,OwnerCount:3,Flags:p.account===issuer?state.issuerFlags:0};break;
 case 'account_lines':result.lines=p.peer===issuer?[{account:issuer,currency:'JCS',balance:state.walletJcs,limit:'21000000',freeze_peer:state.frozen}]:[{account:poolAccount,currency:lpCurrency,balance:state.lp,limit:'0'}];break;
 case 'server_state':result.state={validated_ledger:{seq:100000001,reserve_base:1000000,reserve_inc:200000}};break;
 case 'fee':result.drops={open_ledger_fee:'12'};break;
 default:throw new Error('Unexpected request '+q.method);
 }return {result};},submitLiquidity:async tx=>{submitted.push(JSON.parse(JSON.stringify(tx)));if(state.afterSubmit)state.afterSubmit();return {txid:'B'.repeat(64),validated:true};}};
 w.eval(source);
 const click=id=>d.getElementById(id).click();
 const value=(id,v)=>{const el=d.getElementById(id);el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const mode=name=>{const el=d.getElementById('jcsLiquidityAction');el.value=name;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const prepare=async()=>{click('jcsLiquidityPreview');await flush();};
 const sign=async()=>{const box=d.getElementById('jcsLiquidityAccept');box.checked=true;box.dispatchEvent(new w.Event('change'));click('jcsLiquiditySign');await flush();};
 return {dom,w,d,state,submitted,requests,click,value,mode,prepare,sign,status:()=>d.getElementById('jcsLiquidityStatus').textContent,advance:ms=>{now+=ms;}};
}
async function run(){let checks=0;
 let f=await fixture();f.value('jcsDepositXrp','.4');await f.prepare();assert.match(f.status(),/valid|six decimal/i);f.value('jcsDepositXrp','0.4');await f.prepare();await f.sign();assert.equal(f.submitted.length,1);assert.equal(f.submitted[0].Amount,'400000');assert.equal(f.submitted[0].Amount2.value,'10000');assert.equal(f.submitted[0].Account,account);assert.equal(f.submitted[0].Flags,1048576);assert.match(f.status(),/Confirmed/);assert(f.requests.filter(q=>['server_state','fee'].includes(q.method)).every(q=>q.params[0].ledger_index==='current'));f.dom.window.close();checks++;
 f=await fixture();f.mode('withdraw');f.value('jcsWithdrawPercent','100');await f.prepare();f.state.afterSubmit=()=>f.state.poolGone=true;await f.sign();assert.equal(f.submitted[0].LPTokenIn.value,'100');assert.equal(f.submitted[0].Flags,65536);assert.match(f.status(),/Confirmed/);assert(f.d.querySelector('#jcsLiquidityStatus a'));f.dom.window.close();checks++;
 for(const [overrides,pattern] of [[{walletXrp:'1900000'},/spendable XRP/],[{walletJcs:'100'},/your wallet has/],[{frozen:true},/frozen/],[{issuerFlags:0x00400000},/globally frozen/],[{validated:false},/could not verify/]]){f=await fixture(overrides);f.value('jcsDepositXrp','0.4');await f.prepare();assert.match(f.status(),pattern);assert.equal(f.submitted.length,0);assert(f.d.getElementById('jcsLiquidityReview').hidden);f.dom.window.close();checks++;}
 f=await fixture();f.value('jcsDepositXrp','0.4');await f.prepare();f.advance(61000);await f.sign();assert.match(f.status(),/expired/);assert.equal(f.submitted.length,0);f.dom.window.close();checks++;
 f=await fixture();f.value('jcsDepositXrp','0.4');await f.prepare();f.state.jcs='11000000';await f.sign();assert.match(f.status(),/changed by more than 1%/);assert.equal(f.submitted.length,0);f.dom.window.close();checks++;
 f=await fixture();f.value('jcsDepositXrp','0.4');await f.prepare();f.state.account='rDifferentWallet';await f.sign();assert.match(f.status(),/wallet or review changed/);assert.equal(f.submitted.length,0);f.dom.window.close();checks++;
 f=await fixture();f.value('jcsDepositXrp','0.4');await f.prepare();f.value('jcsDepositXrp','0.5');await f.sign();assert.equal(f.submitted.length,0);assert(f.d.getElementById('jcsLiquidityReview').hidden);f.dom.window.close();checks++;
 f=await fixture();f.value('jcsDepositXrp','0.4');await f.prepare();f.state.afterSubmit=()=>{const err=new Error('pending');err.unconfirmed=true;err.txid='B'.repeat(64);throw err;};await f.sign();assert.match(f.status(),/Submitted|submitted/);assert.match(f.status(),/unavailable|unconfirmed|not available/i);assert(f.d.querySelector('#jcsLiquidityStatus a'));f.dom.window.close();checks++;
 f=await fixture();f.value('jcsDepositXrp','0.4');let release;f.state.requestGate=new Promise(r=>{release=r;});f.click('jcsLiquidityPreview');f.value('jcsDepositXrp','0.5');release();await flush();assert(f.d.getElementById('jcsLiquidityReview').hidden);assert.equal(f.submitted.length,0);f.dom.window.close();checks++;
 f=await fixture();f.click('jcsTabLiquidity');await flush();f.value('jcsDepositXrp','0.4');assert.equal(f.d.getElementById('jcsDepositJcs').value,'10000');f.value('jcsDepositJcs','5000');await f.prepare();await f.sign();assert.equal(f.submitted[0].Amount2.value,'5000');assert.equal(f.submitted[0].Amount,'400000');assert.equal(f.submitted[0].Flags,1048576);f.dom.window.close();checks++;
 f=await fixture();f.click('jcsTabLiquidity');await flush();f.value('jcsDepositXrp','0.4');f.value('jcsDepositJcs','5000');f.click('jcsMatchDeposit');assert.equal(f.d.getElementById('jcsDepositJcs').value,'10000');await f.prepare();f.value('jcsDepositJcs','6000');await f.sign();assert.equal(f.submitted.length,0);assert(f.d.getElementById('jcsLiquidityReview').hidden);f.dom.window.close();checks++;
 f=await fixture();f.click('jcsTabLiquidity');await flush();f.d.querySelector('[data-deposit-percent="100"]').click();assert.equal(f.d.getElementById('jcsDepositXrp').value,'0.8');assert.equal(f.d.getElementById('jcsDepositJcs').value,'20000');assert.match(f.d.getElementById('jcsLiquidityDetails').textContent,/Network fee/);assert.match(f.d.getElementById('jcsPoolShare').textContent,/1%/);await f.prepare();await f.sign();assert.equal(f.submitted[0].Amount,'800000');f.dom.window.close();checks++;
 f=await fixture({walletJcs:'100000000'});f.click('jcsTabLiquidity');await flush();f.d.querySelector('[data-deposit-percent="100"]').click();assert.equal(f.d.getElementById('jcsDepositXrp').value,'97.399988');await f.prepare();await f.sign();assert.equal(f.submitted[0].Amount,'97399988');f.dom.window.close();checks++;
 f=await fixture();f.click('jcsTabLiquidity');await flush();f.click('jcsActionWithdraw');assert.equal(f.d.getElementById('jcsActionWithdraw').getAttribute('aria-pressed'),'true');assert.equal(f.d.getElementById('jcsWithdrawInput').hidden,false);assert.match(f.d.getElementById('jcsLiquidityEstimate').textContent,/Estimated XRP returned/);f.state.account=null;f.d.dispatchEvent(new f.w.Event('jcs:wallet-changed'));await flush();assert.equal(f.d.getElementById('jcsWalletLP').textContent,'—');assert.equal(f.d.getElementById('jcsPoolShare').textContent,'—');f.dom.window.close();checks++;
 console.log('Liquidity integration PASS:',checks,'cases: completed deposit/withdraw, post-validation pool deletion, reserve/balance/freeze/validation guards, expiry, drift, account switch and input mutation.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
