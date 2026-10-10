import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dist=new URL('./public/',import.meta.url);
const json=path=>JSON.parse(fs.readFileSync(new URL(path,dist),'utf8'));
const maps=json('maps.json'),index=json('data/maps/index.json');
assert.deepEqual(index.rotation,maps.rotation);
for(const world of maps.dimensions){
 const entry=index.dimensions.find(d=>d.id===world.id);
 assert.equal(entry.count,world.markers.length);
 assert.deepEqual(json(entry.data.replace('./','').split('?')[0]),world.markers);
 assert.deepEqual(entry.categories,world.categories);
}
const original=json('equipment.json'),catalogue=json('data/equipment/index.json');
assert.equal(catalogue.items.length,272);
for(const item of original.items){
 const summary=catalogue.items.find(entry=>entry.id===item.id);
 assert(summary);
 const {parameters,fixed_effects,tables,...expected}=item;
 const {detail,...actual}=summary;
 assert.deepEqual(actual,expected);
 assert.deepEqual(json(detail.replace('./','').split('?')[0]),item);
}
for(const file of ['resources.mjs','map-data.mjs','equipment-data.mjs','equipment-details.mjs','storm.mjs','ui.mjs'])execFileSync(process.execPath,['--check',fileURLToPath(new URL(file,new URL('./src/',import.meta.url)))]);
const bytes=fs.statSync(new URL('data/equipment/index.json',dist)).size,full=fs.statSync(new URL('equipment.json',dist)).size;
assert(bytes<full*.15,'Equipment summary must remain substantially smaller than full details');
console.log(`Split data: 3 worlds and 272 complete item records retained; equipment summary ${(bytes/1024).toFixed(0)} KiB vs ${(full/1024).toFixed(0)} KiB full data; lazy modules syntax passed.`);
