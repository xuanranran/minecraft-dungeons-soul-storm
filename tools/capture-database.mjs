import {homedir} from 'node:os';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const browser=await chromium.launch({channel:'msedge',headless:true});
const directory='sources/database';await mkdir(directory,{recursive:true});
const categories=['enemies','enchantments','effects','locations','cosmetics','bosses','quests','upcoming'];
try{
 const context=await browser.newContext();
 for(const category of categories){
  const page=await context.newPage(),url='https://www.dungeons.tools/2/'+category;await page.goto(url,{waitUntil:'domcontentloaded'});
  const rows=await page.locator('main a.g2-ht-row,main a.g2-bossrow,main a.g2-qname,main #r3 .g2-tr,main #r4 .g2-tr').evaluateAll(elements=>elements.map((e,index)=>({name:e.querySelector('.nm')?.textContent||e.querySelector('.g2-ht-name')?.textContent||e.querySelector('.c0')?.textContent||e.textContent.trim(),sub:e.querySelector('.sb')?.textContent||'',href:e.getAttribute('href')||'/2/upcoming#entry-'+index,image:e.querySelector('img')?.getAttribute('src')||'',values:[...e.querySelectorAll('[data-h]')].map(cell=>[cell.getAttribute('data-h'),cell.textContent.trim()]),tip:e.getAttribute('data-tip')?JSON.parse(e.getAttribute('data-tip')):null})));
  await writeFile(directory+'/'+category+'.json',JSON.stringify({source:url,captured_at:'2026-10-10',rows},null,2));console.log(category,rows.length);await page.close();
 }
 const page=await context.newPage(),url='https://metabot.gg/zh_CN/minecraft-dungeons-2/armor/sets';await page.goto(url,{waitUntil:'domcontentloaded'});
 const sets=await page.locator('main table tbody tr').evaluateAll(elements=>elements.map(e=>({name:e.querySelector('a')?.textContent.trim(),href:e.querySelector('a')?.getAttribute('href'),values:[...e.querySelectorAll('td')].map((c,i)=>[e.closest('table').querySelectorAll('thead th')[i+1]?.textContent,c.textContent.trim()]),parts:[...e.querySelectorAll('td:first-of-type img')].map(i=>i.alt)})).filter(e=>e.href?.includes('/armor/sets/')));
 await writeFile(directory+'/armor-sets.json',JSON.stringify({source:url,captured_at:'2026-10-10',rows:sets},null,2));console.log('armor-sets',sets.length);await page.close();
}finally{await browser.close();}
