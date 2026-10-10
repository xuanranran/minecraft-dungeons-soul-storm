import {loadMapIndex,loadMapWorld} from './map-data.mjs';
import {loadScript} from './resources.mjs';

const $=id=>document.getElementById(id);
const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const readList=(key,fallback=[])=>{const value=read(key,fallback);return Array.isArray(value)?value.filter(v=>typeof v==='string'):fallback;};
const save=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value))}catch{}};

export async function setupMaps(){
 if(!globalThis.L)await loadScript('./vendor/leaflet/leaflet.js');
 const data=await loadMapIndex();
 await document.fonts.ready;
 let world,map,tiles,focusArea,query='',routeNumber=0,searchTimer,coordinateMarker,spawnOverlay;
 const rendered=new Map(),icons=new Map(),views=new Map();
 let categories=new Map(),points=new Map(),off=new Set(readList('dungeons-map-off-v2',[...readList('dungeons-map-off',['entrance','arena','pot']),'species'])),found=new Set(readList('dungeons-map-found')),hideFound=read('dungeons-map-hide-found',false)===true;
 const foundKey=m=>world.id+':'+m.id;
 const point=(x,y)=>map.unproject([x,y],world.zmax);
 const status=text=>{$('map-status').textContent=text;};
 const available=m=>!off.has(m.cat)&&(!hideFound||!found.has(foundKey(m)))&&(!focusArea||m.generator&&m.area===focusArea)&&(!query||m.search.includes(query));

 function popup(m){
  const content=node('div','map-popup'),type=node('div','map-popup-type'),symbol=node('img','map-popup-icon');symbol.src=m.icon;symbol.alt='';symbol.width=22;symbol.height=22;
  type.append(symbol,node('span','',categories.get(m.cat).label));content.append(type,node('strong','map-popup-name',m.cat==='species'?'生物生成区域':m.name));
  if(m.area)content.append(node('p','map-popup-area',m.area));
  if(m.generator)content.append(node('p','map-popup-note','风暴生成器候选位置，实际生成点以本场游戏为准。'));
  if(m.species){
   const list=node('div','map-species-list');
   for(const s of m.species){const entry=node(s.href?'a':'div','map-species-entry');if(s.href)entry.href=s.href;if(s.image){const image=node('img');image.src=s.image;image.alt='';image.width=32;image.height=32;entry.append(image);}entry.append(node('span','',s.name));list.append(entry);}
   content.append(list);
   const parameters=node('dl','map-spawn-parameters'),extent=m.native.extent;
   if(extent){parameters.append(node('dt','','生成范围'),node('dd','',`${(extent.X*2/100).toLocaleString('zh-CN',{maximumFractionDigits:1})} × ${(extent.Y*2/100).toLocaleString('zh-CN',{maximumFractionDigits:1})} 格`));}
   const density={Sparse:'稀疏',Normal:'标准',Default:'标准',Dense:'密集',VeryDense:'非常密集'}[m.native.density];
   if(density)parameters.append(node('dt','','生成密度'),node('dd','',density));
   if(parameters.childNodes.length)content.append(parameters);
   content.append(node('p','map-popup-note','候选生物会在区域内随机生成，出现情况取决于当前游戏状态。'));
  }
  const actions=node('div','map-popup-actions'),button=node('button','map-found-button'),box=node('span','map-found-box');box.setAttribute('aria-hidden','true');button.append(box,node('span','','已找到'));button.type='button';button.setAttribute('aria-pressed',String(found.has(foundKey(m))));button.title='切换此地点的已找到状态';
  button.addEventListener('click',event=>{L.DomEvent.stopPropagation(event);const focused=document.activeElement===button,key=foundKey(m);found.has(key)?found.delete(key):found.add(key);save('dungeons-map-found',[...found]);render();const marker=rendered.get(m.id)?.layer;if(marker){const content=popup(m);marker.setPopupContent(content);marker.openPopup();if(focused)content.querySelector('.map-found-button').focus({preventScroll:true});}});
  if(m.cat==='storm'){const tracker=node('a','map-storm-tracker','查看灵魂风暴');tracker.href=m.area?'#storm&'+new URLSearchParams({region:m.area}):'#storm';actions.append(tracker);}
  const share=node('button','map-share-button','复制链接');share.type='button';share.title='复制此地点的位置链接';share.setAttribute('aria-label','复制此地点的位置链接');share.addEventListener('click',async()=>{const url=new URL(location.href);url.hash=new URLSearchParams({map:world.id,marker:m.id});try{await navigator.clipboard.writeText(url.href);share.textContent='已复制'}catch{if(!content.querySelector('input')){const field=node('input','map-share-url');field.value=url.href;field.readOnly=true;field.setAttribute('aria-label','此地点的位置链接');content.append(field);field.focus();field.select();share.textContent='选中链接';}}});actions.append(button,share);content.append(actions);return content;
 }
 function icon(m,completed){
  const key=[m.icon,completed,m.generator].join('|');
  if(!icons.has(key))icons.set(key,L.icon({iconUrl:m.icon,iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-12],className:'native-map-marker'+(completed?' is-found':'')+(m.generator?' is-generator':'')}));
  return icons.get(key);
 }
 function makeMarker(m,completed){
  let layer;
  if(m.cat==='pot')layer=L.circleMarker(point(m.x,m.y),{radius:3.5,color:'#0a3321',weight:1,fillColor:completed?'#77847b':'#35da76',fillOpacity:completed?.4:.9});
  else layer=L.marker(point(m.x,m.y),{icon:icon(m,completed),title:m.name,alt:m.name,keyboard:true,zIndexOffset:m.generator?150:0});
  const popupWidth=Math.max(160,Math.min(360,map.getSize().x-56));
  layer.bindPopup(()=>popup(m),{className:'native-place-popup',minWidth:Math.min(260,popupWidth),maxWidth:popupWidth,maxHeight:Math.max(170,Math.min(420,map.getSize().y-110)),autoPanPadding:[14,20]});
  layer.on('popupopen',()=>{layer.getPopup().getElement().querySelector('.leaflet-popup-close-button')?.setAttribute('aria-label','关闭地点窗口');spawnOverlay?.remove();spawnOverlay=undefined;if(m.zone?.length)spawnOverlay=L.polygon(m.zone.map(([x,y])=>point(x,y)),{color:'#f7bd55',weight:2,fillOpacity:.12,interactive:false}).addTo(map);});layer.on('popupclose',()=>{spawnOverlay?.remove();spawnOverlay=undefined;});layer.on('click',()=>setMarkerHash(m.id));layer.addTo(map);return layer;
 }
 function buildCategories(){
  const fragment=document.createDocumentFragment();
  for(const c of world.categories){
   const label=node('label','map-category'),check=node('input');check.type='checkbox';check.dataset.mapCategory=c.id;check.checked=!off.has(c.id);
   check.addEventListener('change',()=>{check.checked?off.delete(c.id):off.add(c.id);save('dungeons-map-off-v2',[...off]);render();});
   const img=node('img');img.src=c.icon;img.alt='';img.width=22;img.height=22;
   const count=node('span','map-category-count');count.dataset.countCategory=c.id;
   label.append(check,img,node('span','map-category-label',c.label),count);fragment.append(label);
  }
  $('map-categories').replaceChildren(fragment);
  if(!world.categories.length)$('map-categories').append(node('p','meta','此处暂未标注固定生成区域，可浏览原生小地图。'));
  for(const id of ['map-show-all','map-hide-all','map-reset-found'])$(id).disabled=!world.markers.length;
 }
 function render(){
  if(!world||!map)return;
  const filtered=world.markers.filter(available),visible=new Set(filtered.map(m=>m.id));
  // Reuse visible markers: typing and toggling a category do not rebuild the map.
  for(const [id,entry] of rendered)if(!visible.has(id)){map.removeLayer(entry.layer);rendered.delete(id);}
  for(const m of filtered){
   const completed=found.has(foundKey(m)),entry=rendered.get(m.id);
   if(!entry)rendered.set(m.id,{layer:makeMarker(m,completed),completed});
   else if(entry.completed!==completed){if(m.cat==='pot')entry.layer.setStyle({fillColor:completed?'#77847b':'#35da76',fillOpacity:completed?.4:.9});else entry.layer.setIcon(icon(m,completed));entry.completed=completed;}
  }
  const completedCounts=new Map();let total=0;
  for(const m of world.markers)if(found.has(foundKey(m))){total++;completedCounts.set(m.cat,(completedCounts.get(m.cat)||0)+1);}
  for(const c of world.categories){
   const check=$('map-categories').querySelector(`[data-map-category="${c.id}"]`),count=$('map-categories').querySelector(`[data-count-category="${c.id}"]`),completed=completedCounts.get(c.id)||0;
   check.checked=!off.has(c.id);count.textContent=completed?`${completed}/${c.count}`:String(c.count);count.title=completed?`已找到 ${completed} / 总计 ${c.count}`:`${c.count} 个地点`;
  }
  $('map-filter-caption').textContent=`${world.categories.filter(c=>!off.has(c.id)).length}/${world.categories.length}`;
  $('map-floating-caption').textContent=$('map-filter-caption').textContent;
  $('map-count').textContent=`${filtered.length} / ${world.markers.length} 个地点`;
  $('map-found-total').textContent=`已找到 ${total} 个`;
  $('map-focus').hidden=!focusArea;$('map-focus-name').textContent=focusArea?`${focusArea} · ${filtered.length} 个生成器位置`:'';
  const results=node('div');if(query){for(const m of filtered.slice(0,40)){const button=node('button','map-search-result');button.type='button';button.append(node('strong','',m.name),node('span','',m.area||categories.get(m.cat).label));button.addEventListener('click',()=>focusMarker(m.id));results.append(button);}if(filtered.length>40)results.append(node('p','meta',`另有 ${filtered.length-40} 个结果，请缩小搜索范围。`));if(!filtered.length)results.append(node('p','meta','没有匹配地点。'));}
  $('map-search-results').replaceChildren(...results.childNodes);$('map-search-results').hidden=!query;
 }
 function setMarkerHash(id){
  const params=new URLSearchParams({map:world.id,marker:id});if(focusArea)params.set('area',focusArea);history.replaceState(null,'','#'+params);
 }
 function focusMarker(id){
  const m=points.get(id);if(!m)return;
  clearTimeout(searchTimer);off.delete(m.cat);focusArea=undefined;query='';$('map-search').value='';if(found.has(foundKey(m)))hideFound=false;$('map-hide-found').checked=hideFound;
  render();setMarkerHash(id);map.setView(point(m.x,m.y),Math.max(map.getZoom(),world.zmax-1),{animate:false});rendered.get(id)?.layer.openPopup();
 }
 function fitWorld(){if(!map||!world)return;const [x0,y0,x1,y1]=world.box;map.fitBounds(L.latLngBounds(point(x0,y1),point(x1,y0)),{padding:[16,16],animate:false});}
 function createWorld(next){
  if(map){if(!focusArea)views.set(world.id,{center:map.getCenter(),zoom:map.getZoom()});map.remove();rendered.clear();spawnOverlay=undefined;}
  world=next;focusArea=undefined;query='';$('map-search').value='';clearTimeout(searchTimer);
  categories=new Map(world.categories.map(c=>[c.id,c]));points=new Map(world.markers.map(m=>[m.id,m]));
  for(const m of world.markers)m.search=[m.name,m.english,m.area,categories.get(m.cat).label].join(' ').toLocaleLowerCase();
  map=L.map('world-map',{crs:L.CRS.Simple,attributionControl:false,zoomControl:false,zoomSnap:.25,zoomDelta:.5,minZoom:0,maxZoom:world.maxZoom??world.zmax+2,preferCanvas:true,maxBoundsViscosity:.8,fadeAnimation:false});
  $('world-map').classList.remove('has-place-popup');
  map.on('popupopen',()=>$('world-map').classList.add('has-place-popup'));map.on('popupclose',()=>$('world-map').classList.remove('has-place-popup'));
  L.control.zoom({position:'topright',zoomInTitle:'放大',zoomOutTitle:'缩小'}).addTo(map);
  const [x0,y0,x1,y1]=world.box,bounds=L.latLngBounds(point(x0,y1),point(x1,y0));
  // Small rooms need free panning so a tall popup can fit above its marker.
  if(!world.image)map.setMaxBounds(bounds.pad(.18));
  if(world.image){tiles=L.imageOverlay(world.image,bounds,{className:'native-interior-map'}).addTo(map);tiles.on('error',()=>{status('室内地图未能载入，请点击“重新载入”重试。');$('map-retry').hidden=false;});}
  else{tiles=L.tileLayer(`./images/map/${world.id}/{z}/{x}/{y}.webp?v=${world.tilesVersion||'native2'}`,{tileSize:1024,minNativeZoom:world.minNativeZoom??0,maxNativeZoom:world.zmax,maxZoom:world.maxZoom??world.zmax+2,noWrap:true,bounds,keepBuffer:1,className:'native-map-tiles'}).addTo(map);tiles.on('tileerror',()=>{status('部分地图分块未能载入，请点击“重新载入”重试。');$('map-retry').hidden=false;});}
  const quality=()=>$('world-map').classList.toggle('at-native-scale',map.getZoom()>=world.zmax);map.on('zoomend',quality);
  const labels=L.layerGroup();for(const label of world.labels)L.marker(point(label.x,label.y),{interactive:false,keyboard:false,icon:L.divIcon({className:'map-area-label',html:'',iconSize:[150,30],iconAnchor:[75,15]})}).on('add',function(){this.getElement().textContent=label.name;}).addTo(labels);labels.addTo(map);
  for(const button of $('map-world-tabs').children)button.setAttribute('aria-pressed',String(button.dataset.mapWorld===world.id));
  $('map-interior').value=world.primary?'':world.id;
  $('map-resolution').textContent=`${world.image?'原生小地图':'原生底图'} ${world.width||world.size} × ${world.height||world.size}`;
  buildCategories();const view=views.get(world.id),home=world.labels.find(label=>label.english==='Howling Woods');if(view)map.setView(view.center,view.zoom,{animate:false});else if(home)map.setView(point(home.x,home.y),world.zmax-1.75,{animate:false});else fitWorld();quality();render();status('拖动移动 · 滚轮或双指缩放 · 点击图标查看地点');
 }
 function focusRegion(name){
  const area=data.rotation.find(r=>r.name===name);if(!area||world.id!==area.dimension)return;
  focusArea=name;query='';clearTimeout(searchTimer);$('map-search').value='';off.delete('storm');hideFound=false;$('map-hide-found').checked=false;render();
  const candidates=area.generators.map(id=>points.get(id));map.fitBounds(L.latLngBounds(candidates.map(m=>point(m.x,m.y))),{padding:[35,35],maxZoom:world.zmax,animate:false});
  status(`${name}：${area.count} 个风暴生成器候选位置。`);
 }
 function expand(value){
  document.documentElement.classList.toggle('map-expanded',value);$('map-expand').setAttribute('aria-pressed',String(value));$('map-expand').textContent=value?'退出专注':'专注地图';
  requestAnimationFrame(()=>map?.invalidateSize());
 }
 async function show(params){
  const ticket=++routeNumber;
  $('map-loading').hidden=false;
  try{
   const area=data.rotation.find(r=>r.name===params.get('area')),id=area?.dimension||params.get('map')||'overworld';
   const next=await loadMapWorld(id);if(ticket!==routeNumber)return;
   if(!map||world.id!==next.id)createWorld(next);
   map.invalidateSize();if(area)focusRegion(area.name);else if(focusArea){focusArea=undefined;render();fitWorld();}
   if(params.has('marker'))focusMarker(params.get('marker'));
   coordinateMarker?.remove();coordinateMarker=undefined;
   if(params.has('position')){const coordinates=params.get('position').split(',').map(Number);if(coordinates.length===2&&coordinates.every(n=>Number.isFinite(n)&&n>=0&&n<=world.size)){const target=point(...coordinates);map.setView(target,Math.max(world.zmax-1,map.getZoom()),{animate:false});coordinateMarker=L.circleMarker(target,{radius:9,color:'#fff',weight:3,fillColor:'#ffb30b',fillOpacity:1}).addTo(map);coordinateMarker.bindTooltip('任务目标位置',{permanent:true,direction:'top'}).openTooltip();status('已定位任务目标 · '+coordinates.join(', '));}}
  }finally{if(ticket===routeNumber)$('map-loading').hidden=true;}
 }
 const tabs=document.createDocumentFragment();for(const d of data.dimensions.filter(d=>d.primary!==false)){const button=node('button','map-world-tab',d.name);button.type='button';button.dataset.mapWorld=d.id;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>{location.hash=new URLSearchParams({map:d.id});});tabs.append(button);}$('map-world-tabs').replaceChildren(tabs);
 for(const d of data.dimensions.filter(d=>d.primary===false)){const option=node('option','',d.name);option.value=d.id;$('map-interior').append(option);}
 $('map-interior').addEventListener('change',()=>{if($('map-interior').value)location.hash=new URLSearchParams({map:$('map-interior').value});});
 $('map-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{query=$('map-search').value.trim().toLocaleLowerCase();render();},100);});
 for(const [id,visible] of [['map-show-all',true],['map-hide-all',false]])$(id).addEventListener('click',()=>{if(!world)return;for(const c of world.categories)visible?off.delete(c.id):off.add(c.id);save('dungeons-map-off-v2',[...off]);render();});
 $('map-hide-found').checked=hideFound;$('map-hide-found').addEventListener('change',()=>{hideFound=$('map-hide-found').checked;save('dungeons-map-hide-found',hideFound);render();});
 $('map-reset-found').addEventListener('click',()=>{if(!world)return;for(const m of world.markers)found.delete(foundKey(m));save('dungeons-map-found',[...found]);render();});
 $('map-clear-focus').addEventListener('click',()=>{location.hash=new URLSearchParams({map:world.id}).toString();});
 $('map-fit').addEventListener('click',fitWorld);$('map-expand').addEventListener('click',()=>expand(!document.documentElement.classList.contains('map-expanded')));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('map-filter-dialog').open&&document.documentElement.classList.contains('map-expanded')){expand(false);$('map-expand').focus();}});
 new ResizeObserver(()=>{if(map&&!$('map-panel').hidden)map.invalidateSize();}).observe($('world-map'));
 const filterDialog=$('map-filter-dialog'),filterDetails=$('map-filter-details'),filterHome=document.createComment('Desktop map filters');filterDetails.before(filterHome);
 const closeFilters=()=>filterDialog.close();
 filterDialog.addEventListener('close',()=>{document.documentElement.classList.remove('map-filters-open');$('map-filter-toggle').setAttribute('aria-expanded','false');});
 $('map-filter-toggle').addEventListener('click',()=>{filterDialog.showModal();document.documentElement.classList.add('map-filters-open');$('map-filter-toggle').setAttribute('aria-expanded','true');});
 $('map-filter-close').addEventListener('click',closeFilters);
 filterDialog.addEventListener('click',e=>{if(e.target===filterDialog){const bounds=filterDialog.getBoundingClientRect();if(e.clientX<bounds.left||e.clientX>bounds.right||e.clientY<bounds.top||e.clientY>bounds.bottom)closeFilters();}});
 const compactFilters=matchMedia('(max-width:760px)'),positionFilters=()=>{closeFilters();filterDetails.open=true;if(compactFilters.matches)$('map-filter-body').append(filterDetails);else filterHome.after(filterDetails);};
 positionFilters();compactFilters.addEventListener('change',positionFilters);
 return {show,hide(){routeNumber++;clearTimeout(searchTimer);closeFilters();expand(false);},redraw(){if(world?.image)tiles?.setUrl(world.image);else tiles?.redraw();},get worldId(){return world?.id||'overworld'}};
}
