export const MOBILE_HISTORY_PERIODS = [['today','Today'],['week','7 days'],['month','30 days'],['3months','3 months'],['6months','6 months'],['year','1 year'],['all','All time'],['custom','Custom dates']];
const ACTIVE = new Set(['PENDING','ACCEPTED','TRIGGERED']);
export const historyTimestamp = item => item?.closedAtIso || item?.executedAt || item?.filledAt || item?.cancelledAt || item?.expiredAt || item?.rejectedAt || item?.updatedAt || item?.createdAt || item?.receivedAt || item?.raw?.closedAt || item?.raw?.executedAt || null;
export function mobileHistoryRows({positions=[],orders=[],kind='position',symbol='',period='6months',start='',end='',now=Date.now()}) {
  const startDate = period==='custom' && start ? Date.parse(`${start}T00:00:00Z`) : null;
  const endDate = period==='custom' && end ? Date.parse(`${end}T23:59:59.999Z`) : null;
  if (startDate!=null && endDate!=null && startDate>endDate) return [];
  const days={week:7,month:30,'3months':90,'6months':180,year:365}[period];
  const cutoff=period==='today' ? Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z') : days ? now-days*86400000 : null;
  return [
    ...positions.map(item=>({kind:'position',key:`position:${item.id}`,item})),
    ...orders.filter(item=>item.status && !ACTIVE.has(String(item.status).toUpperCase())).map(item=>({kind:'order',key:`order:${item.id}`,item})),
  ].map(row=>({...row,time:Date.parse(historyTimestamp(row.item))})).filter(row=>{
    if (row.kind!==kind || (symbol && row.item.symbol!==symbol)) return false;
    if (period==='all') return true;
    if (!Number.isFinite(row.time)) return false;
    return (cutoff==null || row.time>=cutoff) && (startDate==null || row.time>=startDate) && (endDate==null || row.time<=endDate);
  }).sort((a,b)=>(Number.isFinite(b.time)?b.time:0)-(Number.isFinite(a.time)?a.time:0));
}
export function mobilePartialCloseAllowed(position, percentage, instrument) {
  if (percentage===100) return true;
  const volume=Number(position.volume ?? position.lots);
  const step=Number(position.volumeStep || instrument?.volumeStep) || 0.01;
  const min=Number(instrument?.minVolume) || step;
  const closing=Math.floor((volume*percentage/100+step*1e-8)/step)*step;
  return closing>=min-step*1e-8 && closing<volume-step*1e-8 && volume-closing>=min-step*1e-8;
}
