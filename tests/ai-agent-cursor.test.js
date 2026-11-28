import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgentCursor} from '../src/components/ai/agentCursorController.js';
function fixture(reduced=false){
 let clock=0,seq=0,bounds={width:400,height:300};const frames=new Map();
 const controller=createAgentCursor({getBounds:()=>bounds,now:()=>clock,reducedMotion:()=>reduced,requestFrame:cb=>{frames.set(++seq,cb);return seq;},cancelFrame:id=>frames.delete(id)});
 return {controller,frames,resize:b=>{bounds=b;},step:ms=>{clock+=ms;const batch=[...frames.entries()];frames.clear();for(const [,cb] of batch)cb(clock);}};
}
test('agent cursor interpolates local positions and pulses only on explicit action event',async()=>{
 const {controller:c,step}=fixture();let notifications=0;const unsub=c.subscribe(()=>notifications++);
 assert.equal(c.getSnapshot().visible,false);
 const token=c.start({x:10,y:20});assert.ok(token);
 const moving=c.move(token,{x:110,y:120},{durationMs:400});
 step(200);assert.deepEqual(c.getSnapshot(),{visible:true,x:60,y:70,ripple:0});
 assert.equal(c.pulse(token),false);
 step(200);assert.equal(await moving,true);assert.equal(c.getSnapshot().x,110);
 assert.equal(c.pulse(token),true);assert.equal(c.getSnapshot().ripple,1);
 assert.equal(c.finish(token),true);assert.equal(c.getSnapshot().visible,false);
 assert.ok(notifications>=5);unsub();
});
test('stop, replacement, disposal and surface resize cancel in-flight motion',async()=>{
 const f=fixture(),c=f.controller;
 let token=c.start({x:10,y:20}),moving=c.move(token,{x:110,y:120});
 assert.equal(c.stop(token),true);assert.equal(await moving,false);assert.equal(f.frames.size,0);
 assert.equal(c.getSnapshot().visible,false);
 token=c.start({x:10,y:20});moving=c.move(token,{x:110,y:120});
 const next=c.start({x:20,y:20});assert.equal(await moving,false);assert.equal(c.stop(token),false);
 moving=c.move(next,{x:110,y:120});f.resize({width:50,height:50});f.step(20);
 assert.equal(await moving,false);assert.equal(c.getSnapshot().visible,false);
 const last=c.start({x:5,y:5});moving=c.move(last,{x:10,y:10});
 c.dispose();assert.equal(await moving,false);assert.equal(c.start({x:5,y:5}),null);
});
test('invalid local bounds, stale tokens and reduced motion fail safely',async()=>{
 const {controller:c,frames}=fixture(true);
 assert.equal(c.start({x:-1,y:20}),null);assert.equal(c.start({x:10,y:Infinity}),null);
 const token=c.start({x:10,y:20});assert.equal(await c.move({}, {x:50,y:60}),false);
 assert.equal(await c.move(token,{x:401,y:50}),false);
 assert.equal(await c.move(token,{x:50,y:60}),true);
 assert.equal(frames.size,0);assert.equal(c.getSnapshot().x,50);
 assert.equal(c.pulse(token),true);assert.equal(c.getSnapshot().ripple,0);
});
