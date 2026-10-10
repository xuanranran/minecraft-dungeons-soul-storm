import assert from 'node:assert/strict';
import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],newPages=[];
  page.on('pageerror',e=>errors.push(e.message));page.context().on('page',p=>{if(p!==page)newPages.push(p.url());});
  await page.emulateMedia({colorScheme:'dark'});
  const ready=async name=>page.locator('#'+name+'-panel[aria-busy="false"]').waitFor();
  await page.goto('http://127.0.0.1:8080/#collection');await ready('collection');
  const check=page.locator('.tool-owned input').first();await check.check();
  assert.equal(await page.locator('.tool-owned input').first().isChecked(),true);
  await page.reload();await ready('collection');assert.equal(await page.locator('.tool-owned input').first().isChecked(),true);
  const popup=page.waitForEvent('filechooser');await page.getByRole('button',{name:'导入记录',exact:true}).click();
  await (await popup).setFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'dungeons-collection',version:1,owned:['not-an-item'],wanted:[]}))});
  await page.getByText('备份格式不正确，未修改现有记录。',{exact:true}).waitFor();assert.equal(await page.locator('.tool-owned input').first().isChecked(),true);
  await page.goto('http://127.0.0.1:8080/#builds');await ready('builds');
  const first=page.locator('.tool-build-card').first(),gear=first.locator('.tool-gear-button').first();
  if(width===1440){
   await gear.hover();const tip=page.locator('#native-equipment-tooltip:popover-open');await tip.locator('.equipment-tip-enchant-box').waitFor();
   assert.match(await tip.innerText(),/已附魔/);assert.ok(await tip.locator('.equipment-tip-effect').count()>=2);
   const bounds=await tip.boundingBox();assert.equal(bounds.width,380);assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=1001);
   await page.mouse.move(0,0);assert.equal(await tip.count(),0);await gear.hover();await tip.waitFor();await first.evaluate(n=>n.hidden=true);await tip.waitFor({state:'hidden'});assert.equal(await page.locator('#native-equipment-tooltip').evaluate(n=>n.hidden),true);await first.evaluate(n=>n.hidden=false);await gear.hover();await tip.waitFor();
   await page.screenshot({path:'explorer-hover-1440.png'});await page.keyboard.press('Escape');assert.equal(await page.locator('#native-equipment-tooltip:popover-open').count(),0);
  }
  await first.locator('.tool-build-title').click();await page.locator('dialog[open] .tool-build-detail').waitFor();
  await page.locator('dialog[open] .tool-build-detail-item').nth(8).waitFor();assert.ok(await page.locator('dialog[open] .tool-build-detail-item').count()>=9);assert.ok(page.url().includes('#builds'));assert.equal(newPages.length,0);
  await page.locator('dialog[open]').getByRole('button',{name:'关闭窗口'}).click();
  await gear.click();await page.locator('dialog[open] .drop-detail-panel').waitFor();
  assert.ok(page.url().includes('#builds'));assert.equal(newPages.length,0);
  await page.locator('dialog[open]').getByRole('button',{name:'关闭窗口'}).click();
  await first.getByRole('link',{name:'载入规划器',exact:true}).click();await ready('planner');
  assert.equal(await page.locator('.tool-slot .tool-item-picture').count(),12);
  await page.locator('[data-slot="a1"]').click();assert.equal(await page.locator('.tool-editor').getByText('使用附魔',{exact:true}).count(),0);
  await page.locator('[data-slot="melee"]').click();assert.equal(await page.locator('.tool-editor').getByText('使用附魔',{exact:true}).count(),1);
  await page.getByRole('button',{name:'保存配装',exact:true}).click();await page.getByLabel('配装名称',{exact:true}).fill('浏览器验证配装');
  await page.getByRole('button',{name:'保存到我的配装',exact:true}).click();
  await page.goto('http://127.0.0.1:8080/#builds&mine=1');await ready('builds');assert.equal(await page.locator('.tool-build-title').first().innerText(),'浏览器验证配装');
  await page.reload();await ready('builds');assert.equal(await page.locator('.tool-build-title').first().innerText(),'浏览器验证配装');
  await page.goto('http://127.0.0.1:8080/#compare');await ready('compare');
  const before=await page.locator('.tool-compare-pick').first().innerText();await page.getByRole('button',{name:'交换左右',exact:true}).click();
  assert.equal(await page.locator('.tool-compare-pick').first().innerText()===before,false);
  for(const name of ['collection','planner','builds','compare']){
   await page.goto('http://127.0.0.1:8080/#'+name);await ready(name);await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,width+' '+name+' horizontal overflow');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(newPages,[]);await page.close();
  console.log(width+': collection persistence and rejected invalid import, local build/item clicks, populated planner, artifact restrictions, saved build reload, weapon swap, hover and responsive layout passed.');
 }
}finally{await browser.close();}
