// CI-only real Chromium smoke: synthetic V4 callbacks, no credentials or API.
import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import { mkdirSync, existsSync } from 'node:fs';
import { setTimeout as pause } from 'node:timers/promises';

const url='http://127.0.0.1:4176/v4-browser-smoke.html';
const candidates=['google-chrome','google-chrome-stable','chromium','chromium-browser'];
const chrome=candidates.find(name=>spawnSync('which',[name],{encoding:'utf8'}).status===0);
if(!chrome)throw new Error('V4 browser smoke requires Chrome/Chromium on the CI runner.');

const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port','4176','--strictPort'],{
 stdio:['ignore','pipe','pipe'],
 detached:true, // isolate Vite subprocess tree for guaranteed cleanup
});
let output='';
server.stdout.on('data',buf=>{output+=String(buf);});
server.stderr.on('data',buf=>{output+=String(buf);});

try{
 let ready=false;
 for(let i=0;i<70;i++){
   if(server.exitCode!==null)throw new Error('Vite stopped: '+output);
   try{
     const response=await fetch(url,{signal:AbortSignal.timeout(1500)});
     if(response.ok){ready=true;break;}
   }catch{/* retry */}
   await pause(250);
 }
 if(!ready)throw new Error('V4 fixture not ready: '+output);
 const result=spawnSync(chrome,[
   '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--hide-scrollbars','--no-first-run','--disable-background-networking',
   '--window-size=1280,900','--virtual-time-budget=7000',
   '--dump-dom',url,
 ],{encoding:'utf8',timeout:30000,maxBuffer:15*1024*1024});
 const html=result.stdout||'';
 const marker=html.match(/<output id="v4-smoke-status">([^<]*)<\/output>/)?.[1] || '(none)';
 if(result.status!==0 || !marker.includes('V4_SMOKE_PASS')){
   throw new Error('V4 browser layout/interaction failed: '+marker+
     '; Chrome exit '+result.status+'; errors '+String(result.stderr||'').slice(-1200)+
     '; page '+html.slice(-1300));
 }
 console.log(marker);
 // Capture all three synthetic surfaces (ticket, draft chart, accepted
 // Stop Limit chart). Artifact is review evidence, not a live-account proof.
 mkdirSync('artifacts', { recursive: true });
 const screenshotPath='artifacts/chart-order-qa.png';
 const shot=spawnSync(chrome,[
   '--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
   '--hide-scrollbars','--no-first-run','--disable-background-networking',
   '--window-size=1740,960','--virtual-time-budget=9500',
   '--screenshot='+screenshotPath,url,
 ],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
 if(shot.status!==0 || !existsSync(screenshotPath)) {
   throw new Error('Chromium screenshot evidence unavailable: '+String(shot.stderr||'').slice(-800));
 }
 console.log('CHART_ORDER_VISUAL_ARTIFACT '+screenshotPath);
}finally{
 try{process.kill(-server.pid,'SIGTERM');}catch{server.kill('SIGTERM');}
 server.stdout.destroy();
 server.stderr.destroy();
}
