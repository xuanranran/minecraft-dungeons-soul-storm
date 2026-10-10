import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [320,390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://timeapi.io/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({dateTime:'2026-10-10T14:45:00+08:00'})}));
  await page.goto('http://127.0.0.1:8080/#storm');
  await page.locator('.storm-map-link.is-active').waitFor();
  assert.equal(await page.locator('.storm-map-link.is-active').count(),1);
  assert.equal(await page.locator('.storm-map-link.is-active').getAttribute('data-map-storm'),'冰封高地');
  assert.equal(await page.locator('.storm-map-link.is-active').getAttribute('aria-current'),'true');
  assert.equal(await page.locator('.storm-map-state:visible').innerText(),'开启中');
  await page.locator('.settings-trigger').click();await page.locator('#theme').selectOption('dark');await page.locator('#font-choice').selectOption('mojangles');await page.keyboard.press('Escape');
  await page.locator('.alarm-panel>summary').click();
  await page.evaluate(()=>document.fonts.ready);
  const check=await page.locator('.alarm-check').boundingBox(),controls=await page.locator('#alarm-form .controls').boundingBox(),actions=await page.locator('.alarm-actions').boundingBox();
  assert.ok(check.y-controls.y-controls.height>=14,'Alarm controls need breathing room');
  assert.ok(actions.y-check.y-check.height>=14,'Alarm buttons need breathing room');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if([390,1440].includes(width))await page.screenshot({path:`layout-alarm-active-${width}.png`,fullPage:true});
  await page.locator('.calibration-panel:not(.alarm-panel)>summary').click();
  await page.locator('#anchor-time').fill('12:20');await page.locator('#calibration button[type=submit]').click();
  assert.equal(await page.locator('.storm-map-link.is-active').count(),0,'Closed period clears highlight');
  assert.equal(await page.locator('.storm-map-state:visible').count(),0);
  await page.locator('#anchor-time').fill('12:40');await page.locator('#calibration button[type=submit]').click();
  assert.equal(await page.locator('.storm-map-link.is-active').getAttribute('data-map-storm'),'安眠丘陵','Changing rotation updates the active region');
  await page.locator('#map-tab').click();await page.locator('.map-category').first().waitFor({state:'attached'});
  assert.doesNotMatch(await page.locator('.map-source-note').innerText(),/dungeons\.tools|地点坐标参考/);
  if(width<=760){
   assert.equal(await page.locator('.map-sidebar #map-filter-details').count(),0,'Mobile filters must not take space above map');
   await page.locator('#map-filter-toggle').click();assert.equal(await page.locator('#map-filter-dialog').evaluate(e=>e.open),true);
   await page.locator('#map-hide-all').click();assert.match(await page.locator('#map-count').innerText(),/^0 \//);
   const categoryCount=await page.locator('.map-category').count();
   assert.equal(await page.locator('#map-floating-caption').innerText(),`0/${categoryCount}`);
   await page.locator('#map-show-all').click();assert.equal(await page.locator('#map-floating-caption').innerText(),`${categoryCount}/${categoryCount}`);
   if(width===390)await page.screenshot({path:'layout-mobile-filter-sheet.png'});
   await page.keyboard.press('Escape');assert.equal(await page.locator('#map-filter-dialog').evaluate(e=>e.open),false);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'map-filter-toggle');
   await page.locator('#map-expand').click();await page.locator('#map-filter-toggle').click();await page.keyboard.press('Escape');
   assert.equal(await page.locator('#map-expand').getAttribute('aria-pressed'),'true','Closing filters keeps focus mode');
   await page.locator('#map-filter-toggle').click();await page.mouse.click(4,150);assert.equal(await page.locator('#map-filter-dialog').evaluate(e=>e.open),false,'Backdrop closes sheet');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#map-expand').getAttribute('aria-pressed'),'false');
   await page.locator('#map-filter-toggle').click();await page.setViewportSize({width:1000,height:900});
   assert.equal(await page.locator('#map-filter-dialog').evaluate(e=>e.open),false);await page.locator('.map-sidebar .map-category').first().waitFor();
   await page.setViewportSize({width,height:900});await page.locator('#map-filter-toggle').click();await page.locator('#map-filter-close').click();
   if(width===390)await page.screenshot({path:'layout-mobile-floating-filter.png',fullPage:true});
  }else assert.equal(await page.locator('#map-filter-toggle').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log(width,'active region, phase transition, spacious alarm and responsive filters passed');await page.close();
 }
}finally{await browser.close()}
