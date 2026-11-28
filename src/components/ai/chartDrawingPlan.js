// Phase 8A: local chart-only proposal boundary. No provider response is an
// executable command. Only a trusted UI adapter may prepare a verified
// proposal, then apply it after a separate explicit user confirmation.
import {getDrawingSnapshot,commitDrawings} from '../../utils/drawingStore.js';
import {canonicalDrawingTimeframe} from '../../utils/drawingTools.js';

const plans=new WeakSet(),used=new WeakSet();
const frames=new Set(['M1','M5','M15','M30','H1','H4','D1','W1']);
const isObject=x=>x!==null&&typeof x==='object'&&Object.getPrototypeOf(x)===Object.prototype;
const keys=(x,expected)=>isObject(x)&&Object.keys(x).sort().join(',')===expected;
const scope=s=>{
  if(!keys(s,'chartInstanceId,symbol,timeframe')||typeof s.symbol!=='string'||!/^[A-Z0-9._-]{1,32}$/.test(s.symbol)||
    typeof s.chartInstanceId!=='string'||!s.chartInstanceId||s.chartInstanceId.length>128)return null;
  const timeframe=canonicalDrawingTimeframe(s.timeframe);
  return frames.has(timeframe)?{symbol:s.symbol,timeframe,chartInstanceId:s.chartInstanceId}:null;
};
const same=(a,b)=>a&&b&&a.symbol===b.symbol&&a.timeframe===b.timeframe&&a.chartInstanceId===b.chartInstanceId;
const price=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e12;
const time=n=>Number.isSafeInteger(n)&&n>=946684800&&n<=4102444800; // UTC chart seconds, not milliseconds
function normalizeAction(a){
  if(a?.type==='hline'&&keys(a,'price,time,type')&&price(a.price)&&time(a.time))
    return Object.freeze({type:a.type,a:Object.freeze({time:a.time,price:a.price}),b:Object.freeze({time:a.time,price:a.price})});
  if(a?.type==='rectangle'&&keys(a,'fromTime,lower,toTime,type,upper')&&time(a.fromTime)&&time(a.toTime)&&
    a.toTime>a.fromTime&&price(a.lower)&&price(a.upper)&&a.upper>a.lower)
    return Object.freeze({type:a.type,a:Object.freeze({time:a.fromTime,price:a.upper}),b:Object.freeze({time:a.toTime,price:a.lower})});
  return null;
}
// Candidate values must already be verified against trusted chart evidence or
// exact explicit user input by the future adapter. This module validates
// geometry, scope and atomicity, not the truth of market levels.
export function prepareChartDrawingPlan({workspace,actions,now=Date.now()}={}){
  const chart=scope(workspace);
  if(!chart||!Number.isSafeInteger(now)||now<=0||!Array.isArray(actions)||actions.length<1||actions.length>8)return null;
  const normalized=actions.map(normalizeAction);
  if(normalized.some(a=>!a))return null;
  const plan=Object.freeze({workspace:Object.freeze(chart),drawingRevision:getDrawingSnapshot(chart.symbol).revision,
    expiresAtMs:now+120000,actions:Object.freeze(normalized)});
  plans.add(plan);return plan;
}
// Inject no trading runtime, orders, position APIs or network. An AI reply
// cannot access this capability; only the future confirmation UI may call it.
export function applyChartDrawingPlan(plan,{workspace,confirmed,now=Date.now()}={}){
  if(!plans.has(plan)||used.has(plan)||confirmed!==true||!same(scope(workspace),plan.workspace)||
     !Number.isSafeInteger(now)||now>=plan.expiresAtMs||now<plan.expiresAtMs-120000)return false;
  const {symbol,timeframe}=plan.workspace,current=getDrawingSnapshot(symbol);
  if(current.revision!==plan.drawingRevision)return false;
  const id=globalThis.crypto?.randomUUID?.();
  if(typeof id!=='string'||!id)return false;
  const created=plan.actions.map((item,i)=>({id:'ai-'+id+'-'+i,type:item.type,a:{...item.a},b:{...item.b},
    text:'',locked:false,hidden:false,timeframeVisibility:timeframe}));
  if(created.some(item=>current.present.some(existing=>existing.id===item.id)))return false;
  used.add(plan);
  commitDrawings(symbol,existing=>[...existing,...created]);
  return true;
}
