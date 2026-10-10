import assert from 'node:assert/strict';
import fs from 'node:fs';
import {context,slots,compatible,normalizeBuild,decodeBuild,encodeBuild,effectTotals,weaponMetrics,powerMultiplier,farmPlaces} from './src/explorer-model.mjs';
const get=name=>JSON.parse(fs.readFileSync(new URL('./public/data/explorer/'+name+'.json',import.meta.url))),catalogue=get('catalogue'),rules=get('rules'),loadouts=get('loadouts'),weapons=get('weapons'),publicBuilds=get('builds'),ctx=context(catalogue,rules,loadouts);
assert.equal(catalogue.items.length,296);assert.equal(ctx.enchants.size,32);assert.equal(publicBuilds.builds.length,56);
for(const build of publicBuilds.builds){assert.match(build.title_zh,/[\u3400-\u9fff]/,build.id);assert.doesNotMatch(build.title_zh,/[A-Za-z]/,build.id);}
const counts={};for(const item of ctx.items.values()){
 counts[item.kind]=(counts[item.kind]||0)+1;assert.match(item.name,/[\u3400-\u9fff]/);assert.ok(fs.existsSync(new URL('./public/'+item.image,import.meta.url)),item.image);
 if(item.detailURL)assert.ok(fs.existsSync(new URL('./public/'+item.detailURL.split('?')[0],import.meta.url)));
 assert.ok(slots.some(s=>compatible(item,s)));for(const tag of item.pool)assert.ok(ctx.templates.has(tag));
 for(const fixed of item.fixed){assert.ok(rules.effects[fixed.effect]?.name);assert.doesNotMatch(fixed.text,/[{}]/);}
 if(item.kind==='talisman'){assert.equal(item.levels.length,3);for(const l of item.levels){assert.ok(fs.existsSync(new URL('./public/'+l.image,import.meta.url)));for(const e of l.effects)assert.doesNotMatch(e.text,/[{}]/);}}
}
assert.deepEqual(counts,{melee:58,ranged:22,armor:152,artifact:40,talisman:24});
for(const e of rules.enchants){assert.deepEqual(e.tiers.map(t=>t.tier),['I','II','III']);for(const t of e.tiers)assert.match(t.text,/[\u3400-\u9fff]/);assert.ok(fs.existsSync(new URL('./public/'+e.image,import.meta.url)));}
for(const template of rules.templates)assert.doesNotMatch(template.text,/[{}]/);
for(const build of publicBuilds.builds){const decoded=decodeBuild(build.q,ctx),count=[...new URLSearchParams(build.q).keys()].filter(id=>slots.some(s=>s.id===id)).length;assert.equal(Object.keys(decoded).length,count,build.id);assert.deepEqual(decodeBuild(encodeBuild(decoded,ctx),ctx),decoded);for(const effect of effectTotals(decoded,ctx).effects)assert.doesNotMatch(effect.text,/[{}]/);}
const invalid=normalizeBuild({melee:{item:'bow'},chest:{item:'sword'},a1:{item:'corrupted-beacon',rarity:'unique',ench:{slug:'gravity-pulse',tier:'III'},rolls:['SW.EffectTemplate.Sharpness.III','fake']},t1:{item:'amethyst-lens',level:99}},ctx);
assert.ok(!invalid.melee&&!invalid.chest);assert.equal(invalid.a1.ench,null);assert.equal(invalid.a1.rarity,'special');assert.equal(invalid.t1.level,3);assert.ok(!invalid.a1.rolls.includes('fake'));
const sharp='SW.EffectTemplate.Sharpness.III',sword=ctx.items.get('sword'),other=ctx.items.get('fist-of-iron');assert.ok(sword.pool.includes(sharp)&&other);
const build=normalizeBuild({melee:{item:'sword',rarity:'special',rolls:[sharp,sharp]},t1:{item:other.slug,level:3}},ctx);assert.equal(build.melee.rolls[1],null);const total=effectTotals(build,ctx).effects.find(e=>e.tag==='SW.Effect.Sharpness');assert.match(total.text,/65%/);assert.equal(total.entries.length,2);
const stats=weaponMetrics(weapons.sword);assert.equal(stats.find(s=>s.id==='combo').value,52);assert.equal(stats.find(s=>s.id==='time').value,1.483);assert.ok(Math.abs(stats.find(s=>s.id==='dps').value-52/1.483)<1e-9);assert.equal(stats.find(s=>s.id==='jump').value,24);assert.equal(powerMultiplier(rules.power,8,53),.63);
assert.ok(powerMultiplier(rules.power,8,60)>powerMultiplier(rules.power,8,53));assert.ok(powerMultiplier(rules.power,8,53,'low')>powerMultiplier(rules.power,8,53,'high'));
const farm=farmPlaces(catalogue.items,new Set(),new Set(['sword']),{onlyWanted:true});assert.ok(farm.length&&farm.every(p=>p.items.length===1&&p.items[0].slug==='sword'));assert.equal(farmPlaces(catalogue.items,new Set(catalogue.items.map(i=>i.slug)),new Set()).length,0);
console.log('Explorer: 296 native names and images, 72 talisman levels, 32 enchantments, 56 build round trips, slot/rarity/pool validation, stacked effects, attack metrics and power curves passed.');
