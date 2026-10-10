import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const directory=new URL('../dist/data/equipment/items/',import.meta.url),records=await Promise.all((await readdir(directory)).filter(n=>n.endsWith('.json')).map(async name=>JSON.parse(await readFile(new URL(name,directory),'utf8'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8080/');
 const failures=await page.evaluate(async records=>{
  const {renderEquipmentDetails}=await import('./equipment-details.mjs?v=detailcleanup1'),{displayedParameters,displayedTables}=await import('./drops.mjs?v=detailcleanup1'),failures=[];
  const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!=null)n.textContent=text;return n;};
  for(const item of records){
   const panel=el('div');renderEquipmentDetails({item,panel,el,nativeIcon:()=>el('span'),displayedParameters,displayedTables});
   const names=[...panel.querySelectorAll('.database-parameter-table th')].map(n=>n.textContent.replace(/\s/g,''));
   if(new Set(names).size!==names.length)failures.push(item.id+': duplicate parameter names');
   if(panel.textContent.includes('暂无效果说明'))failures.push(item.id+': numeric data rendered as effects');
   for(const section of panel.querySelectorAll('[data-detail-section=effects],[data-detail-section=enchantments],[data-detail-section=locations]')){
    if(section.querySelector('h3'))failures.push(item.id+': redundant tab heading');
    if(section.querySelector('table'))failures.push(item.id+': numeric table outside parameters');
    const cards=[...section.querySelectorAll('.database-effect-card')].map(n=>n.textContent.replace(/\s/g,''));
    if(new Set(cards).size!==cards.length)failures.push(item.id+': duplicate cards');
   }
  }return failures;
 },records);assert.deepEqual(failures,[]);console.log(records.length+' equipment details audited: no duplicate parameter names or cards, no placeholder effects, all numeric tables in parameters.');
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await page.goto('about:blank');await page.goto('http://127.0.0.1:8080/#database&category=weapons&item=double-crossers');
  const box=()=>page.locator('.database-dialog[open]').last();await box().locator('.database-parameter-table td').first().waitFor();
  const labels=await box().locator('.database-parameter-table th').allTextContents();assert.equal(labels.filter(n=>n.replace(/\s/g,'')==='爆发DPS').length,1);
  await box().getByRole('tab',{name:'效果',exact:true}).click();assert.doesNotMatch(await box().locator('[data-detail-section=effects]').innerText(),/暂无效果说明|单发伤害|射击间隔/);
  await box().getByRole('tab',{name:'附魔',exact:true}).click();assert.equal(await box().locator('[data-detail-section=enchantments] h3').count(),0);
  await box().getByRole('button',{name:'连锁反应',exact:true}).click();await box().locator('.database-tier').first().waitFor();assert.equal(await box().getByRole('tab').count(),0);assert.equal(await box().locator('.database-parameter-table').count(),0);
  const close=box().getByRole('button',{name:'关闭窗口'});assert.equal(await close.locator('svg').count(),1);const bounds=await close.boundingBox();assert.ok(bounds.width>=40&&bounds.height>=40);await close.click();
  await box().getByRole('tab',{name:'获取位置',exact:true}).click();assert.equal(await box().locator('[data-detail-section=locations] h3').count(),0);assert.ok(await box().locator('[data-detail-section=locations] button').count()>0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'database-detail-cleanup-'+width+'.png'});await box().getByRole('button',{name:'关闭窗口'}).click();
  console.log(width+': ranged effects, enchantment-only details, location links and close control passed.');
 }
}finally{await browser.close();}
