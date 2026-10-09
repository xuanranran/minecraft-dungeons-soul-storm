import assert from 'node:assert/strict';
import fs from 'node:fs';
import {itemsForRegion} from './dist/drops.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./dist/equipment.json',import.meta.url)));
const rotation=JSON.parse(fs.readFileSync(new URL('./dist/rotation.json',import.meta.url)));
assert.equal(data.items.length,272);
assert.ok(!JSON.stringify(data).includes('https://'));
assert.equal(new Set(data.items.map(i=>i.id)).size,272);
for(const i of data.items){assert.ok(fs.existsSync(new URL(`./dist/${i.image}`,import.meta.url)));assert.ok(i.drops.length)}
const regions=[...new Set(data.items.flatMap(i=>i.drops.map(d=>d['区域'])))];
for(const region of regions){const all=itemsForRegion(data.items,region);const combined=['武器','盔甲部件','法器'].flatMap(c=>itemsForRegion(data.items,region,c));assert.equal(all.length,combined.length);assert.deepEqual(new Set(all.map(i=>i.id)),new Set(combined.map(i=>i.id)))}
assert.equal(itemsForRegion(data.items,'不存在的地区').length,0);
assert.ok(itemsForRegion(data.items,'吟唱者草甸','法器').some(i=>i.id==='battle-banner'));
console.log(`Drop catalogue: 272 images, ${regions.length} regions and all category filters passed.`);
