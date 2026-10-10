import {setRegionText} from './region-icons.mjs?v=listicons1';

const $=id=>document.getElementById(id);
const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const readList=(key,fallback=[])=>{const value=read(key,fallback);return Array.isArray(value)?value.filter(v=>typeof v==='string'):fallback;};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};

export function setupMaps(){
 let dataPromise,data,world,map,tiles,labels,rendered=[],selected,focusArea,query='',off=new Set(readList('dungeons-map-off',['entrance','arena','pot'])),found=new Set(readList('dungeons-map-found')),hideFound=read('dungeons-map-hide-found',false)===true,routeNumber=0;
 const foundKey=m=>world.id+':'+m.id;
 const point=(x,y)=>map.unproject([x,y],world.zmax);
 const status=text=>{$('map-status').textContent=text;};
 const category=id=>world.categories.find(c=>c.id===id);
 const available=m=>!off.has(m.cat)&&(!hideFound||!found.has(foundKey(m)))&&(!focusArea||m.generator&&m.area===focusArea)&&(!query||[m.name,m.english,m.area,category(m.cat).label].join(' ').toLocaleLowerCase().includes(query));

 async function load(){
  if(!dataPromise)dataPromise=fetch('./maps.json?v=maps1').then(r=>{if(!r.ok)throw Error('地图数据读取失败');return r.json()}).catch(e=>{dataPromise=null;throw e});
  data=await dataPromise;
  if(!globalThis.L)throw Error('地图组件未能载入，请刷新页面重试。');
  if(!$('storm-rotation-list').children.length){
   for(const area of data.rotation){
    const li=node('li'),button=node('button','storm-map-link');button.type='button';button.dataset.mapStorm=area.name;
    const name=node('span','storm-map-name');setRegionText(name,area.name);button.append(name,node('span','storm-map-count',`${area.count} 个生成器位置`),node('span','storm-map-action','地图 →'));li.append(button);$('storm-rotation-list').append(li);
   }
   $('storm-rotation-status').textContent='按此顺序循环，每 40 分钟切换地区；同一地区每 4 小时 40 分钟开启一次。';
  }
  return data;
 }

 function popup(m){
  const content=node('div','map-popup');content.append(node('p','map-popup-type',category(m.cat).label),node('strong','map-popup-name',m.name));
  if(m.area)content.append(node('p','',m.area));
  if(m.generator)content.append(node('p','map-popup-note','风暴生成器可能出现的位置。每次风暴的实际生成点以游戏内为准。'));
  const actions=node('div','map-popup-actions'),button=node('button','map-found-button',found.has(foundKey(m))?'已找到 ✓':'标记为已找到');button.type='button';button.setAttribute('aria-pressed',String(found.has(foundKey(m))));
  button.addEventListener('click',()=>{const key=foundKey(m);found.has(key)?found.delete(key):found.add(key);save('dungeons-map-found',[...found]);render();const marker=rendered.find(entry=>entry.id===m.id)?.layer;if(marker)marker.openPopup();});
  const share=node('button','map-share-button','复制位置链接');share.type='button';share.addEventListener('click',async()=>{const url=new URL(location.href);url.hash=new URLSearchParams({map:world.id,marker:m.id});try{await navigator.clipboard.writeText(url.href);share.textContent='已复制'}catch{const field=node('input','map-share-url');field.value=url.href;field.readOnly=true;content.append(field);field.select();}});actions.append(button,share);content.append(actions);return content;
 }

 function renderCategories(){
  const fragment=document.createDocumentFragment();
  for(const c of world.categories){
   const label=node('label','map-category'),check=node('input');check.type='checkbox';check.checked=!off.has(c.id);check.dataset.mapCategory=c.id;
   check.addEventListener('change',()=>{check.checked?off.delete(c.id):off.add(c.id);save('dungeons-map-off',[...off]);render();});
   const img=node('img');img.src=c.icon;img.alt='';img.width=22;img.height=22;
   const count=node('span','map-category-count');const completed=world.markers.filter(m=>m.cat===c.id&&found.has(foundKey(m))).length;count.textContent=completed?`${completed}/${c.count}`:String(c.count);count.title=completed?`已找到 ${completed} / 总计 ${c.count}`:`${c.count} 个地点`;
   label.append(check,img,node('span','map-category-label',c.label),count);fragment.append(label);
  }
  $('map-categories').replaceChildren(fragment);
  $('map-filter-caption').textContent=`${world.categories.filter(c=>!off.has(c.id)).length}/${world.categories.length}`;
 }

 function render(){
  if(!world||!map)return;
  for(const item of rendered)map.removeLayer(item.layer);rendered=[];
  const filtered=world.markers.filter(available);
  for(const m of filtered){
   const completed=found.has(foundKey(m));let layer;
   if(m.cat==='pot')layer=L.circleMarker(point(m.x,m.y),{radius:3.5,color:'#0a3321',weight:1,fillColor:completed?'#77847b':'#35da76',fillOpacity:completed?.4:.9});
   else layer=L.marker(point(m.x,m.y),{icon:L.icon({iconUrl:m.icon,iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-12],className:'native-map-marker'+(completed?' is-found':'')+(m.generator?' is-generator':'')}),title:m.name,alt:m.name,keyboard:true,zIndexOffset:m.generator?150:0});
   layer.bindPopup(()=>popup(m),{maxWidth:285});layer.on('click',()=>{selected=m.id;setMarkerHash(m.id);});layer.addTo(map);rendered.push({id:m.id,layer});
  }
  renderCategories();
  $('map-count').textContent=`${filtered.length} / ${world.markers.length} 个地点`;
  $('map-found-total').textContent=`已找到 ${world.markers.filter(m=>found.has(foundKey(m))).length} 个`;
  $('map-focus').hidden=!focusArea;$('map-focus-name').textContent=focusArea?`${focusArea} · ${filtered.length} 个生成器位置`:'';
  const results=node('div');if(query){for(const m of filtered.slice(0,40)){const button=node('button','map-search-result');button.type='button';button.append(node('strong','',m.name),node('span','',m.area||category(m.cat).label));button.addEventListener('click',()=>focusMarker(m.id));results.append(button);}if(filtered.length>40)results.append(node('p','meta',`另有 ${filtered.length-40} 个结果，缩小搜索范围可继续查看。`));if(!filtered.length)results.append(node('p','meta','没有匹配地点。'));}
  $('map-search-results').replaceChildren(...results.childNodes);$('map-search-results').hidden=!query;
 }

 function setMarkerHash(id){
  const params=new URLSearchParams({map:world.id,marker:id});if(focusArea)params.set('area',focusArea);history.replaceState(null,'','#'+params);
 }
 function focusMarker(id){
  const m=world.markers.find(m=>m.id===id);if(!m)return;
  off.delete(m.cat);focusArea=undefined;query='';$('map-search').value='';if(found.has(foundKey(m)))hideFound=false;$('map-hide-found').checked=hideFound;
  render();selected=id;setMarkerHash(id);map.setView(point(m.x,m.y),Math.max(map.getZoom(),world.zmax-1),{animate:false});rendered.find(r=>r.id===id)?.layer.openPopup();
 }
 function fitWorld(){if(!map||!world)return;const [x0,y0,x1,y1]=world.box;map.fitBounds(L.latLngBounds(point(x0,y1),point(x1,y0)),{padding:[16,16],animate:false});}

 function createWorld(id){
  world=data.dimensions.find(d=>d.id===id)||data.dimensions[0];focusArea=undefined;selected=undefined;
  if(map){map.remove();rendered=[];}
  map=L.map('world-map',{crs:L.CRS.Simple,attributionControl:false,zoomControl:false,zoomSnap:.25,zoomDelta:.5,minZoom:0,maxZoom:world.zmax+2,preferCanvas:true,maxBoundsViscosity:.8,fadeAnimation:false});
  L.control.zoom({position:'topright',zoomInTitle:'放大',zoomOutTitle:'缩小'}).addTo(map);
  const [x0,y0,x1,y1]=world.box,bounds=L.latLngBounds(point(x0,y1),point(x1,y0));map.setMaxBounds(bounds.pad(.18));
  tiles=L.tileLayer(`./images/map/${world.id}/{z}/{x}/{y}.webp`,{tileSize:1024,minNativeZoom:2,maxNativeZoom:world.zmax,maxZoom:world.zmax+2,noWrap:true,bounds,keepBuffer:1,className:'native-map-tiles'}).addTo(map);
  tiles.on('tileerror',()=>{status('部分地图分块未能载入，请点击“重新载入”重试。');$('map-retry').hidden=false;});
  labels=L.layerGroup();for(const label of world.labels)L.marker(point(label.x,label.y),{interactive:false,keyboard:false,icon:L.divIcon({className:'map-area-label',html:'',iconSize:[150,30],iconAnchor:[75,15]})}).on('add',function(){this.getElement().textContent=label.name;}).addTo(labels);labels.addTo(map);
  const tabs=document.createDocumentFragment();for(const d of data.dimensions){const button=node('button','map-world-tab',d.name);button.type='button';button.dataset.mapWorld=d.id;button.setAttribute('aria-pressed',String(d.id===world.id));button.addEventListener('click',()=>{location.hash=new URLSearchParams({map:d.id});});tabs.append(button);}$('map-world-tabs').replaceChildren(tabs);
  fitWorld();render();status('拖动地图移动视角，滚轮或双指缩放；点击图标查看地点。');
 }

 function focusRegion(name){
  const area=data.rotation.find(r=>r.name===name);if(!area)return;
  if(world?.id!==area.dimension)createWorld(area.dimension);
  focusArea=name;query='';$('map-search').value='';off.delete('storm');hideFound=false;$('map-hide-found').checked=false;render();
  const points=world.markers.filter(m=>area.generators.includes(m.id));map.fitBounds(L.latLngBounds(points.map(m=>point(m.x,m.y))),{padding:[35,35],maxZoom:world.zmax,animate:false});
  status(`${name}：${area.count} 个风暴生成器候选位置。点击生成器图标查看详情。`);
 }

 async function route(){
  const ticket=++routeNumber,params=new URLSearchParams(location.hash.slice(1)),storm=location.hash==='#storm',wasStorm=document.documentElement.dataset.view==='storm';
  $('map-panel').hidden=storm;$('storm-panel').hidden=!storm;document.documentElement.dataset.view=storm?'storm':'map';
  for(const tab of document.querySelectorAll('[data-page-tab]')){const active=tab.dataset.pageTab===(storm?'storm':'map');tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  if(storm){load().catch(()=>{$('storm-rotation-status').textContent='位置数据未能载入，请刷新重试。';});return;}
  if(wasStorm)window.scrollTo({top:0,behavior:'instant'});
  $('map-loading').hidden=false;
  try{await load();if(ticket!==routeNumber)return;const id=params.get('map')||'overworld';if(!map||world.id!==id)createWorld(id);map.invalidateSize();const area=params.get('area');if(area)focusRegion(area);else if(focusArea){focusArea=undefined;render();fitWorld();}if(params.has('marker'))focusMarker(params.get('marker'));}
  catch(e){status(e.message);$('map-retry').hidden=false;}finally{if(ticket===routeNumber)$('map-loading').hidden=true;}
 }
 for(const tab of document.querySelectorAll('[data-page-tab]'))tab.addEventListener('click',()=>{location.hash=tab.dataset.pageTab==='storm'?'storm':new URLSearchParams({map:world?.id||'overworld'}).toString();});
 $('page-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('[data-page-tab]')],index=tabs.indexOf(document.activeElement),target=e.key==='Home'?0:e.key==='End'?1:1-Math.max(index,0);tabs[target].focus();tabs[target].click();});
 document.addEventListener('click',e=>{const button=e.target.closest('[data-map-storm]');if(!button||!data)return;const area=data.rotation.find(r=>r.name===button.dataset.mapStorm);if(area)location.hash=new URLSearchParams({map:area.dimension,area:area.name}).toString();});
 $('map-search').addEventListener('input',()=>{query=$('map-search').value.trim().toLocaleLowerCase();render();});
 for(const [id,visible] of [['map-show-all',true],['map-hide-all',false]])$(id).addEventListener('click',()=>{if(!world)return;for(const c of world.categories)visible?off.delete(c.id):off.add(c.id);save('dungeons-map-off',[...off]);render();});
 $('map-hide-found').checked=hideFound;$('map-hide-found').addEventListener('change',()=>{hideFound=$('map-hide-found').checked;save('dungeons-map-hide-found',hideFound);render();});
 $('map-reset-found').addEventListener('click',()=>{if(!world)return;for(const m of world.markers)found.delete(foundKey(m));save('dungeons-map-found',[...found]);render();});
 $('map-clear-focus').addEventListener('click',()=>{location.hash=new URLSearchParams({map:world.id}).toString();});
 $('map-fit').addEventListener('click',fitWorld);
 $('map-retry').addEventListener('click',()=>{if(tiles)tiles.redraw();$('map-retry').hidden=true;route();});
 window.addEventListener('hashchange',route);new ResizeObserver(()=>{if(map&&!$('map-panel').hidden)map.invalidateSize();}).observe($('world-map'));
 const compactFilters=matchMedia('(max-width:600px)');$('map-filter-details').open=!compactFilters.matches;compactFilters.addEventListener('change',e=>{$('map-filter-details').open=!e.matches;});
 route();
 return {focusRegion(name){const area=data?.rotation.find(r=>r.name===name);if(area)location.hash=new URLSearchParams({map:area.dimension,area:name}).toString();}};
}
