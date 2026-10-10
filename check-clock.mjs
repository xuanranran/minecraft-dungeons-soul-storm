import assert from 'node:assert/strict';
import {SyncedClock} from './src/clock.mjs';

let tick=0,fail=false,calls=0;
const epoch=Date.parse('2026-10-09T12:00:00+08:00');
const clock=new SyncedClock({
  local:()=>0,
  monotonic:()=>tick,
  fetcher:async()=>{
    if(fail)throw Error('offline');
    const delay=[100,20,60][calls++%3];tick+=delay;
    const utc=new Date(epoch+tick-delay/2+8*3600000).toISOString();
    return {ok:true,json:async()=>({dateTime:utc.slice(0,-1)+'1234'})};
  },
});
await clock.sync();
assert.equal(clock.now(),epoch+tick);
assert.equal(clock.source,'TimeAPI.io');
tick+=1000;assert.equal(clock.now(),epoch+tick);
fail=true;await assert.rejects(clock.sync());
assert.equal(clock.now(),epoch+tick);assert.equal(clock.busy,false);

const fallback=new SyncedClock({local:()=>0,monotonic:()=>0,fetcher:async url=>{
  if(url.includes('timeapi.io'))throw Error('offline');
  return {ok:true,json:async()=>({datetime:'2026-10-09T12:00:00.000000+08:00'})};
}});
await fallback.sync();assert.equal(fallback.now(),epoch);assert.equal(fallback.source,'WorldTimeAPI');
console.log('Public clock timezone, fractional seconds, latency, fallback and failed sync checks passed.');

let lanTick=0,lanCalls=0;
const lan=new SyncedClock({endpoint:'./api/time',local:()=>0,monotonic:()=>lanTick,fetcher:async url=>{
 assert.equal(url,'./api/time');const delay=[100,20,60][lanCalls++%3];lanTick+=delay;
 return {ok:true,json:async()=>({unixMs:epoch+lanTick-delay/2,synchronized:true})};
}});
await lan.sync();assert.equal(lan.source,'NTP');assert.equal(lan.ntp,true);assert.equal(lan.now(),epoch+lanTick);assert.equal(lanCalls,3);
const unsynced=new SyncedClock({endpoint:'./api/time',monotonic:()=>0,fetcher:async()=>({ok:true,json:async()=>({unixMs:epoch,synchronized:false})})});
await unsynced.sync();assert.equal(unsynced.source,'服务端时间');assert.equal(unsynced.ntp,false);
const lanFallback=new SyncedClock({endpoint:'./api/time',monotonic:()=>0,fetcher:async url=>{
 if(url==='./api/time')throw Error('offline');return {ok:true,json:async()=>({dateTime:'2026-10-09T12:00:00'})};
}});await lanFallback.sync();assert.equal(lanFallback.source,'TimeAPI.io');assert.equal(lanFallback.now(),epoch);
console.log('LAN NTP preference, latency, unsynchronized server status and public fallback passed.');
