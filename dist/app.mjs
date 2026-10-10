import {setupDrops} from './drops.mjs?v=smalleffects5';
import {setRegionText} from './region-icons.mjs?v=listicons1';
import {setupAlarm} from './alarm.mjs?v=m4r1';
import {SyncedClock} from './clock.mjs?v=pages1';
import {createRotation} from './schedule.mjs?v=dark1';
async function start(){

const fontSelect=document.getElementById('font-choice');
function restoreFont(){const value=globalThis.rotationFontPreference.read();document.documentElement.dataset.font=value;fontSelect.value=value;}
function saveFont(){globalThis.rotationFontPreference.save(fontSelect.value);}
restoreFont();
fontSelect.addEventListener('change',saveFont);
fontSelect.addEventListener('input',saveFont);
window.addEventListener('pageshow',restoreFont);
window.addEventListener('storage',e=>{if(e.key==='map-rotation-font')restoreFont();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)restoreFont();});
const themeSelect=document.getElementById('theme');
let preference='auto';try{const saved=localStorage.getItem('map-rotation-theme');if(['auto','light','dark'].includes(saved))preference=saved}catch{}
themeSelect.value=preference;
const media=matchMedia('(prefers-color-scheme: dark)');
const applyTheme=()=>{document.documentElement.dataset.theme=preference==='auto'?(media.matches?'dark':'light'):preference;};
themeSelect.addEventListener('change',()=>{preference=themeSelect.value;try{localStorage.setItem('map-rotation-theme',preference)}catch{}applyTheme();});
media.addEventListener('change',applyTheme);applyTheme();

 const syncedClock=new SyncedClock();
 const syncStatus=document.getElementById('sync-status');
 async function syncTime(){syncStatus.textContent='校时中';try{await syncedClock.sync();syncStatus.textContent='已校准 · 网络时间';}catch{syncStatus.textContent=syncedClock.synced?'校时失败 · 沿用上次':'校时失败 · 本机时间';}if(typeof render==='function'&&typeof config!=='undefined')render();}

 const response=await fetch('./rotation.json?v=nooffset1',{cache:'no-store'});if(!response.ok)throw new Error('无法读取轮换配置');const settings=await response.json();
