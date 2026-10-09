import assert from 'node:assert/strict';
import fs from 'node:fs';
import {itemsForRegion,displayedRarity} from './dist/drops.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./dist/equipment.json',import.meta.url)));
const rotation=JSON.parse(fs.readFileSync(new URL('./dist/rotation.json',import.meta.url)));
assert.equal(data.items.length,272);
assert.ok(!JSON.stringify(data).includes('https://'));
assert.equal(new Set(data.items.map(i=>i.id)).size,272);
for(const i of data.items){assert.ok(fs.existsSync(new URL(`./dist/${i.image}`,import.meta.url)));assert.ok(i.drops.length)}
for(const i of data.items)for(const effect of i.fixed_effects){assert.ok(effect.image?.startsWith('./images/effects/'));assert.ok(fs.existsSync(new URL(`./dist/${effect.image}`,import.meta.url)));}
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
console.log(`Drop catalogue: 272 images, ${regions.length} regions and all category filters passed.`);
