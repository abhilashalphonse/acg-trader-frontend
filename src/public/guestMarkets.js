// Public guest workspace uses deterministic synthetic candles ONLY.
// Never imply these are market data, historical records or indicative quotes.
export const GUEST_MARKETS = Object.freeze([
  Object.freeze({symbol:'EURUSD',displaySymbol:'EUR/USD',name:'Euro / US Dollar',assetClass:'FOREX',digits:5,tickSize:0.00001,pipSize:0.0001,base:1.085,step:0.00019}),
  Object.freeze({symbol:'XAUUSD',displaySymbol:'XAUUSD',name:'Gold / US Dollar',assetClass:'METAL',digits:2,tickSize:0.01,pipSize:0.1,base:2514,step:1.2}),
  Object.freeze({symbol:'BTCUSD',displaySymbol:'BTC/USD',name:'Bitcoin / US Dollar',assetClass:'CRYPTO',digits:2,tickSize:0.01,pipSize:0.01,base:64120,step:68}),
]);
export const GUEST_TIMEFRAMES = Object.freeze([
  {key:'M1',label:'1m',seconds:60},{key:'M5',label:'5m',seconds:300},
  {key:'M15',label:'15m',seconds:900},{key:'M30',label:'30m',seconds:1800},
  {key:'H1',label:'1h',seconds:3600},{key:'H4',label:'4h',seconds:14400},
  {key:'D1',label:'1D',seconds:86400},
]);
// A fixed anchor also preserves saved guest drawing time coordinates on reload.
// These are illustrative, NOT actual prices or real historical bars.
const ANCHOR_TIME = Date.UTC(2026,10,20,12,0,0) / 1000;
export function makeGuestCandles(symbol='EURUSD',timeframe='M30',count=220) {
  const instrument=GUEST_MARKETS.find(item=>item.symbol===symbol) || GUEST_MARKETS[0];
  const period=GUEST_TIMEFRAMES.find(item=>item.key===timeframe)?.seconds || 1800;
  const end=Math.floor(ANCHOR_TIME/period)*period;
  return Array.from({length:Math.min(350,Math.max(60,count))},(_,i)=>{
    const seed=i+3;
    const mid=instrument.base+instrument.step*(Math.sin(seed*0.17)*9+
      Math.sin(seed*0.063)*13+seed*.08+Math.cos(seed*.51)*2);
    const previous=instrument.base+instrument.step*(Math.sin((seed-1)*.17)*9+
      Math.sin((seed-1)*.063)*13+(seed-1)*.08+Math.cos((seed-1)*.51)*2);
    const open=previous;
    const close=mid;
    const buffer=instrument.step*(0.5+Math.abs(Math.sin(seed*.77))*1.5);
    return {time:end-(Math.min(350,Math.max(60,count))-1-i)*period,
      open,high:Math.max(open,close)+buffer,low:Math.min(open,close)-buffer,
      close,volume:100+Math.floor(Math.abs(Math.sin(seed*.29))*100)};
  });
}
export function shouldUseGuestMarketWorkspace(pathname='/',search='') {
  if(pathname!=='/terminal')return false;
  const params=new URLSearchParams(search);
  for(const key of ['ticket','acg_ticket','acg_login','acg_connect_prop','acg_terminal',
    'acg_auth','acg_v4_audit','acg_mobile_audit','acg_onboarding_audit']) {
    if(params.has(key))return false;
  }
  return true;
}
