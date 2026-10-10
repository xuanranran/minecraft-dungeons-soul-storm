import {el,button,modal,copyLink,notify} from './explorer-ui.mjs';
import {loadEquipmentItem} from './equipment-data.mjs';
import {displayedParameters,displayedTables} from './drops.mjs';
import {renderEquipmentDetails,renderParameterTable,renderFixedEffects} from './equipment-details.mjs';
import {loadDatabaseRecord,findDatabaseRecord} from './database-data.mjs';
import {navigationGuard} from './core/navigation.mjs';
import {bindEquipmentTooltip} from './equipment-tooltip.mjs';

const kindCategory={melee:'weapons',ranged:'weapons',armor:'armor',artifact:'artifacts',talisman:'talismans'},categoryNames={weapons:'武器',armor:'盔甲','armor-sets':'盔甲套装',artifacts:'法器',talismans:'护身符',enchantments:'附魔书',effects:'装备效果',statuses:'状态',unique:'独特物品',enemies:'生物',bosses:'首领',locations:'地点',quests:'任务',cosmetics:'装饰',upcoming:'文件预留'};
const resources=()=>Promise.all([import('./explorer.css'),import('./drops.css'),import('./ui/styles/native-equipment.css')]).then(()=>import('./database.css')).then(()=>import('./ui/styles/details.css'));
export function databasePicture(item){
 const picture=el('span','database-picture'),image=el('img');image.src=item.image||'';image.alt='';image.loading='lazy';image.width=64;image.height=64;
 if(!item.image){picture.classList.add('is-empty');picture.textContent='◇';return picture;}
 if(kindCategory[item.kind]){picture.classList.add('tool-item-picture');picture.dataset.kind=item.kind;picture.style.setProperty('--equipment-color',item.unique?'#ff7e2f':item.kind==='artifact'?'#2ca2fe':'#b49d89');if(item.kind!=='talisman')picture.append(el('span','native-square-mark'));}
 if(item.categoryKey==='enchantments'&&item.iconKind!=='effect'){picture.classList.add('native-book');const diamond=el('span','native-indicator native-enchantment');diamond.append(image);picture.append(diamond);}else picture.append(image);
 if(kindCategory[item.kind]||['enchantment','effect'].includes(item.kind))bindEquipmentTooltip(picture,{...item,slug:item.slug||item.id});
 image.addEventListener('error',()=>{image.hidden=true;picture.classList.add('is-empty');},{once:true});return picture;
}
function nativeIcon(entry,className,book=false){const frame=el('span','native-indicator native-'+(entry.native_icon_kind==='enchantment'?'enchantment':'effect')),icon=el('img',className),slot=book?el('span','native-book'):frame;icon.src=entry.image;icon.alt='';icon.loading='lazy';frame.append(icon);if(book)slot.append(frame);return slot;}
function parameterGrid(parameters){return renderParameterTable(parameters.filter(([,v])=>v!=null&&v!==''),el);}
function detailSection(title,tab){const section=el('section','database-detail-section');section.dataset.detailSection=tab;section.append(el('h3','',title));return section;}
function tableSection(table,tab='parameters'){const section=detailSection(table.title||'详细参数',tab),wrap=el('div','database-table-wrap'),node=el('table'),head=el('thead'),row=el('tr'),body=el('tbody');for(const name of table.columns){const th=el('th','',name);th.scope='col';row.append(th);}head.append(row);for(const values of table.rows){const tr=el('tr');for(const value of values)tr.append(el('td','',value));body.append(tr);}node.append(head,body);wrap.append(node);section.append(wrap);return section;}
function tierSection(record){const section=detailSection(record.kind==='talisman'?'等级效果':'等级与效果','effects');for(const tier of record.tiers||[]){const card=el('div','database-tier'),copy=el('div');if(tier.image){card.append(databasePicture({...record,image:tier.image}));copy.append(el('strong','','等级 '+tier.tier));}else card.append(el('span','native-level-badge',tier.tier));copy.append(el('p','',tier.text));card.append(copy);section.append(card);}return section;}
async function showRelated(category,id){const current=navigationGuard();try{const record=await findDatabaseRecord(category,id);if(!current())return;if(record)await showDatabaseItem(record);else notify('该条目暂未收录完整详情。');}catch{if(current())notify('关联资料读取失败，请重试。');}}
export async function showDatabaseItem(input){
 const current=navigationGuard();await resources();if(!current())return;const box=modal(input.name||'数据库详情','database-dialog');box.body.append(el('p','meta','正在读取完整资料…'));box.open();box.dialog.addEventListener('close',()=>box.dialog.remove(),{once:true});
 async function render(){
  let record=input;const category=input.categoryKey||kindCategory[input.kind];
  if(!input.dbKind&&category){const indexed=await findDatabaseRecord(category,input.slug||input.id);if(indexed)record=indexed;}
  if(record.dbKind)record=await loadDatabaseRecord(record);if(!box.dialog.open)return;
  box.title.textContent=record.name;box.body.replaceChildren();const hero=el('div','database-detail-hero'),copy=el('div','database-hero-copy');copy.append(el('h2','',record.name));if(record.description)copy.append(el('p','database-description',record.description));hero.append(databasePicture(record),copy);box.body.append(hero);
  const tabs=el('div','database-detail-tabs'),panel=el('div','drop-detail-panel database-detail-content');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','详情分类');box.body.append(tabs,panel);
  const equipmentURL=record.detailURL||(!record.dbKind?input.detailURL:null);
  if(equipmentURL){const full=await loadEquipmentItem({id:record.id||record.slug,detail:equipmentURL});if(!box.dialog.open)return;if(full.fixed_effects?.length)box.body.insertBefore(renderFixedEffects(full.fixed_effects,{el,nativeIcon}),tabs);renderEquipmentDetails({item:full,panel,el,nativeIcon,displayedParameters,displayedTables});for(const details of panel.querySelectorAll('details'))details.open=true;}
  else{const effectOnly=record.kind==='effect'||record.kind==='enchantment';if(!effectOnly&&record.parameters?.length)panel.append(parameterGrid(record.parameters));if(record.tiers?.length)panel.append(tierSection(record));if(!effectOnly)for(const table of record.tables||[])panel.append(tableSection(table));}
  if(record.objectives?.length){const section=detailSection('任务目标','objectives'),list=el('ol','database-objectives');for(const objective of record.objectives){const li=el('li','',objective.text);if(objective.map){const link=button('地图位置',async()=>{try{const reference=new URL(objective.map,'https://www.dungeons.tools'),query=new URLSearchParams(reference.hash.slice(1)),marker=query.get('m'),position=query.get('p'),dimension=reference.pathname.includes('the-sift')?'sift':reference.pathname.includes('/camp')?'camp':'overworld';const route=new URLSearchParams({map:dimension});if(position)route.set('position',position);if(marker)route.set('marker',marker);for(const dialog of [...document.querySelectorAll('dialog[open]')].reverse())dialog.close();location.hash=route.toString();}catch{notify('地图位置读取失败，请重试。');}},'database-map-link');li.append(link);}list.append(li);}section.append(list);panel.append(section);}
  if(record.categoryKey==='armor-sets'&&record.related?.length){const section=detailSection('套装部件','parameters'),list=el('div','database-location-list');for(const part of record.related){const link=button(part.name,()=>showRelated('armor',part.id),'drop-location');list.append(link);}section.append(list);panel.append(section);}
  box.body.addEventListener('click',event=>{const target=event.target.closest('[data-database-name]');if(target)showRelated(target.dataset.databaseCategory,target.dataset.databaseName);});
  const available=[['parameters','参数'],['effects','效果'],['enchantments','附魔'],['locations','获取位置'],['objectives','任务目标']].filter(([key])=>[...panel.querySelectorAll('[data-detail-section="'+key+'"]')].some(n=>n.children.length));
  function activate(key){for(const node of panel.querySelectorAll('[data-detail-section]'))node.hidden=node.dataset.detailSection!==key;for(const tab of tabs.children){const selected=tab.dataset.section===key;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}}
  for(const [key,name] of available){const b=button(name,()=>activate(key),'database-detail-tab');b.dataset.section=key;b.setAttribute('role','tab');tabs.append(b);}
  tabs.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const all=[...tabs.children],i=all.indexOf(document.activeElement),index=event.key==='Home'?0:event.key==='End'?all.length-1:(i+(event.key==='ArrowRight'?1:-1)+all.length)%all.length;all[index]?.click();all[index]?.focus();});
  if(available.length)activate(available[0][0]);else if(!['effect','enchantment'].includes(record.kind))panel.append(el('p','meta','此条目暂未提供完整参数。'));if(['effect','enchantment'].includes(record.kind))tabs.hidden=true;
  const footer=el('div','database-detail-footer');footer.append(el('span','meta',record.categoryKey==='upcoming'?'游戏文件预留定义，未作为已实装条目统计。':''));const id=record.id||record.slug;if(category&&id)footer.append(button('复制详情链接',()=>copyLink(new URLSearchParams({database:'',category,item:id}).toString()),'database-share'));box.body.append(footer);
 }
 try{await render();}catch{if(box.dialog.open){box.body.replaceChildren(el('p','','详情加载失败，请检查网络后重试。'),button('重新载入',()=>render().catch(()=>notify('详情暂时无法读取，请稍后重试。'))));}}return box;
}
