import assert from 'node:assert/strict';
import fs from 'node:fs';
import {itemsForRegion,displayedRarity,displayedParameters,categories} from './dist/drops.mjs';
import {regionImages} from './dist/region-icons.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./dist/equipment.json',import.meta.url)));
const rotation=JSON.parse(fs.readFileSync(new URL('./dist/rotation.json',import.meta.url)));
assert.equal(data.items.length,272);
assert.ok(!JSON.stringify(data).includes('https://'));
assert.equal(new Set(data.items.map(i=>i.id)).size,272);
for(const i of data.items){assert.ok(fs.existsSync(new URL(`./dist/${i.image}`,import.meta.url)));assert.ok(i.drops.length)}
for(const i of data.items)for(const effect of i.fixed_effects){assert.ok(effect.image?.startsWith('./images/effects/'));assert.ok(fs.existsSync(new URL(`./dist/${effect.image}`,import.meta.url)));}
for(const image of Object.values(regionImages))assert.ok(fs.existsSync(new URL(`./dist/${image}`,import.meta.url)));
for(const name of rotation.places)assert.ok(regionImages[name]);
for(const item of data.items)for(const table of item.tables)for(const row of table.rows)if(row.image)assert.ok(fs.existsSync(new URL(`./dist/${row.image}`,import.meta.url)));
const regions=[...new Set(data.items.flatMap(i=>i.drops.map(d=>d['区域'])))];
for(const region of regions){const all=itemsForRegion(data.items,region);assert.ok(all.every(i=>i.rarity==='独特'||i.category==='法器'));const combined=['武器','盔甲部件','法器'].flatMap(c=>itemsForRegion(data.items,region,c));assert.equal(all.length,combined.length);assert.deepEqual(new Set(all.map(i=>i.id)),new Set(combined.map(i=>i.id)));assert.deepEqual(new Set(all.map(i=>i.id)),new Set(data.items.filter(i=>(i.rarity==='独特'||i.category==='法器')&&i.drops.some(d=>d['区域']===region)).map(i=>i.id)))}
assert.equal(itemsForRegion(data.items,'不存在的地区').length,0);
assert.ok(itemsForRegion(data.items,'吟唱者草甸','法器').some(i=>i.id==='battle-banner'));
const sample=data.items.find(i=>i.id==='battle-banner');
assert.equal(displayedRarity(sample),'特殊');
for(const rarity of ['非独特','特殊','普通/非独特'])assert.equal(itemsForRegion([{...sample,rarity}],'吟唱者草甸').length,1);
for(const category of ['武器','盔甲部件','法器'])assert.equal(itemsForRegion([{...sample,category,rarity:'普通'}],'吟唱者草甸').length,0);
for(const category of ['武器','盔甲部件'])for(const rarity of ['非独特','特殊','普通/非独特'])assert.equal(itemsForRegion([{...sample,category,rarity}],'吟唱者草甸').length,0);
for(const category of ['武器','盔甲部件','法器'])assert.equal(itemsForRegion([{...sample,category,rarity:'独特'}],'吟唱者草甸').length,1);
const gauntlets=data.items.find(i=>i.id==='gauntlets'),uniqueGauntlets=data.items.find(i=>i.id==='prime-enchanters-gauntlets');
assert.equal(gauntlets.parameters['独特版本'],uniqueGauntlets.name);
assert.equal(uniqueGauntlets.parameters['基础武器'],gauntlets.name);
for(const drop of gauntlets.drops){const weapons=itemsForRegion(data.items,drop['区域'],'武器');assert.ok(weapons.some(i=>i.id===uniqueGauntlets.id));assert.ok(!weapons.some(i=>i.id===gauntlets.id));}
assert.ok(itemsForRegion(data.items,'吟唱者草甸','武器').some(i=>i.id==='awesomeaxe'));
assert.equal(data.items.filter(i=>i.rarity==='独特').length,116);
assert.deepEqual(categories,['近战武器','远程武器','盔甲部件','法器']);
for(const region of regions){const melee=itemsForRegion(data.items,region,'近战武器'),ranged=itemsForRegion(data.items,region,'远程武器');assert.ok(melee.every(i=>i.weapon_kind==='近战'));assert.ok(ranged.every(i=>i.weapon_kind==='远程'));assert.equal(melee.length+ranged.length,itemsForRegion(data.items,region,'武器').length);}
for(const item of data.items){const entries=displayedParameters(item);assert.ok(!entries.some(([key])=>key==='DPS排名'));if(item.parameters.DPS)assert.equal(entries.find(([key])=>key==='DPS')[1],item.parameters.DPS);}
const levelRows=data.items.flatMap(i=>i.tables.flatMap(t=>t.rows)).filter(r=>r.levels);
assert.ok(levelRows.length>3000);
for(const row of levelRows){if(row.levels.length){assert.deepEqual(row.levels.map(l=>l.level),['I','II','III']);assert.ok(row.levels.every(l=>typeof l.effect==='string'&&l.effect.length>0));}else assert.ok(row.ungraded_effect);}
const alchemy=levelRows.find(r=>r.image?.includes('ancient-alchemy'));
assert.deepEqual(alchemy.levels.map(l=>l.effect.match(/\d+/)?.[0]),['30','45','60']);
const rollRows=data.items.flatMap(i=>i.tables.flatMap(t=>t.rows)).filter(r=>r.effect_levels);
assert.equal(rollRows.length,1437);
for(const row of rollRows){assert.ok(['I','II','III'].every(level=>row.effect_levels.some(l=>l.level===level)));assert.ok(row.effect_levels.every(l=>l.value&&l.effect));}
const ally=sample.tables.flatMap(t=>t.rows).find(r=>r.image?.endsWith('effects-ally.webp'));
assert.deepEqual(ally.effect_levels.map(l=>l.value),['15%','30%','50%','70%']);
assert.deepEqual(ally.effect_levels.map(l=>l.level),['I','II','III','独特']);
assert.ok(ally.effect_levels.every(l=>l.effect.includes('正面状态持续时间延长')));
console.log(`Drop catalogue: 272 images, ${regions.length} regions and all category filters passed; ${levelRows.length} enchantment rows verified.`);
