/**
 * V4 slider-specific sizing affordances.
 *
 * The instrument's absolute volume ceiling (e.g. BTC 1000 lots) is not
 * an appropriate linear-slider ceiling for a small funded account.
 *
 * This module controls ONLY the interactive track, never the instrument
 * maximum and never the backend's execution validation.
 */
import { estimateExecutionPrice } from './executionPricing.js';
import { estimateOpeningRequirement, estimateLossAtStopWithCosts } from './tradingRisk.js';
import { resolveV4PositionSizing } from './v4ExecutionPrecision.js';

const positive = value => value !== '' && value != null && Number.isFinite(Number(value)) && Number(value) > 0
  ? Number(value) : null;
const safeNumber = value => value !== '' && value != null && Number.isFinite(Number(value)) ? Number(value) : null;
const validSide = side => ['buy','sell'].includes(String(side || '').toLowerCase());
const precisionOf = step => {
  const text=String(step);
  return Math.min(10, text.includes('e-') ? Number(text.split('e-')[1]) : (text.split('.')[1] || '').length);
};
const volumeFromUnits = (units,step) => Number((units * step).toFixed(precisionOf(step)));

/**
 * Affordability includes required margin + opening commission. It models
 * the volume-dependent executable spread for market entries. Pending orders
 * use their effective entry/limit reference; the server still validates.
 *
 * Unknown account, FX or price conversion returns a closed slider state.
 */
export function deriveV4AffordableVolume({ instrument,account,side='buy',pending=false,referencePrice=null }={}) {
  const min=positive(instrument?.minVolume);
  const max=positive(instrument?.maxVolume);
  const step=positive(instrument?.volumeStep);
  const freeMargin=safeNumber(account?.freeMargin);
  if (!min||!max||!step||max<min||!Number.isFinite(freeMargin)||freeMargin<0||!validSide(side))
    return {valid:false,affordableLots:null,reason:'UNVERIFIED_LIMIT'};

  const low=Math.ceil(min/step - 1e-9);
  const high=Math.floor(max/step + 1e-9);
  if (!Number.isSafeInteger(high)||!Number.isSafeInteger(low)||high<low)
    return {valid:false,affordableLots:null,reason:'VOLUME_STEP_INVALID'};

  const requirement=units=>{
    const lots=volumeFromUnits(units,step);
    const marketPrice=pending
      ?positive(referencePrice)
      :positive(estimateExecutionPrice(instrument,side,lots)?.price);
    if (!marketPrice) return null;
    const opening=estimateOpeningRequirement(marketPrice,lots,instrument,account);
    return Number.isFinite(opening)&&opening>=0?opening:null;
  };
  const initial=requirement(low);
  if(initial===null) return {valid:false,affordableLots:null,reason:'OPENING_REQUIREMENT_UNKNOWN'};
  if(initial>freeMargin+1e-8)
    return {valid:true,affordableLots:0,minLots:volumeFromUnits(low,step),reason:'MIN_VOLUME_UNAFFORDABLE'};

  let left=low,right=high,accepted=low;
  while(left<=right){
    const mid=Math.floor((left+right)/2);
    const amount=requirement(mid);
    if(amount===null) return {valid:false,affordableLots:null,reason:'OPENING_REQUIREMENT_UNKNOWN'};
    if(amount<=freeMargin+1e-8){accepted=mid;left=mid+1;}
    else right=mid-1;
  }
  return {valid:true,affordableLots:volumeFromUnits(accepted,step),minLots:volumeFromUnits(low,step),reason:null};
}

/**
 * Risk slider limits use the same verified execution adapter as the ticket.
 * The cap is the risk at the maximum affordable (step-rounded) volume, not
 * a hard-coded percent of equity. Manual typed budgets remain unrestricted
 * and are always validated at submission.
 */
