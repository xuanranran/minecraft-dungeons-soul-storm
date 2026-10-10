import {loadCatalogue,loadRules,loadLoadouts,loadWeapons} from './explorer-data.mjs';
import {context,decodeBuild,weaponMetrics,rarities,kinds,parts} from './explorer-model.mjs';

const targets=new WeakMap();let installed=false,active=null,timer,serial=0,tip,described;
const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const img=(src,cls)=>{const n=node('img',cls);n.src=src;n.alt='';return n;};
let factsPromise;
const facts=()=>factsPromise??=Promise.all([loadCatalogue(),loadRules(),loadLoadouts(),loadWeapons()]).then(([c,r,l,w])=>({ctx:context(c,r,l),weapons:w})).catch(error=>{factsPromise=null;throw error;});
export function hideEquipmentTooltip(){clearTimeout(timer);serial++;active=null;if(described){described.removeAttribute('aria-describedby');described=null;}if(tip?.matches(':popover-open'))tip.hidePopover();if(tip)tip.hidden=true;}
function eligible(target,focusTarget){const rect=target.getBoundingClientRect(),dialog=document.querySelector('dialog[open]');return target.isConnected&&rect.width>0&&rect.height>0&&!target.closest('[hidden]')&&(!dialog||target.closest('dialog[open]'))&&(focusTarget?focusTarget.matches(':focus-visible'):target.matches(':hover'));}
export function bindEquipmentTooltip(target,item,equipment={}){
 targets.set(target,{item,equipment});target.dataset.equipmentTip='';
 if(installed)return;installed=true;
 // Pointer movement is intentional; pointerover also fires when a layout change
 // moves a different item under a stationary cursor.
 document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const target=e.target.closest('[data-equipment-tip]');if(target&&targets.has(target))open(target);else if(!tip?.contains(e.target))scheduleHide();});
 document.addEventListener('focusin',e=>{const target=e.target.matches('[data-equipment-tip]')?e.target:e.target.querySelector('[data-equipment-tip]');if(target&&targets.has(target)&&e.target.matches(':focus-visible'))open(target,e.target);else hideEquipmentTooltip();});
 document.addEventListener('pointerout',e=>{if(active?.contains(e.target)&&!active.contains(e.relatedTarget))hideEquipmentTooltip();});
 document.addEventListener('focusout',()=>scheduleHide());
 document.addEventListener('pointerdown',e=>{if(!tip?.contains(e.target))hideEquipmentTooltip();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideEquipmentTooltip();});
 window.addEventListener('resize',hideEquipmentTooltip);window.addEventListener('hashchange',hideEquipmentTooltip);window.addEventListener('popstate',hideEquipmentTooltip);
 window.addEventListener('blur',hideEquipmentTooltip);document.addEventListener('visibilitychange',()=>{if(document.hidden)hideEquipmentTooltip();});
 new MutationObserver(()=>{if(active&&!eligible(active,described))hideEquipmentTooltip();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','open']});
 document.addEventListener('scroll',e=>{if(!tip?.contains(e.target))hideEquipmentTooltip();},true);
}
function scheduleHide(){clearTimeout(timer);timer=setTimeout(hideEquipmentTooltip,140);}
function place(target){
 const a=target.getBoundingClientRect(),w=Math.min(380,innerWidth-24);tip.style.width=w+'px';tip.style.maxHeight=(innerHeight-24)+'px';
 let left=a.right+18;if(left+w>innerWidth-12)left=a.left-w-18;if(left<12)left=Math.max(12,Math.min(innerWidth-w-12,a.left));
 const h=tip.getBoundingClientRect().height,top=Math.max(12,Math.min(a.top,innerHeight-h-12));tip.style.left=left+'px';tip.style.top=top+'px';
}
async function open(target,focusTarget){
 if(!eligible(target,focusTarget))return;
 clearTimeout(timer);if(active===target)return;hideEquipmentTooltip();active=target;const token=++serial,{item}=targets.get(target);let {equipment}=targets.get(target);
 if(!tip){tip=node('div','equipment-tooltip');tip.id='native-equipment-tooltip';tip.setAttribute('popover','manual');tip.setAttribute('role','tooltip');tip.addEventListener('pointerenter',()=>clearTimeout(timer));tip.addEventListener('pointerleave',scheduleHide);document.body.append(tip);}
 tip.replaceChildren(node('div','equipment-tip-strip',equipment.ench?'已装备 · 已附魔':'物品详情'),node('div','equipment-tip-loading',item.name+' · 正在读取…'));
 tip.hidden=false;tip.showPopover();if(focusTarget){described=focusTarget;focusTarget.setAttribute('aria-describedby',tip.id);}place(target);
 try{
  const card=await createEquipmentCard(item,equipment);
  if(token!==serial||active!==target)return;if(!eligible(target,focusTarget)){hideEquipmentTooltip();return;}
  tip.replaceChildren(...card.childNodes);
  place(target);
 }catch{if(token===serial){tip.replaceChildren(node('div','equipment-tip-strip','物品详情'),node('div','equipment-tip-loading',item.name+' · 暂时无法读取，移开后重试。'));place(target);}}
}

export async function createEquipmentCard(item,equipment={}){
 const {ctx,weapons}=await facts();
 if(equipment.query&&equipment.slot)equipment={...equipment,...decodeBuild(equipment.query,ctx)[equipment.slot]};
 const card=node('article','equipment-card');
  const full=ctx.items.get(item.slug)||item,rarity=equipment.rarity||(full.unique?'unique':full.kind==='artifact'?'special':'common'),level=equipment.level||1;
  const top=node('div','equipment-tip-top'),row=node('div','equipment-tip-kind-row'),badge=node('span','equipment-tip-rarity',rarities[rarity]);badge.dataset.rarity=rarity;
  row.append(node('span','equipment-tip-kind',full.kind==='enchantment'?'附魔书':[kinds[full.kind],parts[full.slot],full.archetype].filter(Boolean).join(' · ')));if(full.kind!=='enchantment')row.append(badge);
  top.append(img(full.levels?.[level-1]?.image||full.image,'equipment-tip-render'),row,node('h3','equipment-tip-name',full.name));
  const metrics=weapons[full.slug]?weaponMetrics(weapons[full.slug]):[];
  for(const id of ['hits','dps','ammo','shot']){const metric=metrics.find(m=>m.id===id);if(metric){const line=node('div','equipment-tip-stat');line.append(node('span','',metric.name),node('b','',Number(metric.value.toFixed(2)).toLocaleString('zh-CN')));top.append(line);}}
  for(const [name,value] of Object.entries(full.parameters||{})){const line=node('div','equipment-tip-stat');line.append(node('span','',name),node('b','',value));top.append(line);}
  card.replaceChildren(node('div','equipment-tip-strip',equipment.item?'已装备':full.kind==='talisman'?'护身符 · '+['I','II','III'][level-1]+' 级':'物品详情'),top);
  if(full.description&&full.descriptionOrigin!=='native-level-I-effect')card.append(node('p','equipment-tip-description',full.description));
  if(full.kind==='enchantment'){
   const list=node('div','equipment-tip-effects');for(const tier of full.tiers||[]){const line=node('div','equipment-tip-effect');line.append(node('span','equipment-tip-tier',tier.tier),node('span','',tier.text));list.append(line);}card.append(list);
  }
  const enchant=ctx.enchants.get(equipment.ench?.slug);
  if(enchant){const group=node('div','equipment-tip-enchant'),label=node('div','equipment-tip-enchant-label','◈ 已附魔'),box=node('div','equipment-tip-enchant-box'),icon=node('div','equipment-tip-enchant-icon'),info=node('div');icon.append(img(enchant.image),node('b','equipment-tip-tier',equipment.ench.tier));info.append(node('strong','',enchant.name),node('p','',enchant.tiers.find(t=>t.tier===equipment.ench.tier)?.text));box.append(icon,info);group.append(label,box);card.append(group);}
  const entries=full.kind==='talisman'?(full.levels?.[level-1]?.effects||[]):[...(full.fixed||[]),...(equipment.rolls||[]).map(t=>ctx.templates.get(t)).filter(Boolean)];
  if(entries.length){const list=node('div','equipment-tip-effects');list.append(node('div','equipment-tip-effects-heading','效果'));
   for(const entry of entries){const info=ctx.rules.effects[entry.effect],line=node('div','equipment-tip-effect');line.dataset.category=info?.category||'';if((full.fixed||[]).includes(entry))line.classList.add('is-fixed');if(info?.image)line.append(img(info.image));else line.append(node('span','equipment-tip-effect-symbol','◇'));line.append(node('span','',entry.text||info?.name));list.append(line);}card.append(list);
  }
  if(full.kind==='talisman'&&!entries.length)card.append(node('p','equipment-tip-description','此护身符召唤的同伴随等级成长。'));

 return card;
}
