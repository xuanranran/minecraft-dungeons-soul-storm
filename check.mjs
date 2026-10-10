import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./src/index.html',import.meta.url),'utf8');
const settings=JSON.parse(fs.readFileSync(new URL('./public/rotation.json',import.meta.url),'utf8'));
const {createRotation}=await import('./src/schedule.mjs');
const R=createRotation(settings),a=R.defaultAnchor;
assert.equal(R.current(a,0,Date.parse('2026-10-07T11:20:00+08:00')).index,0);
assert.equal(R.current(a,0,a).active,true);assert.equal(R.countdown(R.current(a,0,a).target,a),'20:00');
assert.equal(R.current(a,0,a+1200000).active,false);assert.equal(R.countdown(R.current(a,0,a+1200000).target,a+1200000),'20:00');
assert.equal(R.current(a,0,a+2400000).index,1);
assert.equal(R.current(a,0,a+7*86400000).index,0);
for(let offset=0;offset<7;offset++)for(let region=0;region<7;region++)for(const m of [-1,0,19.999,20,39.999,40,1439,1440]){const now=a+m*60000,r=R.region(a,offset,now,region);assert.equal(R.current(a,offset,r.start).index,region);assert(r.end>now);assert(r.active?r.target===r.end&&r.start<=now:r.target===r.start&&r.start>now)}
assert.equal(R.windows(a,0,a,24,-1).length,36);assert.equal(R.windows(a,0,a,168,-1).length,252);assert(R.windows(a,0,a,48,3).every(w=>w.index===3));
for(const id of ['region','horizon','countdown','schedule','calibration'])assert(html.includes(`id="${id}"`));
console.log('JavaScript syntax, confirmed dates, phase changes, 392 region cases and range filters passed. WebMCP browser validation unavailable in this environment.');
