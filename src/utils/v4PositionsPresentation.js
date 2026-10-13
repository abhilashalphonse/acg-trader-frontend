// Read-only presentation helpers for the V4 Positions dock. Do not derive
// reserved margin from leverage or confuse valuation source with order source.
export const V4_POSITION_VIEWS = Object.freeze(['compact','risk','execution']);
export const V4_POSITION_MIN_WIDTHS = Object.freeze({compact:680,risk:960,execution:880});

export function validPositionView(value) {
  return V4_POSITION_VIEWS.includes(value) ? value : 'compact';
}
export function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function fixedNumber(value, places=2) {
  const number = finiteOrNull(value);
  if (number === null) return '—';
  const rounded = Number(number.toFixed(places));
  return rounded.toLocaleString('en-US',{minimumFractionDigits:places,maximumFractionDigits:places});
}
export function money(value, currency='USD', signed=false) {
  const number=finiteOrNull(value);
  if (number===null) return '—';
  const rounded=Number(number.toFixed(2));
  const code=String(currency||'USD').toUpperCase();
  let result;
  try { result=new Intl.NumberFormat('en-US',{style:'currency',currency:code,minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(rounded)); }
  catch { result=fixedNumber(Math.abs(rounded),2)+' '+code; }
  return signed ? (rounded>0?'+':rounded<0?'−':'')+result : (rounded<0?'−':'')+result;
}
export function pnlTone(value) {
  const number=finiteOrNull(value);
  if(number===null || Number(number.toFixed(2))===0)return 'neutral';
  return number>0?'profit':'loss';
}
export function positionMargin(position) {
  // Stored reservation is authoritative, even if the current catalog leverage
  // differs from the one at the time the position was filled.
  const raw=position?.raw;
  const value=raw
    ? raw.margin
    : position?.usedMargin??position?.marginUsed??position?.margin;
  return finiteOrNull(value);
}
export function positionExposure(position,instrument) {
  const lots=finiteOrNull(position?.volume);
  const contract=finiteOrNull(position?.raw?.contractSize??instrument?.contractSize);
  if(lots===null||contract===null||lots<=0||contract<=0)return null;
  const quantity=lots*contract;
  if(!Number.isFinite(quantity))return null;
  const unit=instrument?.baseCurrency||(
    String(instrument?.assetClass||'').toUpperCase()==='EQUITY'?'shares':'units'
  );
  return {quantity,unit:String(unit).toUpperCase()==='SHARES'?'shares':unit,description:'Underlying quantity (lots × contract size); not account-currency notional'};
}
export function positionOpened(position) {
  // The normalized "openedAt" is localized display text; prefer raw ISO
  // timestamp for reliable date and offset calculations.
  const value=position?.raw?.openedAt??position?.openedAtIso??null;
  if(!value)return null;
  const date=new Date(value);
  if(!Number.isFinite(date.getTime()))return null;
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const dateText=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:zone}).format(date);
  const timeText=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:zone}).format(date);
  const offset=new Intl.DateTimeFormat('en-GB',{timeZone:zone,timeZoneName:'shortOffset'})
    .formatToParts(date).find(x=>x.type==='timeZoneName')?.value?.replace('GMT','UTC')||'UTC';
  return {date:dateText,time:timeText,offset,iso:date.toISOString()};
}
export function positionExecutionSource(position) {
  // position.source is the P&L valuation provider, NOT an execution source.
  const raw=position?.raw;
  const meta=raw?.metadata;
  const source=meta instanceof Map ? (meta.get('executionSource')??meta.get('orderSource')) :
    (meta?.executionSource??meta?.orderSource);
  return typeof source==='string'&&source.trim()?source.trim():'—';
}
export function positionUnrealizedPnl(position,account) {
  const currency=String(account?.currency||'USD').toUpperCase();
  const pnlCurrency=String(position?.pnlCurrency||currency).toUpperCase();
  if(pnlCurrency!==currency)return {value:null,currency,verified:false};
  return {value:finiteOrNull(position?.pnl),currency,verified:true};
}
export function positionRiskAtStop(position,instrument,account,estimatePnlAtPrice) {
  const sl=finiteOrNull(position?.sl);
  if(sl===null||sl<=0)return null;
  const accountCurrency=String(account?.currency||'USD').toUpperCase();
  const quoteCurrency=String(instrument?.quoteCurrency||'').toUpperCase();
  // The projection helper computes in the instrument quote currency, even if
  // position.pnl was converted by the valuation feed. Show no synthetic USD
  // risk estimate for AUD/CAD or other cross-currency instruments.
  if(!quoteCurrency||quoteCurrency!==accountCurrency)return null;
  const estimated=finiteOrNull(estimatePnlAtPrice(position,sl,instrument));
  return estimated===null?null:Math.max(0,-estimated);
}
export function positionIdentity(position) {
  return String(position?.id??position?.positionId??'');
}


