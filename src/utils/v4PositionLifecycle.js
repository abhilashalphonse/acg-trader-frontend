// ACG Trader V4 durable position activity projection.
// Browser-local Journal messages are *not* authoritative execution records.
// Do not synthesize order submissions or SL/TP modifications without matching
// persisted order, deal, or audit-event IDs.
const validTime=value=>{
  if(!value)return null;
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toISOString():null;
};
const normId=value=>value==null?'':String(value);
export function positionLifecycleEvents(position,{orders=[],deals=[],fills=[]}={}){
  const posId=normId(position?.id??position?.positionId);
  if(!posId)return [];
  const originOrderId=normId(position?.raw?.sourceOrderId);
  const entries=[];
  const seen=new Set();
  const add=(kind,id,timestamp,label,description)=>{
    const iso=validTime(timestamp);
    if(!id||!iso)return;
    const key=kind+':'+id;
    if(seen.has(key))return;
    seen.add(key);
    entries.push({id:key,recordId:String(id),kind,timestamp:iso,label,description});
  };
  for(const order of Array.isArray(orders)?orders:[]){
    const id=normId(order?.id??order?._id);
    if(!id)continue;
    const matches=normId(order?.positionId)===posId||(originOrderId&&id===originOrderId);
    if(!matches)continue;
    add('order',id,order.createdAt??order.receivedAt,'Order created',
      [order.type,order.side,order.requestedVolume].filter(Boolean).join(' · '));
  }
  for(const deal of [...(Array.isArray(fills)?fills:[]),...(Array.isArray(deals)?deals:[])]){
    const id=normId(deal?.id??deal?._id);
    if(!id||normId(deal.positionId)!==posId)continue;
    const kind=String(deal.type||'').toUpperCase();
    const label=kind==='OPEN'?'Position filled':
      ['CLOSE','CLOSED','PARTIAL_CLOSE'].includes(kind)?'Position reduced':'Execution fill';
    const price=deal?.price!=null?String(deal.price):null;
    const volume=deal?.volume!=null?String(deal.volume):null;
    add('deal',id,deal.executedAt??deal.filledAt,label,
      [volume&&volume+' lots',price&&'@ '+price].filter(Boolean).join(' '));
  }
  return entries.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)||
    a.id.localeCompare(b.id));
}
