import {setRegionText} from './region-icons.mjs?v=listicons1';
export function renderEquipmentDetails({item,panel,el,nativeIcon,displayedParameters,displayedTables}) {
    const dl=el('dl','drop-parameter-grid');dl.dataset.detailSection='parameters';
    for(const [key,value] of displayedParameters(item)){const cell=el('div','drop-parameter');cell.append(el('dt','',key),el('dd','',value));dl.append(cell)}panel.append(dl);
    for(const effect of item.fixed_effects){
     const box=el('div','drop-effect-card'),icon=nativeIcon(effect,'drop-effect-icon');box.dataset.detailSection='effects';
     const text=el('div','drop-effect-copy'),name=el('button','database-related-name',effect.name);name.type='button';name.dataset.databaseName=effect.name;name.dataset.databaseCategory='effects';text.append(name,el('p','',effect.effect));box.append(icon,text);panel.append(box);
    }
    for(const table of displayedTables(item)){if(table.columns.includes('区域')||table.title==='属性 / 数值')continue;
     const section=el('details','drop-extra'),heading=el('summary','',table.title.replace(item.name,''));section.append(heading);
     section.dataset.detailSection=table.title.includes('附魔')?'enchantments':'effects';
     if(table.title==='使用附魔效果')section.classList.add('drop-use-effects');
     if(table.title.includes('可能出现'))section.classList.add('drop-possible-effects');
     for(const row of table.rows){const entry=el('div','drop-entry'),fields=Object.entries(row).filter(([key])=>!['image','native_icon_kind','description','levels','effect_levels','ungraded_effect'].includes(key)),levelData=row.effect_levels?.filter(level=>level.level!=='独特'||level.effect.trim()!==row.effect_levels.find(tier=>tier.level==='III')?.effect.trim())??row.levels;
      let copy=entry;
      if(row.image){entry.classList.add('drop-enchantment-card');const icon=nativeIcon(row,'drop-list-icon',table.title.includes('可用附魔')||table.title==='使用附魔效果');copy=el('div','drop-enchantment-copy');const name=el('button','database-related-name',fields[0][1]);name.type='button';name.dataset.databaseName=fields[0][1];name.dataset.databaseCategory=table.title.includes('附魔')?'enchantments':'effects';copy.append(name);entry.append(icon,copy);fields.shift();}
      if(row.description){entry.classList.add('has-description');copy.append(el('p','',row.description));}
      for(const [key,value] of fields){if(row.levels&&/级效果/.test(key)||row.effect_levels&&['I','II','III','独特'].includes(key))continue;if(row.image&&key==='触发条件')entry.append(el('p','drop-enchantment-trigger',`${key}：${value}`));else copy.append(el('p','',`${key}：${value}`));}
      if(levelData){entry.classList.add('has-levels');const levels=el('dl','drop-levels'),third=levelData.find(level=>level.level==='III');for(const level of levelData){const text=level.level==='独特'&&third&&level.effect.trim()===third.effect.trim()?'和 III 级一样的效果':level.effect,label=el('dt');if(/^(I|II|III)$/.test(level.level)){label.setAttribute('aria-label',`${level.level} 级`);label.append(el('span','native-level-badge',level.level));}else label.textContent=level.level;levels.append(label,el('dd','',text));}if(!levelData.length)levels.append(el('dt','','效果'),el('dd','',row.ungraded_effect||'暂无分级数据'));entry.append(levels);}
      section.append(entry);
     }panel.append(section);
    }
    const locations=el('details','drop-extra');locations.dataset.detailSection='locations';locations.append(el('summary','','获取位置'));for(const place of item.drops){const line=el('button','drop-location database-related-name');line.type='button';line.dataset.databaseName=place['区域'];line.dataset.databaseCategory='locations';setRegionText(line,place['区域']);locations.append(line)}panel.append(locations);
}
