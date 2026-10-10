export const slots=[
 {id:'melee',name:'近战武器',kind:'melee',ench:'MeleeWeapon'},
 {id:'ranged',name:'远程武器',kind:'ranged',ench:'RangedWeapon'},
 {id:'helmet',name:'头盔',kind:'armor',part:'helmet',ench:'Helmet'},
 {id:'chest',name:'胸甲',kind:'armor',part:'chest',ench:'Chest'},
 {id:'legs',name:'护腿',kind:'armor',part:'leggings',ench:'Leggings'},
 {id:'boots',name:'靴子',kind:'armor',part:'boots',ench:'Boots'},
 ...[1,2,3].map(n=>({id:'a'+n,name:'法器 '+n,kind:'artifact'})),
 ...[1,2,3].map(n=>({id:'t'+n,name:'护身符 '+n,kind:'talisman'}))
];
export const kinds={melee:'近战武器',ranged:'远程武器',armor:'盔甲部件',artifact:'法器',talisman:'护身符'};
export const parts={helmet:'头盔',chest:'胸甲',leggings:'护腿',boots:'靴子'};
export const rarities={common:'普通',rare:'稀有',special:'特殊',unique:'独特'};
const codes={c:'common',r:'rare',s:'special',u:'unique'},tiers=['I','II','III'];
export const compatible=(item,slot)=>item.kind===slot.kind&&(!slot.part||item.slot===slot.part);
export function context(catalogue,rules,loadouts){
 const items=new Map(catalogue.items.map(i=>[i.slug,{...i,...loadouts[i.slug]}]));
 return {items,rules,templates:new Map(rules.templates.map(t=>[t.tag,t])),enchants:new Map(rules.enchants.map(e=>[e.slug,e]))};
}
export function normalizeBuild(input,ctx){
 const clean={};if(!input||typeof input!=='object')return clean;
 for(const slot of slots){
  const raw=input[slot.id],item=ctx.items.get(raw?.item);if(!item||!compatible(item,slot))continue;
  if(item.kind==='talisman'){clean[slot.id]={item:item.slug,level:Math.min(3,Math.max(1,Math.trunc(Number(raw.level)||1))),rarity:'common',rolls:[],ench:null};continue;}
  const rarity=item.unique?'unique':['common','rare','special'].includes(raw.rarity)?raw.rarity:'special';
  const count=ctx.rules.rarity[rarity].effects,pool=new Set(item.pool),seen=new Set();
  const rolls=Array.from({length:count},(_,n)=>{const tag=raw.rolls?.[n],t=ctx.templates.get(tag);if(!t||!pool.has(tag)||seen.has(t.effect))return null;seen.add(t.effect);return tag;});
  const enchant=ctx.enchants.get(raw.ench?.slug),ench=slot.ench&&enchant?.slots.includes(slot.ench)&&tiers.includes(raw.ench?.tier)?{slug:enchant.slug,tier:raw.ench.tier}:null;
  clean[slot.id]={item:item.slug,rarity,level:1,rolls,ench};
 }
 return clean;
}
export function decodeBuild(query,ctx){
 const params=query instanceof URLSearchParams?query:new URLSearchParams(query),raw={};
 for(const slot of slots){const value=params.get(slot.id);if(!value||value.length>500)continue;
  const [item,rarity,enchantment,...rolls]=value.split('.'),[slug,tier]=(enchantment||'').split('_');
  raw[slot.id]={item,rarity:codes[rarity],level:Number(rarity),ench:{slug,tier:tiers[Number(tier)-1]},rolls:rolls.slice(0,2).map(s=>{const [effect,grade]=s.split('_');return ctx.rules.templates.find(t=>ctx.rules.effects[t.effect]?.slug===effect&&t.tier===tiers[Number(grade)-1])?.tag;})};
 }
 return normalizeBuild(raw,ctx);
}
export function encodeBuild(build,ctx){
 const q=new URLSearchParams();
 for(const [id,e] of Object.entries(normalizeBuild(build,ctx))){
  const item=ctx.items.get(e.item);if(item.kind==='talisman'){q.set(id,item.slug+'.'+e.level);continue;}
  const values=[e.item,Object.keys(codes).find(k=>codes[k]===e.rarity),e.ench?e.ench.slug+'_'+(tiers.indexOf(e.ench.tier)+1):'',...e.rolls.map(tag=>{const t=ctx.templates.get(tag);return t?ctx.rules.effects[t.effect].slug+'_'+(tiers.indexOf(t.tier)+1):'';})];
  while(values.length>2&&!values.at(-1))values.pop();q.set(id,values.join('.'));
 }return q.toString();
}
export function effectTotals(build,ctx){
 const groups=new Map(),enchants=[];
 for(const [id,e] of Object.entries(normalizeBuild(build,ctx))){
  const item=ctx.items.get(e.item),entries=item.kind==='talisman'?item.levels[e.level-1].effects:[...item.fixed,...e.rolls.map(t=>ctx.templates.get(t)).filter(Boolean)];
  for(const entry of entries){const list=groups.get(entry.effect)||[];list.push({...entry,item:item.name,slot:slots.find(s=>s.id===id).name});groups.set(entry.effect,list);}
  if(e.ench){const enchant=ctx.enchants.get(e.ench.slug);enchants.push({...enchant,tier:e.ench.tier,text:enchant.tiers.find(t=>t.tier===e.ench.tier).text,slot:slots.find(s=>s.id===id).name});}
 }
 return {effects:[...groups].map(([tag,entries])=>{
  const info=ctx.rules.effects[tag];let text;
  if(info?.sum&&entries.every(e=>Number.isFinite(e.value))){
   const fmt=info.sum.format,raw=entries.reduce((a,e)=>a+(info.sum.op==='MultiplyAdditive'?e.value-1:e.value),0)+(info.sum.op==='MultiplyAdditive'?1:0);
   let number=(raw+fmt.offset)*fmt.multiplier;if(fmt.percent)number*=100;if(fmt.abs)number=Math.abs(number);
   const value=Number(number.toFixed(fmt.digits)).toLocaleString('zh-CN',{maximumFractionDigits:fmt.digits})+(fmt.percent?'%':'');text=info.sum.template.replace('{0}',value);
  }else text=entries.map(e=>e.text||info?.name).filter((v,i,a)=>a.indexOf(v)===i).join('；');
  return {tag,info,entries,text};
 }),enchants};
}
export function weaponMetrics(stats){
 if(stats.melee){const m=stats.melee,combo=m.combo,damage=combo.reduce((s,h)=>s+h.damage*h.hits,0),time=combo.reduce((s,h)=>s+h.time,0);return [
  {id:'hit',name:'单次最高伤害',value:Math.max(...combo.map(h=>h.damage))},
  {id:'combo',name:'连招总伤害',value:damage},{id:'dps',name:'每秒伤害',value:damage/time},
  {id:'time',name:'连招耗时',value:time,unit:'秒',lower:true},
  {id:'hits',name:'连招命中次数',value:combo.reduce((s,h)=>s+h.hits,0)},
  {id:'stagger',name:'最高硬直',value:Math.max(...combo.map(h=>h.stagger))},
  {id:'range',name:'最大攻击距离',value:Math.max(...combo.map(h=>h.range))/100,unit:'格'},
  {id:'knockback',name:'最高击退强度',value:Math.max(...combo.map(h=>h.knockback))},
  {id:'jump',name:'跳跃伤害',value:m.jump.damage},
  {id:'reset',name:'连招重置时间',value:m.combo_reset,unit:'秒',lower:true}
 ];}
 const r=stats.ranged,shot=r.projectiles.reduce((s,p)=>s+p.damage*p.count,0)*r.volleys;
 return [{id:'shot',name:'齐射伤害',value:shot},{id:'charged',name:'蓄力齐射伤害',value:shot*r.charge_damage},
  {id:'range',name:'射程',value:r.range/100,unit:'格'},{id:'ammo',name:'弹药容量',value:r.ammo},
  {id:'reload',name:'装填时间',value:r.reload,unit:'秒',lower:true},
  {id:'charge',name:'蓄力时间',value:r.charge_time,unit:'秒',lower:true},
  {id:'projectiles',name:'齐射弹丸数',value:r.projectiles.reduce((s,p)=>s+p.count,0)*r.volleys},
  {id:'stagger',name:'最高硬直',value:Math.max(...r.projectiles.map(p=>p.stagger))}];
}
export function powerMultiplier(power,threat,itemPower,difficulty='normal'){
 const target=Math.trunc(Math.max(threat-1,0)*power.levels_per_threat*power.power_per_level)+1;
 const p=power.weapon,factor=Math.max(p.floor,p.limit/(Math.exp((target-itemPower)*p.spread)*(p.limit-1)+1));
 return factor*power.threat_curves.attack[Math.min(20,Math.max(1,threat))-1]*power.difficulty[difficulty].attack;
}
export function farmPlaces(items,owned,wanted,{onlyWanted=false}={}){
 const places=new Map();for(const item of items){if(owned.has(item.slug)||onlyWanted&&!wanted.has(item.slug))continue;
  for(const source of item.sources){const key=source.type+':'+source.name,place=places.get(key)||{...source,items:[]};place.items.push(item);places.set(key,place);}
 }return [...places.values()].sort((a,b)=>b.items.length-a.items.length||a.name.localeCompare(b.name,'zh-CN'));
}
