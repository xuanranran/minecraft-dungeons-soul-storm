import assert from 'node:assert/strict';
import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.SITE_TEST_URL||'http://127.0.0.1:8080/',browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const test of [{path:'builds/',pattern:'**/assets/build-detail-*.js',click:'.tool-build-title'},{path:'database/weapons/awesomeaxe/',pattern:'**/data/database/weapons.json*'}]){
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let release,started;const gate=new Promise(r=>release=r),received=new Promise(r=>started=r);
 await page.route(test.pattern,async route=>{started(route.request().url());await gate;await route.continue();});
 await page.goto(new URL(test.path,base).href);
 if(test.click){await page.locator('#builds-panel[aria-busy=false]').waitFor();await page.locator(test.click).first().click();}
 const blocked=await received;await page.locator('[data-page-tab=collection]').click();await page.locator('#collection-panel[aria-busy=false]').waitFor();
 const loaded=page.waitForResponse(r=>r.url()===blocked);release();const response=await loaded;await response.finished();
 if(blocked.includes('/assets/'))await page.evaluate(url=>import(url),blocked);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
 assert.equal(await page.locator('dialog[open]').count(),0,'stale popup after leaving '+test.path);assert.equal(await page.evaluate(()=>document.documentElement.dataset.view),'collection');assert.deepEqual(errors,[]);
 await page.close();console.log(test.path+': delayed response discarded after navigation; no stale dialog.');
}}finally{await browser.close();}
