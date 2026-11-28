// Phase 8B.2: presentation-only cursor. Native actions remain the sole
// source of authority; this controller never clicks, draws, or places orders.
const HIDDEN=Object.freeze({visible:false,x:0,y:0,ripple:0});
const finite=Number.isFinite;
const ease=t=>t*t*(3-2*t);
export function createAgentCursor({getBounds,requestFrame=cb=>requestAnimationFrame(cb),cancelFrame=id=>cancelAnimationFrame(id),now=()=>performance.now(),reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true}={}){
 if(typeof getBounds!=='function')throw new TypeError('Cursor requires local surface bounds');
 let state=HIDDEN,owner=null,pending=null,disposed=false,ripple=0;
 const listeners=new Set();
 const publish=next=>{state=Object.freeze(next);for(const listener of [...listeners])listener();};
 const inside=p=>{const b=getBounds();return p&&finite(p.x)&&finite(p.y)&&b&&finite(b.width)&&finite(b.height)&&b.width>0&&b.height>0&&p.x>=0&&p.y>=0&&p.x<=b.width&&p.y<=b.height;};
 const valid=token=>!disposed&&owner!==null&&token===owner;
 const cancel=()=>{if(pending){const p=pending;pending=null;if(p.frame!==null)cancelFrame(p.frame);p.resolve(false);}};
 const hide=()=>{owner=null;cancel();publish({...state,visible:false,ripple:0});};
 return Object.freeze({
  subscribe(listener){if(disposed)return ()=>{};listeners.add(listener);return ()=>listeners.delete(listener);},
  getSnapshot:()=>state,
  getServerSnapshot:()=>HIDDEN,
  start(point){
   if(disposed||!inside(point))return null;
   cancel();owner=Object.freeze({});publish({visible:true,x:point.x,y:point.y,ripple:0});return owner;
  },
  move(token,point,{durationMs=340}={}){
   if(!valid(token)||!inside(point)||!finite(durationMs)||durationMs<0||durationMs>1200)return Promise.resolve(false);
   cancel();
   const target={x:point.x,y:point.y},from={x:state.x,y:state.y};
   if(reducedMotion()||durationMs===0){publish({visible:true,...target,ripple:0});return Promise.resolve(true);}
   const started=now();
   return new Promise(resolve=>{
    const p={frame:null,resolve};pending=p;
    function tick(){
     if(pending!==p||!valid(token))return;
     if(!inside(target)||!inside(from)){hide();return;}
     const t=Math.max(0,Math.min(1,(now()-started)/durationMs)),f=ease(t);
     publish({visible:true,x:from.x+(target.x-from.x)*f,y:from.y+(target.y-from.y)*f,ripple:0});
     if(pending!==p||!valid(token))return;
     if(t>=1){pending=null;resolve(true);}else p.frame=requestFrame(tick);
    }
    p.frame=requestFrame(tick);
   });
  },
  // Call only to visualize an actual native action event. No synthetic input.
  pulse(token){if(!valid(token)||pending||!inside(state))return false;publish({...state,ripple:reducedMotion()?0:++ripple});return true;},
  finish(token){if(!valid(token))return false;hide();return true;},
  stop(token){if(!valid(token))return false;hide();return true;},
  dispose(){if(disposed)return;disposed=true;hide();listeners.clear();}
 });
}
