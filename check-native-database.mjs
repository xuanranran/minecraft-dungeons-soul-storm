import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const report=read('public/data/database/native-import-report.json');
const catalogue=read('public/data/database/native-definitions.json');
const definitions=new Map(catalogue.definitions.map(d=>[d.tag,d]));
assert.equal(definitions.size,catalogue.definitions.length);
assert.deepEqual(report.byCategory,{enemies:133,locations:30});
assert.equal(report.matched,163);assert.equal(report.nativeImages,35);
assert.equal(report.definitionCount,definitions.size);
for(const asset of report.sources){
 assert.match(asset.sha256,/^[a-f0-9]{64}$/);
 if(asset.file)assert.equal(createHash('sha256').update(fs.readFileSync('public/'+asset.file)).digest('hex'),asset.sha256);
}
let count=0,images=0;
for(const category of ['enemies','locations','bosses']){
 const records=read('public/data/database/'+category+'.json').items;
 for(const record of records){
  assert.ok(!record.native,'keep native definitions out of category payloads');
  const item=read('public/'+record.detail.slice(2).split('?')[0]);
  if(!item.native)continue;
  count++;
  assert.match(record.detail,/native3$/);
  for(const d of item.native.definitions)assert.deepEqual(d,definitions.get(d.tag));
  for(const table of item.tables.filter(t=>t.native)){
   assert.ok(table.note&&table.rows.length);
   for(const row of table.rows)assert.equal(row.length,table.columns.length);
  }
  if(item.image.includes('database-native/')){images++;assert.ok(report.sources.some(s=>'./'+s.file===item.image));}
 }
}
assert.equal(count,174);assert.equal(images,35);
const zombie=read('public/data/database/items/enemies-zombie.json');
const base=zombie.native.definitions.find(d=>d.tag==='SW.Mob.Zombie');
assert.equal(base.attributes.find(a=>a.tag==='SW.Attribute.Health').value,8);
assert.ok(base.parents.includes('SW.Mob.Default.MeleeAttackMob'));
assert.ok(base.abilities.some(a=>a.values.some(v=>v.tag==='SW.KeyValue.Damage'&&v.value===6&&v.operation==='Override')));
const variants=zombie.tables.find(t=>t.title==='原生变种替换规则');
assert.equal(variants.rows.length,6);assert.ok(variants.rows.some(r=>r[1]==='0.2'&&r[2]==='禁用'));
for(const id of ['wolf','iron-golem','llama','prickle','wobble'])assert.match(read('public/data/database/items/enemies-'+id+'.json').image,/database-native\/T_UI_.*_Companion\.png$/);
console.log('Native database: 133 species + 30 regions + 11 boss aliases; exact definitions, overrides, conditional weights and 19 original PNG hashes passed.');
