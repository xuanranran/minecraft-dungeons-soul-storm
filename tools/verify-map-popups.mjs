import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8080/#map=overworld&marker=chest-2450-4088');await page.locator('.map-popup-name').waitFor();
  assert.equal(await page.locator('.map-popup-name').innerText(),'宝箱');assert.equal(await page.locator('.map-popup-area').innerText(),'蜜脾原野');
  const popup=page.locator('.native-place-popup');
  assert.equal(await popup.locator('.leaflet-popup-content-wrapper').evaluate(e=>getComputedStyle(e).borderRadius),'0px');
  await page.locator('.map-found-button').click();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.keyboard.press('Space');assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'false');
  await page.locator('.map-found-button').click();await page.reload();await page.locator('.map-found-button').waitFor();assert.equal(await page.locator('.map-found-button').getAttribute('aria-pressed'),'true');
  await page.evaluate(()=>{navigator.clipboard.writeText=async text=>{window.copiedPosition=text;};});
  await page.locator('.map-share-button').click();assert.equal(await page.locator('.map-share-button').innerText(),'已复制');
  assert.match(await page.evaluate(()=>window.copiedPosition),/#map=overworld&marker=chest-2450-4088$/);
  await popup.screenshot({path:`popup-chest-${width}.png`});
  await page.locator('.leaflet-popup-close-button').click();assert.equal(await page.locator('.native-place-popup').count(),0);
  await page.goto('http://127.0.0.1:8080/#map=overworld&marker=station-2769-3640');await page.locator('.map-popup-name').waitFor();assert.equal(await page.locator('.map-popup-name').innerText(),'蜜脾农场');
  await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('Clipboard unavailable');};});
  await page.locator('.map-share-button').click();const fallback=page.locator('.map-share-url');await fallback.waitFor();assert.match(await fallback.inputValue(),/marker=station-2769-3640$/);assert.equal(await fallback.getAttribute('aria-label'),'此地点的位置链接');
  await page.goto('http://127.0.0.1:8080/#map=overworld&marker=storm-5041-7759');await page.locator('.map-popup-name').waitFor();
  assert.equal(await page.locator('.map-popup-name').innerText(),'风暴生成器');assert.ok(await page.locator('.map-popup-note').isVisible());const target=new URLSearchParams((await page.locator('.map-storm-tracker').getAttribute('href')).slice(1));assert.ok(target.has('storm'));assert.equal(target.get('region'),'多雨平原');
  const container=await page.locator('#world-map').boundingBox(),bounds=await popup.boundingBox();
  assert.ok(bounds.x>=container.x-2&&bounds.x+bounds.width<=container.x+container.width+2,`${width}: popup fits map width`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await popup.screenshot({path:`popup-generator-${width}.png`});
  await page.locator('.map-storm-tracker').click();await page.locator('#region-result').waitFor();assert.equal(await page.locator('#storm-tab').getAttribute('aria-selected'),'true');assert.equal(await page.locator('#region option:checked').innerText(),'多雨平原');assert.match(await page.locator('#region-state').innerText(),/多雨平原/);assert.notEqual(await page.locator('#region-countdown').innerText(),'—');
  assert.deepEqual(errors,[]);console.log(width,'game-style popup, found persistence, keyboard toggle, copy/fallback and storm link passed');await page.close();
 }
}finally{await browser.close()}
