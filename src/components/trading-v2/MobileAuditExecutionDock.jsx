import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, X } from 'lucide-react';
import { formatInstrumentPrice } from '../../utils/instrumentFormatting.js';
import { normalizeVolumeToStep } from '../../utils/tradingCommandNormalization.js';
import { resolveV4PositionSizing } from '../../utils/v4ExecutionPrecision.js';
import { createDefaultTradePlan, validateTradePlanForExecution } from '../../utils/tradePlanExecution.js';
import { mobileOrderTypePatch, mobileProtectionPatch } from '../../utils/mobileAuditDraft.js';
import { v4ExitPriceFromInput, v4ExitValueFromPrice } from '../../utils/v4ProtectionPrecision.js';

const ORDER_TYPES = [['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop']];
const MODES = [['lots', 'Lots'], ['margin', 'Margin'], ['riskPercent', 'Risk %'], ['riskUSD', 'Risk amount']];
const isRisk = mode => mode === 'riskPercent' || mode === 'riskUSD';
const hasNumber = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const validPositive = value => hasNumber(value) && Number(value) > 0;
function money(value, currency = 'USD') {
  if (!hasNumber(value)) return '—';
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value)); }
  catch { return '—'; }
}
function fmtLots(value, market) {
  if (!validPositive(value)) return '—';
  const stepText = String(market?.volumeStep ?? '0.01');
  const decimals = Math.min(8, (stepText.split('.')[1] || '').length);
  return Number(value).toFixed(decimals);
}
function popTitle(field) {
  return field === 'sl' ? 'Stop loss' : field === 'tp' ? 'Take profit' : field === 'entry' ? 'Pending entry' : 'Position size';
}

/**
 * Audited presentation only: the existing MobileTraderShell owns the canonical
 * tradePlan and is solely responsible for account checks and order submission.
 * No action in this component directly calls an execution service.
 */
