import {setRegionText} from './region-icons.mjs?v=listicons1';
const translateAttack=text=>String(text).replace(/Heavy/g,'重击').replace(/Light/g,'轻击').replace(/Projectile/g,'投射物').replace(/^\d+ 第(\d+)击 /,'第 $1 击 · ');
export function renderParameterTable(parameters,el){
 const wrap=el('div','database-table-wrap database-parameters'),table=el('table','database-parameter-table'),body=el('tbody');wrap.dataset.detailSection='parameters';table.setAttribute('aria-label','基本参数');
 for(let index=0;index<parameters.length;index+=2){const row=el('tr');for(const pair of parameters.slice(index,index+2)){const th=el('th','',pair[0]);th.scope='row';row.append(th,el('td','',pair[1]));}body.append(row);}table.append(body);wrap.append(table);return wrap;
}
export function renderFixedEffects(effects,{el,nativeIcon}){
 const section=el('section','database-fixed-effects');section.setAttribute('aria-label','固定词条');
 for(const effect of effects){const card=el('div','drop-effect-card'),copy=el('div','drop-effect-copy'),link=el('button','database-related-name',effect.name);link.type='button';link.dataset.databaseName=effect.name;link.dataset.databaseCategory='effects';copy.append(link,el('p','',effect.effect));card.append(nativeIcon(effect,'drop-effect-icon'),copy);section.append(card);}return section;
}
export function renderEquipmentDetails({item,panel,el,nativeIcon,displayedParameters,displayedTables}){
 panel.append(renderParameterTable(displayedParameters(item),el));
 for(const table of displayedTables(item)){
  if(table.columns.includes('区域')||table.title==='属性 / 数值')continue;
  const combo=table.title.includes('连招拆解'),enchantment=table.title.includes('附魔'),section=el('section','database-detail-section');section.dataset.detailSection=combo?'parameters':enchantment?'enchantments':'effects';
  const title=combo?'连招拆解':table.title.replace(item.name,'');if(combo||enchantment)section.append(el('h3','',title));
  const wrap=combo?el('div','database-table-wrap'):null,node=combo?el('table','database-combo-table'):null,head=combo?el('thead'):null,headers=combo?el('tr'):null,body=combo?el('tbody'):null;
  if(combo){for(const column of table.columns){const th=el('th','',column);th.scope='col';headers.append(th);}for(const values of table.rows){const row=el('tr');for(const column of table.columns)row.append(el('td','',translateAttack(values[column]||'—')));body.append(row);}}
  else{
   for(const values of table.rows){const row=el('div','drop-enchantment-card database-effect-card'),name=el('div','database-effect-heading'),copy=el('div','drop-effect-copy'),label=values[enchantment?'附魔':'效果']||Object.values(values)[0],link=el('button','database-related-name',label);link.type='button';link.dataset.databaseName=label;link.dataset.databaseCategory=enchantment?'enchantments':'effects';if(values.image)row.append(nativeIcon(values,'drop-list-icon',enchantment));name.append(link);copy.append(name);
    if(enchantment){if(values.description)copy.append(el('p','database-row-description',values.description));if(values['类别'])copy.append(el('span','database-row-meta','类别：'+values['类别']));if(values['触发条件'])copy.append(el('p','database-row-meta','触发条件：'+values['触发条件']));}
    const tiers=values.effect_levels?.filter(level=>level.level!=='独特'||level.effect.trim()!==values.effect_levels.find(t=>t.level==='III')?.effect.trim())??values.levels;
    if(!enchantment){copy.append(el('p','',tiers?.find(level=>level.level==='I')?.effect||tiers?.[0]?.effect||values.ungraded_effect||values['效果']||values.description||'暂无效果说明'));row.append(copy);section.append(row);continue;}
    if(tiers?.length){const levels=el('dl','drop-levels');for(const level of tiers){const dt=el('dt');dt.append(/^(I|II|III)$/.test(level.level)?el('span','native-level-badge',level.level):el('span','',level.level));levels.append(dt,el('dd','',level.effect));}row.append(copy,levels);}else{copy.append(el('p','',values.ungraded_effect||values['III级效果']||values['效果']||'暂无分级数据'));row.append(copy);}section.append(row);
   }
  }
  if(combo){head.append(headers);node.append(head,body);wrap.append(node);section.append(wrap);}panel.append(section);
 }
 const locations=el('section','database-detail-section');locations.dataset.detailSection='locations';locations.append(el('h3','','获取位置'));const list=el('div','database-location-list');for(const place of item.drops){const link=el('button','drop-location database-related-name');link.type='button';link.dataset.databaseName=place['区域'];link.dataset.databaseCategory='locations';setRegionText(link,place['区域']);list.append(link);}locations.append(list);panel.append(locations);
}
