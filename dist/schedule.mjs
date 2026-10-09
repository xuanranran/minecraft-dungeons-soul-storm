export function createRotation(settings) {
 if (!Array.isArray(settings.places) || settings.places.length !== 7 || settings.intervalMinutes !== 40 || settings.durationMinutes !== 20 || !Number.isFinite(Date.parse(settings.anchor))) throw new Error('轮换配置无效');
 return {places:settings.places,step:settings.intervalMinutes*60000,duration:settings.durationMinutes*60000,defaultAnchor:Date.parse(settings.anchor),
 index(n,offset){return ((n+offset)%7+7)%7},
 current(anchor,offset,now){const n=Math.floor((now-anchor)/this.step),start=anchor+n*this.step,end=start+this.duration,active=now<end;return {n,index:this.index(n,offset),start,end,active,target:active?end:start+this.step}},
 region(anchor,offset,now,index){const c=this.current(anchor,offset,now);let delta=(index-c.index+7)%7;if(delta===0&&!c.active)delta=7;const start=c.start+delta*this.step,end=start+this.duration,active=now>=start&&now<end;return {index,start,end,active,target:active?end:start}},
 windows(anchor,offset,now,hours,index){const c=this.current(anchor,offset,now),result=[],limit=now+hours*3600000;for(let start=c.start,n=c.n;start<limit;start+=this.step,n++){const end=start+this.duration,i=this.index(n,offset);if(end<=now||(index>=0&&index!==i))continue;result.push({index:i,start,end,active:start<=now&&now<end})}return result},
 countdown(target,now){let s=Math.max(0,Math.ceil((target-now)/1000));const pad=n=>String(n).padStart(2,'0');return (s>=3600?pad(Math.floor(s/3600))+':':'')+pad(Math.floor(s/60)%60)+':'+pad(s%60)}

 };
}
