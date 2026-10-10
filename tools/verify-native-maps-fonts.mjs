import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const data=JSON.parse(await fs.readFile('public/maps.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const out='artifacts/native-maps-fonts';await fs.mkdir(out,{recursive:true});
const reports=[];
try{
 for(const width of [1440,390,320]){
  const page=await browser.newPage({viewport:{width,height:width>760?1000:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(new URL(r.url()).hostname==='127.0.0.1'&&r.status()>=400)errors.push(r.status()+' '+r.url());});
  await page.route('https://timeapi.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({dateTime:'2026-10-10T21:40:00+08:00'})}));
  await page.addInitScript(()=>{localStorage.setItem('map-rotation-theme','dark');localStorage.setItem('map-rotation-font','default');});
  await page.goto('http://127.0.0.1:8080/map/overworld/');
  await page.locator('[data-map-category=species]').waitFor({state:'attached'});
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#map-interior option').count(),24);
  assert.equal(await page.locator('.map-world-tab').count(),3);
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(e=>e.complete&&e.naturalWidth===1024));
  assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');
  assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Dungeons Sixteen/);
  const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
  const document=await cdp.send('DOM.getDocument');
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:document.root.nodeId,selector:'#map-panel h2'});
  const {fonts}=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});
  assert.ok(fonts.some(f=>f.isCustomFont&&f.glyphCount>=4),'Chinese map title must actually render with an embedded native font');
  await page.locator('#map-fit').click();
  await page.screenshot({path:out+'/overview-'+width+'.png'});
  if(width===1440){
   for(const d of data.dimensions.filter(d=>!d.primary)){
    await page.locator('#map-interior').selectOption(d.id);
    await page.waitForFunction(({image})=>{const img=document.querySelector('.native-interior-map');return img?.src.endsWith(image.replace('./',''))&&img.complete&&img.naturalWidth>0;},{image:d.image});
    assert.equal(await page.locator('.native-interior-map').evaluate(e=>e.naturalWidth),d.width);
    assert.equal(await page.locator('#map-resolution').innerText(),`原生小地图 ${d.width} × ${d.height}`);
   }
  }
  const interior=data.dimensions.find(d=>d.nativeTag==='SW.Area.Meadow.A2.MeadowFortress');
  await page.locator('#map-interior').selectOption(interior.id);
  await page.waitForFunction(()=>document.querySelector('.native-interior-map')?.complete);
  await page.screenshot({path:out+'/interior-'+width+'.png'});
  const spawn=interior.markers[0];
  await page.goto('http://127.0.0.1:8080/map/'+interior.id+'/#'+new URLSearchParams({map:interior.id,marker:spawn.id}));
  await page.locator('.map-species-entry').first().waitFor();
  assert.equal(await page.locator('.map-species-entry').count(),spawn.species.length);
  if(spawn.zone.length)await page.locator('.leaflet-overlay-pane canvas').waitFor();
  await page.locator('.map-found-button').click();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.reload();await page.locator('.map-species-entry').first().waitFor();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.waitForFunction(()=>{
   const map=document.getElementById('world-map').getBoundingClientRect(),popup=document.querySelector('.leaflet-popup').getBoundingClientRect();
   return popup.top>=map.top&&popup.bottom<=map.bottom&&popup.left>=map.left&&popup.right<=map.right;
  });
  const close=await page.locator('.leaflet-popup-close-button').boundingBox();assert.ok(close.width>=40&&close.height>=40);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Native map popup must not overflow mobile');
  await page.screenshot({path:out+'/spawn-'+width+'.png'});
  const target=await page.locator('.map-species-entry[href]').first().getAttribute('href');
  await page.locator('.map-species-entry[href]').first().click();
  await page.locator('.database-dialog[open]').waitFor();assert.ok(page.url().includes(target));
  const checked=[];
  for(const name of ['storm','database','collection','planner','builds','compare']){
   await page.goto('http://127.0.0.1:8080/'+name+'/');
   await page.waitForFunction(name=>{const p=document.getElementById(name+'-panel');return p&&!p.hidden&&p.getAttribute('aria-busy')!=='true';},name);
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(0, 0, 0)');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' native font overflow at '+width);
   const family=await page.locator('#'+name+'-panel h2').first().evaluate(e=>getComputedStyle(e).fontFamily);
   assert.match(family,/Dungeons Sixteen/);
   checked.push(name);
   if(width!==320)await page.screenshot({path:out+'/'+name+'-'+width+'.png'});
  }
  await page.locator('.settings-trigger').click();await page.locator('#font-choice').selectOption('system');
  assert.doesNotMatch(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Dungeons Sixteen/);
  await page.locator('#font-choice').selectOption('default');
  assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).fontFamily),/Dungeons Sixteen/);
  assert.deepEqual(errors,[]);
  reports.push({width,nativeChineseFonts:fonts,indoorMaps:23,popupAndPolygon:true,foundRecordPersists:true,localSpeciesDetails:true,blackBackground:true,pages:checked,errors});
  console.log(width,'native fonts, indoor maps, spawn bounds, links, progress and all page layouts passed');
  await page.close();
 }
 await fs.writeFile(out+'/verification.json',JSON.stringify(reports,null,2));
}finally{await browser.close();}
