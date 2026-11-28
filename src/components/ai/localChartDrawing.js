// Visual annotation only. The source is the active chart's pinned displayed
// OHLC data, not quotes, wall-clock freshness, server history or model text.
// Gaps/malformed candles invalidate only the affected local pattern.
const orders=Object.freeze({LIQUIDITY:['hline'],FVG:['rectangle'],LIQUIDITY_THEN_FVG:['hline','rectangle'],FVG_THEN_LIQUIDITY:['rectangle','hline']});
const price=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=1e12;
const time=n=>Number.isSafeInteger(n)&&n>=946684800&&n<=4102444800;
const valid=b=>b&&b.complete!==false&&b.synthetic!==true&&time(b.time)&&[b.open,b.high,b.low,b.close].every(price)&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close);
const consecutive=(a,b,step)=>valid(a)&&valid(b)&&b.time-a.time===step;
export function chartDrawingCandidates({candles,step,command,isVisible=()=>true}={}){
 if(!Array.isArray(candles)||candles.length>512||!Number.isSafeInteger(step)||step<=0||!Object.hasOwn(orders,command))return null;
 const last=candles.findLast(valid);if(!last)return [];
 const levels=[],gaps=[];
 for(let i=1;i<candles.length-1;i++){
  const [a,b,c]=candles.slice(i-1,i+2);
  if(!consecutive(a,b,step)||!consecutive(b,c,step))continue;
  const later=candles.slice(i+1).filter(valid);
  if(b.high>a.high&&b.high>c.high&&!later.some(x=>x.high>=b.high))levels.push({type:'hline',time:b.time,price:b.high});
  if(b.low<a.low&&b.low<c.low&&!later.some(x=>x.low<=b.low))levels.push({type:'hline',time:b.time,price:b.low});
  // A three-candle imbalance starts at the third observed candle. Do not
  // infer an imbalance across a missing interval. Historical gaps elsewhere
  // never prevent annotations on intact portions of the chart.
  if(c.time>=last.time)continue;
  const after=candles.slice(i+2).filter(valid);
  if(a.high<c.low&&!after.some(x=>x.low<=a.high))gaps.push({type:'rectangle',fromTime:c.time,toTime:last.time,lower:a.high,upper:c.low});
  if(a.low>c.high&&!after.some(x=>x.high>=a.low))gaps.push({type:'rectangle',fromTime:c.time,toTime:last.time,lower:c.high,upper:a.low});
 }
 const order=orders[command],limit=order.length===1?6:3;
 const byType={hline:levels,rectangle:gaps};
 return order.flatMap(type=>byType[type].reverse().filter(isVisible).slice(0,limit));
}
export async function buildLocalDrawingReceipt({snapshot,request,command,isVisible,now=Date.now,signal}={}){
 if(signal?.aborted||!snapshot||!request||request.userRequested!==true||request.complete!==true||snapshot.latestClosedAtMs!==request.latestClosedAtMs)return null;
 const geometries=chartDrawingCandidates({candles:snapshot.candles,step:snapshot.step,command,isVisible});
 if(!geometries)return null;
 if(!geometries.length)return {state:'EMPTY'};
 const {symbol,timeframe}=request.workspace,actions=[];
 for(const geometry of geometries){
  // Extension of an existing zone does not create a duplicate source ID.
  const identity=geometry.type==='hline'?[geometry.type,geometry.time,geometry.price]:[geometry.type,geometry.fromTime,geometry.lower,geometry.upper];
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(['active-chart-v1',symbol,timeframe,identity])));
  const sourceId='draw_'+Array.from(new Uint8Array(hash).slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
  if(signal?.aborted)return null;
  actions.push({sourceId,drawingKey:sourceId,sourceTimeframe:timeframe,geometry});
 }
 return {state:'READY',receipt:{contractVersion:'chart-drawing-candidates-v1',actionId:request.actionId,context:{symbol,timeframe,chartContextVersion:request.chartContextVersion,latestClosedAtMs:request.latestClosedAtMs,expiresAtMs:now()+10000},actions}};
}
