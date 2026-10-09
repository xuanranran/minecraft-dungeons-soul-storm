export function alarmOccurrence(R, anchor, offset, region, minutes, now) {
  let event=R.region(anchor,offset,now,region);
  // An alarm at opening may arrive slightly late when a background tab wakes.
  if(event.active && (minutes>0 || now-event.start>90000))
    event=R.region(anchor,offset,event.end,region);
  return {...event,trigger:event.start-minutes*60000};
}

export function setupAlarm({R,clock,getConfig,format}) {
  const $=id=>document.getElementById(id),key='map-rotation-alarm-v1';
  let alarm={enabled:false,region:0,minutes:5,sound:true},audio=null,bellBuffer=null,bellLoading=null,pending=null,activeSound=null,deadlineTimer=null,deadlineAt=null;
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&typeof saved.enabled==='boolean'&&Number.isInteger(saved.region)&&saved.region>=0&&saved.region<7&&Number.isInteger(saved.minutes)&&saved.minutes>=0&&saved.minutes<=120&&typeof saved.sound==='boolean')alarm=saved;}catch{}
  R.places.forEach((name,i)=>{const o=document.createElement('option');o.value=i;o.textContent=name;$('alarm-region').append(o);});
  $('alarm-region').value=alarm.region;$('alarm-minutes').value=alarm.minutes;$('alarm-sound').checked=alarm.sound;
  function save(){try{localStorage.setItem(key,JSON.stringify(alarm));return true;}catch{return false;}}
  async function loadBell(){
    if(bellBuffer)return;
    if(!bellLoading)bellLoading=(async()=>{const response=await fetch('./audio/radar.m4a?v=m4r1');if(!response.ok)throw Error('铃声加载失败');bellBuffer=await audio.decodeAudioData(await response.arrayBuffer());})().catch(error=>{bellLoading=null;throw error;});
    await bellLoading;
  }
  async function unlock(){try{const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('浏览器不支持声音播放');if(!audio){audio=new Audio();audio.addEventListener?.('statechange',()=>{if(audio.state==='running')tick();});}await audio.resume();await loadBell();if(!$('alarm-alert').hidden&&alarm.sound&&!activeSound)activeSound=soundAt(audio.currentTime);tick();return true;}catch{$('alarm-message').textContent='声音未准备好，请检查网络后再次点击测试闹钟。';return false;}}
  function cancelPending(){if(pending){try{pending.source.stop();}catch{}pending=null;}}
  function stopSound(){if(activeSound){try{activeSound.stop();}catch{}activeSound=null;}}
  function stop(){cancelPending();stopSound();$('alarm-alert').hidden=true;}
  function soundAt(when){
    if(!audio||audio.state!=='running'||!bellBuffer)return null;
    const source=audio.createBufferSource();source.buffer=bellBuffer;source.loop=true;source.connect(audio.destination);source.start(when);return source;
  }
  function ring(message,scheduledSource=null){
    if(activeSound){if(scheduledSource&&scheduledSource!==activeSound){try{scheduledSource.stop();}catch{}}cancelPending();$('alarm-alert-text').textContent=message;$('alarm-alert').hidden=false;return;}
    if(pending?.source===scheduledSource)pending=null;else cancelPending();
    $('alarm-alert-text').textContent=message;$('alarm-alert').hidden=false;
    activeSound=scheduledSource||(alarm.sound?soundAt(audio?.currentTime||0):null);
  }
  function arm(event,id,now){
    if(deadlineAt!==event.trigger){clearTimeout(deadlineTimer);deadlineAt=event.trigger;deadlineTimer=setTimeout(()=>{deadlineAt=null;tick();},Math.max(10,event.trigger-now));}
    if(activeSound||!alarm.sound||!audio||audio.state!=='running'||!bellBuffer){cancelPending();return;}
    const when=audio.currentTime+Math.max(0,(event.trigger-now)/1000);
    // Schedule the sound in the audio engine, independent of throttled JS timers.
    if(pending?.id===id&&Math.abs(pending.when-when)<.25)return;
    cancelPending();pending={id,event,when,source:soundAt(when)};
  }
  $('alarm-stop').addEventListener('click',stop);
  $('alarm-test').addEventListener('click',async()=>{if(!await unlock())return;ring('闹钟测试：声音和网页提示已触发。');});
  $('alarm-form').addEventListener('submit',async e=>{e.preventDefault();const region=Number($('alarm-region').value),minutes=Number($('alarm-minutes').value);if(!Number.isInteger(region)||region<0||region>6||!Number.isInteger(minutes)||minutes<0||minutes>120)return;await unlock();stop();alarm={enabled:true,region,minutes,sound:$('alarm-sound').checked};$('alarm-message').textContent=save()?'已保存到当前浏览器。':'已启用，但当前浏览器无法保存配置。';tick();});
  $('alarm-disable').addEventListener('click',()=>{alarm.enabled=false;stop();save();tick();});
  // Returning to a saved alarm still needs a gesture to unlock browser audio.
  document.addEventListener('pointerdown',()=>{if(alarm.enabled&&alarm.sound)unlock();},{once:true});
  function tick(){
    $('alarm-disable').disabled=!alarm.enabled;
    if(!alarm.enabled){clearTimeout(deadlineTimer);deadlineAt=null;cancelPending();$('alarm-status').textContent='未启用';return;}
    // Adopt audio that started while JS was asleep, even after its reminder window.
    if(pending&&audio?.state==='running'&&audio.currentTime>=pending.when){
      const started=pending;tick.last=started.id;try{localStorage.setItem(key+'-last',started.id);}catch{}
      ring(R.places[started.event.index]+' · '+format(started.event.start)+' 开启，请手动停止闹钟。',started.source);
    }
    const now=clock.now(),config=getConfig(),event=alarmOccurrence(R,config.anchor,config.offset,alarm.region,alarm.minutes,now);
    const id=[config.anchor,config.offset,alarm.region,alarm.minutes,event.start].join('|');
    let fired;try{fired=localStorage.getItem(key+'-last');}catch{}
    if(now>=event.trigger&&now<event.start+(alarm.minutes===0?90000:0)&&fired!==id){
      // Keep an in-memory marker too when local storage is unavailable.
      if(tick.last!==id){const scheduledSource=pending?.id===id&&audio?.state==='running'&&audio.currentTime>=pending.when?pending.source:null;tick.last=id;try{localStorage.setItem(key+'-last',id);}catch{}ring(R.places[alarm.region]+' · '+format(event.start)+' 开启'+(alarm.minutes===0?'，已到开启时间。':'，还剩 '+R.countdown(event.start,now)+'。'),scheduledSource);}
    }
    let next=event;
    if(fired===id||tick.last===id)next={...event,start:event.start+R.step*7,trigger:event.trigger+R.step*7};
    if(next.trigger>now)arm(next,[config.anchor,config.offset,alarm.region,alarm.minutes,next.start].join('|'),now);
    $('alarm-status').textContent=R.places[alarm.region]+' · '+(alarm.minutes===0?'开启时提醒':'提前 '+alarm.minutes+' 分钟')+' · 下次 '+format(next.trigger);
    $('alarm-audio-hint').hidden=!alarm.sound||(audio?.state==='running'&&!!bellBuffer);
  }
  tick();return {tick};
}
