import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.STORM_TEST_URL||'http://127.0.0.1:8080/';
const browser=await chromium.launch({channel:'msedge',headless:true});
await mkdir('artifacts/game-tooltip',{recursive:true});
try{
 for(const width of [390,320,844]){
  const page=await browser.newPage({viewport:{width,height:width===844?390:844},isMobile:true,hasTouch:true,colorScheme:'dark'}),errors=[];
  // crypto.randomUUID is absent on the LAN HTTP origin. UI identifiers must
  // remain usable there, not only on localhost/HTTPS.
  await page.addInitScript(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined}));
  page.on('pageerror',e=>errors.push(e.message));
  const tip=page.locator('#native-equipment-tooltip:popover-open'),ready=name=>page.locator('#'+name+'-panel[aria-busy=false]').waitFor();
  const tap=async target=>{await target.tap();await tip.locator('.equipment-tip-name').waitFor();await page.evaluate(()=>document.fonts.ready);const source=await target.boundingBox(),preview=await tip.boundingBox();assert.ok(preview.y>=source.y+source.height+31||preview.y+preview.height<=source.y-31,'touch preview must be above/below the clicked card');};
  const bounds=async()=>{
   const r=await tip.boundingBox(),art=await tip.locator(':scope > .equipment-tip-render').boundingBox(),v=page.viewportSize();
   assert.ok(r.x>=2&&r.y>=2&&r.x+r.width<=v.width-2&&r.y+r.height<=v.height-2,JSON.stringify(r));
   assert.ok(art.x+art.width<=v.width-2&&art.y>=2,'native overhang stays on screen');
   assert.ok(art.x+art.width>r.x+r.width,'item art overhangs');
   assert.equal(await tip.locator('.equipment-tip-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(0, 0, 0)');
   assert.ok(await tip.evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=15,'mobile native text is readable');
   assert.equal(await tip.getAttribute('data-interaction'),'tap');
  };
  const dismiss=async()=>{await page.touchscreen.tap(4,4);await tip.waitFor({state:'hidden'});};
  await page.goto(base+'#database&category=enchantments');await ready('database');
  // Tap the text as well as the icon: neither should open the old large dialog.
  const alchemy=page.locator('.database-item[data-id=ancient-alchemy]');
  await tap(alchemy.locator('.database-item-copy'));assert.equal(await page.locator('.database-dialog[open]').count(),0);
  assert.equal(await tip.locator('.equipment-tip-tier').count(),3);assert.match(await tip.innerText(),/30|45|60/);await bounds();
  assert.equal(await tip.locator('button').count(),0);assert.match(await tip.locator(':scope > .native-book').getAttribute('class'),/native-book/);
  await page.screenshot({path:'artifacts/game-tooltip/mobile-book-'+width+'.png'});
  await page.waitForTimeout(250);assert.equal(await tip.count(),1,'touch preview persists without hover');
  if(width===844){await tip.locator('.equipment-tip-scroll').evaluate(n=>n.scrollTop=100);await page.waitForTimeout(200);assert.equal(await tip.count(),1);assert.ok(await tip.locator('.equipment-tip-scroll').evaluate(n=>n.scrollTop)>0);}
  await dismiss();
  // Deep links, effects and artifacts all share the native renderer.
  for(const [category,id,kind] of [['effects','bounty-hunter','effect'],['artifacts','conductive-quiver','artifact']]){
   await page.goto(base+'#database&category='+category+'&item='+id);await ready('database');await tip.locator('.equipment-tip-name').waitFor();await bounds();
   assert.equal(await tip.locator('.equipment-tip-scroll').getAttribute('data-kind'),kind);assert.equal(await page.locator('.database-dialog[open]').count(),0);
   if(kind==='effect')assert.equal(await tip.locator('.equipment-tip-tier').count(),3);
   else assert.equal(await tip.locator('.equipment-tip-stat-icon').count(),2);
   await dismiss();
  }
  await page.goto(base+'#builds');await ready('builds');const gear=page.locator('.tool-gear-button').first();
  await tap(gear);await bounds();assert.equal(await tip.locator('.equipment-tip-strip').innerText(),'已装备');assert.equal(await tip.locator('.equipment-tip-enchant-label').innerText(),'已附魔');assert.ok(await tip.locator('.equipment-tip-effect').count()>=2);assert.equal(await page.locator('.database-dialog[open]').count(),0);
  await page.screenshot({path:'artifacts/game-tooltip/mobile-gear-'+width+'.png'});await dismiss();
  await tap(gear);await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await gear.getAttribute('aria-describedby'),null);
  await tap(gear);await page.evaluate(()=>scrollBy(0,80));await tip.waitFor({state:'hidden'});
  // Read-only item inspection inside a parent dialog must keep that dialog open.
  await page.locator('.tool-build-title').first().tap();await page.locator('dialog[open] .tool-build-detail-item').first().waitFor();
  await tap(page.locator('dialog[open] .tool-build-detail-item').first());await bounds();assert.equal(await page.locator('dialog[open]').count(),1);
  await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await page.locator('dialog[open]').count(),1);
  await page.locator('dialog[open]').getByRole('button',{name:'关闭窗口'}).tap();
  // Selection controls keep their original actions; ownership is independent.
  await page.goto(base+'#planner');await ready('planner');await page.locator('[data-slot=melee]').tap();
  await page.locator('.tool-inline-choice').first().tap();assert.equal(await tip.count(),0);assert.equal(await page.locator('[data-slot=melee] .tool-item-picture').count(),1);
  await page.locator('[data-slot=a1]').tap();assert.equal(await page.locator('.tool-editor .tool-section-heading').innerText(),'法器 1');assert.equal(await tip.count(),0);
  await page.goto(base+'#compare');await ready('compare');await page.getByRole('button',{name:'更换武器',exact:true}).first().tap();await page.locator('.tool-picker-option').first().tap();assert.equal(await tip.count(),0);assert.equal(await page.locator('.tool-picker[open]').count(),0);
  await page.goto(base+'#collection');await ready('collection');await page.locator('.tool-owned input').first().check();assert.equal(await tip.count(),0);assert.equal(await page.locator('.tool-owned input').first().isChecked(),true);
  await tap(page.locator('.tool-item-name').first());await page.goto(base+'#builds');await ready('builds');assert.equal(await tip.count(),0);
  // Region equipment retains full details. Only its effect/book rows use taps.
  await page.goto(base+'#storm');await ready('storm');await page.locator('#current-drops').tap();await page.locator('#drops-dialog .drop-item').first().waitFor();
  await page.locator('#drops-dialog .drop-item').first().tap();const detail=page.locator('.database-dialog[open]');await detail.locator('.database-parameter-table td').first().waitFor();assert.equal(await tip.count(),0);assert.equal(await page.locator('#drops-dialog[open]').count(),1);
  await detail.getByRole('tab',{name:'效果',exact:true}).tap();await tap(detail.locator('[data-detail-section=effects]:visible .database-effect-card').first());await bounds();assert.equal(await tip.locator('.equipment-tip-scroll').getAttribute('data-kind'),'effect');assert.equal(await page.locator('.database-dialog[open]').count(),1);
  await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await detail.count(),1);
  await detail.getByRole('tab',{name:'附魔',exact:true}).tap();await tap(detail.locator('[data-detail-section=enchantments]:visible .database-effect-card').first());await bounds();assert.equal(await tip.locator('.equipment-tip-scroll').getAttribute('data-kind'),'enchantment');assert.equal(await tip.locator('.equipment-tip-tier').count(),3);
  await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});await detail.getByRole('button',{name:'关闭窗口'}).tap();assert.equal(await page.locator('#drops-dialog[open]').count(),1);await page.locator('#drops-close').tap();
  assert.deepEqual(errors,[]);console.log(width+': native touch panels, tiers, actual build configuration, screen bounds, dismiss/scroll/navigation, parent dialogs and editing controls passed.');await page.close();
 }
 // Closing during a delayed load must never resurrect a touch panel.
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.route('**/data/explorer/catalogue.json',async route=>{await new Promise(r=>setTimeout(r,500));await route.continue();});
 await page.goto(base+'#database&category=enchantments');await page.locator('#database-panel[aria-busy=false]').waitFor();await page.locator('.database-item').first().tap();
 await page.locator('#native-equipment-tooltip:popover-open').waitFor();await page.touchscreen.tap(4,4);await page.waitForTimeout(800);assert.equal(await page.locator('#native-equipment-tooltip:popover-open').count(),0);await page.close();
}finally{await browser.close();}
