import './ui/styles/build-details.css';
import {loadCatalogue,loadRules,loadLoadouts} from './explorer-data.mjs';
import {context,decodeBuild,effectTotals,slots} from './explorer-model.mjs';
import {el,button,itemPicture,modal,inspect,copyLink} from './explorer-ui.mjs';
import {createEquipmentCard} from './equipment-tooltip.mjs';

function section(title,cls=''){const box=el('section','build-detail-section '+cls);box.append(el('h3','build-detail-strip',title));const body=el('div','build-detail-section-body');box.append(body);return {box,body};}
function publishedDate(text){const match=String(text||'').match(/^(\d+) ([A-Za-z]+) (\d{4})$/),months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return match?match[3]+'年'+(months.indexOf(match[2])+1)+'月'+match[1]+'日':text;}
function icon(src){const image=el('img');image.src=src;image.alt='';image.loading='lazy';return image;}
export async function showBuildDetail(build,title,introduction){
 const box=modal(title,'build-introduction-dialog'),content=el('div','tool-build-detail');
 box.body.append(content);content.append(el('p','tool-note','正在读取配装…'));box.open();
 box.dialog.addEventListener('close',()=>box.dialog.remove(),{once:true});
 try{
  const [catalogue,rules,loadouts]=await Promise.all([loadCatalogue(),loadRules(),loadLoadouts()]);
  if(!box.dialog.open)return;
  const ctx=context(catalogue,rules,loadouts),configured=decodeBuild(build.q,ctx),summary=effectTotals(configured,ctx);
  content.replaceChildren();
  content.append(el('p','build-introduction',introduction));
  const overview=el('div','build-detail-overview'),inventory=el('div','build-detail-inventory');
  for(const [name,ids] of [['武器',['melee','ranged']],['盔甲',['helmet','chest','legs','boots']],['法器',['a1','a2','a3']],['护身符',['t1','t2','t3']]]){
   const group=el('section','build-detail-slot-group'),row=el('div','build-detail-slot-row');group.append(el('h3','',name),row);
   for(const id of ids){const entry=configured[id],item=ctx.items.get(entry?.item);if(!item)continue;
    const control=button('',()=>inspect(item),'tool-build-detail-item');control.setAttribute('aria-label','查看'+item.name+'详情');
    control.append(itemPicture(item,{rarity:entry.rarity,level:entry.level,equipment:entry}));row.append(control);
   }if(row.childElementCount)inventory.append(group);
  }
  const controls=el('div','tool-action-row'),edit=el('a','tool-button-link','复制并编辑');edit.href='#planner&'+build.q+(build.public?'':'&edit='+encodeURIComponent(build.id));edit.addEventListener('click',()=>box.close());
  controls.append(edit,button('复制配装链接',()=>copyLink(build.public?'builds&build='+encodeURIComponent(build.id):'planner&'+build.q)));
  inventory.append(controls);const sidebar=el('div','build-detail-sidebar'),about=section('关于这套配装');
  const metadata=el('dl','build-detail-metadata');for(const [label,value] of [['风格',build.tags.join(' · ')],['版本',build.patch],['作者',build.author],['发布',publishedDate(build.published)]])if(value)metadata.append(el('dt','',label),el('dd','',value));
  about.body.append(metadata);sidebar.append(about.box);overview.append(inventory,sidebar);content.append(overview);
  const effects=section('效果与属性','build-detail-totals'),effectGrid=el('div','build-detail-effects');
  for(const effect of summary.effects){const row=el('div','build-detail-effect');if(effect.info?.image)row.append(icon(effect.info.image));else row.append(el('span','build-detail-symbol','◇'));const text=el('div');text.append(el('strong','',effect.info?.name||effect.tag),el('span','',effect.entries.length>1?' ×'+effect.entries.length:''),el('p','',effect.text));row.append(text);effectGrid.append(row);}
  effects.body.append(effectGrid,el('p','tool-note','同一属性的数值按游戏的汇总规则显示；触发类效果保留各件装备的说明。'));
  if(summary.enchants.length){effects.body.append(el('h4','build-detail-subheading','附魔'));const list=el('div','build-detail-enchantments');
   for(const enchant of summary.enchants){const row=el('div','build-detail-enchantment'),item=ctx.items.get(configured[slots.find(s=>s.name===enchant.slot).id].item),text=el('div');text.append(el('strong','',enchant.name+' '+enchant.tier+' · '+item.name),el('p','',enchant.text));row.append(icon(enchant.image),text);list.append(row);}effects.body.append(list);
  }content.append(effects.box);
  if(build.id==='2-tumbleshot-close-ranger'){
   const guide=section('玩法指南','build-detail-guide');content.append(guide.box);
   try{const response=await fetch('./data/explorer/guides/2-tumbleshot-close-ranger.json?v=tools2');if(!response.ok)throw Error();const data=await response.json();if(!box.dialog.open)return;
    for(const part of data.sections){const group=el('section');group.append(el('h4','',part.title));for(const text of part.paragraphs)group.append(el('p','',text));guide.body.append(group);}guide.body.append(el('p','tool-note',data.note));
   }catch{guide.body.append(el('p','tool-note','玩法说明读取失败。'),button('重新读取',()=>{box.close();showBuildDetail(build,title,introduction);}));}
  }
  if(build.note){const notes=section('配装说明');notes.body.append(el('p','tool-build-note',build.note));content.append(notes.box);}
  const details=section('装备详情 · '+Object.keys(configured).length,'build-detail-gear'),grid=el('div','build-detail-gear-grid');details.body.append(grid);content.append(details.box);
  const cards=await Promise.all(Object.values(configured).map(entry=>createEquipmentCard(ctx.items.get(entry.item),entry)));
  if(!box.dialog.open)return;grid.append(...cards);
 }catch{if(box.dialog.open){content.replaceChildren(el('p','tool-note','配装详情读取失败。'),button('重新读取',()=>{box.close();showBuildDetail(build,title,introduction);}));}}
}