const R=createRotation(settings),$=id=>document.getElementById(id),key='map-rotation-web-v2';
 const dropViewer=setupDrops();
 let config={anchor:R.defaultAnchor,offset:settings.anchorRegion,region:-1,hours:24},listKey='';
 try{const saved=JSON.parse(localStorage.getItem(key)||localStorage.getItem('map-rotation-web-v1'));if(saved&&Number.isFinite(saved.anchor)&&saved.anchor>=Date.parse('2000-01-01')&&saved.anchor<Date.parse('2100-01-01')&&Number.isInteger(saved.offset)&&saved.offset>=0&&saved.offset<7&&Number.isInteger(saved.region)&&saved.region>=-1&&saved.region<7&&[24,48,168].includes(saved.hours))config=saved}catch{}
 if(config.anchor===Date.parse('2026-10-07T12:00:00+08:00')&&config.offset===0){config.anchor=R.defaultAnchor;try{localStorage.setItem(key,JSON.stringify(config))}catch{}}
 const beijing=ms=>new Date(ms+8*3600000).toISOString(),date=ms=>beijing(ms).slice(5,10),time=ms=>beijing(ms).slice(11,16),period=(start,end)=>date(start)+' '+time(start)+' – '+(date(start)===date(end)?'':date(end)+' ')+time(end);
 R.places.forEach((name,i)=>{for(const id of ['region','anchor-region']){const o=document.createElement('option');o.value=i;o.textContent=name;$(id).append(o)}});
 $('region').value=config.region;$('horizon').value=config.hours;$('anchor-date').value=beijing(config.anchor).slice(0,10);$('anchor-time').value=time(config.anchor);$('anchor-region').value=config.offset;
 function persist(){try{localStorage.setItem(key,JSON.stringify(config));return true}catch{return false}}
 function render(){const now=syncedClock.now(),c=R.current(config.anchor,config.offset,now),n=R.current(config.anchor,config.offset,c.start+R.step);$('clock').textContent=beijing(syncedClock.now()).slice(0,10)+' '+beijing(syncedClock.now()).slice(11,19);$('status-card').classList.toggle('active',c.active);$('phase').textContent=c.active?'开启中':'未开启';setRegionText($('current-name'),R.places[c.active?c.index:n.index],c.active?R.places[c.index]:'下一场 · '+R.places[n.index]);dropViewer.setCurrentRegion(R.places[c.active?c.index:n.index]);$('current-period').textContent=(c.active?'本场时间  ':'下一场时间  ')+period(c.active?c.start:n.start,c.active?c.end:n.end);$('countdown-label').textContent=c.active?'距离本场结束':'距离下一场开始';$('countdown').textContent=R.countdown(c.target,now);setRegionText($('next'),R.places[n.index],'下一场：'+R.places[n.index]+' · '+date(n.start)+' '+time(n.start)+' 开始');$('progress').style.width=Math.max(0,Math.min(100,(now-(c.active?c.start:c.end))/R.duration*100))+'%';$('anchor-info').textContent='轮换起点：'+beijing(config.anchor).slice(0,10)+' '+time(config.anchor)+' · '+R.places[config.offset];$('saved-anchor').textContent=beijing(config.anchor).slice(0,10)+' '+time(config.anchor)+' · '+R.places[config.offset];
 $('region-result').hidden=config.region<0;if(config.region>=0){const r=R.region(config.anchor,config.offset,now,config.region);setRegionText($('region-state'),R.places[r.index],R.places[r.index]+' · '+(r.active?'开启中':'未开启'));$('region-period').textContent=(r.active?'当前时段  ':'最近时段  ')+period(r.start,r.end);$('region-label').textContent=r.active?'距离该地区结束':'距离该地区开始';$('region-countdown').textContent=R.countdown(r.target,now)}
 const last=R.current(config.anchor,config.offset,now+config.hours*3600000-1).n,k=[c.n,c.active,last,config.anchor,config.offset,config.region,config.hours].join('|');if(listKey!==k){listKey=k;const windows=R.windows(config.anchor,config.offset,now,config.hours,config.region),fragment=document.createDocumentFragment();$('table-title').textContent=(config.region<0?'全部地区':R.places[config.region])+' · 开启时段';for(const row of windows){const tr=document.createElement('tr');tr.className=row.active?'live':'';const start=document.createElement('td');start.className='schedule-date';start.textContent=date(row.start);const end=document.createElement('td');end.className='schedule-period';const range=document.createElement('strong');range.className='time-range';const opening=document.createElement('span');opening.textContent=time(row.start);const dash=document.createElement('span');dash.className='time-dash';dash.textContent='–';const closing=document.createElement('span');closing.textContent=time(row.end);range.append(opening,dash,closing);end.append(range);if(date(row.start)!==date(row.end)){const note=document.createElement('small');note.className='end-date';note.textContent=date(row.end)+' 结束';end.append(note);}const region=document.createElement('td');const dropButton=document.createElement('button');dropButton.type='button';dropButton.className='schedule-drop';setRegionText(dropButton,R.places[row.index]);dropButton.dataset.dropRegion=R.places[row.index];dropButton.setAttribute('aria-haspopup','dialog');dropButton.setAttribute('aria-label','查看'+R.places[row.index]+'掉落物品');region.append(dropButton);if(row.active){const badge=document.createElement('span');badge.className='badge';badge.textContent='开启中';badge.title='开启中';region.append(badge)}tr.append(start,end,region);fragment.append(tr)}$('schedule').replaceChildren(fragment)}
 alarms.tick();
 }
 function select(region,hours){if(!Number.isInteger(region)||region< -1||region>6||![24,48,168].includes(hours))throw Error('地区或时间范围无效');config.region=region;config.hours=hours;$('region').value=region;$('horizon').value=hours;persist();listKey='';render()}
 $('region').addEventListener('change',()=>select(Number($('region').value),config.hours));$('horizon').addEventListener('change',()=>select(config.region,Number($('horizon').value)));
 $('calibration').addEventListener('submit',e=>{e.preventDefault();const anchor=Date.parse($('anchor-date').value+'T'+$('anchor-time').value+':00+08:00'),offset=Number($('anchor-region').value);if(!Number.isFinite(anchor)||anchor<Date.parse('2000-01-01')||anchor>=Date.parse('2100-01-01')||!Number.isInteger(offset)||offset<0||offset>6){$('save-message').textContent='请输入有效的日期、时间和地区。';return}config.anchor=anchor;config.offset=offset;$('save-message').textContent=persist()?'已保存，时段已更新':'校准已应用；当前浏览器无法保存设置。';listKey='';render()});
 const alarms=setupAlarm({R,clock:syncedClock,getConfig:()=>config,format:ms=>date(ms)+' '+time(ms)});
 render();syncTime();setInterval(render,1000);setInterval(syncTime,300000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();syncTime();}});
 if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'select_rotation_region',title:'选择轮换地区',description:'选择地区和查询范围，更新可见时段列表。region 为 -1（全部地区）或 0–6，hours 为 24、48、168。',inputSchema:{type:'object',properties:{region:{type:'integer',minimum:-1,maximum:6},hours:{type:'integer',enum:[24,48,168]}},required:['region','hours'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){select(input.region,input.hours);const now=syncedClock.now();return {region:input.region<0?'全部地区':R.places[input.region],hours:input.hours,windows:R.windows(config.anchor,config.offset,now,input.hours,input.region).map(w=>({region:R.places[w.index],start:new Date(w.start).toISOString(),end:new Date(w.end).toISOString()}))}}})).catch(()=>{})}catch{}}
}
start().catch(error=>{document.getElementById('phase').textContent='加载失败';document.getElementById('current-name').textContent='请刷新页面重试';console.error(error);});
