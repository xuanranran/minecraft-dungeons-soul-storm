import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const data=JSON.parse(fs.readFileSync(new URL('./public/maps.json',import.meta.url),'utf8'));
assert.deepEqual(data.dimensions.map(d=>d.id),['overworld','sift','camp']);
assert.deepEqual(data.dimensions.map(d=>d.markers.length),[1112,500,5]);
assert.deepEqual(data.rotation.map(r=>r.count),[7,8,8,8,8,8,5]);
const generators=new Set();
for(const dim of data.dimensions){
 const ids=new Set();
 for(const m of dim.markers){assert(!ids.has(m.id),`Duplicate ${dim.id} marker ${m.id}`);ids.add(m.id);assert(Number.isFinite(m.x)&&m.x>=0&&m.x<=dim.size);assert(Number.isFinite(m.y)&&m.y>=0&&m.y<=dim.size);assert(dim.categories.some(c=>c.id===m.cat));assert(m.name&&!m.name.includes('胸甲'));assert(fs.existsSync(new URL('./public/'+m.icon.replace('./',''),import.meta.url)));}
 for(const c of dim.categories)assert.equal(c.count,dim.markers.filter(m=>m.cat===c.id).length);
 const capture=JSON.parse(fs.readFileSync(new URL(`./sources/dungeons-tools/${dim.id}.json`,import.meta.url),'utf8'));
 for(const original of capture.markers){const point=dim.markers.find(m=>m.id===original.id);assert.equal(point.x,original.x);assert.equal(point.y,original.y);}
 for(const label of dim.labels)assert(label.english!==label.name,'Area name must use the native Chinese translation');
 for(let z=2;z<=dim.zmax;z++){const count=Math.ceil(dim.size/2**(dim.zmax-z)/1024);for(let x=0;x<count;x++)for(let y=0;y<count;y++)assert(fs.existsSync(new URL(`./public/images/map/${dim.id}/${z}/${x}/${y}.webp`,import.meta.url)));}
}
for(const region of data.rotation){const dim=data.dimensions.find(d=>d.id===region.dimension);assert.equal(region.generators.length,region.count);for(const id of region.generators){const marker=dim.markers.find(m=>m.id===id);assert(marker?.generator&&marker.area===region.name);assert(!generators.has(id));generators.add(id);}}
assert.equal(generators.size,52);
for(const entry of JSON.parse(fs.readFileSync(new URL('./native-map-images.json',import.meta.url),'utf8'))){if(!entry.file)continue;const bytes=fs.readFileSync(new URL('./public/'+entry.file,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
const html=fs.readFileSync(new URL('./src/index.html',import.meta.url),'utf8');for(const id of ['page-tabs','map-panel','storm-panel','world-map','storm-rotation-list','map-search','map-categories'])assert(html.includes(`id="${id}"`));
console.log('Map: 3 complete native maps, 1617 source coordinates, 14 categories, 52 regional generators and asset hashes passed.');
