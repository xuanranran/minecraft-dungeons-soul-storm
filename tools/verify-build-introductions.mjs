import assert from 'node:assert/strict';
import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=process.env.EXPLORER_URL||'http://127.0.0.1:8080/';
try{
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},isMobile:width<760,hasTouch:width<760}),errors=[],popups=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('popup',p=>popups.push(p.url()));await page.emulateMedia({colorScheme:'dark'});
  const ready=async view=>{await page.locator('#'+view+'-panel[aria-busy="false"]').waitFor();await page.evaluate(()=>document.fonts.ready);};
  for(const view of ['collection','planner','builds','compare']){
   await page.goto(base+'#'+view);await ready(view);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),width+' '+view+' overflow');
   const selectors={collection:'.tool-grid .tool-item-picture',planner:'.tool-inline-choice .tool-item-picture',builds:'.tool-build-icons .tool-item-picture',compare:'.tool-compare-pick .tool-item-picture'};
   const size=await page.locator(selectors[view]).first().boundingBox(),expected={collection:width<760?48:56,planner:40,compare:width<760?48:56};if(view==='builds')assert.ok(size.width>=32&&size.width<=64);else assert.equal(size.width,expected[view],width+' '+view+' native slot size');
   if(width===1440||width===390)await page.screenshot({path:'tool-references/local-'+view+'-'+width+'.png',fullPage:false});
  }
  await page.goto(base+'#builds&build=2-tumbleshot-close-ranger');await ready('builds');
  const dialog=page.locator('.build-introduction-dialog[open]');await dialog.locator('.equipment-card').nth(11).waitFor({state:'attached'});
  assert.equal(await dialog.locator('.equipment-card').count(),12);assert.equal(await dialog.locator('.tool-build-detail-item').count(),12);
  assert.equal(await dialog.locator('.build-detail-guide section').count(),4);assert.equal(await dialog.locator('.build-detail-enchantment').count(),5);
  assert.match(await dialog.innerText(),/暴击箭袋/);assert.match(await dialog.innerText(),/2026年10月4日/);
  await dialog.getByRole('tab',{name:'装备详情'}).click();const banner=dialog.locator('.equipment-card').filter({has:page.getByRole('heading',{name:'战旗',exact:true})});assert.match(await banner.innerText(),/10 秒/);assert.match(await banner.innerText(),/45/);
  assert.ok(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth),width+' dialog overflow');
  if(width===1440||width===390)await page.screenshot({path:'tool-references/local-build-introduction-'+width+'.png'});
  const url=page.url();await dialog.getByRole('button',{name:'关闭窗口'}).click();assert.equal(page.url(),url);
  await page.locator('.tool-build-title').first().click();await page.locator('.build-introduction-dialog[open] .equipment-card').nth(11).waitFor({state:'attached'});
  await page.locator('.build-introduction-dialog[open]').getByRole('link',{name:'复制并编辑',exact:true}).click();await ready('planner');
  assert.equal(await page.locator('.tool-slot .tool-item-picture').count(),12);assert.ok(page.url().includes('#planner&'));
  assert.deepEqual(errors,[]);assert.deepEqual(popups,[]);await page.close();console.log(width+': matched slot sizes, translated local guide, 12 configured gear cards, effects/enchantments, shared build link and mobile bounds passed.');
 }
}finally{await browser.close();}
