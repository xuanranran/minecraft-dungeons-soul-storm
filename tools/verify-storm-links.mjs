import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRotation} from '../dist/schedule.mjs';
const settings=JSON.parse(fs.readFileSync(new URL('../dist/rotation.json',import.meta.url))),R=createRotation(settings);
const worlds=JSON.parse(fs.readFileSync(new URL('../dist/maps.json',import.meta.url))).dimensions,now=Date.parse('2026-10-10T14:45:00+08:00');
const time=ms=>new Date(ms+8*3600000).toISOString().slice(11,16);
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true}),base='http://127.0.0.1:8080/';
try{
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://timeapi.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({dateTime:'2026-10-10T14:45:00+08:00'})}));
  for(const [i,area] of R.places.entries()){
   const world=worlds.find(d=>d.markers.some(m=>m.generator&&m.area===area)),marker=world.markers.find(m=>m.generator&&m.area===area),expected=R.region(R.defaultAnchor,settings.anchorRegion,now,i);
   await page.goto(base+'#map='+world.id+'&marker='+marker.id);await page.locator('.map-storm-tracker').waitFor();
   await page.locator('.map-storm-tracker').click();await page.locator('#region-result').waitFor();
   assert.equal(await page.locator('#region').inputValue(),String(i));assert.match(await page.locator('#region-state').innerText(),new RegExp(area));
   assert.equal(await page.locator('#region-label').innerText(),expected.active?'距离该地区结束':'距离该地区开始');
   assert.ok((await page.locator('#region-period').innerText()).includes(`${time(expected.start)} – ${time(expected.end)}`));
   const countdown=await page.locator('#region-countdown').innerText();assert.match(countdown,/^\d+:\d{2}(?::\d{2})?$/);
   assert.match(await page.locator('#table-title').innerText(),new RegExp(area));
   assert.ok((await page.locator('.schedule-drop').allTextContents()).every(name=>name===area));
   const card=await page.locator('.query-card').boundingBox(),header=await page.locator('.site-topbar').boundingBox(),result=await page.locator('#region-result').boundingBox();
   assert.ok(card.y>=header.height-1&&result.y+result.height<=900,'Region query and countdown are visible beneath the top bar');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'query-heading');
   assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('region'),area);
   if(area==='冰封高地')await page.screenshot({path:`storm-region-link-${width}.png`});
  }
  await page.reload();await page.locator('#region-result').waitFor();assert.equal(await page.locator('#region').inputValue(),'6','Bookmark/reload preserves linked region');
  await page.locator('#region').selectOption('1');assert.equal(new URLSearchParams(new URL(page.url()).hash.slice(1)).get('region'),'冰封高地');
  await page.locator('#region').selectOption('-1');assert.equal(new URL(page.url()).hash,'#storm');assert.equal(await page.locator('#region-result').isVisible(),false);
  await page.goto(base+'#storm&region='+encodeURIComponent('未知地区'));await page.locator('.storm-map-link').last().waitFor();assert.equal(await page.locator('#storm-tab').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#region').inputValue(),'-1');
  assert.deepEqual(errors,[]);console.log(width,'all 7 generator regions, active/upcoming state, filtered schedule, countdown, query focus and reload passed');await page.close();
 }
}finally{await browser.close()}
