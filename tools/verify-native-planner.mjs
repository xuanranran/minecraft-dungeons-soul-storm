import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.STORM_TEST_URL||'http://127.0.0.1:8080/';
const manifest=JSON.parse(await readFile('public/data/native-planner-ui.json','utf8'));
for(const asset of manifest.sources.filter(s=>s.file))assert.equal(createHash('sha256').update(await readFile(join('public',asset.file))).digest('hex'),asset.sha256,'unchanged native PNG '+asset.file);
assert.equal(manifest.slots.length,12);assert.deepEqual(manifest.groups.map(g=>g.slots.length),[2,4,3,3]);
const reference=JSON.parse(await readFile('public/data/explorer/builds.json','utf8')).builds[0];
const browser=await chromium.launch({channel:'msedge',headless:true});await mkdir('artifacts/native-planner',{recursive:true});
try{
 for(const width of [1440,1024,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:'dark',hasTouch:width<=760,isMobile:width<=760}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const preview=page.locator('.planner-item-preview'),ready=async()=>{await preview.locator('.equipment-tip-name').waitFor();await page.locator('.planner-item-preview[aria-busy=false]').waitFor();await page.evaluate(()=>document.fonts.ready);};
  await page.goto(base+'#planner&'+reference.q);await page.locator('#planner-panel[aria-busy=false]').waitFor();await ready();
  assert.equal(await page.locator('.tool-slot').count(),12);assert.equal(await page.locator('.tool-slot .tool-item-picture').count(),12);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(0, 0, 0)');
  const first=await page.locator('[data-slot=melee]').boundingBox(),second=await page.locator('[data-slot=ranged]').boundingBox();
  assert.ok(Math.abs((second.x-first.x-first.width)/first.width-manifest.metrics.slotGap/manifest.metrics.textureExtent)<.002,'cooked slot gap survives uniform scaling');
  for(const group of manifest.groups){
   const boxes=await Promise.all(group.slots.map(id=>page.locator('[data-slot='+id+']').boundingBox()));
   assert.ok(boxes.every(b=>Math.abs(b.width-first.width)<1&&Math.abs(b.y-boxes[0].y)<1),'native category slots share their row and size');
  }
  assert.match(await page.locator('.tool-slot').first().evaluate(n=>getComputedStyle(n).backgroundImage),/native-planner\/slot-background\.png/);
  assert.match(await preview.locator('.equipment-tip-name').evaluate(n=>getComputedStyle(n).fontFamily),/Dungeons Ten/);
  assert.ok(await preview.locator('.equipment-tip-name').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))>=22,'generic card styles must not shrink the native title');
  assert.equal(await preview.locator('.equipment-tip-enchant-label').innerText(),'已附魔');
  assert.ok(await preview.locator('.equipment-tip-effect').count()>=2);assert.equal(await page.locator('.tool-config').getAttribute('open'),null);
  if([1440,390].includes(width))await page.screenshot({path:'artifacts/native-planner/equipped-'+width+'.png',fullPage:true});
  await page.locator('[data-slot=helmet]').click();await page.getByRole('button',{name:'更换装备',exact:true}).click();
  await page.getByLabel('筛选头盔',{exact:true}).fill('神谕王冠');await page.locator('.tool-inline-choice').first().click();await ready();
  assert.equal(await preview.locator('.equipment-tip-name').innerText(),'神谕王冠');
  await page.locator('.tool-config>summary').click();const enchant=page.getByLabel('使用附魔',{exact:true});
  const slug=await enchant.locator('option').nth(1).getAttribute('value');await enchant.selectOption(slug);await ready();
  const enchantGrade=page.getByLabel('等级',{exact:true}).last();await enchantGrade.focus();await enchantGrade.selectOption('II');await ready();
  assert.equal(await enchantGrade.evaluate(n=>n===document.activeElement),true,'the enchantment grade keeps focus instead of jumping to the random effect grade');
  assert.equal(await preview.locator('.equipment-tip-tier').innerText(),'II');
  assert.equal(await page.locator('.tool-config').evaluate(n=>n.open),true,'configuration remains open after an edit');
  if([1440,390].includes(width)){await page.locator('.tool-config>summary').click();await page.screenshot({path:'artifacts/native-planner/crown-'+width+'.png',fullPage:true});}
  await page.locator('[data-slot=t1]').click();await ready();await page.locator('.tool-config>summary').click();
  await page.getByLabel('护身符等级',{exact:true}).selectOption('2');await ready();assert.equal(await preview.locator('.equipment-tip-talisman-grade').innerText(),'2');
  await page.getByRole('button',{name:'效果和属性',exact:true}).click();assert.equal(await page.locator('#planner-total-effects').isVisible(),true);assert.ok(await page.locator('.tool-total-row').count()>0);
  await page.getByRole('button',{name:'效果和属性',exact:true}).click();assert.equal(await page.locator('#planner-total-effects').isVisible(),false);
  await page.getByRole('button',{name:'保存配装',exact:true}).click();const dialog=page.locator('.explorer-dialog[open]');
  await dialog.getByLabel('配装名称',{exact:true}).fill('原生布局验收');await dialog.getByRole('button',{name:'保存到我的配装',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await page.reload();await page.locator('#planner-panel[aria-busy=false]').waitFor();await ready();await page.locator('[data-slot=t1]').click();await ready();assert.equal(await preview.locator('.equipment-tip-talisman-grade').innerText(),'2','actual talisman configuration survives reload');
  if(width<=760){await page.getByRole('button',{name:'返回装备槽位',exact:true}).click();const screen=await page.locator('.tool-planner-screen').boundingBox();assert.ok(screen.y>=80&&screen.y<300,'mobile return exposes the equipment overview');}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'planner has no horizontal overflow');
  const art=await preview.locator(':scope > .equipment-tip-render').boundingBox();assert.ok(art.x+art.width<=width,'native item art remains inside the browser viewport');
  const broken=await page.evaluate(()=>[...document.querySelectorAll('#planner-panel img')].filter(n=>n.complete&&!n.naturalWidth).map(n=>n.src));assert.deepEqual(broken,[]);
  assert.deepEqual(errors,[]);console.log(width+': native slot texture/gaps, configured preview, enchantment/talisman editing, save/reload, totals and viewport bounds passed.');await page.close();
 }
}finally{await browser.close();}
