'use strict';
(() => {
  const root=document.getElementById('sidebarSystem');if(!root)return;
  const api=window.dragonStrap;let statsBusy=false,sensorsBusy=false,stopped=false;
  function meter(key,value,suffix,status){
    const output=root.querySelector(`[data-system-value="${key}"]`),bar=root.querySelector(`[data-system-bar="${key}"]`);
    const valid=typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=(suffix==='%'?100:150);
    output.textContent=valid?Math.round(value)+suffix:'—';output.title=status||'';
    bar.style.width=valid?Math.max(0,Math.min(100,value/(suffix==='%'?100:150)*100))+'%':'0%';
    const track=bar.parentElement;track.setAttribute('aria-valuetext',valid?output.textContent:(status||'Unavailable'));track.title=status||'';
    if(valid)track.setAttribute('aria-valuenow',String(value));else track.removeAttribute('aria-valuenow');
    track.dataset.available=String(valid);
  }
  async function stats(){if(statsBusy||stopped||document.hidden)return;statsBusy=true;try{const r=await api.getSystemStats();if(!r.ok)throw new Error(r.message);meter('cpu',r.system.cpuPercent,'%','System-wide CPU usage');meter('ram',r.system.memoryPercent,'%','Physical memory in use');}catch{meter('cpu',null,'%','System readings unavailable');meter('ram',null,'%','System readings unavailable');}finally{statsBusy=false;}}
  async function sensors(){if(sensorsBusy||stopped||document.hidden)return;sensorsBusy=true;try{const r=await api.getSystemSensors();if(!r.ok)throw new Error(r.message);meter('cpuTemp',r.sensors.cpu.celsius,'°',r.sensors.cpu.status);meter('gpuTemp',r.sensors.gpu.celsius,'°',r.sensors.gpu.status);}catch{meter('cpuTemp',null,'°','Temperature provider unavailable');meter('gpuTemp',null,'°','Temperature provider unavailable');}finally{sensorsBusy=false;}}
  const statsTimer=setInterval(stats,2000),sensorTimer=setInterval(sensors,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){stats();sensors();}});
  window.addEventListener('beforeunload',()=>{stopped=true;clearInterval(statsTimer);clearInterval(sensorTimer);},{once:true});
  const network=()=>{const node=document.getElementById('sidebarNetwork');if(node){node.textContent=navigator.onLine?'Online':'Offline';node.parentElement.dataset.online=String(navigator.onLine);node.title='Windows network connectivity indicator; this is not an internet latency test.';}};window.addEventListener('online',network);window.addEventListener('offline',network);network();
  stats();sensors();
})();
