import assert from 'node:assert/strict';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.SITE_TEST_URL||'http://127.0.0.1:8080/';
await mkdir('artifacts/redesign',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const width of [2560,1440,1024,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.emulateMedia({colorScheme:'dark'});
  const ready=name=>page.locator('#'+name+'-panel[aria-busy=false]').waitFor();
  const snapshot=async name=>{
   await page.evaluate(()=>scrollTo(0,0));
   await page.evaluate(async()=>{const visible=[...document.images].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.top<innerHeight&&r.bottom>0;});await Promise.all(visible.map(n=>n.decode().catch(()=>{})));});
   const broken=await page.evaluate(()=>[...document.images].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.top<innerHeight&&r.bottom>0&&n.complete&&n.naturalWidth===0;}).map(n=>n.currentSrc||n.src));
   assert.deepEqual(broken,[],name+' broken visible artwork');
   if([1440,390].includes(width))await page.screenshot({path:'artifacts/redesign/'+name+'-'+width+'.png'});
  };
  for(const name of ['collection','planner','builds','compare']){
   await page.goto(new URL(name+'/',base).href);await ready(name);
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(0, 0, 0)');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow '+width);
   assert.ok((await page.locator('#'+name+'-panel').boundingBox()).width<=1280);
   if(name==='collection'){
    await page.locator('.tool-owned input').first().check();
    const progress=await page.locator('progress').evaluateAll(nodes=>nodes.map(n=>({value:n.value,max:n.max,w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height,padding:getComputedStyle(n).padding})));
    assert.equal(progress.length,4);assert.ok(progress.some(n=>n.value>0));assert.ok(progress.every(n=>n.max>0&&n.w>80&&n.h===4&&n.padding==='0px'));
   }
   if(name==='planner'){
    assert.equal(await page.locator('.tool-slot').count(),12);
    assert.ok((await page.locator('.tool-slots').boundingBox()).height<540);
    assert.ok((await page.locator('.tool-slot').first().boundingBox()).height<125);
    await page.locator('.tool-inline-choice').first().click();
    assert.equal(await page.locator('.tool-slot .tool-item-picture').count(),1);
    const rarity=page.getByLabel('品质',{exact:true});await rarity.focus();await rarity.selectOption('rare');
    assert.equal(await rarity.evaluate(n=>n===document.activeElement),true,'editor field focus lost on rerender');
    await page.locator('[data-slot=ranged]').click();
    if(width<=760){const position=await page.locator('.tool-editor').boundingBox();assert.ok(position.y>=100&&position.y<800,'mobile editor remains out of view');}
   }
   if(name==='compare'){assert.ok(await page.locator('.tool-compare-table tbody tr').count()>3);await page.getByRole('button',{name:'交换左右'}).click();}
   await snapshot(name);
  }
  let releaseGuide;
  if(width===1440){const pending=new Promise(resolve=>releaseGuide=resolve);await page.route('**/guides/*.json*',async route=>{await pending;await route.continue();});}
  // Shared links use the router hash, including on prerendered routes.
  await page.goto(base+'#builds&build=2-tumbleshot-close-ranger');await ready('builds');
  const dialog=page.locator('.build-introduction-dialog[open]');
  if(releaseGuide){await dialog.getByRole('tab',{name:'玩法指南'}).click();releaseGuide();}
  await dialog.locator('.equipment-card').nth(11).waitFor({state:'attached'});
  if(releaseGuide){assert.equal(await dialog.getByRole('tab',{name:'玩法指南'}).getAttribute('aria-selected'),'true','async equipment load changed selected tab');await dialog.getByRole('tab',{name:'配装效果'}).click();}
  assert.equal(await dialog.locator('[role=tabpanel]:visible').count(),1);
  assert.doesNotMatch(await dialog.innerText(),/TalismanEffect/);
  assert.equal(await dialog.locator('.build-detail-gear').isVisible(),false);
  await dialog.getByRole('tab',{name:'玩法指南'}).click();assert.equal(await dialog.locator('.build-detail-guide section').count(),4);
  await dialog.getByRole('tab',{name:'装备详情'}).click();assert.equal(await dialog.locator('.equipment-card').count(),12);
  assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth),false);
  await dialog.getByRole('tab',{name:'配装效果'}).click();
  await snapshot('build-detail');
  await dialog.getByRole('button',{name:'关闭窗口'}).click();
  await page.goto(new URL('storm/',base).href);await ready('storm');await page.locator('#current-drops').click();await page.locator('#drops-dialog .drop-item').first().waitFor();
  const cards=await page.locator('#drops-dialog .drop-item').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  assert.equal(await page.locator('#drops-dialog .drop-item').evaluateAll(nodes=>nodes.every(n=>{const c=n.getBoundingClientRect(),p=n.querySelector('.drop-picture').getBoundingClientRect(),i=n.querySelector('.drop-info').getBoundingClientRect();return Math.abs((p.top+p.bottom)-(c.top+c.bottom))<2&&Math.abs((i.top+i.bottom)-(c.top+c.bottom))<2;})),true,'drop image and text must share the card vertical center');
  assert.ok(cards.every(h=>Math.abs(h-cards[0])<1&&h<140));
  await snapshot('drops');
  assert.deepEqual(errors,[]);await page.close();console.log(width+': black canvas, visible progress, compact planner, table comparison, detail tabs and consistent drop cards passed.');
 }
}finally{await browser.close();}