/**
 * USD notional = underlying quantity × current executable price, but only
 * when the instrument is USD-denominated or its underlying itself is USD.
 * No assumed FX conversion and no mixed-unit additions.
 */
export function positionUsdNotional(position,instrument) {
  const underlying=positionExposure(position,instrument);
  if(!underlying)return null;
  const base=String(instrument?.baseCurrency||'').toUpperCase();
  const quote=String(instrument?.quoteCurrency||'').toUpperCase();
  if(base==='USD')return underlying.quantity;
  if(quote!=='USD')return null;
  const price=finiteOrNull(position?.closePrice);
  return price!=null&&price>0 ? underlying.quantity*price : null;
}
export function positionMarginUtilization(position,account) {
  const margin=positionMargin(position);
  const equity=finiteOrNull(account?.equity);
  return margin!=null&&equity!=null&&equity>0 ? 100*margin/equity : null;
}
export function positionRecordedCosts(position) {
  // Explicit presence matters: unknown is NOT free. Amounts are already
  // posted in account accounting; never subtract them again from live P&L.
  const raw=position?.raw;
  const commission=raw&&Object.prototype.hasOwnProperty.call(raw,'commissionPaid')
    ? finiteOrNull(raw.commissionPaid):null;
  const swap=raw&&Object.prototype.hasOwnProperty.call(raw,'swapPaid')
    ? finiteOrNull(raw.swapPaid):null;
  const realized=raw&&Object.prototype.hasOwnProperty.call(raw,'realizedPnl')
    ? finiteOrNull(raw.realizedPnl):null;
  return {commission,swap,realized};
}
export function positionHoldingDuration(position,now=Date.now()) {
  const started=positionOpened(position)?.iso;
  const start=started==null?NaN:Date.parse(started);
  const end=typeof now==='number'?now:Date.parse(now);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return null;
  const totalMinutes=Math.floor((end-start)/60000);
  const days=Math.floor(totalMinutes/1440);
  const hours=Math.floor(totalMinutes%1440/60);
  const minutes=totalMinutes%60;
  return days ? days+'d '+hours+'h' : hours ? hours+'h '+minutes+'m' : minutes+'m';
}

/**
 * Conservative account-currency protection intelligence. Never equate
 * original risk with risk remaining from the current mark.
 * estimatePnlAtPrice computes quote-currency P&L and is only valid as account
 * P&L here when quote == account currency.
 */
export function positionProtectionIntelligence(position,instrument,account,estimatePnlAtPrice) {
  const entry=finiteOrNull(position?.entry);
  const current=finiteOrNull(position?.closePrice);
  const sl=finiteOrNull(position?.sl);
  const tp=finiteOrNull(position?.tp);
  const pip=finiteOrNull(instrument?.pipSize)??finiteOrNull(instrument?.tickSize);
  const unit=finiteOrNull(instrument?.pipSize)>0?'pips':finiteOrNull(instrument?.tickSize)>0?'ticks':'price units';
  const distance=target=>current!=null&&target!=null&&pip!=null&&pip>0
    ? Math.abs(target-current)/pip:null;
  const validConversion=String(instrument?.quoteCurrency||'').toUpperCase()===
    String(account?.currency||'USD').toUpperCase();
  const projected=(reference,target)=>validConversion&&reference!=null&&target!=null
    ? finiteOrNull(estimatePnlAtPrice({...position,entry:reference},target,instrument)):null;
  const lossAtStop=projected(entry,sl);
  const gainAtTarget=projected(entry,tp);
  const currentToStop=projected(current,sl);
  const currentToTarget=projected(current,tp);
  return {
    unit,stopDistance:distance(sl),targetDistance:distance(tp),
    currentToStop,currentToTarget,lossAtStop,gainAtTarget,
    rewardToRisk:lossAtStop!=null&&lossAtStop<0&&gainAtTarget!=null&&gainAtTarget>0
      ? gainAtTarget/-lossAtStop:null,
    // This is an immutable historical metric; do not synthesize it from
    // mutable SL or mark price without a recorded opening-risk basis.
    rMultiple:null,
  };
}
