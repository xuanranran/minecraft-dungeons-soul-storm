import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.STORM_TEST_URL||'http://127.0.0.1:8080/';
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('artifacts/native-database',{recursive:true});
try{for(const theme of ['light','dark'])for(const width of [1440,390,320]){
 const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme,isMobile:width<760,hasTouch:width<760}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'#database&category=enemies&item=zombie');
 const dialog=page.locator('.database-dialog[open]');await dialog.locator('.database-native-section').first().waitFor();
 assert.equal(await dialog.locator('.database-native-section').count(),3);
 assert.equal(await dialog.locator('.database-native-section[open]').count(),0);
 const values=dialog.locator('.database-native-section').filter({has:page.getByText(/原生属性（定义值）/)});
 await values.locator('summary').click();assert.match(await values.innerText(),/生命\s+8/);
 const abilities=dialog.locator('.database-native-section').filter({has:page.getByText(/原生能力参数 ·/)});
 await abilities.locator('summary').click();assert.match(await abilities.innerText(),/轻击\s+伤害\s+6\s+覆盖/);
 const variants=dialog.locator('.database-native-section').filter({has:page.getByText(/原生变种替换规则 ·/)});
 await variants.locator('summary').click();assert.match(await variants.innerText(),/0.2\s+禁用/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
 assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth+1),false,'dialog horizontal overflow');
 await dialog.screenshot({path:'artifacts/native-database/zombie-'+theme+'-'+width+'.png'});
 await dialog.getByRole('button',{name:'关闭窗口'}).click();
 await page.goto(base+'#database&category=enemies&item=wolf');
 await page.locator('.database-dialog[open] .database-native-section').first().waitFor();
 const image=page.locator('.database-dialog[open] .database-detail-hero img');
 await image.evaluate(n=>n.complete?Promise.resolve():new Promise((resolve,reject)=>{n.onload=resolve;n.onerror=reject;}));
 assert.match(await image.getAttribute('src'),/T_UI_Wolf_Companion.png/);assert.ok(await image.evaluate(n=>n.naturalWidth>0));
 await page.locator('.database-dialog[open]').getByRole('button',{name:'关闭窗口'}).click();
 await page.goto(base+'#map=overworld');await page.locator('#map-panel[aria-busy=false]').waitFor();
 if(width>760){const icon=page.locator('.map-category img[src*=T_UI_Icon_Category_Talisman]').first();await icon.scrollIntoViewIfNeeded();await icon.evaluate(n=>n.complete?Promise.resolve():new Promise((resolve,reject)=>{n.onload=resolve;n.onerror=reject;}));assert.equal(await icon.evaluate(n=>getComputedStyle(n).filter),theme==='light'?'brightness(0)':'none');assert.ok(await icon.evaluate(n=>n.naturalWidth>0));}
 const images=JSON.parse(await readFile('public/data/database/enemies.json','utf8')).items.map(r=>r.image);
 const results=await page.evaluate(async paths=>Promise.all(paths.map(path=>new Promise(resolve=>{const image=new Image;image.onload=()=>resolve(image.naturalWidth>0);image.onerror=()=>resolve(false);image.src=path;}))),images);
 assert.ok(results.every(Boolean),'every species image loads');assert.deepEqual(errors,[]);
 console.log(theme+' '+width+': native stats, conditional variants, original species icons, map category visibility and all 133 species images passed.');await page.close();
}}finally{await browser.close();}
