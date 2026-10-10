import {setRegionText} from './region-icons.mjs?v=listicons1';
import {loadEquipmentIndex,loadEquipmentItem} from './equipment-data.mjs?v=layout2';
export const categories=['近战武器','远程武器','盔甲部件','法器'];
export const displayedCategory=item=>item.category==='武器'?`${item.weapon_kind}武器`:item.category;
export const displayedTables=item=>(item.tables??[])
 .map(table=>item.category==='法器'&&table.title==='附魔 / III级效果'?{...table,title:'使用附魔效果'}:table)
 .map(table=>table.title.includes('可用附魔')?{...table,rows:table.rows.filter(row=>(row.levels?.length??0)>1)}:table)
 .filter(table=>table.rows.length>0);
export const displayedParameters=item=>{
 const seen=new Set(),entries=Object.entries(item.parameters).filter(([key])=>{const normalized=key.replace(/\s/g,'');if(key==='DPS排名'||seen.has(normalized))return false;seen.add(normalized);return true;}).map(([key,value])=>[key,['每秒终结击','每秒投射物'].includes(key)?value.replace(/\s*·\s*同级.*$/u,''):value]);
 if(item.category!=='武器')return entries;
 const weight=item.overview?.['重量']||item.parameters['重量']||'—';
 return [['重量',weight],...entries.filter(([key])=>key!=='重量')];
};
// Base records can roll ordinary or special; display the special variant for every category.
export const displayedRarity=item=>item.rarity==='独特'?'独特':['普通/非独特','非独特','特殊'].includes(item.rarity)?'特殊':'普通';
export const itemsForRegion=(items,region,category='全部')=>items.filter(item=>(displayedRarity(item)==='独特'||item.category==='法器'&&displayedRarity(item)==='特殊')&&(category==='全部'||item.category===category||displayedCategory(item)===category)&&item.drops.some(drop=>drop['区域']===region));

export function setupDrops(){
 const dialog=document.getElementById('drops-dialog'),title=document.getElementById('drops-title'),grid=document.getElementById('drops-grid'),status=document.getElementById('drops-status'),tabs=document.getElementById('drops-tabs');
 let region='',category='近战武器',opener;
 const el=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e};
 const nativeIcon=(entry,className,book=false)=>{const frame=el('span',`native-indicator native-${entry.native_icon_kind==='enchantment'?'enchantment':'effect'}`),icon=el('img',className),slot=book?el('span','native-book'):frame;icon.src=entry.image;icon.alt='';icon.width=48;icon.height=48;icon.loading='lazy';icon.addEventListener('error',()=>{slot.hidden=true},{once:true});frame.append(icon);if(book)slot.append(frame);return slot};
 const mobile=matchMedia('(max-width:600px)');
 const layoutCards=()=>{const cards=[...grid.querySelectorAll('.drop-item')].sort((a,b)=>Number(a.style.order)-Number(b.style.order));if(mobile.matches){grid.replaceChildren(...cards);return}const columns=[el('div','drops-column'),el('div','drops-column')];cards.forEach((card,index)=>columns[index%2].append(card));grid.replaceChildren(...columns)};
 mobile.addEventListener('change',layoutCards);
 const load=loadEquipmentIndex;
 async function render(){
  const target=region,selected=category;grid.replaceChildren();status.textContent='正在读取掉落物品…';
  try{const data=await load();if(region!==target||category!==selected||!dialog.open)return;
   const items=itemsForRegion(data.items,region,category);status.textContent=items.length?`${items.length} 件物品`:'该地区暂无符合条件的物品';
   const fragment=document.createDocumentFragment();
   for(const [index,item] of items.entries()){
    const card=el('article','drop-item'),picture=el('div','drop-picture'),img=el('img');img.src=item.image;img.alt=item.name;img.loading='lazy';img.width=88;img.height=88;
    card.classList.toggle('unique',item.rarity==='独特');
    card.classList.toggle('artifact',item.category==='法器');
    card.classList.toggle('special',displayedRarity(item)==='特殊');
    picture.classList.add('native-storm-slot');const soul=el('span','native-soul-mark');soul.setAttribute('aria-hidden','true');picture.append(soul);
    img.addEventListener('error',()=>{picture.replaceChildren(el('span','meta','图片暂不可用'))},{once:true});picture.append(img);
    const info=el('div','drop-info');info.append(el('h3','',item.name),el('p','drop-kind',[displayedCategory(item),item.overview['部位'],displayedRarity(item)].filter(Boolean).join(' · ')));
    if(item.description)info.append(el('p','drop-description',item.description));
    const drop=item.drops.find(d=>d['区域']===region);if(item.category!=='法器'&&drop['物品掉落占比'])info.append(el('p','drop-weight',`物品池占比 ${drop['物品掉落占比']}`));
    const openItem=async()=>{try{const {inspect}=await import('./explorer-ui.mjs?v=detailcleanup1');inspect({...item,slug:item.id,kind:item.category==='法器'?'artifact':item.category==='盔甲部件'?'armor':item.weapon_kind==='远程'?'ranged':'melee',unique:item.rarity==='独特',detailURL:item.detail});}catch{status.textContent='详情加载失败，请重试。';}};
    card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','查看'+item.name+'数据库详情');card.addEventListener('click',openItem);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openItem();}});card.style.order=index;card.append(picture,info);fragment.append(card);
   }grid.replaceChildren(fragment);layoutCards();
  }catch{if(region===target&&category===selected){status.replaceChildren(el('span','','掉落数据加载失败，'),el('button','drops-retry','重试'));status.querySelector('button').addEventListener('click',render)}}
 }
 function open(name,button){region=name;category='近战武器';opener=button;setRegionText(title,name,`${name} · 地区掉落`);for(const t of tabs.children)t.setAttribute('aria-pressed',String(t.dataset.category===category));if(!dialog.open){dialog.showModal();document.body.classList.add('drops-open')}render();}
 for(const name of categories){const button=el('button','drops-tab',name);button.type='button';button.dataset.category=name;button.setAttribute('aria-pressed',String(name==='近战武器'));button.addEventListener('click',()=>{category=name;for(const t of tabs.children)t.setAttribute('aria-pressed',String(t===button));render()});tabs.append(button)}

 document.getElementById('drops-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog){const box=dialog.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)dialog.close()}});
 dialog.addEventListener('close',()=>{document.body.classList.remove('drops-open');if(opener?.isConnected)opener.focus()});
 return {open,setCurrentRegion(name){const button=document.getElementById('current-drops');button.dataset.dropRegion=name;button.setAttribute('aria-label',`查看${name}掉落物品`)}};
}
