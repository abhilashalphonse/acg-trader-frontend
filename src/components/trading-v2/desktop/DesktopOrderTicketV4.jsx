import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, CheckCircle2, Circle, Ellipsis, X, Minus, Plus, ArrowRight } from 'lucide-react';
import InstrumentAvatar from '../InstrumentAvatar.jsx';
import { formatInstrumentPrice, formatSpreadDisplay, instrumentPipSize } from '../../../utils/instrumentFormatting.js';
import { normalizePriceToTick, normalizeProtectionPrice, normalizeVolumeToStep } from '../../../utils/tradingCommandNormalization.js';
import { effectiveTradePlan, validateTradePlanForExecution } from '../../../utils/tradePlanExecution.js';
import { deriveAccountCapabilities } from '../../../utils/accountCapabilities.js';
import { estimateRequiredMargin, estimateLossAtStopWithCosts, effectiveLeverage, estimateOpeningRequirement, riskSizingSupported, defaultPlannerStopDistance } from '../../../utils/tradingRisk.js';
import { resolveV4PositionSizing } from '../../../utils/v4ExecutionPrecision.js';
import { v4ExitPriceFromInput, v4ExitValueFromPrice } from '../../../utils/v4ProtectionPrecision.js';
import { estimateExecutionPrice } from '../../../utils/executionPricing.js';
import { deriveV4AffordableVolume, v4LotsFromTrack, v4TrackFromLots, v4CryptoQuantity } from '../../../utils/v4SliderSizing.js';
import './DesktopOrderTicketV4.css';

// This is a PRODUCTION PRESENTATION ADAPTER, gated off by default in DesktopTerminal.
// No synthetic market/account values, order APIs, additional execution paths or
// bypasses. The parent terminal retains all execution, validation and audit logic.
const numeric = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x)) ? Number(x) : null;
const positive = x => { const n = numeric(x); return n !== null && n > 0 ? n : null; };
const fmt = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—';
const money = (n, c='USD') => {
  if (!Number.isFinite(n)) return '—';
  try { return new Intl.NumberFormat('en-US', {style:'currency',currency:c,maximumFractionDigits:2}).format(n); }
  catch { return fmt(n) + ' ' + c; }
};
const pillModes = [
  ['lots','Lots'],['margin','Margin $'],['riskPercent','Risk %'],['riskUSD','Risk USD'],
];
const exitUnits = [
  ['price','Price'],['ticks','Ticks'],['percent','% Price'],['usd','USD'],['balance','% Balance'],
];
function Capsule({ options, active, onChange, label, className='' }) {
  return <div className={'v4-capsule '+className} role="group" aria-label={label}>
    {options.map(([id,text])=><button type="button" key={id}
      className={'v4-capsule-button'+(id===active?' selected':'')}
      aria-pressed={id===active} onClick={()=>onChange(id)}>{text}</button>)}
  </div>;
}
function EditNumber({ value, label, onCommit, digits=4 }) {
  const [focused,setFocused] = useState(false);
  const [draft,setDraft] = useState('');
  const aborted = useRef(false);
  const open = () => { aborted.current=false; setDraft(Number.isFinite(value)?String(Number(value.toFixed(digits))):'');setFocused(true); };
  const commit = () => {
    if (!aborted.current && draft.trim()!=='' && Number.isFinite(Number(draft)) && Number(draft)>0) onCommit(Number(draft));
    setFocused(false);
  };
  return <div className="v4-hero-input">{focused
    ? <input autoFocus aria-label={label} inputMode="decimal" value={draft} onChange={e=>setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){aborted.current=true;e.currentTarget.blur();}}}/>
    : <button className="v4-hero-value" type="button" aria-label={'Edit '+label} onClick={open}>{fmt(value,digits===2?2:digits)}</button>}
  </div>;
}
function PendingPriceInput({label,price,instrument,disabled,onCommit,onNotice}) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState('');
  const cancel=useRef(false);
  const rendered=formatInstrumentPrice(price,instrument,'');
  const begin=()=>{cancel.current=false;setDraft(rendered);setEditing(true);};
  const finish=()=>{
    if (!cancel.current) {
      const requested=Number(draft);
      if (draft.trim()==='' || !Number.isFinite(requested) || requested<=0) {
        onNotice('Enter a valid positive pending price.');
      } else if (String(rendered)!==draft.trim()) {
        // Patch is normalized once by the existing trade-plan adapter.
        onCommit(requested);
      }
    }
    setEditing(false);
  };
  return <input type="text" inputMode="decimal" aria-label={label} disabled={disabled}
    value={editing?draft:rendered}
    onFocus={begin} onChange={e=>setDraft(e.target.value)} onBlur={finish}
    onKeyDown={e=>{
      if(e.key==='Enter')e.currentTarget.blur();
      if(e.key==='Escape'){cancel.current=true;e.currentTarget.blur();}
    }}/>;
}
export function ProtectionCard({field,active,onToggle,unit,onUnit,plan,market,account,lots,sizingMode,onPrice,onNotice,disabled=false}) {
  const title = field==='sl'?'Stop Loss':'Take Profit';
  const rawPrice=positive(plan?.[field]);
  const hasPlan=Boolean(plan?.side);
  const projection = hasPlan && rawPrice
    ? v4ExitValueFromPrice({field,unit,price:rawPrice,plan,instrument:market,lots,account}) : null;
  const baseProjection=hasPlan && rawPrice
    ? v4ExitValueFromPrice({field,unit:'price',price:rawPrice,plan,instrument:market,lots,account}) : null;
  const [focused,setFocused]=useState(false);
  const [draft,setDraft]=useState('');
  const abort=useRef(false);
  const locked=field==='sl' && ['riskPercent','riskUSD'].includes(sizingMode) && ['usd','balance'].includes(unit);
  const canEdit=active && !disabled && hasPlan && !locked && projection?.valid===true;
  const currentValue=projection?.valid ? projection.value : null;
  const labelFor=(id)=>{
    if(id==='usd')return field==='sl'?'Risk USD':'Profit USD';
    if(id==='balance')return field==='sl'?'Risk % Bal.':'Profit % Bal.';
    return exitUnits.find(x=>x[0]===id)?.[1]||id;
  };
  const apply=()=>{
    if(!abort.current && canEdit && draft.trim()!==''){
      const result=v4ExitPriceFromInput({
        field,unit,amount:draft,plan,instrument:market,lots,account,sizingMode,
      });
      if(result.valid)onPrice(result.price);
      else onNotice(result.message||'Protection level cannot be calculated');
    }
    setFocused(false);
  };
  return <div className={'v4-exit-card'+(!active?' is-disabled':'')}>
    <div className="v4-exit-heading">
      <strong>{title}</strong>
      <button type="button" className="v4-exit-toggle" onClick={onToggle} disabled={disabled} aria-pressed={active}>
        {active?<CheckCircle2 size={20} fill="#F2F2F4" color="#F2F2F4" className="v4-check-on"/>
          :<Circle size={20} color="#898990"/>}
        <span>{active?'Enabled':'Disabled'}</span>
      </button>
    </div>
    {active && <>
      <div className="v4-exit-controls">
        <input type="text" inputMode="decimal" aria-label={title+' value'} disabled={!canEdit}
          value={focused?draft:(Number.isFinite(currentValue)?String(Number(currentValue.toFixed(unit==='ticks'?0:unit==='percent'||unit==='balance'?6:2))):'')}
          onFocus={()=>{abort.current=false;setDraft(Number.isFinite(currentValue)?String(Number(currentValue.toFixed(6))):'');setFocused(true);}}
          onChange={e=>setDraft(e.target.value)} onBlur={apply}
          onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){abort.current=true;e.currentTarget.blur();}}}/>
        <div className="v4-select-wrap">
          <select aria-label={title+' input unit'} value={unit} disabled={disabled} onChange={e=>{onUnit(e.target.value);setFocused(false);}}>
            {exitUnits.map(([id])=><option key={id} value={id}
              disabled={field==='sl' && ['riskPercent','riskUSD'].includes(sizingMode) && ['usd','balance'].includes(id)}>
              {labelFor(id)}
            </option>)}
          </select>
          <ChevronDown size={14}/>
        </div>
      </div>
      <div className="v4-exit-result">
        <span>Price {formatInstrumentPrice(rawPrice,market)}</span>
        <strong>{Number.isFinite(baseProjection?.accountCurrencyValue)
          ? money(baseProjection.accountCurrencyValue,account?.currency)+' · '+fmt(baseProjection.accountPercent)+'%'
          :'—'}</strong>
      </div>
    </>}
  </div>;
}

