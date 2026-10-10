import {el,button,input,heading,select} from './explorer-ui.mjs';
import {loadDatabaseIndex,loadDatabaseCategory} from './database-data.mjs';
import {showDatabaseItem,databasePicture} from './database-detail.mjs';
import {navigationGuard} from './core/navigation.mjs';

export function setupDatabase(){
 const panel=document.getElementById('database-panel');panel.replaceChildren();heading(panel,'GAME DATABASE','数据库','查询装备与世界资料，点击条目查看完整参数与关联信息。');
 const search=input('search','搜索物品、附魔、生物、地点…');search.id='database-search';search.setAttribute('aria-label','搜索数据库');
 const tools=el('div','database-toolbar'),selectBox=select([['all','全部分类']],'all'),sort=select([['name','按名称'],['unique','独特优先']],'name');selectBox.setAttribute('aria-label','数据库分类');sort.setAttribute('aria-label','数据库排序');tools.append(search,selectBox,sort);
 const layout=el('div','database-layout'),sidebar=el('aside','database-sidebar'),content=el('div','database-content'),caption=el('div','database-caption'),title=el('h3','','浏览数据库'),status=el('span','meta'),tiles=el('div','database-categories'),grid=el('div','database-grid'),pager=el('div','database-pagination');caption.append(title,status);content.append(caption,tiles,grid,pager);layout.append(sidebar,content);panel.append(tools,layout);
 let index,current='all',records=[],page=1,ticket=0,showingItem='';const pageSize=48;
 const navigate=category=>{search.value='';location.hash=category==='all'?'database':new URLSearchParams({database:'',category}).toString();};
 selectBox.addEventListener('change',()=>navigate(selectBox.value));sort.addEventListener('change',()=>{page=1;render();});search.addEventListener('input',()=>{page=1;render();});
 function render(){
  if(!index)return;const q=search.value.trim().toLocaleLowerCase(),overview=current==='all'&&!q;tiles.hidden=!overview;grid.hidden=overview;pager.hidden=overview;title.textContent=q?'搜索结果':current==='all'?'浏览数据库':index.categories.find(c=>c.id===current).name;
  const list=records.filter(r=>[r.name,r.english,r.subtype,r.slot,r.set,r.archetype].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>(sort.value==='unique'?Number(b.unique)-Number(a.unique):0)||a.name.localeCompare(b.name,'zh-CN'));
  status.textContent=overview?index.categories.length+' 个分类':list.length+' 个条目';grid.replaceChildren();pager.replaceChildren();if(overview)return;
  if(!list.length){grid.append(el('p','database-empty','没有匹配的条目，试试其他名称。'));return;}
  const pages=Math.ceil(list.length/pageSize);page=Math.min(page,pages);
  for(const item of list.slice((page-1)*pageSize,page*pageSize)){
   const card=button('',()=>showDatabaseItem(item),'database-item');card.setAttribute('aria-label','查看'+item.name+'数据库详情');card.dataset.id=item.id;const copy=el('span','database-item-copy');copy.append(el('strong','',item.name));if(item.description)copy.append(el('span','database-item-description',item.description));card.append(databasePicture(item),copy,el('span','database-item-arrow','↗'));grid.append(card);
  }
  if(pages>1){const previous=button('上一页',()=>{page--;render();grid.scrollIntoView({block:'start'});}),next=button('下一页',()=>{page++;render();grid.scrollIntoView({block:'start'});});previous.disabled=page===1;next.disabled=page===pages;pager.append(previous,el('span','meta',page+' / '+pages),next);}
 }
 function buildNavigation(){
  const all=button('全部分类',()=>navigate('all'),'database-category-link');all.dataset.category='all';sidebar.append(all);
  for(const c of index.categories){const link=button('',()=>navigate(c.id),'database-category-link');link.dataset.category=c.id;link.append(databasePicture(c),el('span','',c.name),el('span','database-count',c.count));sidebar.append(link);const tile=button('',()=>navigate(c.id),'database-category-tile'),copy=el('span');copy.append(el('strong','',c.name),el('span','meta',c.count+' 个条目'));tile.append(databasePicture(c),copy,el('span','database-item-arrow','→'));tiles.append(tile);const option=el('option','',c.name);option.value=c.id;selectBox.append(option);}
 }
 return {async show(params){const task=++ticket,currentRoute=navigationGuard();if(!index){index=await loadDatabaseIndex();buildNavigation();}if(task!==ticket||!currentRoute())return;const alias=index.aliases?.[params.get('category')+':'+params.get('item')],category=alias?.category||params.get('category');const nextCategory=index.categories.some(c=>c.id===category)?category:'all';if(current!==nextCategory)search.value='';current=nextCategory;selectBox.value=current;page=1;for(const link of sidebar.querySelectorAll('[data-category]'))link.setAttribute('aria-pressed',String(link.dataset.category===current));tiles.hidden=true;grid.hidden=false;grid.replaceChildren(el('p','meta','正在读取条目…'));records=current==='all'?index.search.filter(r=>!['unique','bosses'].includes(r.categoryKey)):(await loadDatabaseCategory(current)).items;if(task!==ticket||!currentRoute())return;render();const selected=alias?.id||params.get('item'),key=current+'-'+selected;if(selected&&current!=='all'&&showingItem!==key){const item=records.find(r=>r.id===selected);if(item){showingItem=key;const box=await showDatabaseItem(item);if(box)box.dialog.addEventListener('close',()=>showingItem='',{once:true});else showingItem='';}}}};
}
