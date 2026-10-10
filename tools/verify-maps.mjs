import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&!r.url().includes('timeapi')&&!r.url().includes('worldtime'))errors.push(`${r.status()} ${r.url()}`)});
  await page.goto('http://127.0.0.1:8080');await page.locator('.map-category').first().waitFor({state:'attached'});await page.locator('#theme').selectOption('dark');await page.locator('#font-choice').selectOption('default');
  assert.equal(await page.locator('[data-page-tab="map"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.map-category').count(),14);
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(e=>e.complete&&e.naturalWidth===1024));
  await page.locator('#map-search').fill('矿车站');assert.equal(await page.locator('.map-search-result').count(),18);await page.locator('.map-search-result').first().click();await page.locator('.leaflet-popup').waitFor();
  const url=page.url();assert.ok(url.includes('marker='));await page.locator('.map-found-button').click();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');await page.reload();await page.locator('.map-found-button').waitFor();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.locator('.leaflet-popup-close-button').click();await page.locator('#map-hide-found').check();await page.locator('#map-search').fill('矿车站');assert.equal(await page.locator('.map-search-result').count(),17);await page.locator('#map-reset-found').click();assert.equal(await page.locator('.map-search-result').count(),18);await page.locator('#map-search').fill('');await page.locator('#map-hide-found').uncheck();
  await page.locator('#map-show-all').click();assert.equal(await page.locator('.map-category input:checked').count(),14);await page.locator('#map-hide-all').click();assert.equal(await page.locator('.map-category input:checked').count(),0);assert.match(await page.locator('#map-count').innerText(),/^0 \/ 1112/);await page.locator('#map-show-all').click();
  for(const [world,count] of [['sift',500],['camp',5],['overworld',1112]]){await page.locator(`[data-map-world="${world}"]`).click();await page.waitForFunction(({count})=>document.getElementById('map-count').textContent.includes(`/ ${count}`),{count});await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(e=>e.complete&&e.naturalWidth===1024));}
  await page.locator('#map-fit').click();await page.screenshot({path:`map-complete-${width}.png`});
  await page.locator('#storm-tab').click();await page.locator('.storm-map-link').last().waitFor();assert.equal(await page.locator('.storm-map-link').count(),7);await page.locator('.schedule-drop').first().click();await page.locator('#drops-dialog').waitFor();await page.locator('.drop-item').first().waitFor();await page.locator('#drops-close').click();
  await page.screenshot({path:`storm-map-rotation-${width}.png`,fullPage:true});
  for(const [area,count] of [['咆哮树林',7],['吟唱者草甸',8],['多雨平原',8],['轰鸣虫壳地',8],['安眠丘陵',8],['冰封高地',8],['蜜脾原野',5]]){await page.locator('#storm-tab').click();await page.locator(`#storm-rotation-list [data-map-storm="${area}"]`).click();await page.locator('#map-focus').waitFor();assert.equal(await page.locator('.is-generator').count(),count);assert.match(await page.locator('#map-focus-name').innerText(),new RegExp(`${count} 个`));await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(e=>e.complete&&e.naturalWidth===1024));}
  await page.screenshot({path:`map-generators-${width}.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(errors.length,0,errors.join('\n'));
  console.log(width,'world switching, search, deep link, progress persistence, 14 filters, 7 generator groups and drops passed');await page.close();
 }
}finally{await browser.close()}
