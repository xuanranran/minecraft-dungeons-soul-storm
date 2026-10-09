import {setRegionText} from './region-icons.mjs?v=listicons1';
export const categories=['近战武器','远程武器','盔甲部件','法器'];
export const displayedCategory=item=>item.category==='武器'?`${item.weapon_kind}武器`:item.category;
export const displayedTables=item=>(item.tables??[])
 .map(table=>item.category==='法器'&&table.title==='附魔 / III级效果'?{...table,title:'使用附魔效果'}:table)
 .map(table=>table.title.includes('可用附魔')?{...table,rows:table.rows.filter(row=>(row.levels?.length??0)>1)}:table)
 .filter(table=>table.rows.length>0);
export const displayedParameters=item=>{
 const entries=Object.entries(item.parameters).filter(([key])=>key!=='DPS排名').map(([key,value])=>[key,key==='每秒终结击'?value.replace(/\s*·\s*同级.*$/u,''):value]);
 if(item.category!=='武器')return entries;
 const weight=item.overview?.['重量']||item.parameters['重量']||'—';
 return [['重量',weight],...entries.filter(([key])=>key!=='重量')];
};
// Base records can roll ordinary or special; display the special variant for every category.
export const displayedRarity=item=>item.rarity==='独特'?'独特':['普通/非独特','非独特','特殊'].includes(item.rarity)?'特殊':'普通';
export const itemsForRegion=(items,region,category='全部')=>items.filter(item=>(displayedRarity(item)==='独特'||item.category==='法器'&&displayedRarity(item)==='特殊')&&(category==='全部'||item.category===category||displayedCategory(item)===category)&&item.drops.some(drop=>drop['区域']===region));

