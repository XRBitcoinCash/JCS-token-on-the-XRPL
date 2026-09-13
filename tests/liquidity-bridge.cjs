const fs=require('fs'),assert=require('assert/strict');const {JSDOM}=require('jsdom');
const src=fs.readFileSync(require('path').resolve(__dirname, '../js/jcs-core.js'),'utf8');
const waitCode=src.slice(src.indexOf('  async function waitForQuickBuyValidation('),src.indexOf('  async function quickBuy('));
const bridge=src.slice(src.indexOf('  let liquiditySigning = false;'),src.indexOf('  let refreshing = false;'));
const hash='B'.repeat(64),issuer='rIssuerTest',acct='rWalletTest';
function fixture(){const dom=new JSDOM('',{url:'https://jesuschristsavestoken.com/',runScripts:'outside-only'}),w=dom.window;
 const state={receipt:null,requests:0,signed:0,race:false};w.__state=state;w.setTimeout=fn=>{queueMicrotask(fn);return 1};w.clearTimeout=()=>{};
 w.eval(`(()=>{let currentAccount='${acct}';const CURRENCY_HEX='JCS',ISSUER='${issuer}',state=window.__state;
 const xrplRequest=async q=>{state.requests++;return {result:state.receipt};};
 const getLedgerSummary=async()=>{if(state.race)currentAccount='rChanged';return {validated:true,index:100000001};};
 const refreshAll=async()=>{};const signWithSentinel=async()=>{state.signed++;return {txid:'${hash}'};};
 ${waitCode}
 ${bridge}
 window.__testWait=waitForQuickBuyValidation;
 })();`);
 return{dom,w,state};}
const tx={TransactionType:'AMMDeposit',Account:acct,Asset:{currency:'XRP'},Asset2:{currency:'JCS',issuer},Flags:1048576,Amount:'400000',Amount2:{currency:'JCS',issuer,value:'10000'},Fee:'12',LastLedgerSequence:100000021};
function receipt(o={}){return {...tx,hash,validated:true,ledger_index:100000004,meta:{TransactionResult:'tesSUCCESS'},...o};}
(async()=>{let checks=0,f;
 f=fixture();f.state.receipt=receipt({Amount2:{...tx.Amount2,value:'1e4'},Flags:2148532224});let r=await f.w.JCSWallet.submitLiquidity(tx);assert.equal(r.validated,true);assert.equal(r.txid,hash);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt({Amount:'400001'});await assert.rejects(f.w.JCSWallet.submitLiquidity(tx),/differs/);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt({Account:'rWrongAccount'});await assert.rejects(f.w.JCSWallet.submitLiquidity(tx),/differs/);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt({meta:{TransactionResult:'tecUNFUNDED_AMM'}});await assert.rejects(f.w.JCSWallet.submitLiquidity(tx),/did not succeed/);assert.equal(f.state.requests,1);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt({validated:false});await assert.rejects(f.w.JCSWallet.submitLiquidity(tx));assert.equal(f.state.requests,36);f.dom.window.close();checks++;
 f=fixture();f.state.race=true;f.state.receipt=receipt();await assert.rejects(f.w.JCSWallet.submitLiquidity(tx),/wallet changed/);assert.equal(f.state.signed,0);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt();await assert.rejects(f.w.JCSWallet.submitLiquidity({...tx,Destination:'rBad'}),/Unexpected/);assert.equal(f.state.signed,0);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt();await assert.rejects(f.w.JCSWallet.submitLiquidity({...tx,Fee:'10001'}),/bounded fee/);assert.equal(f.state.signed,0);f.dom.window.close();checks++;
 f=fixture();f.state.receipt=receipt({hash:'C'.repeat(64)});await assert.rejects(f.w.JCSWallet.submitLiquidity(tx),/could not be matched/i);f.dom.window.close();checks++;
 console.log('Liquidity core bridge PASS:',checks,'cases: decimal/global flag equivalence, wrong amounts/account rejected, validated tec failure, unvalidated timeout, account race, unexpected fields, fee cap.');
})().catch(e=>{console.error(e);process.exitCode=1;});
