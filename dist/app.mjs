import {SyncedClock} from './clock.mjs?v=pages1';
import {setupPreferences,showNotice} from './ui.mjs?v=layout2';
import {loadStyle,loadScript,retryable} from './resources.mjs?v=layout2';
import {loadMapIndex} from './map-data.mjs?v=layout2';

setupPreferences();
const $=id=>document.getElementById(id),clock=new SyncedClock();
let mapController,stormController,lastWorld='overworld',routeTicket=0;
const toolNames=['database','collection','planner','builds','compare'];
const toolControllers=Object.fromEntries(toolNames.map(name=>[name,retryable(async()=>{
 const [module]=await Promise.all([import('./'+name+'.mjs?v=layoutrefine2'),loadStyle('./explorer.css?v=db1'),loadStyle('./drops.css?v=db1'),...(['collection','database'].includes(name)?[]:[loadStyle('./'+name+'.css?v=tools2')])]);
 await loadStyle('./explorer-game.css?v=tools2');
 await loadStyle('./explorer-reference.css?v=tools2');
 await loadStyle('./database.css?v=layoutrefine2');
 return module['setup'+name[0].toUpperCase()+name.slice(1)]();
})]));
const getMaps=retryable(async()=>{
 const [module]=await Promise.all([import('./maps.mjs?v=db1'),loadStyle('./maps.css?v=fonts1'),loadStyle('./vendor/leaflet/leaflet.css'),loadScript('./vendor/leaflet/leaflet.js'),loadMapIndex()]);
 mapController=await module.setupMaps();return mapController;
});
const getStorm=retryable(async()=>{
 const [module]=await Promise.all([import('./storm.mjs?v=stormlink1'),loadStyle('./storm.css?v=fonts1')]);
 stormController=await module.setupStorm({clock});return stormController;
});
const getDrops=retryable(async()=>{
 const [module]=await Promise.all([import('./drops.mjs?v=layoutrefine2'),loadStyle('./drops.css?v=db1'),loadStyle('./database.css?v=layoutrefine2')]);
 return module.setupDrops();
});

function tick(){
 const now=clock.now(),date=new Date(now+8*3600000).toISOString();
 $('clock').textContent=date.slice(11,19);$('clock').dateTime=new Date(now).toISOString();$('clock-date').textContent=date.slice(0,10)+' · 北京时间';
 if(stormController)stormController.tick();
}
async function syncTime(){
 if(clock.busy)return;
 $('sync-status').textContent='校时中';
 try{await clock.sync();$('sync-status').textContent='已校准 · 网络时间';}
 catch{$('sync-status').textContent=clock.synced?'校时失败 · 沿用上次':'本机时间 · 暂未连接校时服务';}
 $('clock-connection').dataset.synced=String(clock.synced);$('clock-connection').title=$('sync-status').textContent;tick();
}
tick();syncTime();setInterval(()=>{if(!document.hidden||stormController)tick();},1000);setInterval(()=>{if(!document.hidden)syncTime();},300000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){tick();syncTime();}});

async function route(){
 const ticket=++routeTicket,params=new URLSearchParams(location.hash.slice(1)),view=toolNames.find(name=>params.has(name))||(params.has('storm')?'storm':'map');
 let focusRegionQuery=false;
 const switched=document.documentElement.dataset.view&&document.documentElement.dataset.view!==view;
 document.documentElement.dataset.view=view;for(const name of ['map','storm',...toolNames])$(name+'-panel').hidden=view!==name;
 if(view!=='map')mapController?.hide();
 for(const tab of document.querySelectorAll('[data-page-tab]')){const active=tab.dataset.pageTab===view;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
 if(switched)window.scrollTo({top:0,behavior:'instant'});
 const panel=$(view+'-panel');panel.setAttribute('aria-busy','true');
 try{
  if(view==='map'){$('map-loading').hidden=false;const controller=await getMaps();if(ticket!==routeTicket)return;await controller.show(params);lastWorld=controller.worldId;}
  else if(view==='storm'){const controller=await getStorm();if(ticket!==routeTicket)return;focusRegionQuery=controller.show(params.get('region'));}
  else{const controller=await toolControllers[view]();if(ticket!==routeTicket)return;await controller.show(params);}
 }catch(error){
  if(ticket!==routeTicket)return;
  if(view==='map'){$('map-status').textContent=error.message;$('map-retry').hidden=false;$('map-loading').hidden=true;}
  else if(view==='storm'){$('storm-loading').textContent='加载失败，请点击重试。';$('storm-loading').hidden=false;}
  else{panel.replaceChildren();const retry=document.createElement('button');retry.textContent='加载失败，点击重试';retry.addEventListener('click',route);panel.append(retry);}
  showNotice('内容加载失败，请检查网络后重试。');console.error(error);
 }finally{if(ticket===routeTicket)panel.setAttribute('aria-busy','false');}
 if(ticket===routeTicket&&focusRegionQuery){$('query-heading').focus({preventScroll:true});$('query-heading').closest('section').scrollIntoView({block:'start',behavior:'instant'});}
}
window.addEventListener('hashchange',route);
for(const tab of document.querySelectorAll('[data-page-tab]'))tab.addEventListener('click',()=>{const hash=tab.dataset.pageTab==='map'?new URLSearchParams({map:lastWorld}).toString():tab.dataset.pageTab;if(location.hash==='#'+hash)route();else location.hash=hash;});
$('page-tabs').addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();const tabs=[...document.querySelectorAll('[data-page-tab]')],index=tabs.indexOf(document.activeElement),target=e.key==='Home'?0:e.key==='End'?tabs.length-1:(Math.max(index,0)+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[target].focus();tabs[target].click();
});
$('map-retry').addEventListener('click',()=>{mapController?.redraw();$('map-retry').hidden=true;route();});
$('storm-loading').addEventListener('click',route);
document.addEventListener('click',async e=>{
 const stormLink=e.target.closest('[data-map-storm]'),dropLink=e.target.closest('[data-drop-region]');
 if(stormLink){try{const index=await loadMapIndex(),area=index.rotation.find(r=>r.name===stormLink.dataset.mapStorm);if(area)location.hash=new URLSearchParams({map:area.dimension,area:area.name}).toString();}catch{showNotice('地图位置读取失败，请重试。');}}
 if(dropLink){dropLink.setAttribute('aria-busy','true');try{const viewer=await getDrops();viewer.open(dropLink.dataset.dropRegion,dropLink);}catch{showNotice('掉落详情加载失败，请重试。');}finally{dropLink.removeAttribute('aria-busy');}}
});
route();
// Restore an enabled alarm even when the visitor opens the map first.
try{if(JSON.parse(localStorage.getItem('map-rotation-alarm-v1'))?.enabled===true)getStorm().catch(()=>showNotice('保存的闹钟未能载入，请打开灵魂风暴重试。'));}catch{}