export function deriveV4AffordableRiskRange({ instrument, account, plan, affordableLots }={}) {
  const equity=positive(account?.equity);
  const lots=positive(affordableLots);
  const minLots=positive(instrument?.minVolume);
  const step=positive(instrument?.volumeStep);
  const sl=positive(plan?.sl);
  const side=String(plan?.side||'').toLowerCase();
  const invalid={valid:false,reason:'RISK_RANGE_UNAVAILABLE'};
  if(!equity||!lots||!minLots||!step||lots<minLots||!sl||!validSide(side))return invalid;

  const entryFor=volume=>plan?.pending
    ?positive(plan?.orderType==='stop-limit'?plan?.limitPrice:plan?.entry)
    :positive(estimateExecutionPrice(instrument,side,volume)?.price);
  const lossFor=volume=>{
    const entry=entryFor(volume);
    if(!entry || (side==='buy'?sl>=entry:sl<=entry))return null;
    return positive(estimateLossAtStopWithCosts({...plan,entry},volume,instrument,account));
  };
  const minRisk=lossFor(minLots);
  const upperRisk=lossFor(lots);
  if(!minRisk||!upperRisk||upperRisk<minRisk)return invalid;

  const isExecutable=(mode,amount)=>Number.isFinite(amount)&&amount>0
    &&resolveV4PositionSizing({mode,amount,plan,account,instrument}).canExecute===true;
  const usdWorks=amount=>isExecutable('riskUSD',amount);
  let firstValid=null;
  // Find a known executable budget before searching upward. Risk amounts
  // below the minimum volume must not be mistaken for the maximum.
  for(let n=0;n<=24;n++){
    const candidate=minRisk+(upperRisk-minRisk)*n/24+upperRisk*1e-10;
    if(usdWorks(candidate)){firstValid=candidate;break;}
  }
  if(firstValid===null)return invalid;

  let ceiling=upperRisk;
  if(!usdWorks(upperRisk)){
    let low=firstValid, high=upperRisk;
    for(let i=0;i<26;i++){
      const mid=(low+high)/2;
      if(usdWorks(mid))low=mid;
      else high=mid;
    }
    ceiling=low;
  }

  const floorStep=(v,increment)=>Number((Math.floor((v+1e-10)/increment)*increment).toPrecision(12));
  const ceilStep=(v,increment)=>Number((Math.ceil((v-1e-10)/increment)*increment).toPrecision(12));
  const modeRange=(mode,increment,convert)=>{
    const min=ceilStep(convert(minRisk),increment);
    const max=floorStep(convert(ceiling),increment);
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||min<=0)return null;
    // Converted, quantized endpoints must remain executable as prices move.
    if(!isExecutable(mode,min)||!isExecutable(mode,max))return null;
    return {min,max};
  };
  const usd=modeRange('riskUSD',1,risk=>risk);
  const percent=modeRange('riskPercent',0.01,risk=>risk/equity*100);
  if(!usd&&!percent)return invalid;
  return {valid:true,usd,percent,affordableLots:lots};
}

/** Logarithmic mapping: precise around min lots, reaches full affordable cap. */
export function v4LotsFromTrack(position,{minLots,maxLots,step}={}){
  const min=positive(minLots),max=positive(maxLots),increment=positive(step);
  if(!min||!max||!increment||max<min) return null;
  const fraction=Math.max(0,Math.min(1,Number(position)/1000||0));
  const raw=min===max?min:min*Math.exp(Math.log(max/min)*fraction);
  const snapped=volumeFromUnits(Math.round(raw/increment),increment);
  return Math.max(min,Math.min(max,snapped));
}
export function v4TrackFromLots(lots,{minLots,maxLots}={}){
  const min=positive(minLots),max=positive(maxLots),value=positive(lots);
  if(!min||!max||!value||max<=min) return 0;
  const clipped=Math.max(min,Math.min(max,value));
  return Math.max(0,Math.min(1000,Math.log(clipped/min)/Math.log(max/min)*1000));
}

/** Show the underlying crypto quantity without implying 'lots' mean USD. */
export function v4CryptoQuantity(lots,instrument){
  if(String(instrument?.assetClass||'').toUpperCase()!=='CRYPTO') return null;
  const unit=String(instrument?.baseCurrency||'').trim().toUpperCase()
    || (String(instrument?.symbol||'').toUpperCase().startsWith('BTC')?'BTC':'');
  const contract=positive(instrument?.contractSize);
  const value=positive(lots);
  return unit&&contract&&value?{quantity:value*contract,unit}:null;
}
