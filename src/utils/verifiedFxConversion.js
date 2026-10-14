/**
 * V4 FX PREVIEW: bid/ask conversion from fresh, subscribed backend quotes only.
 * Used solely for client estimates. Server remains authoritative for execution.
 * Freshness contract mirrors backend CurrencyConversionEngine (10 seconds).
 */
const code = v => String(v || '').trim().toUpperCase();
const amountOf = v => v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);
export const V4_FX_QUOTE_MAX_AGE_MS = 10000;

function liveQuote(markets, symbol, nowMs) {
  const q = (Array.isArray(markets) ? markets : []).find(item => code(item?.symbol).replaceAll('/','')===symbol);
  if(!q||q.live!==true||q.subscribed!==true||q.isStale===true||q.sessionOpen===false)return null;
  const received=amountOf(q.receivedAtMs),bid=amountOf(q.bid),ask=amountOf(q.ask);
  if(!received||nowMs<received-1000||nowMs-received>V4_FX_QUOTE_MAX_AGE_MS||!bid||!ask||bid<=0||ask<bid)return null;
  return {bid,ask};
}
function leg(value,from,to,markets,nowMs) {
  const direct=liveQuote(markets,from+to,nowMs);
  if(direct)return value*(value>=0?direct.bid:direct.ask);
  const inverse=liveQuote(markets,to+from,nowMs);
  if(inverse)return value/(value>=0?inverse.ask:inverse.bid);
  return null;
}
export function convertFreshFx(amount,fromCurrency,toCurrency,markets,nowMs=Date.now()) {
  const value=amountOf(amount),from=code(fromCurrency),to=code(toCurrency);
  if(value===null||!/^[A-Z]{3}$/.test(from)||!/^[A-Z]{3}$/.test(to))return null;
  if(value===0||from===to)return value;
  const direct=leg(value,from,to,markets,nowMs);
  if(direct!==null)return Number.isFinite(direct)?direct:null;
  if(from!=='USD'&&to!=='USD') {
    const usd=leg(value,from,'USD',markets,nowMs);
    const cross=usd===null?null:leg(usd,'USD',to,markets,nowMs);
    return cross!==null&&Number.isFinite(cross)?cross:null;
  }
  return null;
}
export function conversionQuoteSymbolsForInstrument(instrument,instruments,accountCurrency='USD') {
  const target=code(accountCurrency);
  const known=new Set((instruments||[]).map(item=>code(item?.symbol).replaceAll('/','')));
  const required=new Set();
  const legSymbol=(from,to)=>{
    if(from===to)return true;
    for(const candidate of [from+to,to+from]){
      if(known.has(candidate)){required.add(candidate);return true;}
    }
    return false;
  };
  for(const original of [instrument?.marginCurrency||instrument?.quoteCurrency,instrument?.quoteCurrency,instrument?.pnlCurrency||instrument?.quoteCurrency]){
    const from=code(original);
    if(!/^[A-Z]{3}$/.test(from)||!target||from===target)continue;
    if(legSymbol(from,target))continue;
    if(from!=='USD'&&target!=='USD'){legSymbol(from,'USD');legSymbol('USD',target);}
  }
  return [...required];
}
