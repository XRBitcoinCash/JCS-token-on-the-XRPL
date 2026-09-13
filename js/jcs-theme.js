(function(){
  'use strict';

  const storageKey='jcs-color-mode';
  const root=document.documentElement;
  const button=document.getElementById('themeToggle');
  const text=document.getElementById('themeToggleText');
  const themeMeta=document.querySelector('meta[name="theme-color"]');
  const media=window.matchMedia('(prefers-color-scheme: dark)');

  function currentMode(){
    return root.getAttribute('data-theme')==='dark'?'dark':'light';
  }

  function updateControl(){
    const dark=currentMode()==='dark';
    if(button){
      button.setAttribute('aria-pressed',String(dark));
      button.setAttribute(
        'aria-label',
        dark?'Switch to light mode':'Switch to dark mode'
      );
      button.title=dark?'Switch to light mode':'Switch to dark mode';
    }
    if(text){
      text.textContent=dark?'Light mode':'Dark mode';
    }
    if(themeMeta){
      themeMeta.setAttribute('content',dark?'#07101c':'#ffffff');
    }
  }

  function setMode(mode,persist){
    const normalized=mode==='dark'?'dark':'light';
    root.setAttribute('data-theme',normalized);
    if(persist){
      try{localStorage.setItem(storageKey,normalized)}catch(error){}
    }
    updateControl();
  }

  button?.addEventListener('click',()=>{
    setMode(currentMode()==='dark'?'light':'dark',true);
  });

  media.addEventListener?.('change',event=>{
    let saved='';
    try{saved=localStorage.getItem(storageKey)||''}catch(error){}
    if(saved!=='light'&&saved!=='dark'){
      setMode(event.matches?'dark':'light',false);
    }
  });

  updateControl();
})();