export function setupDrops(){
 const dialog=document.getElementById('drops-dialog'),title=document.getElementById('drops-title'),grid=document.getElementById('drops-grid'),status=document.getElementById('drops-status'),tabs=document.getElementById('drops-tabs');
 let dataPromise,region='',category='近战武器',opener;
 const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e};
 const mobile=matchMedia('(max-width:600px)');
 const layoutCards=()=>{const cards=[...grid.querySelectorAll('.drop-item')].sort((a,b)=>Number(a.style.order)-Number(b.style.order));if(mobile.matches){grid.replaceChildren(...cards);return}const columns=[el('div','drops-column'),el('div','drops-column')];cards.forEach((card,index)=>columns[index%2].append(card));grid.replaceChildren(...columns)};
 mobile.addEventListener('change',layoutCards);
 const load=()=>dataPromise??=(fetch('./equipment.json?v=allintro1').then(r=>{if(!r.ok)throw Error('无法读取装备数据');return r.json()}).catch(e=>{dataPromise=null;throw e}));
 async function render(){
  const target=region,selected=category;grid.replaceChildren();status.textContent='正在读取掉落物品…';
  try{const data=await load();if(region!==target||category!==selected||!dialog.open)return;
   const items=itemsForRegion(data.items,region,category);status.textContent=items.length?`${items.length} 件物品`:'该地区暂无符合条件的物品';
   const fragment=document.createDocumentFragment();
   for(const [index,item] of items.entries()){
    const card=el('article','drop-item'),picture=el('div','drop-picture'),img=el('img');img.src=item.image;img.alt=item.name;img.loading='lazy';img.width=88;img.height=88;
    card.classList.toggle('unique',item.rarity==='独特');
    card.classList.toggle('special',displayedRarity(item)==='特殊');
    img.addEventListener('error',()=>{picture.replaceChildren(el('span','meta','图片暂不可用'))},{once:true});picture.append(img);
    const info=el('div','drop-info');info.append(el('h3','',item.name),el('p','drop-kind',[displayedCategory(item),item.overview['部位'],displayedRarity(item)].filter(Boolean).join(' · ')));
    if(item.description)info.append(el('p','drop-description',item.description));
    const drop=item.drops.find(d=>d['区域']===region);if(item.category!=='法器'&&drop['物品掉落占比'])info.append(el('p','drop-weight',`物品池占比 ${drop['物品掉落占比']}`));
    const details=el('details','drop-details'),summary=el('summary','','参数与效果'),panel=el('div','drop-detail-panel');details.append(summary,panel);const dl=el('dl');
    for(const [key,value] of displayedParameters(item)){dl.append(el('dt','',key),el('dd','',value))}panel.append(dl);
    for(const effect of item.fixed_effects){
     const box=el('div','drop-effect-card'),icon=el('img','drop-effect-icon');icon.src=effect.image;icon.alt='';icon.width=48;icon.height=48;icon.loading='lazy';icon.addEventListener('error',()=>{icon.hidden=true},{once:true});
     const text=el('div','drop-effect-copy');text.append(el('strong','',effect.name),el('p','',effect.effect));box.append(icon,text);panel.append(box);
    }
    for(const table of displayedTables(item)){if(table.columns.includes('区域')||table.title==='属性 / 数值')continue;
     const section=el('details','drop-extra'),heading=el('summary','',table.title.replace(item.name,''));section.append(heading);
     if(table.title==='使用附魔效果')section.classList.add('drop-use-effects');
     for(const row of table.rows){const entry=el('div','drop-entry'),fields=Object.entries(row).filter(([key])=>!['image','description','levels','effect_levels','ungraded_effect'].includes(key)),levelData=row.effect_levels??row.levels;
      let copy=entry;
      if(row.image){entry.classList.add('drop-enchantment-card');const icon=el('img','drop-list-icon');icon.src=row.image;icon.alt='';icon.width=48;icon.height=48;icon.loading='lazy';icon.addEventListener('error',()=>{icon.hidden=true},{once:true});copy=el('div','drop-enchantment-copy');copy.append(el('strong','',fields[0][1]));entry.append(icon,copy);fields.shift();}
      if(row.description){entry.classList.add('has-description');copy.append(el('p','',row.description));}
      for(const [key,value] of fields){if(row.levels&&/级效果/.test(key)||row.effect_levels&&['I','II','III','独特'].includes(key))continue;if(row.image&&key==='触发条件')entry.append(el('p','drop-enchantment-trigger',`${key}：${value}`));else copy.append(el('p','',`${key}：${value}`));}
      if(levelData){entry.classList.add('has-levels');const levels=el('dl','drop-levels'),third=levelData.find(level=>level.level==='III');for(const level of levelData){const text=level.level==='独特'&&third&&level.effect.trim()===third.effect.trim()?'和 III 级一样的效果':level.effect;levels.append(el('dt','',/^(I|II|III)$/.test(level.level)?`${level.level} 级`:level.level),el('dd','',text));}if(!levelData.length)levels.append(el('dt','','效果'),el('dd','',row.ungraded_effect||'暂无分级数据'));entry.append(levels);}
      section.append(entry);
     }panel.append(section);
    }
    const locations=el('details','drop-extra');locations.append(el('summary','','掉落地区'));for(const place of item.drops){const line=el('p','drop-location');setRegionText(line,place['区域']);locations.append(line)}panel.append(locations);
    card.style.order=index;card.append(picture,info,details);fragment.append(card);
   }grid.replaceChildren(fragment);layoutCards();
  }catch{if(region===target&&category===selected){status.replaceChildren(el('span','','掉落数据加载失败，'),el('button','drops-retry','重试'));status.querySelector('button').addEventListener('click',render)}}
 }
 function open(name,button){region=name;category='近战武器';opener=button;setRegionText(title,name,`${name} · 地区掉落`);for(const t of tabs.children)t.setAttribute('aria-pressed',String(t.dataset.category===category));if(!dialog.open){dialog.showModal();document.body.classList.add('drops-open')}render();}
 for(const name of categories){const button=el('button','drops-tab',name);button.type='button';button.dataset.category=name;button.setAttribute('aria-pressed',String(name==='近战武器'));button.addEventListener('click',()=>{category=name;for(const t of tabs.children)t.setAttribute('aria-pressed',String(t===button));render()});tabs.append(button)}
 document.addEventListener('click',e=>{const button=e.target.closest('[data-drop-region]');if(button)open(button.dataset.dropRegion,button)});
 document.getElementById('drops-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{document.body.classList.remove('drops-open');if(opener?.isConnected)opener.focus()});
 return {setCurrentRegion(name){const button=document.getElementById('current-drops');button.dataset.dropRegion=name;button.setAttribute('aria-label',`查看${name}掉落物品`)}};
}
