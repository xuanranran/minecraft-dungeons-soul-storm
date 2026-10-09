export const categories=['全部','武器','盔甲部件','法器'];
// Base records can roll ordinary or special; display the special variant for every category.
export const displayedRarity=item=>item.rarity==='独特'?'独特':['普通/非独特','非独特','特殊'].includes(item.rarity)?'特殊':'普通';
export const itemsForRegion=(items,region,category='全部')=>items.filter(item=>displayedRarity(item)!=='普通'&&(category==='全部'||item.category===category)&&item.drops.some(drop=>drop['区域']===region));

export function setupDrops(){
 const dialog=document.getElementById('drops-dialog'),title=document.getElementById('drops-title'),grid=document.getElementById('drops-grid'),status=document.getElementById('drops-status'),tabs=document.getElementById('drops-tabs');
 let dataPromise,region='',category='全部',opener;
 const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e};
 const load=()=>dataPromise??=(fetch('./equipment.json?v=drops1').then(r=>{if(!r.ok)throw Error('无法读取装备数据');return r.json()}).catch(e=>{dataPromise=null;throw e}));
 async function render(){
  const target=region,selected=category;grid.replaceChildren();status.textContent='正在读取掉落物品…';
  try{const data=await load();if(region!==target||category!==selected||!dialog.open)return;
   const items=itemsForRegion(data.items,region,category);status.textContent=items.length?`${items.length} 件物品`:'该地区暂无符合条件的物品';
   const fragment=document.createDocumentFragment();
   for(const item of items){
    const card=el('article','drop-item'),picture=el('div','drop-picture'),img=el('img');img.src=item.image;img.alt=item.name;img.loading='lazy';img.width=88;img.height=88;
    card.classList.toggle('unique',item.rarity==='独特');
    card.classList.toggle('special',displayedRarity(item)==='特殊');
    img.addEventListener('error',()=>{picture.replaceChildren(el('span','meta','图片暂不可用'))},{once:true});picture.append(img);
    const info=el('div','drop-info');info.append(el('h3','',item.name),el('p','drop-kind',[item.category,item.weapon_kind,item.overview['部位'],displayedRarity(item)].filter(Boolean).join(' · ')));
    const drop=item.drops.find(d=>d['区域']===region);if(drop['物品掉落占比'])info.append(el('p','drop-weight',`物品池占比 ${drop['物品掉落占比']}`));
    const details=el('details','drop-details'),summary=el('summary','','参数与效果');details.append(summary);const dl=el('dl');
    for(const [key,value] of Object.entries(item.parameters)){dl.append(el('dt','',key),el('dd','',value))}details.append(dl);
    for(const effect of item.fixed_effects)details.append(el('p','drop-effect',`${effect.name}：${effect.effect}`));
    for(const table of item.tables??[]){if(table.columns.includes('区域')||table.title==='属性 / 数值')continue;
     const section=el('details','drop-extra'),heading=el('summary','',table.title.replace(item.name,''));section.append(heading);
     for(const row of table.rows){const entry=el('div','drop-entry');for(const [key,value] of Object.entries(row)){entry.append(el('p','',`${key}：${value}`))}section.append(entry)}details.append(section);
    }
    info.append(details);card.append(picture,info);fragment.append(card);
   }grid.replaceChildren(fragment);
  }catch{if(region===target&&category===selected){status.replaceChildren(el('span','','掉落数据加载失败，'),el('button','drops-retry','重试'));status.querySelector('button').addEventListener('click',render)}}
 }
 function open(name,button){region=name;category='全部';opener=button;title.textContent=`${name} · 地区掉落`;for(const t of tabs.children)t.setAttribute('aria-pressed',String(t.dataset.category===category));if(!dialog.open){dialog.showModal();document.body.classList.add('drops-open')}render();}
 for(const name of categories){const button=el('button','drops-tab',name);button.type='button';button.dataset.category=name;button.setAttribute('aria-pressed',String(name==='全部'));button.addEventListener('click',()=>{category=name;for(const t of tabs.children)t.setAttribute('aria-pressed',String(t===button));render()});tabs.append(button)}
 document.addEventListener('click',e=>{const button=e.target.closest('[data-drop-region]');if(button)open(button.dataset.dropRegion,button)});
 document.getElementById('drops-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{document.body.classList.remove('drops-open');if(opener?.isConnected)opener.focus()});
 return {setCurrentRegion(name){const button=document.getElementById('current-drops');button.dataset.dropRegion=name;button.setAttribute('aria-label',`查看${name}掉落物品`)}};
}
