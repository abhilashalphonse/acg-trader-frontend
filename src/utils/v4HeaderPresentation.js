// Owner-audit-only V4 desktop header presentation. No execution or market-data decisions.
export function v4HeaderMarketStatus(market) {
  const state=String(market?.marketState||'').toUpperCase();
  if(market?.sessionOpen===false || state==='CLOSED')return 'closed';
  if(!market || market.isStale===true || market.marketDataAvailable===false ||
     ['ERROR','DISCONNECTED','WAITING','DISABLED','SUBSCRIPTION_ERROR'].includes(state))return 'unavailable';
  return market.sessionOpen===true || ['LIVE','OPEN'].includes(state)?'open':'unavailable';
}
const GLYPHS={USD:'$',EUR:'€',GBP:'£',JPY:'¥',CHF:'₣',AUD:'A$',CAD:'C$',NZD:'NZ$'};
export function v4HeaderFxMonogram(market){
  if(!['FOREX','FX'].includes(String(market?.assetClass||market?.category||'').toUpperCase()))return null;
  const symbol=String(market?.symbol||'').replaceAll('/','').toUpperCase();
  if(!/^[A-Z]{6}$/.test(symbol))return null;
  const base=GLYPHS[symbol.slice(0,3)],quote=GLYPHS[symbol.slice(3)];
  return base&&quote?base+quote:null;
}
export function v4HeaderAccountLabel(account){
  const raw=String(account?.accountCode||'').trim();
  return raw?'ACG · '+raw.slice(-6):'Trading account';
}

/** Presentation-only account kind: backend and legacy account rules stay unchanged. */
export function v4HeaderAccountType(account) {
  const raw=String(account?.accountType||account?.mode||account?.type||'').trim().toUpperCase();
  if(raw==='TRIAL'||raw==='DEMO')return 'Trial';
  if(raw==='CHALLENGE')return 'Challenge';
  if(raw==='MASTER'||raw==='FUNDED')return 'Master';
  return 'Account';
}
