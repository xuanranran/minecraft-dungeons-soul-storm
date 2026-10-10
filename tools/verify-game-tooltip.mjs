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
 const page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'dark'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const tip=page.locator('#native-equipment-tooltip:popover-open');
 const ready=name=>page.locator('#'+name+'-panel[aria-busy=false]').waitFor();
 const show=async target=>{await page.mouse.move(0,0);await target.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await target.hover();await tip.locator('.equipment-tip-name').waitFor();await page.evaluate(()=>document.fonts.ready);};
 const within=async()=>{const r=await tip.boundingBox(),v=page.viewportSize();assert.ok(r.x>=11&&r.y>=11&&r.x+r.width<=v.width-11&&r.y+r.height<=v.height-11,JSON.stringify(r));assert.equal(await tip.locator('.equipment-tip-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),false);const art=await tip.locator(':scope > .equipment-tip-render').boundingBox();assert.ok(art.x+art.width<=v.width-11&&art.y>=11,'overhanging native image must stay on screen');};
 await page.goto(base+'#builds');await ready('builds');
 const first=page.locator('.tool-gear-button').first();await show(first);await within();
 assert.equal(await tip.locator('.equipment-tip-strip').innerText(),'已装备');
 assert.equal(await tip.locator('.equipment-tip-enchant-label').innerText(),'已附魔');
 assert.equal(await tip.locator('.equipment-tip-kind').isVisible(),false);
 assert.equal(await tip.evaluate(n=>getComputedStyle(n).borderRadius),'0px');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(0, 0, 0)');
 assert.match(await tip.locator('.equipment-tip-tier').evaluate(n=>getComputedStyle(n).fontFamily), /Dungeons Five/);
 const render=await tip.locator(':scope > .equipment-tip-render').boundingBox(),frame=await tip.boundingBox();assert.ok(render.x+render.width>frame.x+frame.width,'native render must overhang the upper right');
 assert.equal(await tip.locator('.equipment-tip-top').evaluate(n=>getComputedStyle(n).paddingLeft),'40px');
 assert.ok(await page.evaluate(()=>document.fonts.check('12px "Dungeons Five"')));
 assert.ok(await tip.locator('.equipment-tip-effect').count()>=2);
 await page.screenshot({path:'artifacts/game-tooltip/builds-1440.png'});
 // The pointer can cross the gap to read/scroll the preview; leaving dismisses it.
 let box=await tip.boundingBox();await page.mouse.move(box.x+20,box.y+80);await page.waitForTimeout(180);assert.equal(await tip.count(),1);
 await page.mouse.move(0,0);await tip.waitFor({state:'hidden'});
 // Keyboard preview must describe the focused button and Escape consumes only the preview.
 await first.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await tip.waitFor();
 assert.equal(await first.getAttribute('aria-describedby'),'native-equipment-tooltip');
 await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await first.getAttribute('aria-describedby'),null);
 // Keep the panel on screen at narrow/short viewport edges, including scrolling inside it.
 await page.setViewportSize({width:640,height:420});await show(first);await within();
 box=await tip.boundingBox();await page.mouse.move(box.x+100,box.y+180);await page.mouse.wheel(0,300);await page.waitForTimeout(180);
 assert.equal(await tip.count(),1);assert.ok(await tip.locator('.equipment-tip-scroll').evaluate(n=>n.scrollTop>0));
 await page.screenshot({path:'artifacts/game-tooltip/short-640.png'});
 await page.mouse.move(0,0);await tip.waitFor({state:'hidden'});
 await page.setViewportSize({width:1440,height:1000});await show(first);await page.evaluate(()=>scrollBy(0,100));await tip.waitFor({state:'hidden'});
 // Rerendering/removing the target and navigating must not resurrect stale previews.
 await show(first);const card=page.locator('.tool-build-card').first();await card.evaluate(n=>n.hidden=true);await tip.waitFor({state:'hidden'});await card.evaluate(n=>n.hidden=false);
 await show(first);await page.goto(base+'#collection');await ready('collection');assert.equal(await tip.count(),0);
 await show(page.locator('#collection-panel .tool-item-picture').first());assert.equal(await tip.locator('.equipment-tip-strip').isVisible(),false);await within();
 assert.equal(await tip.locator('.is-unenchanted').innerText(),'未附魔');
 await page.screenshot({path:'artifacts/game-tooltip/collection-1440.png'});
 await page.goto(base+'#planner&t1=ocelots-paw.3');await ready('planner');await show(page.locator('[data-slot=t1] .tool-item-picture'));await within();
 assert.equal(await tip.locator('.equipment-tip-talisman-level').innerText(),'III');assert.match(await tip.innerText(),/已装备/);
 const loadouts=await page.evaluate(async()=>await(await fetch('./data/explorer/loadouts.json')).json());
 for(const effect of loadouts['ocelots-paw'].levels[2].effects)assert.ok((await tip.innerText()).includes(effect.text));
 await page.screenshot({path:'artifacts/game-tooltip/talisman-1440.png'});
 await page.goto(base+'#compare');await ready('compare');await show(page.locator('#compare-panel .tool-item-picture').first());await within();
 for(const [category,slug,query] of [['enchantments','frost-crescent','寒霜斩'],['effects','bounty-hunter','赏金猎人'],['artifacts','conductive-quiver','导电箭袋']]){
  await page.goto(base+'#database&category='+category);await ready('database');await page.getByLabel('搜索数据库',{exact:true}).fill(query);
  await show(page.locator('.database-item[data-id="'+slug+'"] .database-picture'));await within();
  assert.equal(await tip.locator('button').count(),0);assert.doesNotMatch(await tip.innerText(),/更多操作|可用部位|适用装备数/);
  if(category==='artifacts'){assert.equal(await tip.locator('.equipment-tip-enchant').count(),0);assert.equal(await tip.locator('.equipment-tip-stat-icon').count(),2);const stats=await tip.locator('.equipment-tip-stats').boundingBox();assert.ok(stats.height<40);assert.match(await tip.innerText(),/冷却[\s\S]*5[\s\S]*花费[\s\S]*20/);}
  else{assert.equal(await tip.locator('.equipment-tip-tier').count(),3);assert.equal(await tip.locator('.equipment-tip-stat').count(),0);if(category==='enchantments')assert.equal(await tip.locator(':scope > .native-book').count(),1);}
  await page.screenshot({path:'artifacts/game-tooltip/'+category+'-1440.png'});
 }
 // Large effect rows keep the native preview next to the moving pointer,
 // while Escape dismisses only the preview, leaving its parent dialog open.
 await page.goto(base+'#database&category=weapons&item=awesomeaxe');await ready('database');
 const dialog=page.locator('.database-dialog[open]').last();await dialog.getByRole('tab',{name:'效果',exact:true}).click();
 const bounty=dialog.locator('.database-effect-card').filter({hasText:'赏金猎人'});await bounty.scrollIntoViewIfNeeded();
 const source=await bounty.boundingBox();await page.mouse.move(source.x+20,source.y+20);await tip.locator('.equipment-tip-name').waitFor();
 const before=await tip.boundingBox();await page.mouse.move(source.x+60,source.y+26);await page.waitForTimeout(50);const after=await tip.boundingBox();
 assert.ok(Math.abs(after.x-before.x-40)<1,'preview must follow pointer within the same effect row');await within();
 await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await page.locator('.database-dialog[open]').count(),1);
 // Book count/navigation use the native 32 definitions, not the 31 statuses.
 await page.goto(base+'#database&category=enchantments');await ready('database');
 const books=page.locator('.database-category-link[data-category=enchantments]');assert.match(await books.innerText(),/附魔书[\s\S]*32/);
 assert.match(await books.locator('img').getAttribute('src'),/native-tooltip\/enchantment-swirl.png/);assert.equal(await page.locator('.database-item').count(),32);
 assert.equal(await page.locator('.database-pagination button').count(),0);await page.screenshot({path:'artifacts/game-tooltip/books-32.png'});
 for(const route of ['#database&category=enchantments&item=burned','database/enchantments/burned/']){
  await page.goto(base+route);await ready('database');await page.locator('.database-dialog[open] .database-detail-hero').waitFor();
  assert.equal(await page.getByLabel('数据库分类').inputValue(),'statuses');assert.match(await page.locator('.database-dialog[open]').innerText(),/灼烧/);
 }
 assert.deepEqual(errors,[]);await page.close();
 // A real touch context opens the existing item detail, never a hover preview.
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark'});
 await mobile.goto(base+'#builds');await mobile.locator('#builds-panel[aria-busy=false]').waitFor();await mobile.locator('.tool-gear-button').first().tap();
 await mobile.locator('dialog[open] .drop-detail-panel').waitFor();assert.equal(await mobile.locator('#native-equipment-tooltip:popover-open').count(),0);
 await mobile.locator('dialog[open]').getByRole('button',{name:'关闭窗口'}).tap();await mobile.waitForTimeout(180);assert.equal(await mobile.locator('#native-equipment-tooltip:popover-open').count(),0);
 await mobile.close();
 console.log('Game tooltip: native UI/font, four tools, pointer transfer, internal scroll, keyboard/Escape, viewport edges, stale-target cleanup and touch detail passed.');
}finally{await browser.close();}
