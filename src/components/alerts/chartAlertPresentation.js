const names={crosses:'Crossing',crosses_above:'Crossing above',crosses_below:'Crossing below',enters_range:'Enters range',exits_range:'Exits range',candle_close_above:'Candle close above',candle_close_below:'Candle close below'};

export function chartAlertEntries(rules,symbol){
  return rules.filter(rule=>rule.symbol===symbol&&['STARTING','MONITORING'].includes(rule.status))
    .flatMap(rule=>(rule.condition?.lower!=null?['lower','upper']:['level'])
      .filter(field=>Number(rule.condition?.[field])>0)
      .map(field=>({key:rule.id+':'+field,rule,field,price:Number(rule.condition[field])})));
}
export function chartAlertPrice(value,instrument={}){
  const numeric=Number(value),tick=Number(instrument?.tickSize);
  if(!Number.isFinite(numeric)||numeric<=0)return null;
  const [coefficient,exponent]=String(tick||0).toLowerCase().split('e');
  const precision=Math.max(0,(coefficient.split('.')[1]?.length||0)-Number(exponent||0));
  const digits=Math.min(10,Math.max(0,Number(instrument?.digits)||0,precision));
  const rounded=Number.isFinite(tick)&&tick>0?Math.round(numeric/tick)*tick:numeric;
  return rounded>0?rounded.toFixed(digits):null;
}
export function movedAlertCondition(rule,field,value,instrument){
  const text=chartAlertPrice(value,instrument);
  if(!text||!['level','lower','upper'].includes(field)||!Object.hasOwn(rule.condition||{},field))return null;
  const condition={...rule.condition,[field]:text};
  if(condition.lower!=null&&Number(condition.lower)>=Number(condition.upper))return null;
  return condition;
}
export function chartAlertLabel(entry,price=entry.price){
  const rule=entry.rule,c=rule.condition;
  const prefix=rule.name||rule.symbol;
  const timeframe=c.type.startsWith('candle_')&&rule.timeframe?' '+rule.timeframe:'';
  const edge=entry.field==='level'?'':' · '+entry.field;
  return `${prefix}${timeframe} · ${names[c.type]||'Alert'}${edge} · ${price}`;
}
export function alertDefinition(rule,condition=rule.condition){
  return {symbol:rule.symbol,name:rule.name||'',note:rule.note||'',condition,
    priceSource:rule.priceSource||'last',timeframe:rule.timeframe||null,
    frequency:rule.frequency||'once',cooldownMs:rule.cooldownMs??60000,
    expiresAt:rule.expiresAt||null,pushEnabled:rule.pushEnabled===true,soundEnabled:rule.soundEnabled!==false};
}
