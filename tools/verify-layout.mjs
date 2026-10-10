import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
const base='http://127.0.0.1:8080';
let currentPage;
async function pageAt(width,hash=''){
 const page=await browser.newPage({viewport:{width,height:width>760?1000:844}}),requests=[],errors=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400&&!/timeapi|worldtime/.test(r.url()))errors.push(`${r.status()} ${r.url()}`)});
 await page.route('https://timeapi.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({dateTime:'2026-10-10T14:40:00+08:00'})}));
 currentPage=page;await page.goto(base+'/'+hash);return {page,requests,errors};
}
const networkBytes=page=>page.evaluate(()=>{
 const resources=performance.getEntriesByType('resource').filter(r=>/\.(?:m?js|css)(?:\?|$)/.test(r.name));
 return resources.reduce((sum,r)=>sum+r.encodedBodySize,0);
});
try{
 for(const width of [1440,390]){
  const {page,requests,errors}=await pageAt(width,'#storm');
  await page.locator('.storm-map-link').last().waitFor();
  assert.equal(requests.some(p=>/leaflet|\/maps\.mjs|data\/maps\/(overworld|sift|camp)\.json|drops\.mjs|equipment/.test(p)),false,'Storm cold route must not load map or equipment bundles');
  const stormBytes=await networkBytes(page);
  assert.ok(await page.locator('#countdown').innerText()!=='—');
  assert.ok(await page.locator('.site-topbar').evaluate(e=>e.getBoundingClientRect().height)<(width>760?80:118));
  await page.locator('.settings-trigger').click();await page.locator('#theme').selectOption('dark');await page.locator('#font-choice').selectOption('default');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#site-settings').evaluate(e=>e.open),false);
  await page.screenshot({path:`layout-storm-dark-${width}.png`,fullPage:true});
  await page.locator('#current-drops').click();await page.locator('.drop-item').first().waitFor();
  assert.ok(requests.includes('/data/equipment/index.json'));assert.equal(requests.includes('/equipment.json'),false);
  assert.equal(requests.some(p=>p.includes('/data/equipment/items/')||p.includes('equipment-details.mjs')),false,'Details are deferred until expanded');
  await page.locator('.drop-item').first().click();const details=page.locator('.database-dialog[open]');await details.locator('.database-parameter-table td').first().waitFor();
  assert.ok(requests.some(p=>p.includes('/data/equipment/items/')));assert.ok(requests.some(p=>p.includes('/assets/database-detail-')));
  await page.screenshot({path:`layout-equipment-${width}.png`,fullPage:true});
  await details.getByRole('button',{name:'关闭窗口'}).click();await page.locator('.drops-tab[data-category="法器"]').click();await page.waitForFunction(()=>document.querySelector('.drop-item.artifact'));
  await page.locator('.drop-item.artifact').first().click();await details.getByRole('tab',{name:'附魔',exact:true}).click();await details.locator('.native-book').first().waitFor();
  await page.screenshot({path:`layout-artifacts-${width}.png`,fullPage:true});
  await details.getByRole('button',{name:'关闭窗口'}).click();await page.locator('#drops-close').click();
  await page.locator('#region').selectOption('3');assert.match(await page.locator('#table-title').innerText(),/咆哮树林/);
  await page.locator('#horizon').selectOption('168');assert.ok(await page.locator('#schedule tr').count()>=35);
  await page.locator('#region').selectOption('-1');await page.locator('#horizon').selectOption('24');
  await page.locator('.calibration-panel:not(.alarm-panel)>summary').click();await page.locator('#anchor-date').fill('2026-10-06');await page.locator('#anchor-time').fill('12:00');await page.locator('#anchor-region').selectOption('0');await page.locator('#calibration button[type=submit]').click();assert.match(await page.locator('#save-message').innerText(),/已保存/);
  await page.locator('#map-tab').click();await page.locator('.map-category').first().waitFor({state:'attached'});
  assert.equal(requests.includes('/data/maps/overworld.json'),true);assert.equal(requests.includes('/maps.json'),false);assert.equal(requests.includes('/data/maps/sift.json'),false);assert.equal(requests.includes('/data/maps/camp.json'),false);
  await page.waitForFunction(()=>[...document.querySelectorAll('.leaflet-tile')].some(e=>e.complete&&e.naturalWidth===1024));
  await page.screenshot({path:`layout-map-dark-${width}.png`,fullPage:true});
  const initialIcon=await page.locator('.native-map-marker').first().getAttribute('src');
  await page.locator('#map-search').fill('矿车站');await page.waitForFunction(()=>document.querySelectorAll('.map-search-result').length===18);await page.locator('.map-search-result').first().click();await page.locator('.leaflet-popup').waitFor();await page.locator('.map-found-button').click();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.locator('.leaflet-popup-close-button').click();await page.locator('#map-expand').click();assert.equal(await page.locator('#map-expand').getAttribute('aria-pressed'),'true');await page.keyboard.press('Escape');assert.equal(await page.locator('#map-expand').getAttribute('aria-pressed'),'false');
  await page.locator('[data-map-world="sift"]').click();await page.waitForFunction(()=>document.getElementById('map-count').textContent.includes('/ 500'));
  await page.locator('[data-map-world="camp"]').click();await page.waitForFunction(()=>document.getElementById('map-count').textContent.includes('/ 5'));
  await page.locator('#storm-tab').click();await page.locator('#storm-rotation-list [data-map-storm="咆哮树林"]').click();await page.waitForFunction(()=>document.querySelectorAll('.is-generator').length===7);
  await page.screenshot({path:`layout-generators-${width}.png`,fullPage:true});
  await page.locator('.settings-trigger').click();await page.locator('#theme').selectOption('light');await page.keyboard.press('Escape');await page.screenshot({path:`layout-map-light-${width}.png`,fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow');
  await page.evaluate(()=>window.scrollTo(0,500));assert.ok(await page.locator('.site-topbar').evaluate(e=>Math.abs(e.getBoundingClientRect().top)<1));
  const settingsOpen=page.locator('.settings-trigger');await settingsOpen.click();await page.locator('#font-choice').selectOption('mojangles');await page.keyboard.press('Escape');await page.reload();await page.locator('.map-category').first().waitFor({state:'attached'});assert.equal(await page.locator('html').getAttribute('data-font'),'mojangles');
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(width,`layout, lazy loading (${stormBytes} bytes storm JS/CSS), all detail variants, settings, schedule, calibration and map links passed`);await page.close();
 }
 // A saved alarm must restore on the map route, and its alert must stay outside hidden panels.
 const alarm=await browser.newPage({viewport:{width:390,height:844}});
 await alarm.addInitScript(()=>localStorage.setItem('map-rotation-alarm-v1',JSON.stringify({enabled:true,region:0,minutes:5,sound:false})));
 await alarm.route('https://timeapi.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({dateTime:'2026-10-10T18:35:00+08:00'})}));
 await alarm.goto(base+'/');await alarm.waitForFunction(()=>document.getElementById('alarm-status').textContent.includes('提前 5 分钟'));
 await alarm.locator('#alarm-alert').waitFor();
 assert.ok(await alarm.locator('#alarm-alert').evaluate(e=>!e.closest('[role=tabpanel]')));await alarm.close();
 // Narrow screens and tablet width retain a single page width.
 for(const width of [320,768,1024]){const {page,errors}=await pageAt(width,'#storm');await page.locator('.storm-map-link').last().waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}: overflow`);assert.equal(errors.length,0);await page.close();}
 console.log('Saved alarm restoration and 320/768/1024px responsive checks passed');
}catch(error){if(currentPage&&!currentPage.isClosed()){console.log('Failed URL:',currentPage.url());console.log(await currentPage.locator('body').innerText());await currentPage.screenshot({path:'layout-failure.png',fullPage:true});}throw error;}finally{await browser.close()}
