export class SyncedClock {
  constructor({fetcher=(...args)=>globalThis.fetch(...args),monotonic=()=>performance.now(),local=()=>Date.now(),endpoint=globalThis.document?.documentElement.dataset.timeEndpoint||null}={}) {
    this.fetcher=fetcher;this.monotonic=monotonic;
    this.base=local();this.reference=monotonic();this.synced=false;this.ntp=false;this.busy=false;this.source='本机时间';this.endpoint=endpoint;
  }
  now(){return this.base+this.monotonic()-this.reference;}
  async sample(url,source){
    const start=this.monotonic(),controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6000);
    try{
      const response=await this.fetcher(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('时间服务不可用');
      const data=await response.json(),received=this.monotonic(),rtt=received-start;
      if(source==='LAN'){
        if(!Number.isFinite(data.unixMs)||data.unixMs<946684800000||rtt>3000)throw Error('时间样本无效');
        return {rtt,base:data.unixMs+rtt/2,reference:received,source:data.synchronized===true?'NTP':'服务端时间',ntp:data.synchronized===true};
      }
      // TimeAPI's dateTime has no offset; its requested zone is explicitly UTC+8.
      let value=typeof data.dateTime==='string'?data.dateTime: data.datetime;
      if(typeof value!=='string')throw Error('时间样本无效');
      value=value.replace(/(\.\d{3})\d+/, '$1');
      if(!/(Z|[+-]\d{2}:\d{2})$/i.test(value))value+='+08:00';
      const unixMs=Date.parse(value);
      if(!Number.isFinite(unixMs)||unixMs<946684800000||rtt>6000)throw Error('时间样本无效');
      return {rtt,base:unixMs+rtt/2,reference:received,source};
    }finally{clearTimeout(timer);}
  }
  async sync(){
    if(this.busy)return;this.busy=true;
    let best=null;
    try{
      for(let i=0;i<3;i++){
        try{
          const sample=await this.sample(this.endpoint||'https://timeapi.io/api/time/current/zone?timeZone=Asia%2FShanghai',this.endpoint?'LAN':'TimeAPI.io');
          if(!best||sample.rtt<best.rtt)best=sample;
        }catch{}
      }
      if(!best&&this.endpoint){try{best=await this.sample('https://timeapi.io/api/time/current/zone?timeZone=Asia%2FShanghai','TimeAPI.io');}catch{}}
      if(!best){try{best=await this.sample('https://worldtimeapi.org/api/timezone/Asia/Shanghai','WorldTimeAPI');}catch{}}
      if(!best)throw Error('校时失败');
      this.base=best.base;this.reference=best.reference;this.source=best.source;this.ntp=best.ntp===true;this.synced=true;
      return true;
    }finally{this.busy=false;}
  }
}
