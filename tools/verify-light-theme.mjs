import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=await import('playwright').catch(()=>import(pathToFileURL(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'))));
const base=process.env.STORM_TEST_URL||'http://127.0.0.1:8080/';
const reference=JSON.parse(await readFile('public/data/explorer/builds.json','utf8')).builds[0];
function luminance(color){const values=color.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
const browser=await chromium.launch({channel:'msedge',headless:true});await mkdir('artifacts/light-theme',{recursive:true});
try{
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000},colorScheme:'light',hasTouch:width<=760,isMobile:width<=760}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const preview=page.locator('.planner-item-preview'),ready=async()=>{await page.locator('.planner-item-preview[aria-busy=false]').waitFor();await page.evaluate(()=>document.fonts.ready);};
  const color=async locator=>locator.evaluate(n=>getComputedStyle(n).color);
  const readable=async(locator,background)=>{const foreground=await color(locator);assert.ok(contrast(foreground,background)>=4.5,'text contrast '+await locator.innerText()+' '+foreground+' on '+background);};
  const whitePanel=async locator=>{assert.equal(await locator.evaluate(n=>getComputedStyle(n,'::before').backgroundColor),'rgb(255, 255, 255)');await readable(locator.locator('.equipment-tip-name'),'rgb(255, 255, 255)');};
  await page.goto(base+'#planner&'+reference.q);await page.locator('#planner-panel[aria-busy=false]').waitFor();await ready();
  await page.locator('[data-slot=melee]').click();await page.getByRole('button',{name:'更换装备',exact:true}).click();
  await page.getByLabel('筛选近战武器',{exact:true}).fill('首席附魔师护手');await page.locator('.tool-inline-choice').first().click();await ready();
  assert.equal(await preview.locator('.equipment-tip-name').innerText(),'首席附魔师护手');
  await whitePanel(preview);await readable(preview.locator('.equipment-tip-description'),'rgb(255, 255, 255)');
  assert.equal(await preview.locator('.equipment-tip-description').evaluate(n=>getComputedStyle(n).textShadow),'none');
  const pageBackground=await page.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  for(const locator of [page.locator('.tool-slot-group>h3').first(),page.locator('.tool-editor>.tool-section-heading'),page.locator('.tool-config>summary')])await readable(locator,pageBackground);
  assert.equal(await page.locator('.tool-slot-group>h3>img').first().evaluate(n=>getComputedStyle(n).filter),'brightness(0)');
  const frame=await preview.boundingBox(),slot=await page.locator('.tool-slot').first().boundingBox();
  if([1440,390].includes(width)){await page.evaluate(()=>{document.activeElement?.blur?.();scrollTo(0,0);});await page.screenshot({path:'artifacts/light-theme/planner-'+width+'.png',fullPage:true});}
  await page.getByRole('button',{name:'物品详情',exact:true}).click();
  if(width<=760){
   const itemTip=page.locator('#native-equipment-tooltip:popover-open');await itemTip.locator('.equipment-tip-name').waitFor();await whitePanel(itemTip);await page.keyboard.press('Escape');await itemTip.waitFor({state:'hidden'});
   // Region equipment retains the full detail dialog on phones.
   await page.goto(base+'#storm');await page.locator('#storm-panel[aria-busy=false]').waitFor();await page.locator('#current-drops').click();await page.locator('#drops-dialog .drop-item').first().tap();
  }
  const dialog=page.locator('.database-dialog[open]');await dialog.locator('.database-parameter-table').waitFor();
  assert.equal(await dialog.evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(255, 255, 255)');
  await readable(dialog.locator('.database-hero-copy h2'),'rgb(255, 255, 255)');await readable(dialog.locator('.database-description'),'rgb(255, 255, 255)');
  await dialog.getByRole('tab',{name:'效果',exact:true}).click();const effect=dialog.locator('.database-effect-card:visible,.drop-effect-card:visible').first();await effect.waitFor();
  if(width<=760)await effect.tap();else await effect.hover();const tip=page.locator('#native-equipment-tooltip:popover-open');await tip.locator('.equipment-tip-name').waitFor();await whitePanel(tip);
  await readable(tip.locator('.equipment-tip-effect:visible,.equipment-tip-description:visible').first(),'rgb(255, 255, 255)');
  await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});await dialog.getByRole('tab',{name:'参数',exact:true}).click();
  if([1440,390].includes(width))await page.screenshot({path:'artifacts/light-theme/details-'+width+'.png'});
  assert.equal(await dialog.evaluate(n=>n.scrollWidth>n.clientWidth),false,'light detail rows fit mobile');await dialog.getByRole('button',{name:'关闭窗口',exact:true}).click();
  if(width<=760){await page.goto(base+'#planner');await page.locator('#planner-panel[aria-busy=false]').waitFor();await ready();}
  await page.locator('.site-settings>summary').click();await page.locator('#theme').selectOption('dark');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(0, 0, 0)');
  assert.equal(await preview.evaluate(n=>getComputedStyle(n,'::before').backgroundColor),'rgba(0, 0, 0, 0.5)');
  assert.equal(await color(preview.locator('.equipment-tip-name')),'rgb(255, 255, 255)');
  const darkFrame=await preview.boundingBox(),darkSlot=await page.locator('.tool-slot').first().boundingBox();
  assert.ok(Math.abs(frame.width-darkFrame.width)<1&&Math.abs(frame.height-darkFrame.height)<1&&Math.abs(slot.width-darkSlot.width)<1,'theme changes preserve native dimensions');
  await page.locator('#theme').selectOption('light');await page.locator('.site-settings>summary').click();await page.reload();await page.locator('#planner-panel[aria-busy=false]').waitFor();await ready();await whitePanel(preview);
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light','theme preference survives reload');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log(width+': light text contrast, original artwork, native panels, detail dialogs, touch/hover and dark/light switching passed.');await page.close();
 }
}finally{await browser.close();}
