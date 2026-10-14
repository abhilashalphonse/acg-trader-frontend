// V4 trading-activity range policy: never display records older than one
// rolling calendar month. 7D/30D and 1M are genuinely different windows.
export const V4_ACTIVITY_RANGES=Object.freeze(['7D','30D','1M']);
export function activityStart(range,now=new Date()) {
  const end=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(end.getTime()))return null;
  const start=new Date(end.getTime());
  if(range==='7D')start.setUTCDate(start.getUTCDate()-7);
  else if(range==='30D')start.setUTCDate(start.getUTCDate()-30);
  else {
    // Calendar month back (clamped to last day), not a 31-day approximation.
    const day=end.getUTCDate();
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth()-1);
    const last=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
    start.setUTCDate(Math.min(day,last));
  }
  return start;
}
export function activityTimestamp(record,kind) {
  if(!record||typeof record!=='object')return null;
  const raw=record.raw||{};
  const candidates=kind==='history'
    ? [raw.closedAt,raw.executedAt,raw.updatedAt,record.executedAt,
      record.closedAtIso,record.closedAt]
    : [record.timestamp,record.createdAt,record.executedAt];
  for(const candidate of candidates){
    if(typeof candidate!=='string' || !candidate.trim())continue;
    // Avoid interpreting time-only strings as a new, unverified date.
    if(!/^\d{4}-\d{2}-\d{2}/.test(candidate))continue;
    const time=Date.parse(candidate);
    if(Number.isFinite(time))return time;
  }
  return null;
}
export function filterActivity(records,range,kind,now=new Date()) {
  const end=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(end.getTime()))return [];
  const start=activityStart(range,end);
  return (Array.isArray(records)?records:[])
    .filter(record=>{
      const time=activityTimestamp(record,kind);
      return time!=null&&time>=start.getTime()&&time<=end.getTime();
    })
    .sort((a,b)=>activityTimestamp(b,kind)-activityTimestamp(a,kind));
}
