import { marketCategoryId } from './marketClassification.js';
import { commoditySearchTerms, commoditySubgroup, isCommodityInstrument } from './commodityPresentation.js';
import { formatInstrumentPrice, instrumentPipSize } from './instrumentFormatting.js';

const number=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
const change=item=>number(item?.changePercent??item?.percentChange??item?.changePct??item?.dailyChangePercent??item?.dayChangePercent);
const volume=item=>number(item?.volume??item?.dayVolume??item?.sessionVolume);
const category=item=>isCommodityInstrument(item)?'commodities':marketCategoryId(item);
const searchable=item=>[` ${item.symbol||''}`,item.displaySymbol,item.name,item.assetClass,commoditySearchTerms(item)].filter(Boolean).join(' ').toLowerCase();
const compareSymbol=(a,b)=>String(a?.symbol||'').localeCompare(String(b?.symbol||''));

export function selectV4Markets({markets=[],category:selected='all',commodityView='all',search='',view='popular',recent=[],popularSymbols=[]}={}) {
  const q=search.trim().toLowerCase().replaceAll('/','');
  let rows=markets.filter(item=>item?.marketDataAvailable!==false);
  if(selected!=='all')rows=rows.filter(item=>category(item)===selected);
  if(selected==='commodities'&&commodityView!=='all')rows=rows.filter(item=>commoditySubgroup(item)===commodityView);
  if(q)rows=rows.filter(item=>searchable(item).replaceAll('/','').includes(q));
  const popular=new Map(popularSymbols.map((symbol,index)=>[symbol,index]));
  const recentIndex=new Map(recent.map((symbol,index)=>[symbol,index]));
  if(view==='recent')rows=rows.filter(item=>recentIndex.has(item.symbol)).sort((a,b)=>recentIndex.get(a.symbol)-recentIndex.get(b.symbol));
  else if(view==='movers')rows=rows.filter(item=>change(item)!==null).sort((a,b)=>Math.abs(change(b))-Math.abs(change(a))||compareSymbol(a,b));
  else if(view==='active')rows=rows.filter(item=>volume(item)!==null).sort((a,b)=>volume(b)-volume(a)||compareSymbol(a,b));
  else if(view==='popular')rows=rows.sort((a,b)=>(popular.get(a.symbol)??Number.MAX_SAFE_INTEGER)-(popular.get(b.symbol)??Number.MAX_SAFE_INTEGER)||compareSymbol(a,b));
  else rows=rows.sort(compareSymbol);
  return rows;
}
export function v4MarketPricePresentation(item,forex=false) {
  const bid=number(item?.bid),ask=number(item?.ask);
  const ready=bid!==null&&ask!==null&&bid>0&&ask>=bid&&item?.isStale!==true&&item?.marketState!=='SUBSCRIPTION_ERROR';
  const pip=instrumentPipSize(item);
  const last=number(item?.last??item?.price??item?.mid);
  const chg=change(item);
  return {
    bid:ready?formatInstrumentPrice(bid,item):'—',
    ask:ready?formatInstrumentPrice(ask,item):'—',
    spread:ready&&Number.isFinite(pip)&&pip>0?`${((ask-bid)/pip).toFixed(1)}p`:'—',
    last:last!==null&&last>0?formatInstrumentPrice(last,item):'—',
    change:chg===null?'—':`${chg>=0?'+':''}${chg.toFixed(2)}%`,
    changeValue:chg,
  };
}
