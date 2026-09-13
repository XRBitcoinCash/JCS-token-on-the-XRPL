/* JCS market comparison: observed session samples, never simulated history. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const INTERVAL = 60000;
  const MAX_AGE = 180000;
  const series = [];
  let latest = null, usd = null, usdTask = null, usdAttempt = 0, supplyAt = 0, supply = null, supplyBusy = false;
  const number = v => Number.isFinite(Number(v)) && Number(v) > 0;
  const fmt = (v, digits = 8) => Number(v).toLocaleString(undefined, { maximumSignificantDigits: digits });
  const stamp = t => new Date(t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
  const set = (id, value) => { if ($(id)) $(id).textContent = value; };
  const svgNode = (name, attrs = {}, label) => {
    const n = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k, String(v)));
    if (label != null) n.textContent = label;
    return n;
  };
  function recentUsd() {
    return usd && number(usd.xrp) && number(usd.rlusd) && Date.now()-usd.observedAt < MAX_AGE &&
      Date.now()-usd.providerAt < MAX_AGE && Date.now()-usd.providerAt > -60000;
  }
  async function prices() {
    if (usdTask) return usdTask;
    if (Date.now()-usdAttempt < INTERVAL) return usd;
    usdAttempt = Date.now();
    usdTask = (async () => {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple-usd,ripple&vs_currencies=usd&include_last_updated_at=true', {credentials:'omit', signal:controller.signal});
        if (!response.ok) throw new Error('Reference prices unavailable');
        const data = await response.json();
        if (!number(data.ripple?.usd) || !number(data['ripple-usd']?.usd) || !number(data.ripple?.last_updated_at) || !number(data['ripple-usd']?.last_updated_at)) throw new Error('Incomplete reference prices');
        const providerAt = Math.min(data.ripple.last_updated_at, data['ripple-usd'].last_updated_at)*1000;
        if (Date.now()-providerAt >= MAX_AGE || providerAt-Date.now() > 60000) throw new Error('Reference prices are stale');
        usd = {xrp:Number(data.ripple.usd), rlusd:Number(data['ripple-usd'].usd), observedAt:Date.now(), providerAt, provider:'CoinGecko'};
      } catch {
        // Public spot-price fallback; preserve provenance rather than mixing providers.
        try {
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10000);
          try {
            const values = await Promise.all(['XRP','RLUSD'].map(async asset => {
              const r = await fetch(`https://api.coinbase.com/v2/prices/${asset}-USD/spot`, {credentials:'omit', signal:fallbackController.signal});
              if (!r.ok) throw new Error('Reference unavailable');
              const body = await r.json();
              if (body.data?.currency !== 'USD' || !number(body.data?.amount)) throw new Error('Invalid reference');
              return Number(body.data.amount);
            }));
            usd = {xrp:values[0], rlusd:values[1], observedAt:Date.now(), providerAt:Date.now(), provider:'Coinbase spot (observed)'};
          } finally { clearTimeout(fallbackTimeout); }
        } catch { /* Native XRPL evidence remains available without a USD reference. */ }
      }
      finally { clearTimeout(timeout); usdTask = null; }
      return usd;
    })();
    return usdTask;
  }
  async function readSupply() {
    if (supplyBusy || Date.now()-supplyAt < INTERVAL || !window.__jcsXrplRequest) return;
    supplyBusy = true; supplyAt = Date.now();
    try {
      const config = JSON.parse($('app-config').textContent).asset;
      const r = await window.__jcsXrplRequest({method:'gateway_balances', params:[{account:config.issuer, strict:true, ledger_index:'validated'}]});
      if (r?.result?.validated !== true) throw new Error('Supply read not validated');
      const raw = r?.result?.obligations?.[config.currencyHex];
      if (raw == null || !Number.isFinite(Number(raw)) || Number(raw)<0) throw new Error('Supply unavailable');
      supply = Number(raw);
      set('jcsProjectSupply', fmt(supply) + ' JCS');
    } catch { supply = null; set('jcsProjectSupply', 'Unavailable'); }
    finally { supplyBusy = false; }
  }
  function chartStatus(message) { set('jcsChartStatus', message); }
  function renderChart() {
    const host = $('jcsComparisonChart');
    if (!host) return;
    host.replaceChildren();
    host.classList.toggle('has-live-data', series.length > 0);
    host.dataset.observations = String(series.length);
    if (series.length < 2) {
      const message = document.createElement('p');
      message.className = 'comparison-empty';
      message.textContent = series.length ? 'First observation recorded. The comparison appears after the next 60-second update.' : 'Waiting for current JCS, XRP and RLUSD prices. The chart starts with this visit.';
      host.append(message);
      return;
    }
    const W=500,H=245,L=54,R=13,T=17,B=36, start=series[0], end=series.at(-1);
    const keys = [['jcs','JCS','#dfc180'],['xrp','XRP','#8cbae0'],['rlusd','RLUSD','#86d7c2']];
    const percentages = series.flatMap(s=>keys.map(([key])=>(s[key]/start[key]-1)*100));
    let min = Math.min(0,...percentages), max = Math.max(0,...percentages);
    const pad = Math.max((max-min)*.15,.02); min-=pad; max+=pad;
    const x = s=>L+(s.at-start.at)/(end.at-start.at)*(W-L-R);
    const y = p=>T+(max-p)/(max-min)*(H-T-B);
    const svg = svgNode('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Percentage price change since the first observation this visit: JCS, XRP and RLUSD in US dollars.'});
    for(let i=0;i<4;i++) {
      const p=min+(max-min)*i/3, py=y(p);
      svg.append(svgNode('line',{x1:L,x2:W-R,y1:py,y2:py,stroke:'currentColor',opacity:'.12'}));
      svg.append(svgNode('text',{x:L-8,y:py+4,'text-anchor':'end',fill:'currentColor','font-size':11},`${p>0?'+':''}${p.toFixed(2)}%`));
    }
    keys.forEach(([key,label,color])=>{
      // A gap over two refresh cycles is a break, not invented continuity.
      let d='';
      series.forEach((s,i)=>{d+=(i && s.at-series[i-1].at<=150000?' L':' M')+x(s).toFixed(2)+' '+y((s[key]/start[key]-1)*100).toFixed(2);});
      const path=svgNode('path',{d,fill:'none',stroke:color,'stroke-width':2.5,'stroke-linejoin':'round'});
      path.append(svgNode('title',{},`${label}: ${((end[key]/start[key]-1)*100).toFixed(3)}% this visit`));svg.append(path);
      svg.append(svgNode('circle',{cx:x(end),cy:y((end[key]/start[key]-1)*100),r:3,fill:color}));
    });
    svg.append(svgNode('text',{x:L,y:H-9,fill:'currentColor','font-size':11},stamp(start.at)));
    svg.append(svgNode('text',{x:W-R,y:H-9,'text-anchor':'end',fill:'currentColor','font-size':11},stamp(end.at)));
    host.append(svg);
    const label=document.createElement('label'); label.htmlFor='comparisonObservation';label.className='comparison-inspector-label';label.textContent='Inspect an observation';
    const slider=document.createElement('input');slider.type='range';slider.id='comparisonObservation';slider.min='0';slider.max=String(series.length-1);slider.value=slider.max;slider.step='1';
    const out=document.createElement('output');out.setAttribute('for',slider.id);out.className='comparison-observation';
    const inspect=()=>{const s=series[Number(slider.value)];out.textContent=`${stamp(s.at)} · JCS ${fmt(s.jcs)} · XRP ${fmt(s.xrp,6)} · RLUSD ${fmt(s.rlusd,6)}`;slider.setAttribute('aria-valuetext',out.textContent);};
    slider.addEventListener('input',inspect);inspect();host.append(label,slider,out);
  }
  async function onSnapshot(event) {
    const s=event.detail;
    if (!s?.validated || !number(s.priceXrpPerJcs) || !Number.isInteger(Number(s.ledgerIndex)) || Number(s.ledgerIndex)<=0) return;
    const observedAt=Number(s.observedAt) || Date.parse(s.observedAt);
    if (!Number.isFinite(observedAt) || Date.now()-observedAt>90000 || observedAt>Date.now()+1000) return;
    latest={...s, observedAt};
    await Promise.allSettled([prices(),readSupply()]);
    if (latest.observedAt!==observedAt) return;
    set('jcsProjectChange', `Ledger ${s.ledgerIndex} · ${stamp(observedAt)}`);
    if (!recentUsd()) {
      set('jcsProjectPrice', fmt(s.priceXrpPerJcs) + ' XRP');
      set('jcsProjectMarketcap','USD reference unavailable');
      chartStatus('USD comparison unavailable. The native JCS/XRP price above is still from the ledger.');
      return;
    }
    const jcs=Number(s.priceXrpPerJcs)*usd.xrp;
    set('jcsProjectPrice','$'+fmt(jcs));
    set('jcsProjectMarketcap',supply!=null ? '$'+fmt(supply*jcs,6) : 'Unavailable');
    if (series.length && series.at(-1).provider !== usd.provider) series.length=0;
    const point={at:observedAt,jcs,xrp:usd.xrp,rlusd:usd.rlusd,ledger:s.ledgerIndex,provider:usd.provider};
    if (!series.length || point.at-series.at(-1).at>=55000) {
      series.push(point); if(series.length>240)series.shift();renderChart();
    }
    chartStatus(`${series.length} observation${series.length===1?'':'s'} this visit · updated ${stamp(observedAt)} · ${usd.provider} · live window`);
  }
  window.addEventListener('jcs:market-snapshot',e=>{onSnapshot(e).catch(()=>chartStatus('Market comparison temporarily unavailable.'));});
  $('jcsChartReset')?.addEventListener('click',()=>{series.length=0;renderChart();chartStatus('Session chart reset. Waiting for the next market update.');});
  let scene=0;
  document.body.dataset.scene='0';
  setInterval(()=>{
    if(document.hidden) return;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.dataset.scene=String(scene=(scene+1)%3);
    if(latest && Date.now()-latest.observedAt>90000) {
      set('jcsProjectChange','Last ledger read '+stamp(latest.observedAt)+' · waiting to reconnect');
      chartStatus('Updates paused. Last observation '+stamp(latest.observedAt)+'.');
    }
  },INTERVAL);
  renderChart();
})();