export default function DesktopOrderTicketV4({
  market,account={},lots=0.1,onLotsChange=()=>{},
  sizingMode='lots',onSizingModeChange=()=>{},riskPercent=0.5,onRiskPercentChange=()=>{},
  orderType='market',onOrderTypeChange=()=>{},tradePlan,
  onStartPlan=()=>{},onCancelPlan=()=>{},onExecutePlan=()=>{},
  onManualOrder=()=>{},onTradePlanChange=()=>{},onNotice=()=>{},
  exposureAllowed=true,exposureBlockReason='New exposure unavailable',
  executionCommandPending=false,
  onCloseTicket=()=>{},
  onOpenMarkets=()=>{},
}) {
  const [uiMode,setUiMode]=useState(sizingMode==='risk'?'riskPercent':'lots');
  const [slUnit,setSlUnit]=useState('ticks');
  const [tpUnit,setTpUnit]=useState('ticks');
  const [wantSl,setWantSl]=useState(false);
  const [wantTp,setWantTp]=useState(false);
  const [advanced,setAdvanced]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const submittingRef=useRef(false);
  const [localSubmitting,setLocalSubmitting]=useState(false);
  // Margin $ is a user-selected budget; it must not be replaced by the
  // discretized required margin after lot-step rounding.
  const [marginBudget,setMarginBudget]=useState(null);
  // A default BUY is a clearly marked chart DRAFT, never an order submission.
  // Once the trader chooses SELL, subsequent slider edits retain that direction.
  const [draftSide,setDraftSide]=useState('buy');
  // A chart-loaded risk plan can change the native mode independently.
  useEffect(()=>{if(tradePlan?.sizingMode==='risk')setUiMode(current=>
    current==='lots'||current==='margin'?'riskPercent':current);
  },[tradePlan?.sizingMode]);
  // Initial protection toggles only apply to one chart plan.
  useEffect(()=>{if(tradePlan?.symbol){setWantSl(false);setWantTp(false);}},[tradePlan?.symbol]);
  const currency=account?.currency||'USD';
  const family=orderType==='market'?'market':'pending';
  const capabilities=deriveAccountCapabilities(account);
  const effective=useMemo(()=>effectiveTradePlan(tradePlan,market),[tradePlan,market]);
  const validMarket=positive(market?.bid)&&positive(market?.ask)&&Number(market.ask)>=Number(market.bid)
    && market?.isStale!==true && market?.sessionOpen!==false
    && !['WAITING','STALE','DISCONNECTED','ERROR','DISABLED','CLOSED','UNAVAILABLE','SUBSCRIPTION_ERROR'].includes(String(market?.marketState||'').toUpperCase());
  const accountValid=account && positive(account?.equity);
  const accountBalance=positive(account?.balance);
  const hasSl=tradePlan?positive(effective?.sl)!==null:wantSl;
  const hasTp=tradePlan?positive(effective?.tp)!==null:wantTp;
  const effectiveLots=useMemo(()=>{
    // Risk sizing without a side/SL is an uncommitted budget, not lots.
    if(!effective && ['riskPercent','riskUSD'].includes(uiMode))return null;
    if(!effective||effective.sizingMode!=='risk')return positive(lots);
    const result=resolveV4PositionSizing({mode:'riskPercent',amount:riskPercent,plan:effective,account,instrument:market});
    return result.canExecute?result.lots:null;
  },[effective,account,market,lots,riskPercent,uiMode]);
  const volume=positive(effectiveLots);
  const step=positive(market?.volumeStep)||0.01;
  const min=positive(market?.minVolume)||step;
  const max=positive(market?.maxVolume)||Math.max(1,Number(lots)||1);
  const lotPrecision=String(step).includes('.')?Math.min(8,String(step).split('.')[1].length):0;
  const planRef=positive(effective?.pending&&effective?.orderType==='stop-limit'?effective?.limitPrice:effective?.entry);
  // The displayed margin and projected risk use the SAME executable volume-
  // adjusted price as the trading command (pending orders use pending entry).
  const liveModeledPrice=volume
    ?positive(estimateExecutionPrice(market,effective?.side||'buy',volume)?.price):null;
  const previewRef=effective?.pending?planRef:(liveModeledPrice||planRef||positive(market?.ask));
  const margin=volume&&previewRef?estimateRequiredMargin(previewRef,volume,market,account):null;
  const requirement=volume&&previewRef?estimateOpeningRequirement(previewRef,volume,market,account):null;
  const freeAfter=Number.isFinite(Number(account?.freeMargin)) && account?.freeMargin!=null&&Number.isFinite(requirement)
    ? Number(account.freeMargin)-requirement:null;
  const risk=effective&&volume&&positive(effective.sl)
    ? estimateLossAtStopWithCosts({...effective,entry:previewRef||effective.entry},volume,market,account):null;
  const stopDistance=previewRef&&positive(effective?.sl)?Math.abs(previewRef-effective.sl):null;
  const tpDistance=previewRef&&positive(effective?.tp)?Math.abs(previewRef-effective.tp):null;
  const rr=Number.isFinite(stopDistance)&&stopDistance>0&&Number.isFinite(tpDistance)?tpDistance/stopDistance:null;
  const notional=volume&&previewRef&&positive(market?.contractSize)&&String(market?.quoteCurrency||'').toUpperCase()===String(currency).toUpperCase()
    ?volume*previewRef*Number(market.contractSize):null;
  const selectedValue=uiMode==='lots'?Number(lots):uiMode==='margin'?(marginBudget??margin)
    :uiMode==='riskPercent'?Number(riskPercent):accountValid?Number(account.equity)*Number(riskPercent)/100:null;
  const activeMode=uiMode==='riskUSD'||uiMode==='riskPercent'?'risk':'lots';
  const quoteState=market?.sessionOpen===false||String(market?.marketState||'').toUpperCase()==='CLOSED'?'Market Closed'
    :validMarket?'Market Open':'Quote Unavailable';
  const sessionHint=market?.sessionOpen===false?'Trading paused':validMarket?'Live prices':'Waiting for quotes';
  const entryOptions=[['market','Market'],['limit','Limit'],['stop','Stop']];
  const notice=message=>onNotice(message);
  const normalLots=value=>normalizeVolumeToStep(value,market,{rounding:'nearest'});
  const fakePlanForIndicative={
    symbol:market?.symbol,side:draftSide,pending:false,orderType:'market',
    entry:draftSide==='buy'?market?.ask:market?.bid,sl:null,tp:null,
  };
  const createSliderDraft=(nextSizingMode,nextLots,protection='none')=>{
    if(tradePlan || executionCommandPending || localSubmitting || !exposureAllowed || !validMarket) return;
    onStartPlan(draftSide,orderType,{
      sizingMode:nextSizingMode,manualLots:nextLots,protection,
      source:'v4-slider',desktopPendingDraft:family==='pending',
    });
  };
  const applySize=value=>{
    if(!Number.isFinite(value)||value<=0){notice('Enter a valid positive size.');return;}
    if(uiMode==='lots'){
      if(value<min-1e-8||value>max+1e-8){notice('Volume is outside instrument limits.');return;}
      const l=normalLots(value);
      onLotsChange(l);onSizingModeChange('lots');
      if(tradePlan)onTradePlanChange({manualLots:l,sizingMode:'lots',stage:'ready'});
      else createSliderDraft('lots',l,capabilities.stopLossRequiredForManualLots?'sl':'none');
      return;
    }
    if(uiMode==='margin')setMarginBudget(value);
    if((uiMode==='riskUSD'||uiMode==='riskPercent')&&!effective?.sl){
      // Store the risk budget now. Selecting Buy/Sell creates a chart plan
      // with an initial SL; the authoritative engine then derives volume.
      const equity=positive(account?.equity);
      if(!equity){notice('Account equity is unavailable.');return;}
      const percent=uiMode==='riskUSD'?value/equity*100:value;
      onRiskPercentChange(percent);
      onSizingModeChange('risk');
      if(tradePlan){
        const sl=defaultProtect('sl');
        if(!positive(sl)){notice('Unable to calculate a safe initial SL.');return;}
        onTradePlanChange({sl,sizingMode:'risk',stage:'ready'});
      }else{
        createSliderDraft('risk',lots,'sl');
      }
      return;
    }
    const plan=effective||fakePlanForIndicative;
    const result=resolveV4PositionSizing({mode:uiMode,amount:value,plan,account,instrument:market});
    if(uiMode==='margin'){
      if(!result.canExecute){notice(result.message||'Unable to calculate position size');return;}
      onLotsChange(result.lots);onSizingModeChange('lots');
      if(tradePlan)onTradePlanChange({sizingMode:'lots',manualLots:result.lots,stage:'ready'});
      else createSliderDraft('lots',result.lots,capabilities.stopLossRequiredForManualLots?'sl':'none');
    }else{
      // A trader must be able to lower an unaffordable risk budget.
      // Persist the requested risk even if its current volume is blocked;
      // the ticket keeps execution disabled until the backend preview passes.
      const equity=positive(account?.equity);
      if(!equity){notice('Account equity is unavailable.');return;}
      const percent=uiMode==='riskUSD'?value/equity*100:value;
      onRiskPercentChange(percent);onSizingModeChange('risk');
      if(tradePlan)onTradePlanChange({sizingMode:'risk',manualLots:result.canExecute?result.lots:null,stage:'ready'});
      if(!result.canExecute)notice(result.message||'Risk budget cannot be executed at this SL.');
    }
  };
  const changeSizing=next=>{
    if(['riskPercent','riskUSD'].includes(next)){
      if(!riskSizingSupported(market,currency)){notice('Risk sizing needs verified account-currency P&L.');return;}
      // The user can choose the risk budget before choosing Buy or Sell.
      // A new chart plan will create a default SL, and then compute lots.
      const priceReference=planRef||positive(effective?.entry);
      const perLot=effective?.sl&&volume&&priceReference
        ?estimateLossAtStopWithCosts({...effective,entry:priceReference},volume,market,account):null;
      if(activeMode!=='risk'&&Number.isFinite(perLot)&&positive(account?.equity)){
        onRiskPercentChange(perLot/Number(account.equity)*100);
      }
      onSizingModeChange('risk');
      if(tradePlan){
        const sl=positive(effective?.sl)||defaultProtect('sl');
        if(!positive(sl)){notice('Unable to create an initial stop loss.');return;}
        onTradePlanChange({sl,sizingMode:'risk',stage:'ready'});
      }
      if(['usd','balance'].includes(slUnit))setSlUnit('ticks');
    }else{
      onSizingModeChange('lots');
      if(tradePlan)onTradePlanChange({sizingMode:'lots',manualLots:normalLots(volume||lots),stage:'ready'});
      if(next==='margin')setMarginBudget(Number.isFinite(margin)?margin:null);
    }
    setUiMode(next);
  };
  const setPendingType=next=>{
    if(tradePlan?.editingOrderId){notice('Finish or cancel editing the existing pending order before changing its type.');return;}
    onOrderTypeChange(next);
    if(tradePlan){
      const base=positive(String(effective.side).toLowerCase()==='buy'?market?.ask:market?.bid);
      const pip=positive(instrumentPipSize(market))||positive(market?.tickSize);
      const isBuy=String(effective.side).toLowerCase()==='buy';
      const direction=next==='limit'?(isBuy?-1:1):(isBuy?1:-1);
      const raw=base&&pip?base+direction*pip*5:null;
      const entry=raw?normalizePriceToTick(raw,market, direction<0?'down':'up'):effective.entry;
      const patch={orderType:next,entry,desktopExplicitStopLimit:next==='stop-limit',stage:'ready'};
      if(next==='stop-limit'&&pip)patch.limitPrice=normalizePriceToTick(entry+(isBuy?1:-1)*pip*2,market,isBuy?'up':'down');
      if(next!=='stop-limit')patch.limitPrice=null;
      onTradePlanChange(patch);
    }
  };
  const selectOrderType=next=>{
    if(!entryOptions.some(([id])=>id===next) || next===orderType)return;
    if(tradePlan?.editingOrderId){
      notice('Finish or cancel editing the existing pending order before changing its type.');
      return;
    }
    // Switching between market and pending modes must discard an incompatible
    // chart draft, never submit it. The existing trade engine remains in charge.
    if(next==='market'||orderType==='market'||orderType==='stop-limit'){
      if(tradePlan)onCancelPlan();
      onOrderTypeChange(next);
      setWantSl(false);setWantTp(false);
      if(next!=='market')notice('Choose Buy or Sell to create a chart-linked pending order.');
      return;
    }
    setPendingType(next);
  };
  // The current UI may load an existing Stop Limit for modification, but
  // must never inadvertently offer a new Stop Limit after that edit is closed.
  useEffect(()=>{
    if(orderType==='stop-limit'&&!tradePlan?.editingOrderId)onOrderTypeChange('stop');
  },[orderType,tradePlan?.editingOrderId,onOrderTypeChange]);
  const defaultProtect=(field)=>{
    const side=String(effective?.side||'').toLowerCase();
    const entry=planRef||positive(effective?.entry);
    if(!entry||!['buy','sell'].includes(side))return null;
    const dist=defaultPlannerStopDistance(market,entry);
    if(!dist)return null;
    const price=entry+(side==='buy'?(field==='sl'?-1:1):(field==='sl'?1:-1))*dist*(field==='tp'?2:1);
    return normalizeProtectionPrice(price,market,side,field);
  };
  const toggleProtection=field=>{
    if(!tradePlan){
      field==='sl'?setWantSl(x=>!x):setWantTp(x=>!x);
      notice('Select Buy or Sell to start a protected chart plan.');
      return;
    }
    if(effective?.[field]!=null){
      if(field==='sl'&&activeMode==='risk'){notice('Risk sizing requires a stop loss. Switch to Lots first.');return;}
      onTradePlanChange({[field]:null,activeField:null,stage:'ready'});
    }else{
      const price=defaultProtect(field);
      if(!positive(price)){notice('Protection level unavailable for this instrument.');return;}
      onTradePlanChange({[field]:price,activeField:field,stage:'ready'});
    }
  };
  const financialVerified=Number.isFinite(requirement)&&Number.isFinite(freeAfter)&&freeAfter>=0;
  const canStartPlan=Boolean(market?.symbol&&validMarket&&exposureAllowed&&!executionCommandPending&&!localSubmitting);
  const requiresPlan=!tradePlan&&(family==='pending'||activeMode==='risk'||wantSl||wantTp||capabilities.stopLossRequiredForManualLots);
  // Starting a risk plan does NOT submit an order. Its first SL and
  // estimated volume are calculated after Buy/Sell sets the direction.
  const canTrade=canStartPlan&&(requiresPlan||(financialVerified&&Boolean(volume)));
  // A slider-generated pending draft has no explicit side choice yet.
  const pendingReview=family==='pending'&&Boolean(tradePlan)&&tradePlan?.source!=='v4-slider';
  const reviewedSide=String(effective?.side||'').toLowerCase();
  const pendingActionName=tradePlan?.editingOrderId?'Save Order Changes'
    :'Place '+reviewedSide.toUpperCase()+' '+String(effective?.orderType||orderType).replaceAll('-',' ').toUpperCase();
  const executionDisabledReason=Number.isFinite(freeAfter)&&freeAfter<0
    ? 'Insufficient free margin — reduce position size.'
    : !financialVerified
      ? 'Opening margin, fees, and free margin must be verified before V4 execution.'
      : !volume?'Position size is not executable.':null;
  const submitOnce=callback=>{
    if(submittingRef.current || executionCommandPending)return;
    submittingRef.current=true;
    setLocalSubmitting(true);
    try {
      Promise.resolve(callback()).catch(error=>{
        notice(error?.message || 'Execution failed');
      }).finally(()=>{
        submittingRef.current=false;
        setLocalSubmitting(false);
      });
    } catch (error) {
      submittingRef.current=false;
      setLocalSubmitting(false);
      notice(error?.message || 'Execution failed');
    }
  };
  const place=side=>{
    // Selecting the opposite side switches the existing chart draft,
    // without ever dispatching an order for that first side change.
    if(tradePlan?.source==='v4-slider'&&!tradePlan.editingOrderId &&
      (family==='pending'||effective?.side!==side)){
      setDraftSide(side);
      onStartPlan(side,orderType,{
        protection:activeMode==='risk'||hasSl?'sl':hasTp?'tp':'none',
        sizingMode:activeMode,manualLots:volume||lots,
        // Explicit side selection on pending drafts disarms the provisional flag.
        ...(family==='market'?{source:'v4-slider'}:{}),
        desktopPendingDraft:family==='pending',
      });
      if(family==='pending')notice('Review the chart-linked pending order, then press Place Order.');
      return;
    }
    if(!canTrade){if(!executionCommandPending&&!localSubmitting)notice(!exposureAllowed?exposureBlockReason:executionDisabledReason||'Waiting for executable market quote.');return;}
    if(!tradePlan){
      setDraftSide(side);
      if(family==='pending'||activeMode==='risk'||wantSl||wantTp||capabilities.stopLossRequiredForManualLots){
        const protection=(wantSl||capabilities.stopLossRequiredForManualLots||activeMode==='risk')
          ?(wantTp?'both':'sl'):(wantTp?'tp':'none');
        onStartPlan(side,orderType,{protection,desktopPendingDraft:family==='pending'});
        notice(family==='pending'
          ?'Review the chart-linked pending order, then press Place Order.'
          :'Review the chart-linked order, then press '+side.toUpperCase()+' again to execute.');
        return;
      }
      submitOnce(()=>onManualOrder({side,symbol:market.symbol,lots:normalLots(lots),price:side==='buy'?market.ask:market.bid}));
      return;
    }
    if(tradePlan?.editingOrderId && String(tradePlan.side).toLowerCase()!==side){
      notice('Cannot reverse the side of an order being replaced.');return;
    }
    if(String(effective?.side||'').toLowerCase()!==side){
      setDraftSide(side);
      onStartPlan(side,orderType,{protection:hasSl?(hasTp?'both':'sl'):(hasTp?'tp':'none'),desktopPendingDraft:family==='pending'});
      notice('Order direction changed. Review the chart before execution.');
      return;
    }
    if(activeMode==='risk'&&!positive(effective?.sl)){notice('Risk sizing requires an SL.');return;}
    const validation=validateTradePlanForExecution(effective,market,{preserveEntry:true});
    if(!validation.valid){notice(validation.message||'Invalid trade plan.');return;}
    // Use the established parent execution with its client Risk Guard enabled.
    // Parent backend also validates permissions, funds, quotes and funded risk.
    submitOnce(()=>onExecutePlan());
  };
  const changeExitUnit=(field,u)=>{
    if(field==='sl'&&activeMode==='risk'&&['usd','balance'].includes(u)){
      notice('Use Price, Ticks or % Price with risk-based position sizing.');return;
    }
    field==='sl'?setSlUnit(u):setTpUnit(u);
  };
  const cryptoQuantity=v4CryptoQuantity(volume,market);
  const volumeLabel=cryptoQuantity
    ?fmt(cryptoQuantity.quantity,Math.max(2,lotPrecision))+' '+cryptoQuantity.unit
    :fmt(volume,lotPrecision)+' lots';
  const translation=()=>{
    if(!volume)return '—';
    if(uiMode==='lots')return <>{volumeLabel} <ArrowRight size={13}/> {Number.isFinite(notional)?'~'+money(notional,currency):'—'} <span>{Number.isFinite(notional)&&accountBalance?'('+fmt(notional/accountBalance*100)+'% balance)':'Balance conversion unavailable'}</span></>;
    if(uiMode==='margin')return <>{money(margin,currency)} margin <ArrowRight size={13}/> {fmt(volume,lotPrecision)} lots <span>{accountBalance&&Number.isFinite(margin)?'('+fmt(margin/accountBalance*100)+'% balance)':''}</span></>;
    if(uiMode==='riskPercent')return <>{Number.isFinite(risk)&&accountValid?fmt(risk/Number(account.equity)*100)+'% risk':'—'} <ArrowRight size={13}/> {money(risk,currency)} <span>({fmt(volume,lotPrecision)} lots)</span></>;
    return <>{money(risk,currency)} risk <ArrowRight size={13}/> {fmt(volume,lotPrecision)} lots <span>{Number.isFinite(risk)&&accountValid?'('+fmt(risk/Number(account.equity)*100)+'% equity)':''}</span></>;
  };
  // Slider bounds are instrument/account limits, never a function of the
  // value being dragged. The old "current margin * 4" feedback loop
  // repeatedly rescaled the track after every lot-step conversion.
  const affordable=useMemo(()=>deriveV4AffordableVolume({
    instrument:market,account,side:effective?.side||draftSide,
    pending:Boolean(effective?.pending),
    referencePrice:planRef,
  }),[market,account,effective?.side,effective?.pending,draftSide,planRef]);
  const lotRange={
    minLots:affordable.minLots||min,
    maxLots:affordable.affordableLots,
    step,
  };
  const lotsTrackEnabled=affordable.valid&&Number(affordable.affordableLots)>=min;
  const baseSliderQuote=positive(market?.ask)||positive(market?.bid);
  const minMargin=baseSliderQuote?estimateRequiredMargin(baseSliderQuote,min,market,account):null;
  const maxMargin=baseSliderQuote?estimateRequiredMargin(baseSliderQuote,max,market,account):null;
  const marginCap=Number.isFinite(maxMargin)&&Number.isFinite(Number(account?.freeMargin))
    ?Math.min(maxMargin,Number(account.freeMargin)):null;
  const slideMin=uiMode==='lots'?min:uiMode==='margin'?(positive(minMargin)||0):0;
  const slideMax=uiMode==='lots'?Math.max(min,max):
    uiMode==='margin'&&Number.isFinite(marginCap)?Math.max(slideMin+1,marginCap):
      uiMode==='margin'?Math.max(slideMin+1,100):
      uiMode==='riskPercent'?5:positive(account?.equity)?Number(account.equity)*0.05:100;
  const slideStep=uiMode==='lots'?step:uiMode==='margin'?1:uiMode==='riskPercent'?0.01:1;
  const slideValue=Number.isFinite(selectedValue)?Math.max(slideMin,Math.min(slideMax,selectedValue)):slideMin;
  // Only the Lots track uses the affordability-aware logarithmic scale.
  // The editable numerical input still accepts the full instrument range.
  const trackMin=uiMode==='lots'?0:slideMin;
  const trackMax=uiMode==='lots'?1000:slideMax;
  const trackStep=uiMode==='lots'?1:slideStep;
  const trackValue=uiMode==='lots'?v4TrackFromLots(selectedValue,lotRange):slideValue;
  const trackMarks=[0,.25,.5,.75,1].map(p=>uiMode==='lots'
    ?v4LotsFromTrack(p*1000,lotRange)
    :slideMin+(slideMax-slideMin)*p);
  // Keep local editing state when quotes move; committed value is read from
  // live account/plan state. Never freeze financial values at first render.
  return <section className="v4-live-scope v4-ticket" aria-label="ACG Trader V4 live execution ticket">
    <div className="v4-ticket-body">
      <div className="v4-instrument">
        <InstrumentAvatar instrument={market} size={32}/>
        <button className="v4-symbol v4-symbol-button" type="button"
          onClick={onOpenMarkets} aria-label="Open markets and select instrument">
          <strong>{market?.displaySymbol||market?.symbol||'—'} <ChevronDown size={13}/></strong>
          <span>{market?.name||market?.displayName||market?.description||market?.symbol||'Instrument'}</span>
        </button>
        <div className="v4-head-actions">
          <button type="button" aria-label="Ticket information" onClick={()=>setMenuOpen(x=>!x)}><Ellipsis size={20}/></button>
          <button type="button" aria-label="Close trade ticket" onClick={()=>{if(tradePlan)onCancelPlan();else onCloseTicket();}}><X size={19}/></button>
        </div>
      </div>
      {menuOpen&&<div className="v4-settings">
        <strong>Execution information</strong>
        <span>Instrument leverage: {fmt(effectiveLeverage(account,market),0)}x</span>
        <span>Account policy: {capabilities.optionalStopLoss?'Optional SL':'SL required for manual orders'}</span>
      </div>}
      <div className="v4-session"><span><i style={{background:validMarket?'#23c58b':'#a6a6ae'}}/>{quoteState}</span><span>{sessionHint}</span></div>
      <div className="v4-quote-strip">
        <span>Bid <strong>{formatInstrumentPrice(market?.bid,market)}</strong></span>
        <span>Ask <strong>{formatInstrumentPrice(market?.ask,market)}</strong></span>
        <span>Spr <strong>{positive(market?.ask)&&positive(market?.bid)?formatSpreadDisplay(market.bid,market.ask,market):'—'}</strong></span>
      </div>
      <Capsule className="v4-mainmodes v4-order-types" label="Order type" options={entryOptions} active={orderType} onChange={selectOrderType}/>
      {family==='pending'&&<div className="v4-pending v4-block">
        {orderType==='stop-limit'&&tradePlan?.editingOrderId&&
          <span className="v4-pending-note">Editing an existing Stop Limit order</span>}
        <label className="v4-inline-setting">{orderType==='stop-limit'?'Stop trigger':'Entry price'}
          <PendingPriceInput label={orderType==='stop-limit'?'Stop trigger price':'Pending entry price'} price={effective?.entry} instrument={market} disabled={!tradePlan}
            onCommit={entry=>onTradePlanChange({entry,stage:'ready'})} onNotice={notice}/>
        </label>
        {orderType==='stop-limit'&&<label className="v4-inline-setting">Limit price
          <PendingPriceInput label="Stop-limit execution price" price={effective?.limitPrice} instrument={market} disabled={!tradePlan}
            onCommit={limitPrice=>onTradePlanChange({limitPrice,stage:'ready'})} onNotice={notice}/>
        </label>}
        {orderType==='stop-limit'&&<span className="v4-pending-note">The stop price activates a limit order. The limit is the maximum buy / minimum sell execution price; fills are not guaranteed.</span>}
      </div>}
      <div className="v4-position v4-block">
        <div className="v4-section-heading"><span>POSITION</span><span>{Number.isFinite(effectiveLeverage(account,market))?fmt(effectiveLeverage(account,market),0)+'x':'—'} <ChevronDown size={13}/></span></div>
        <Capsule label="Position sizing mode" className="v4-position-modes" options={pillModes}
          active={uiMode} onChange={changeSizing}/>
        <div className="v4-amount">
          <button type="button" aria-label="Decrease position value" onClick={()=>applySize(Math.max(slideMin,Number(selectedValue||0)-slideStep))}><Minus size={18}/></button>
          <EditNumber key={uiMode} value={selectedValue} label="Position sizing amount"
            digits={uiMode==='lots'?Math.max(2,lotPrecision):2} onCommit={applySize}/>
          <button type="button" aria-label="Increase position value" onClick={()=>applySize(Number(selectedValue||0)+slideStep)}><Plus size={18}/></button>
        </div>
        <div className="v4-slider">
          <input type="range" aria-label="Position size slider" min={trackMin} max={trackMax} step={trackStep}
            disabled={uiMode==='lots'&&!lotsTrackEnabled}
            value={trackValue} onChange={e=>{
              const requested=uiMode==='lots'
                ?v4LotsFromTrack(Number(e.target.value),lotRange)
                :Number(e.target.value);
              if(requested!=null)applySize(requested);
            }}
            style={{'--fill':((trackValue-trackMin)/Math.max(1e-8,trackMax-trackMin)*100)+'%'}}/>
          <div className="v4-scale">{trackMarks.map((mark,i)=><span key={i}>{mark!=null?fmt(mark,uiMode==='lots'?2:0):'—'}</span>)}</div>
          {uiMode==='lots'&&!lotsTrackEnabled&&<span className="v4-slider-hint" role="status">
            {affordable.valid?'Minimum volume exceeds available margin.':'Affordable range cannot be verified.'}
          </span>}
        </div>
        <div className="v4-translation">{translation()}</div>
      </div>
      <div className="v4-exits v4-block">
        <div className="v4-section-heading"><span>EXITS / PROTECTION</span><ChevronUp size={15}/></div>
        <ProtectionCard field="sl" active={hasSl} onToggle={()=>toggleProtection('sl')} unit={slUnit}
          onUnit={u=>changeExitUnit('sl',u)} plan={effective} market={market} account={account}
          lots={volume} sizingMode={uiMode} onPrice={price=>onTradePlanChange({sl:price,activeField:'sl',stage:'ready'})} onNotice={notice}/>
        <ProtectionCard field="tp" active={hasTp} onToggle={()=>toggleProtection('tp')} unit={tpUnit}
          onUnit={u=>changeExitUnit('tp',u)} plan={effective} market={market} account={account}
          lots={volume} sizingMode={uiMode} onPrice={price=>onTradePlanChange({tp:price,activeField:'tp',stage:'ready'})} onNotice={notice}/>
        <div className="v4-ratio-slab">
          <div><span>Risk / Reward</span><strong>{Number.isFinite(rr)?'1:'+fmt(rr):'—'}</strong></div>
          <div><span>Position volume</span><strong>{volume?volumeLabel:'—'}</strong></div>
        </div>
      </div>
      <div className="v4-block">
        <button type="button" className="v4-disclosure" aria-expanded={advanced} onClick={()=>setAdvanced(x=>!x)}>
          ADVANCED {advanced?<ChevronUp size={15}/>:<ChevronDown size={15}/>}
        </button>
        {advanced&&<div className="v4-advanced-content">
          {family==='pending'&&tradePlan&&<label>Time in force
            <select aria-label="Pending time in force" value={effective?.expiration||'GTC'}
              onChange={e=>onTradePlanChange({expiration:e.target.value,expirationAt:e.target.value==='SPECIFIED'?effective?.expirationAt:null,stage:'ready'})}>
              <option value="GTC">GTC</option><option value="TODAY">Today</option><option value="SPECIFIED">Custom</option>
            </select>
          </label>}
          {family==='pending'&&effective?.expiration==='SPECIFIED'&&<label>Expiry
            <input aria-label="Pending expiry" type="datetime-local"
              value={effective?.expirationAt||''} onChange={e=>onTradePlanChange({expirationAt:e.target.value,stage:'ready'})}/>
          </label>}
          <div><span>Effective leverage</span><strong>{Number.isFinite(effectiveLeverage(account,market))?fmt(effectiveLeverage(account,market),0)+'x':'—'}</strong></div>
          <div><span>Estimated risk incl. fees</span><strong>{money(risk,currency)}</strong></div>
        </div>}
      </div>
      {!exposureAllowed&&<div className="v4-notice" role="status">{exposureBlockReason}</div>}
      {!validMarket&&<div className="v4-notice" role="status">An executable quote is unavailable.</div>}
      {validMarket&&exposureAllowed&&!financialVerified&&<div className="v4-notice" role="status">{executionDisabledReason}</div>}
    </div>
    <div className="v4-execution-footer">
      <div className="v4-margin-summary">
        <div><span>Required margin</span><strong>{money(margin,currency)}</strong></div>
        <div><span>Free after</span><strong>{money(freeAfter,currency)}</strong></div>
      </div>
      <div className={pendingReview?'v4-trade-actions v4-pending-review-actions':'v4-trade-actions'}>
        {pendingReview?<>
          <button type="button" className="v4-pending-discard" disabled={localSubmitting||executionCommandPending}
            onClick={onCancelPlan} aria-label="Discard unplaced chart order">
            <span>Discard</span>
          </button>
          <button type="button" className={'v4-pending-place '+(reviewedSide==='sell'?'v4-sell':'v4-buy')}
            disabled={!canTrade} onClick={()=>place(reviewedSide)} aria-label={pendingActionName}>
            <span>{pendingActionName}</span>
            <strong>{volume?volumeLabel:'—'} @ {formatInstrumentPrice(
              effective?.pending&&effective?.orderType==='stop-limit'?effective?.limitPrice:effective?.entry,market)}</strong>
          </button>
        </>:<>
          <button type="button" className="v4-sell" disabled={!canTrade} onClick={()=>place('sell')}>
            <span>{family==='market'?'SELL':'SELL '+orderType.replace('-',' ').toUpperCase()}</span>
            <strong>{formatInstrumentPrice(family==='market'?market?.bid:effective?.entry,market)}</strong>
          </button>
          <button type="button" className="v4-buy" disabled={!canTrade} onClick={()=>place('buy')}>
            <span>{family==='market'?'BUY':'BUY '+orderType.replace('-',' ').toUpperCase()}</span>
            <strong>{formatInstrumentPrice(family==='market'?market?.ask:effective?.entry,market)}</strong>
          </button>
        </>}
      </div>
    </div>
  </section>;
}
