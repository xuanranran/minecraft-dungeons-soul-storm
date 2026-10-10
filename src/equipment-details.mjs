import {setRegionText} from './region-icons.mjs';
import {bindEquipmentTooltip} from './equipment-tooltip.mjs';
const translateAttack=text=>String(text).replace(/Heavy/g,'重击').replace(/Light/g,'轻击').replace(/Projectile/g,'投射物').replace(/^\d+ 第(\d+)击 /,'第 $1 击 · ');
export function renderParameterTable(parameters,el){
 const wrap=el('div','database-table-wrap database-parameters'),table=el('table','database-parameter-table'),body=el('tbody');wrap.dataset.detailSection='parameters';table.setAttribute('aria-label','基本参数');
 for(let index=0;index<parameters.length;index+=2){const row=el('tr');for(const pair of parameters.slice(index,index+2)){const th=el('th','',pair[0]);th.scope='row';row.append(th,el('td','',pair[1]));}body.append(row);}table.append(body);wrap.append(table);return wrap;
}
export function renderFixedEffects(effects,{el,nativeIcon}){
 const section=el('section','database-fixed-effects');section.setAttribute('aria-label','固定词条');
 for(const effect of effects){const card=el('button','drop-effect-card'),copy=el('div','drop-effect-copy'),link=el('span','database-related-name',effect.name);card.type='button';card.setAttribute('aria-label',effect.name);card.setAttribute('aria-description',effect.effect);card.dataset.databaseName=effect.name;card.dataset.databaseCategory='effects';copy.append(link,el('p','',effect.effect));card.append(nativeIcon(effect,'drop-effect-icon'),copy);bindEquipmentTooltip(card,{kind:'effect',categoryKey:'effects',name:effect.name,lookupName:effect.name,image:effect.image,description:effect.effect});section.append(card);}return section;
}
export function renderEquipmentDetails({item,panel,el,nativeIcon,displayedParameters,displayedTables}){
 panel.append(renderParameterTable(displayedParameters(item),el));
 for(const table of displayedTables(item)){
  if(table.columns.includes('区域')||table.columns.includes('属性')&&table.columns.includes('数值'))continue;
  const combo=table.title.includes('连招拆解'),enchantment=table.columns.includes('附魔'),numeric=!enchantment&&!table.columns.includes('效果'),section=el('section','database-detail-section');section.dataset.detailSection=numeric?'parameters':enchantment?'enchantments':'effects';
  const title=combo?'连招拆解':table.title.replace(item.name,'');if(numeric)section.append(el('h3','',title));
  const wrap=numeric?el('div','database-table-wrap'):null,node=numeric?el('table',combo?'database-combo-table':'database-extra-parameter-table'):null,head=numeric?el('thead'):null,headers=numeric?el('tr'):null,body=numeric?el('tbody'):null;
  if(numeric){for(const column of table.columns){const th=el('th','',column);th.scope='col';headers.append(th);}for(const values of table.rows){const row=el('tr');for(const column of table.columns)row.append(el('td','',translateAttack(values[column]||'—')));body.append(row);}}
  else{
   for(const values of table.rows){const row=el('button','drop-enchantment-card database-effect-card'),name=el('div','database-effect-heading'),copy=el('div','drop-effect-copy'),label=values[enchantment?'附魔':'效果']||Object.values(values)[0],link=el('span','database-related-name',label);row.type='button';row.setAttribute('aria-label',label);row.dataset.databaseName=label;row.dataset.databaseCategory=enchantment?'enchantments':'effects';if(values.image)row.append(nativeIcon(values,'drop-list-icon',enchantment));name.append(link);copy.append(name);
    const tiers=values.effect_levels?.filter(level=>level.level!=='独特'||level.effect.trim()!==values.effect_levels.find(t=>t.level==='III')?.effect.trim())??values.levels;
    const text=tiers?.find(level=>level.level==='I')?.effect||tiers?.[0]?.effect||values.ungraded_effect||values['效果']||values.description||'暂无效果说明';copy.append(el('p','',text));row.setAttribute('aria-description',text);row.append(copy);bindEquipmentTooltip(row,{kind:enchantment?'enchantment':'effect',categoryKey:row.dataset.databaseCategory,name:label,lookupName:label,image:values.image,description:text});section.append(row);
   }
  }
  if(numeric){head.append(headers);node.append(head,body);wrap.append(node);section.append(wrap);}panel.append(section);
 }
 const locations=el('section','database-detail-section');locations.dataset.detailSection='locations';const list=el('div','database-location-list');for(const place of item.drops){const link=el('button','drop-location database-related-name');link.type='button';link.dataset.databaseName=place['区域'];link.dataset.databaseCategory='locations';setRegionText(link,place['区域']);list.append(link);}locations.append(list);panel.append(locations);
}
