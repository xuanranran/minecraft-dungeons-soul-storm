import {loadCatalogue,loadRules,loadLoadouts,loadWeapons} from './explorer-data.mjs';
import {context,decodeBuild,weaponMetrics,rarities,kinds,parts} from './explorer-model.mjs';
import './ui/styles/game-tooltip.css';

const targets=new WeakMap();let installed=false,active=null,timer,serial=0,tip,described,anchorRect,pointer;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const img=(src,cls)=>{const n=node('img',cls);n.src=src;n.alt='';return n;};
let factsPromise;
const facts=()=>factsPromise??=Promise.all([loadCatalogue(),loadRules(),loadLoadouts(),loadWeapons()]).then(([c,r,l,w])=>({ctx:context(c,r,l),weapons:w})).catch(error=>{factsPromise=null;throw error;});
export function hideEquipmentTooltip(){clearTimeout(timer);serial++;active=null;pointer=null;if(described){described.removeAttribute('aria-describedby');described=null;}if(tip?.matches(':popover-open'))tip.hidePopover();if(tip)tip.hidden=true;}
function eligible(target,focusTarget){const rect=target.getBoundingClientRect(),dialog=[...document.querySelectorAll('dialog[open]')].at(-1);return target.isConnected&&rect.width>0&&rect.height>0&&!target.closest('[hidden]')&&(!dialog||target.closest('dialog[open]')===dialog)&&(focusTarget?focusTarget.matches(':focus-visible'):target.matches(':hover')||(active===target&&!tip?.hidden&&tip?.matches(':hover')));}
export function bindEquipmentTooltip(target,item,equipment={}){
 targets.set(target,{item,equipment});target.dataset.equipmentTip='';
 if(installed)return;installed=true;
 // Pointer movement is intentional; pointerover also fires when a layout change
 // moves a different item under a stationary cursor.
 document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;if(tip?.contains(e.target)){clearTimeout(timer);return;}const target=e.target.closest('[data-equipment-tip]');if(target&&targets.has(target))open(target,undefined,{x:e.clientX,y:e.clientY});else scheduleHide();});
 document.addEventListener('focusin',e=>{const target=e.target.matches('[data-equipment-tip]')?e.target:e.target.querySelector('[data-equipment-tip]');if(target&&targets.has(target)&&e.target.matches(':focus-visible'))open(target,e.target);else hideEquipmentTooltip();});
 document.addEventListener('pointerout',e=>{if(active?.contains(e.target)&&!active.contains(e.relatedTarget))scheduleHide();});
 document.addEventListener('focusout',()=>scheduleHide());
 document.addEventListener('pointerdown',e=>{if(!tip?.contains(e.target))hideEquipmentTooltip();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&active){e.preventDefault();e.stopPropagation();hideEquipmentTooltip();}});
 window.addEventListener('resize',hideEquipmentTooltip);window.addEventListener('hashchange',hideEquipmentTooltip);window.addEventListener('popstate',hideEquipmentTooltip);
 window.addEventListener('blur',hideEquipmentTooltip);document.addEventListener('visibilitychange',()=>{if(document.hidden)hideEquipmentTooltip();});
 new MutationObserver(()=>{if(active&&!eligible(active,described))hideEquipmentTooltip();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
 document.addEventListener('scroll',e=>{if(active&&!tip?.contains(e.target)){const r=active.getBoundingClientRect();if(!anchorRect||r.x!==anchorRect.x||r.y!==anchorRect.y)hideEquipmentTooltip();}},true);
}
function scheduleHide(){clearTimeout(timer);timer=setTimeout(hideEquipmentTooltip,140);}
function place(target){
 const a=target.getBoundingClientRect(),margin=36,w=Math.min(480,innerWidth-margin*2),gap=16;anchorRect=a;tip.style.width=w+'px';tip.style.setProperty('--game-ui-scale',w/960);
 let left,top;
 if(pointer){
  tip.style.maxHeight=(innerHeight-margin*2)+'px';const h=tip.getBoundingClientRect().height;
  left=pointer.x+gap+w<=innerWidth-margin?pointer.x+gap:pointer.x-gap-w;
  top=pointer.y+gap+h<=innerHeight-margin?pointer.y+gap:pointer.y-gap-h;
  left=Math.max(margin,Math.min(innerWidth-w-margin,left));top=Math.max(margin,Math.min(innerHeight-h-margin,top));
 }else if(a.right+gap+w<=innerWidth-margin||a.left-gap-w>=margin){
  left=a.right+gap+w<=innerWidth-margin?a.right+gap:a.left-gap-w;
  tip.style.maxHeight=(innerHeight-margin*2)+'px';top=Math.max(margin,Math.min(a.top,innerHeight-tip.getBoundingClientRect().height-margin));
 }else{
  // When neither side fits, use the space above/below the item instead of
  // covering it. This keeps the originating button clickable on small screens.
  left=Math.max(margin,Math.min(innerWidth-w-margin,a.left));
  const below=innerHeight-a.bottom-gap-margin,above=a.top-gap-margin,useBelow=below>=above;
  tip.style.maxHeight=Math.max(32,useBelow?below:above)+'px';
  top=useBelow?a.bottom+gap:a.top-gap-tip.getBoundingClientRect().height;
 }
 tip.style.left=left+'px';tip.style.top=top+'px';
}
async function open(target,focusTarget,point){
 if(!eligible(target,focusTarget))return;
 clearTimeout(timer);if(active===target){pointer=point||null;place(target);return;}hideEquipmentTooltip();active=target;pointer=point||null;const token=++serial,{item}=targets.get(target);let {equipment}=targets.get(target);
 if(!tip){tip=node('div','equipment-tooltip native-game-tooltip');tip.id='native-equipment-tooltip';tip.setAttribute('popover','manual');tip.setAttribute('role','tooltip');tip.addEventListener('pointerenter',()=>clearTimeout(timer));tip.addEventListener('pointerleave',scheduleHide);tip.addEventListener('load',()=>{if(active&&!tip.hidden)place(active);},true);new ResizeObserver(()=>{if(active&&!tip.hidden)place(active);}).observe(tip);document.body.append(tip);}
 tip.replaceChildren(node('div','equipment-tip-strip',equipment.ench?'已装备 · 已附魔':'物品详情'),node('div','equipment-tip-loading',item.name+' · 正在读取…'));
 tip.hidden=false;tip.showPopover();if(focusTarget){described=focusTarget;focusTarget.setAttribute('aria-describedby',tip.id);}place(target);
 try{
  const card=await createEquipmentCard(item,equipment,{nativeTooltip:true});
  if(token!==serial||active!==target)return;if(!eligible(target,focusTarget)){hideEquipmentTooltip();return;}
  tip.replaceChildren(...card.childNodes);
  place(target);
 }catch{if(token===serial){tip.replaceChildren(node('div','equipment-tip-strip','物品详情'),node('div','equipment-tip-loading',item.name+' · 暂时无法读取，移开后重试。'));place(target);}}
}

export async function createEquipmentCard(item,equipment={}, {nativeTooltip=false}={}){
 const {ctx,weapons}=await facts();
 if(equipment.query&&equipment.slot)equipment={...equipment,...decodeBuild(equipment.query,ctx)[equipment.slot]};
 const card=node('article','equipment-card');
  let full=ctx.items.get(item.slug)||item;
  if(nativeTooltip&&['enchantment','effect'].includes(full.kind)){
   const {loadDatabaseRecord,findDatabaseRecord}=await import('./database-data.mjs');
   if(full.lookupName)full=await findDatabaseRecord(full.categoryKey,full.lookupName)||full;
   if(full.dbKind)full=await loadDatabaseRecord(full);
   else if(full.kind==='enchantment')full={...full,...ctx.enchants.get(full.slug)};
  }
  const rarity=equipment.rarity||(full.unique?'unique':full.kind==='artifact'?'special':'common'),level=equipment.level||1,isReference=['enchantment','effect'].includes(full.kind);
  const top=node('div','equipment-tip-top'),row=node('div','equipment-tip-kind-row'),badge=node('span','equipment-tip-rarity',rarities[rarity]);badge.dataset.rarity=rarity;
  top.dataset.kind=full.kind;
  row.append(node('span','equipment-tip-kind',full.kind==='enchantment'?'附魔书':[kinds[full.kind],parts[full.slot],full.archetype].filter(Boolean).join(' · ')));if(!isReference)row.append(badge);
  if(nativeTooltip&&full.kind==='talisman'){badge.textContent=['I','II','III'][level-1];badge.classList.add('equipment-tip-talisman-level');}
  let render=img(full.levels?.[level-1]?.image||full.image,'equipment-tip-render');
  if(nativeTooltip&&isReference){const frame=node('span','equipment-tip-render'+(full.kind==='enchantment'?' native-book':'')),icon=node('span','native-indicator native-'+(full.kind==='enchantment'?'enchantment':'effect'));render.className='';icon.append(render);frame.append(icon);render=frame;}
  top.append(render,row,node('h3','equipment-tip-name',full.name));
  const metrics=weapons[full.slug]?weaponMetrics(weapons[full.slug]):[];
  for(const id of ['hits','dps','ammo','shot']){const metric=metrics.find(m=>m.id===id);if(metric){const line=node('div','equipment-tip-stat');line.append(node('span','',metric.name),node('b','',Number(metric.value.toFixed(2)).toLocaleString('zh-CN')));top.append(line);}}
  const stats=node('div','equipment-tip-stats');
  for(const [name,value] of Object.entries(!isReference&&!(nativeTooltip&&full.kind==='armor')?full.parameters||{}:{})){const soulCost=['灵魂消耗','灵魂花费'].includes(name),line=node('div','equipment-tip-stat');line.append(node('span','',nativeTooltip&&soulCost?'花费':name));if(nativeTooltip&&full.kind==='artifact'&&(name==='冷却'||soulCost)){const icon=img('./images/native-tooltip/'+(name==='冷却'?'timer':'soul-cost')+'.png','equipment-tip-stat-icon');icon.dataset.metric=name==='冷却'?'timer':'soul-cost';line.append(icon);}line.append(node('b','',nativeTooltip&&full.kind==='artifact'?String(value).replace(/\s*秒$/,''):value));stats.append(line);}if(stats.childNodes.length)top.append(stats);
  const strip=node('div','equipment-tip-strip',equipment.item?'已装备':full.kind==='talisman'?'护身符 · '+['I','II','III'][level-1]+' 级':'物品详情');
  strip.hidden=nativeTooltip&&!equipment.item;card.replaceChildren(strip,top);
  if(full.description&&full.descriptionOrigin!=='native-level-I-effect'&&!(nativeTooltip&&isReference&&full.tiers?.some(t=>t.text===full.description)))card.append(node('p','equipment-tip-description',full.description));
  if(isReference){
   const list=node('div','equipment-tip-effects equipment-tip-tiers');for(const tier of full.tiers||[]){const line=node('div','equipment-tip-effect');line.append(node('span','equipment-tip-tier',tier.tier),node('span','',tier.text));list.append(line);}card.append(list);
  }
  const enchant=ctx.enchants.get(equipment.ench?.slug);
  if(enchant){const group=node('div','equipment-tip-enchant'),label=node('div','equipment-tip-enchant-label',nativeTooltip?'已附魔':'◈ 已附魔'),box=node('div','equipment-tip-enchant-box'),icon=node('div','equipment-tip-enchant-icon'),info=node('div');icon.append(img(enchant.image),node('b','equipment-tip-tier',equipment.ench.tier));info.append(node('strong','',enchant.name),node('p','',enchant.tiers.find(t=>t.tier===equipment.ench.tier)?.text));box.append(icon,info);group.append(label,box);card.append(group);}
  else if(nativeTooltip&&['melee','ranged','armor'].includes(full.kind)){
   const group=node('div','equipment-tip-enchant is-unenchanted'),box=node('div','equipment-tip-enchant-box');
   box.append(node('span','equipment-tip-unenchanted-icon'),node('span','','未附魔'));group.append(box);card.append(group);
  }
  const entries=full.kind==='talisman'?(full.levels?.[level-1]?.effects||[]):[...(full.fixed||[]),...(equipment.rolls||[]).map(t=>ctx.templates.get(t)).filter(Boolean)];
  if(entries.length){const list=node('div','equipment-tip-effects');list.append(node('div','equipment-tip-effects-heading','效果'));
   for(const entry of entries){const info=ctx.rules.effects[entry.effect],line=node('div','equipment-tip-effect');line.dataset.category=info?.category||'';if((full.fixed||[]).includes(entry))line.classList.add('is-fixed');if(info?.image)line.append(img(info.image));else line.append(node('span','equipment-tip-effect-symbol','◇'));line.append(node('span','',entry.text||info?.name));list.append(line);}card.append(list);
  }
  if(full.kind==='talisman'&&!entries.length)card.append(node('p','equipment-tip-description','此护身符召唤的同伴随等级成长。'));

 if(nativeTooltip){
  const scroll=node('div','equipment-tip-scroll');scroll.dataset.kind=full.kind;scroll.dataset.equipped=String(Boolean(equipment.item));
  render.remove();scroll.append(...card.childNodes);card.replaceChildren(scroll,render);
 }
 return card;
}
