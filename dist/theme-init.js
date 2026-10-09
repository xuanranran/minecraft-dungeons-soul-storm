try{const saved=localStorage.getItem('map-rotation-theme');document.documentElement.dataset.theme=['light','dark'].includes(saved)?saved:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}

// Font preference survives browser restarts; cookies back up localStorage.
(()=>{
 const key='map-rotation-font',valid=value=>value==='mojangles'||value==='default';
 function read(){try{const saved=localStorage.getItem(key);if(valid(saved))return saved;}catch{}try{const entry=document.cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='));const saved=entry?.slice(key.length+1);if(valid(saved))return saved;}catch{}return 'mojangles';}
 function save(value){if(!valid(value))return;try{localStorage.setItem(key,value);}catch{}try{document.cookie=key+'='+value+'; Max-Age=31536000; Path=/; SameSite=Lax';}catch{}document.documentElement.dataset.font=value;}
 globalThis.rotationFontPreference={read,save};
 document.documentElement.dataset.font=read();
})();