export default function MobileAuditExecutionDock({
  market, account, tradePlan, onStartPlan, onCancelPlan, onExecutePlan,
  onTradePlanChange, exposureAllowed, exposureBlockReason,
  commandPending = false,
}) {
  const [idleMode, setIdleMode] = useState('lots');
  const [idleAmount, setIdleAmount] = useState('0.01');
  const [idleOrderType, setIdleOrderType] = useState('market');
  const [openPanel, setOpenPanel] = useState(null);
  const [editorText, setEditorText] = useState('');
  const [localError, setLocalError] = useState('');
  const [exitUnit, setExitUnit] = useState('price');
  const dockRef = useRef(null);
  const rememberedAmounts = useRef({});
  const mode = tradePlan?.auditMode || (tradePlan?.editingOrderId ? 'lots' : idleMode);
  const amount = tradePlan?.auditValue ?? (tradePlan?.editingOrderId ? tradePlan.manualLots : idleAmount);
  const type = tradePlan?.orderType || idleOrderType;
  const direction = String(tradePlan?.side || '').toLowerCase();
  const reviewing = tradePlan?.stage === 'review';
  const editing = Boolean(tradePlan && !tradePlan.open);
  const preview = useMemo(() => editing
    ? resolveV4PositionSizing({ mode, amount, plan: tradePlan, account, instrument: market })
    : null, [mode, amount, tradePlan, account, market, editing]);
  const indicative = useMemo(() => !editing && !isRisk(mode)
    ? resolveV4PositionSizing({ mode, amount, plan: createDefaultTradePlan({ side:'buy', market, protection:'none' }), account, instrument:market })
    : null, [editing, mode, amount, market, account]);
  const planCheck = editing ? validateTradePlanForExecution(tradePlan, market) : null;
  const canReview = exposureAllowed && !commandPending && preview?.canExecute && planCheck?.valid;
  const canSubmit = canReview && reviewing;
  const quotePrice = (side) => formatInstrumentPrice(side === 'buy' ? market?.ask : market?.bid, market) || '—';
  const available = exposureAllowed && !commandPending && validPositive(market?.bid) && validPositive(market?.ask);
  const labels = { lots: 'Lots', margin: 'Margin', riskPercent: 'Risk %', riskUSD: 'Risk amount' };

  useEffect(() => {
    if (!openPanel) return undefined;
    const dismiss = event => { if (!dockRef.current?.contains(event.target)) setOpenPanel(null); };
    const escape = event => { if (event.key === 'Escape') setOpenPanel(null); };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [openPanel]);

  const invalidate = patch => {
    setLocalError('');
    onTradePlanChange({ ...patch, stage: 'planning', auditReviewRevision: (Number(tradePlan?.auditReviewRevision) || 0) + 1 });
  };
  const updateMode = nextMode => {
    if (nextMode === mode) { setOpenPanel(null); return; }
    rememberedAmounts.current[mode] = amount;
    const currentValue = rememberedAmounts.current[nextMode] ?? (nextMode === 'lots' ? fmtLots(preview?.lots || market?.minVolume || market?.volumeStep || 0.01, market)
      : nextMode === 'riskPercent' ? '0.50' : nextMode === 'margin' ? '100' : '50');
    if (editing) invalidate({ auditMode: nextMode, auditValue: currentValue });
    setIdleMode(nextMode); setIdleAmount(currentValue);
    setOpenPanel(null);
  };
  const updateAmount = value => {
    if (editing) invalidate({ auditValue: String(value) });
    setIdleMode(mode); setIdleAmount(String(value));
  };
  const changeAmountStep = directionStep => {
    const raw = Number(amount);
    const step = mode === 'lots' ? Number(market?.volumeStep) || 0.01 : mode === 'riskPercent' ? 0.1 : 1;
    if (!Number.isFinite(raw)) return;
    const next = raw + directionStep * step;
    if (mode === 'lots') {
      if (next <= 0) return;
      updateAmount(fmtLots(normalizeVolumeToStep(next, market, { rounding: 'nearest' }), market));
    } else if (next > 0) updateAmount(String(Number(next.toFixed(6))));
  };
  const selectOrderType = next => {
    if (next === type) { setOpenPanel(null); return; }
    if (editing) {
      const patch = mobileOrderTypePatch(tradePlan, next, market);
      if (!patch) { setLocalError('Finish this order edit before changing order type.'); return; }
      invalidate(patch);
    } else setIdleOrderType(next);
    setIdleOrderType(next);
    setOpenPanel(null);
  };
  const chooseSide = side => {
    setLocalError('');
    setOpenPanel(null);
    if (!available) return;
    if (!editing || direction !== side) {
      onStartPlan(side, type, {
        auditMode: mode, auditValue: String(amount),
        stage: 'planning', sl: null, tp: null,
      });
    } else if (!reviewing) {
      if (!canReview) { setLocalError(preview?.message || planCheck?.message || exposureBlockReason || 'Check the draft before review.'); return; }
      onTradePlanChange({ stage: 'review' });
    }
  };
  const openEditor = kind => {
    setLocalError('');
    setExitUnit('price');
    setEditorText(kind === 'size' ? String(amount) : (tradePlan?.[kind] == null ? '' : String(tradePlan[kind])));
    setOpenPanel(openPanel === kind ? null : kind);
  };
  const selectProtection = field => {
    if (!editing || commandPending) return;
    if (validPositive(tradePlan[field])) { openEditor(field); return; }
    const patch = mobileProtectionPatch(tradePlan, field, market);
    if (!patch) { setLocalError('Protection cannot be placed with the current instrument data.'); return; }
    invalidate(patch);
    setOpenPanel(null);
  };
  const selectExitUnit = unit => {
    const result = v4ExitValueFromPrice({ field: openPanel, unit, price: tradePlan?.[openPanel], plan: tradePlan, instrument: market, lots: preview?.lots, account });
    setExitUnit(unit);
    setEditorText(result?.valid && hasNumber(result.value) ? String(Number(Number(result.value).toFixed(8))) : '');
    setLocalError(result?.valid ? '' : result?.message || 'This unit requires verified sizing.');
  };
  const saveEditor = () => {
    if (openPanel === 'size') {
      if (!validPositive(editorText)) { setLocalError('Enter a positive amount.'); return; }
      updateAmount(editorText);
    } else if (['sl', 'tp', 'entry'].includes(openPanel)) {
      if (!editing) { setLocalError('Choose Buy or Sell first.'); return; }
      if (editorText !== '' && !validPositive(editorText)) { setLocalError('Enter a valid price.'); return; }
      if (['sl', 'tp'].includes(openPanel) && editorText !== '') {
        const result = v4ExitPriceFromInput({ field: openPanel, unit: exitUnit, amount: editorText, plan: tradePlan, instrument: market, lots: preview?.lots, account, sizingMode: mode });
        if (!result.valid) { setLocalError(result.message || 'Protection cannot be calculated.'); return; }
        invalidate({ [openPanel]: result.price });
      } else invalidate({ [openPanel]: editorText === '' ? null : Number(editorText) });
    }
    setOpenPanel(null);
  };
  const cancel = () => {
    if (commandPending) return;
    if (editing) onCancelPlan();
    setOpenPanel(null);
    setLocalError('');
  };
  const submit = () => {
    if (!canSubmit) return;
    setOpenPanel(null);
    onExecutePlan();
  };

  let helper;
  if (editing && !preview?.canExecute) {
    helper = isRisk(mode) && !validPositive(tradePlan?.sl)
      ? 'Set a stop loss to calculate size.'
      : preview?.message || 'Calculation unavailable';
  } else if (!editing) {
    const estimate = indicative?.notionalAccount != null ? money(indicative.notionalAccount, account?.currency) : indicative?.notionalQuote != null ? money(indicative.notionalQuote, market?.quoteCurrency) : null;
    helper = isRisk(mode) ? 'Choose a side and set SL to calculate size.' : indicative?.canExecute && estimate
      ? `${fmtLots(indicative.lots, market)} lots → ≈${estimate}${indicative.notionalAccountPercent == null ? '' : ` (${indicative.notionalAccountPercent.toFixed(2)}% balance)`}`
      : indicative?.message || 'Choose Buy or Sell to estimate exposure.';
  } else if (mode === 'lots') {
    const exposure = preview.notionalAccount != null ? money(preview.notionalAccount, account?.currency) :
      preview.notionalQuote != null ? `${money(preview.notionalQuote, market?.quoteCurrency)}` : 'Exposure unavailable';
    helper = `${fmtLots(preview.lots, market)} lots → ${exposure}${preview.notionalAccountPercent == null ? '' : ` (${preview.notionalAccountPercent.toFixed(2)}% balance)`}`;
  } else if (mode === 'margin') {
    helper = `${money(amount, account?.currency)} margin → ${fmtLots(preview.lots, market)} lots`;
  } else if (mode === 'riskPercent') {
    helper = `${amount}% equity → ${money(Number(account?.equity) * Number(amount) / 100, account?.currency)} risk · ${fmtLots(preview.lots, market)} lots`;
  } else {
    helper = `${money(amount, account?.currency)} risk → ${fmtLots(preview.lots, market)} lots`;
  }
  if (!exposureAllowed) helper = exposureBlockReason || 'Trading unavailable';

  const showInput = openPanel && ['size', 'entry', 'sl', 'tp'].includes(openPanel);
  return (
    <section ref={dockRef} data-acg-mobile-audit-dock className="relative z-50 mx-[6px] shrink-0 rounded-[8px] border border-white/[0.10] bg-[#101114] p-[8px] text-[#eeeef0]">
      {/* Row 1: order type and new-draft SL/TP controls */}
      <div className="flex h-[32px] min-w-0 items-center justify-between gap-2">
        <button type="button" disabled={commandPending} onClick={() => setOpenPanel(openPanel === 'order' ? null : 'order')} aria-label="Choose order type" aria-expanded={openPanel === 'order'} className="flex h-full min-w-[78px] items-center gap-1 rounded-[6px] px-2 text-left text-[12px] font-semibold text-[#f0f1f2]">
          {ORDER_TYPES.find(([id]) => id === type)?.[1] || type}<ChevronDown size={13}/>
        </button>
        <div className="flex h-full shrink-0 items-center gap-1">
          <button type="button" disabled={commandPending || !editing} onClick={() => selectProtection('sl')} aria-label="Set stop loss" title="Place on chart; tap again for precise editing" className="min-h-8 rounded-[6px] border border-white/[0.10] bg-white/[0.035] px-2 text-[12px] font-medium text-[#d8dce0] disabled:opacity-45">
            SL {validPositive(tradePlan?.sl) ? '✓' : '+'}
          </button>
          <button type="button" disabled={commandPending || !editing} onClick={() => selectProtection('tp')} aria-label="Set take profit" title="Place on chart; tap again for precise editing" className="min-h-8 rounded-[6px] border border-white/[0.10] bg-white/[0.035] px-2 text-[12px] font-medium text-[#d8dce0] disabled:opacity-45">
            TP {validPositive(tradePlan?.tp) ? '✓' : '+'}
          </button>
          {editing && <button type="button" disabled={commandPending} onClick={cancel} aria-label="Cancel draft" className="grid size-8 place-items-center text-[#aab0b7]"><X size={14}/></button>}
        </div>
      </div>
      {/* Row 2: derived meaning follows mode. It never claims missing values equal zero. */}
      <div title={helper} aria-live="polite" className="flex h-[20px] min-w-0 items-center justify-center overflow-hidden text-center text-[11px] font-medium tabular-nums text-[#b7bec6]">
        <span className="block w-full truncate">{localError || helper}</span>
      </div>
      {/* Row 3: direction, inline sizing and explicit review/confirmation. */}
      <div className="grid h-[48px] grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-[6px]">
        {reviewing ? (
          <>
            <button type="button" disabled={commandPending} onClick={cancel} className="rounded-[6px] border border-white/[0.10] bg-[#1b1c1f] text-[12px] font-semibold text-[#d7dce1]">Cancel</button>
            <button type="button" onClick={() => openEditor('size')} disabled={commandPending} className="min-w-0 overflow-hidden rounded-[6px] border border-white/[0.08] bg-[#090a0c] px-1 text-center">
              <span className="block truncate font-mono text-[13px] font-semibold tabular-nums">{fmtLots(preview?.lots, market)}</span>
              <span className="block text-[10px] text-[#a7afb8]">Lots · Edit</span>
            </button>
            <button type="button" disabled={!canSubmit} onClick={submit} className={`min-w-0 rounded-[6px] px-1 text-[11px] font-bold text-white disabled:opacity-40 ${direction === 'sell' ? 'bg-[#c83242]' : 'bg-[#195be1]'}`} aria-label={`Confirm ${direction} order`}>
              {commandPending ? 'Submitting…' : `PLACE ${direction.toUpperCase()}`}
            </button>
          </>
        ) : (
          <>
            <button type="button" disabled={!available} onClick={() => chooseSide('sell')} className={`flex min-w-0 flex-col items-center justify-center rounded-[6px] bg-[#c83242] px-1 text-white disabled:opacity-40 ${direction === 'sell' ? 'ring-1 ring-white/60' : ''}`} aria-label={direction === 'sell' ? 'Review sell draft' : 'Prepare sell draft'}>
              <span className="text-[10px] font-semibold tracking-[0.02em]">{direction === 'sell' ? 'REVIEW SELL' : 'SELL'}</span><strong title={quotePrice('sell')} className="max-w-full truncate font-mono text-[14px] font-semibold tabular-nums">{quotePrice('sell')}</strong>
            </button>
            <div className="grid min-w-0 grid-cols-[30px_minmax(0,1fr)_30px] items-center rounded-[6px] border border-white/[0.09] bg-[#090a0c]">
              <button type="button" disabled={commandPending} onClick={() => changeAmountStep(-1)} aria-label="Decrease sizing amount" className="mx-[2px] grid h-[40px] w-[26px] place-items-center rounded-[6px] border border-white/[0.12] bg-white/[0.07] text-[#e0e4e8] disabled:opacity-40"><Minus size={16}/></button>
              <div className="min-w-0 text-center">
                <button type="button" disabled={commandPending} onClick={() => openEditor('size')} aria-label="Edit position sizing" className="block h-[26px] w-full overflow-hidden text-center font-mono text-[14px] font-semibold tabular-nums"><span className="block truncate">{amount}</span></button>
                <button type="button" disabled={commandPending} onClick={() => setOpenPanel(openPanel === 'modes' ? null : 'modes')} aria-label="Choose sizing mode" aria-expanded={openPanel === 'modes'} className="flex h-[22px] w-full items-center justify-center gap-0.5 overflow-hidden text-[10px] text-[#abb3bb]"><span className="truncate">{labels[mode]}</span><ChevronDown size={10}/></button>
              </div>
              <button type="button" disabled={commandPending} onClick={() => changeAmountStep(1)} aria-label="Increase sizing amount" className="mx-[2px] grid h-[40px] w-[26px] place-items-center rounded-[6px] border border-white/[0.12] bg-white/[0.07] text-[#e0e4e8] disabled:opacity-40"><Plus size={16}/></button>
            </div>
            <button type="button" disabled={!available} onClick={() => chooseSide('buy')} className={`flex min-w-0 flex-col items-center justify-center rounded-[6px] bg-[#195be1] px-1 text-white disabled:opacity-40 ${direction === 'buy' ? 'ring-1 ring-white/60' : ''}`} aria-label={direction === 'buy' ? 'Review buy draft' : 'Prepare buy draft'}>
              <span className="text-[10px] font-semibold tracking-[0.02em]">{direction === 'buy' ? 'REVIEW BUY' : 'BUY'}</span><strong title={quotePrice('buy')} className="max-w-full truncate font-mono text-[14px] font-semibold tabular-nums">{quotePrice('buy')}</strong>
            </button>
          </>
        )}
      </div>
      {/* Absolute panels overlay chart, never alter the dock's measured height. */}
      {openPanel === 'order' && <div className="absolute bottom-full left-0 z-[90] mb-1 w-[174px] rounded-[8px] border border-white/[0.12] bg-[#17191d] p-1 shadow-xl" role="group" aria-label="Order types">
        {ORDER_TYPES.map(([id, label]) => <button type="button" key={id} className={`block min-h-9 w-full rounded-[6px] px-3 text-left text-[12px] ${type === id ? 'bg-[#e8eaeb] text-black' : 'text-[#d1d8de]'}`} onClick={() => selectOrderType(id)}>{label}</button>)}
        {editing && tradePlan?.pending && <button type="button" className="min-h-9 w-full border-t border-white/[0.08] px-3 text-left text-[12px] text-[#d1d8de]" onClick={() => openEditor('entry')}>Edit entry price</button>}
      </div>}
      {openPanel === 'modes' && <div className="absolute bottom-full left-1/3 z-[90] mb-1 w-[170px] rounded-[8px] border border-white/[0.12] bg-[#17191d] p-1 shadow-xl" role="group" aria-label="Sizing modes">
        {MODES.map(([id, label]) => <button type="button" key={id} className={`block min-h-9 w-full rounded-[6px] px-3 text-left text-[12px] ${mode === id ? 'bg-[#e8eaeb] text-black' : 'text-[#d1d8de]'}`} onClick={() => updateMode(id)}>{label}</button>)}
      </div>}
      {showInput && <div className="absolute bottom-full left-1/2 z-[90] mb-1 max-h-[max(120px,calc(100dvh-180px))] w-[min(300px,calc(100vw-24px))] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[8px] border border-white/[0.12] bg-[#17191d] p-3" role="dialog" aria-label={popTitle(openPanel)}>
        <div className="mb-2 flex items-center justify-between text-[12px] font-semibold"><span>{popTitle(openPanel)}</span><button type="button" onClick={() => setOpenPanel(null)} aria-label="Close editor"><X size={15}/></button></div>
        {openPanel === 'size' && <button type="button" className="mb-2 flex min-h-9 w-full items-center justify-between rounded-[6px] border border-white/[0.08] bg-[#0e1012] px-2 text-[12px]" onClick={() => setOpenPanel('modes')}>
          {labels[mode]}<ChevronDown size={13}/>
        </button>}
        {['sl', 'tp'].includes(openPanel) && <>
          <p className="mb-2 text-[11px] text-[#a1a1aa]">Drag this level on the chart, or tap the value to type.</p>
          <select aria-label="Protection unit" value={exitUnit} onChange={event => selectExitUnit(event.target.value)} className="mb-2 h-9 w-full rounded-[6px] border border-white/10 bg-[#202023] px-2 text-[12px]">
            {[['price', 'Price'], ['ticks', 'Ticks'], ['percent', '% Price'], ['usd', `${openPanel === 'sl' ? 'Risk' : 'Profit'} ${account?.currency || 'USD'}`], ['balance', '% Balance']].map(([unit, label]) => <option key={unit} value={unit} disabled={openPanel === 'sl' && isRisk(mode) && ['usd', 'balance'].includes(unit)}>{label}</option>)}
          </select>
        </>}
        <input aria-label="Edit numeric value" type="text" inputMode="decimal" enterKeyHint="done" value={editorText} placeholder={openPanel === 'size' ? 'Tap to enter amount' : 'Price (blank to remove)'} onChange={event => setEditorText(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') saveEditor(); }} className="h-10 w-full rounded-[6px] border border-white/[0.12] bg-black px-2 font-mono text-[16px] tabular-nums outline-none focus:border-white/40"/>
        {localError && <p className="mt-1 text-[11px] text-[#eb8087]">{localError}</p>}
        <button type="button" onClick={saveEditor} className="mt-2 flex min-h-9 w-full items-center justify-center gap-1 rounded-[6px] bg-[#e4e8ea] text-[12px] font-semibold text-black"><Check size={14}/>Apply</button>
      </div>}
    </section>
  );
}
