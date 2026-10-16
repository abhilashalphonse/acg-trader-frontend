import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { estimateLossAtStopWithCosts, estimatePositionPnlAtPrice, riskSizingSupported } from '../../utils/tradingRisk.js';

// This is a view of the desktop chart controller, never a second order engine.
export default function MobileAuditManageDock({ management, market, account }) {
  const dockRef = useRef(null);
  const commandLock = useRef(false);
  const [menu, setMenu] = useState(false);
  const [intent, setIntent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const { owner, objectType, edit, saving, error, awaiting, disabled, actions } = management;
  useEffect(() => { setMenu(false); setIntent(null); setFailure(''); setBusy(false); }, [owner.id, objectType]);
  const pending = objectType === 'pending';
  const locked = busy || saving || disabled;
  useEffect(() => {
    const outside = event => { if (!dockRef.current?.contains(event.target)) setMenu(false); };
    const escape = event => {
      if (event.key !== 'Escape' || locked) return;
      setMenu(false); setIntent(null);
      if (edit) actions.discard();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', outside);document.removeEventListener('keydown', escape);};
  }, [locked, edit, actions]);
  const price = value => value == null ? '—' : formatInstrumentPrice(value, market);
  const field = edit?.kind;
  const fill = pending && String(owner.orderType).toLowerCase().replaceAll('_','-') === 'stop-limit' ? owner.limitPrice : owner.entry ?? owner.entryPrice;
  const estimatePlan = {...owner, side:String(owner.side).toLowerCase(), entry:fill, sl:edit?.proposedPrice};
  const lossSide = field === 'sl' && (estimatePlan.side === 'buy' ? Number(edit?.proposedPrice) < Number(fill) : Number(edit?.proposedPrice) > Number(fill));
  const outcome = edit && ['sl','tp'].includes(field) && riskSizingSupported(market, account?.currency)
    ? lossSide ? estimateLossAtStopWithCosts(estimatePlan, Number(owner.volume ?? owner.lots), market, account)
      : estimatePositionPnlAtPrice({...owner,entry:fill}, edit.proposedPrice, market) : null;
  const outcomeLabel = outcome != null && Number.isFinite(outcome) ? ` · ${lossSide ? 'Risk' : 'Est.'} ${new Intl.NumberFormat('en-US',{style:'currency',currency:account?.currency || 'USD',maximumFractionDigits:2}).format(outcome)}` : '';
  const executeIntent = async () => {
    if (locked || commandLock.current) return;
    commandLock.current = true;
    setBusy(true); setFailure('');
    try {
      const result = await actions.command(intent);
      if (result === false || result == null) setFailure('Change was not accepted. Try again.');
      else setIntent(null);
    } catch (cause) { setFailure(cause?.message || 'Change was not accepted.'); }
    finally { commandLock.current = false; setBusy(false); }
  };
  const button = 'min-h-9 rounded-[6px] border border-white/10 bg-white/[0.035] px-2 text-[11px] font-medium disabled:opacity-40';
  return <section ref={dockRef} data-acg-mobile-manage-dock className="relative mx-[6px] shrink-0 rounded-[8px] border border-white/10 bg-[#101114] p-2 text-[#eeeef0]">
    <div className="flex h-8 items-center justify-between gap-2 text-[12px]">
      <span className="min-w-0 truncate font-semibold">{market.displaySymbol || owner.symbol} <span className="ml-1 text-[10px] text-[#aab3bc]">{owner.side} {pending ? String(owner.orderType).replaceAll('-', ' ').toUpperCase() : ''} · {owner.volume ?? owner.lots ?? owner.manualLots}</span></span>
      <button type="button" disabled={locked} onClick={actions.done} aria-label="Finish managing trade" className="grid size-8 shrink-0 place-items-center text-[#aab3bc]"><X size={14}/></button>
    </div>
    <div aria-live="polite" title={failure || error} className="flex h-5 items-center justify-center overflow-hidden text-[11px] tabular-nums text-[#b7bec6]">
      <span className="truncate">{failure || error || (awaiting ? 'Waiting for account confirmation…' : intent ? `${intent.startsWith('close') ? intent === 'close' ? 'Close position' : `Close ${intent.slice(5)}% of position` : intent === 'cancel' ? 'Cancel pending order' : `Remove ${intent.toUpperCase()}`}?` : edit ? `${field === 'limitPrice' ? 'Limit' : field.toUpperCase()} ${price(edit.confirmedPrice ?? owner[field])} → ${price(edit.proposedPrice)}${outcomeLabel}` : `Entry ${price(owner.entry ?? owner.entryPrice)} · Tap SL / TP to edit`)}</span>
    </div>
    <div className="flex h-12 items-stretch gap-[6px]">
      {intent ? <>
        <button className={`${button} flex-1`} disabled={locked} onClick={() => setIntent(null)}>Back</button>
        <button className={`${button} flex-1 text-[#f27883]`} disabled={locked} onClick={executeIntent}>{busy ? 'Submitting…' : 'Confirm'}</button>
      </> : edit ? <>
        <button className={`${button} flex-1`} disabled={locked} onClick={actions.discard}>Discard</button>
        <button className="flex-1 rounded-[6px] bg-[#e8eaeb] px-2 text-[12px] font-semibold text-black disabled:opacity-40" disabled={locked} onClick={actions.confirm}>{saving ? 'Confirming…' : `Apply ${field === 'limitPrice' ? 'limit' : field.toUpperCase()}`}</button>
      </> : <>
        {pending && <button className={`${button} flex-1`} disabled={locked} onClick={() => actions.edit('entry')}>Entry</button>}
        {['sl', 'tp'].map(kind => <button key={kind} className={`${button} flex-1`} disabled={locked} onClick={() => actions.edit(kind)}>{kind.toUpperCase()} {Number(owner[kind]) > 0 ? '✓' : '+'}</button>)}
        <button className={`${button} w-10 px-0`} disabled={locked} onClick={() => setMenu(value => !value)} aria-label="Trade actions" aria-expanded={menu}><MoreHorizontal size={16} className="mx-auto"/></button>
      </>}
    </div>
    {menu && !edit && !intent && <div role="group" aria-label="Manage trade actions" className="absolute bottom-full right-0 z-50 mb-1 max-h-[min(320px,calc(100dvh-180px))] w-48 overflow-y-auto rounded-[8px] border border-white/10 bg-[#17191d] p-1 shadow-xl">
      {[...(pending && String(owner.orderType).replaceAll('_','-').toLowerCase() === 'stop-limit' ? [['limitPrice', 'Edit limit price']] : []), ...(!pending ? [25,50,75].map(percent => [`close${percent}`, `Close ${percent}%`]) : []), ...['sl','tp'].filter(kind => Number(owner[kind]) > 0).map(kind => [kind, `Remove ${kind.toUpperCase()}`]), [pending ? 'cancel' : 'close', pending ? 'Cancel order' : 'Close position']].map(([kind,label]) => <button key={kind} type="button" className="min-h-10 w-full rounded-[6px] px-3 text-left text-[12px] hover:bg-white/5" onClick={() => {setMenu(false); if (kind === 'limitPrice') actions.edit(kind); else setIntent(kind);}}>{label}</button>)}
      <button type="button" className="min-h-9 w-full px-3 text-left text-[11px] text-[#9aa4ae]" onClick={() => setMenu(false)}>Dismiss</button>
    </div>}
  </section>;
}
