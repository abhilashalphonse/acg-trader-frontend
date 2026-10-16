import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import V4ChartOrderLayer from './V4ChartOrderLayer.jsx';
import { projectV4AcceptedLevels } from './chartOrderModel.js';
import { formatInstrumentPrice } from '../../../utils/instrumentFormatting.js';
import { defaultPlannerStopDistance } from '../../../utils/tradingRisk.js';
import { normalizeProtectionPrice } from '../../../utils/tradingCommandNormalization.js';

// Runs behind desktop V4 or the separately opted-in mobile audit gate. Financial state is provided by
// the existing store; drafts exist locally and never optimistically mutate it.
export default function V4FullTerminalOrders({
  account, symbol, instrument, positions = [], pendingOrders = [],
  mobile = false, mobileTradeSelection, onMobileManagementChange, managementDisabled = false,
  coordinateApi, height, positionProtectionDraft, pendingOrderDraft = null,
  onPendingOrderDraftChange, onCancelPendingOrderDraft, isNewOrderPlanning = false,
  renderPositionEntries = null, hoveredPositionId = null,
  onUpdatePosition, onRemovePositionProtection, onMovePending,
  onRequestPositionProtection, onCancelPositionProtection,
  onPositionProtectionDraftChange,
  onSelectPosition, onSelectPending, onClosePosition, onCancelPending,
}) {
  const [mobileClosing, setMobileClosing] = useState(null);
  const [mobileOwner, setMobileOwner] = useState(null);
  const mobileActions = useRef({});
  const accountId = account?.id == null ? null : String(account.id);
  const contextRef = useRef(null);
  contextRef.current = `${accountId}:${symbol}`;
  const [edit, setEdit] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [awaiting, setAwaiting] = useState(null);
  const [removing, setRemoving] = useState(null);
  const removalRequest = useRef(null);
  const accepted = useMemo(() => projectV4AcceptedLevels({
    accountId, symbol, positions, pendingOrders,
  }), [accountId, symbol, positions, pendingOrders]);

  // Cancel any previous owner when the user switches account or instrument.
  useEffect(() => {
    setMobileClosing(null);
    setMobileOwner(null);
    setEdit(null);
    setAwaiting(null);
    setRemoving(null);
    removalRequest.current = null;
    setSaving(false);
    setError('');
  }, [accountId, symbol]);

  // Clicking × is the removal command. Never optimistically erase accepted
  // prices: clear the chip only when the authoritative account snapshot does.
  useEffect(() => {
    if (!removing) return;
    const stillAccepted = accepted.some(level => level.id === removing.id);
    if (!stillAccepted) {
      removalRequest.current = null;
      setRemoving(null);
      setSaving(false);
      setError('');
    }
  }, [accepted, removing]);
  useEffect(() => {
    if (!removing?.awaitingSnapshot) return undefined;
    const request = removing;
    const timeout = window.setTimeout(() => {
      if (removalRequest.current !== request.token) return;
      removalRequest.current = null;
      setRemoving(null);
      setSaving(false);
      setError('The account has not confirmed TP/SL removal. The accepted level is unchanged; refresh before retrying.');
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [removing]);

  const hadParentDraft = useRef(false);
  useEffect(() => {
    const exists = Boolean(positionProtectionDraft);
    // Panel Confirm/Discard clears the parent's authoritative draft. Also
    // clear a chart-originated local preview; no orphaned dotted line remains.
    if (!exists && hadParentDraft.current && edit?.objectType === 'position' && !awaiting) {
      setEdit(null);
      setError('');
    }
    hadParentDraft.current = exists;
  }, [positionProtectionDraft, edit?.objectType, awaiting]);

  const priorPendingDraft = useRef(null);
  useEffect(()=>{
    const previous=priorPendingDraft.current;
    const now=pendingOrderDraft;
    if(previous && !now && edit?.objectType==='pending' && !awaiting) {
      setEdit(null);setError('');
    }
    if(previous && now && String(previous.objectId)!==String(now.objectId) &&
      edit?.objectType==='pending')setEdit(null);
    priorPendingDraft.current=now;
  },[pendingOrderDraft, edit?.objectType, awaiting]);

  const parentEdit = useMemo(() => {
    const parent = positionProtectionDraft;
    if (!parent || (mobile && parent.accountId != null && String(parent.accountId) !== accountId) || !['tp', 'sl'].includes(parent.activeField) ||
        String(parent.symbol).toUpperCase() !== String(symbol).toUpperCase() ||
        !Number.isFinite(Number(parent[parent.activeField])) ||
        Number(parent[parent.activeField]) <= 0 || !accountId) return null;
    return {
      accountId, objectType: 'position', objectId: String(parent.positionId),
      kind: parent.activeField, proposedPrice: Number(parent[parent.activeField]),
    };
  }, [positionProtectionDraft, symbol, accountId, mobile]);
  const activeEdit = isNewOrderPlanning ? null : edit || parentEdit || pendingOrderDraft;

  // Acknowledge only the matching server/store snapshot. Never paint a local
  // confirmed line while the backend still reports the original price.
  useEffect(() => {
    if (!awaiting) return;
    const actual = accepted.find(level => level.accountId === awaiting.accountId &&
      level.objectId === awaiting.objectId && level.objectType === awaiting.objectType &&
      level.kind === awaiting.kind);
    const tick = Number(instrument?.tickSize);
    const tolerance = Number.isFinite(tick) && tick > 0 ? Math.max(1e-8, tick * 0.51) : 1e-8;
    const limitConfirmed = awaiting.expectedLimitPrice == null || accepted.some(level =>
      level.accountId === awaiting.accountId && level.objectId === awaiting.objectId &&
      level.objectType === 'pending' && level.kind === 'limitPrice' &&
      Math.abs(level.price - awaiting.expectedLimitPrice) <= tolerance);
    if (actual && Math.abs(actual.price - awaiting.price) <= tolerance && limitConfirmed) {
      setAwaiting(null);
      setEdit(null);
      setSaving(false);
      setError('');
      onCancelPositionProtection?.();
      if(awaiting.objectType==='pending')onCancelPendingOrderDraft?.();
    }
  }, [accepted, awaiting, onCancelPositionProtection, instrument?.tickSize]);
  useEffect(() => {
    if (!awaiting) return undefined;
    const timer = window.setTimeout(() => {
      setAwaiting(null);
      setSaving(false);
      setError('The server has not confirmed the new level. The accepted price is unchanged; refresh the account before retrying.');
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [awaiting]);

  useEffect(() => {
    if (!isNewOrderPlanning) return;
    setEdit(null);
    setAwaiting(null);
    setSaving(false);
    setError('');
  }, [isNewOrderPlanning]);

  const begin = useCallback(value => {
    if (!value || saving || isNewOrderPlanning || (mobile && managementDisabled)) return;
    if (mobile) setMobileOwner({objectType:value.objectType, objectId:String(value.objectId), context:contextRef.current});
    // Switching levels replaces every draft visual from the previous edit.
    setEdit({ ...value, proposedPrice: value.proposedPrice ?? value.confirmedPrice });
    setError('');
    setAwaiting(null);
    if (parentEdit &&
        (value.objectType !== 'position' || String(parentEdit.objectId)!==String(value.objectId) || parentEdit.kind!==value.kind)) {
      onCancelPositionProtection?.();
    }
    if(value.objectType==='pending'){
      onSelectPending?.(value.objectId);
      onPendingOrderDraftChange?.({...value});
    }
    if (value.objectType === 'position' && ['tp','sl'].includes(value.kind)) {
      // Selecting/draging a chart protection switches the very same sidebar
      // into Manage Position and creates a shared position draft.
      onRequestPositionProtection?.(value.objectId,value.kind,value.proposedPrice);
    }
  }, [parentEdit, onCancelPositionProtection, onRequestPositionProtection, onPendingOrderDraftChange, onSelectPending, saving, isNewOrderPlanning, mobile, managementDisabled]);

  const changeEdit = useCallback(value => {
    setEdit(value);
    if(value?.objectType==='pending')onPendingOrderDraftChange?.({...value});
    if (value?.objectType === 'position' && ['sl','tp'].includes(value.kind) &&
        Number.isFinite(Number(value.proposedPrice))) {
      onPositionProtectionDraftChange?.({
        [value.kind]:Number(value.proposedPrice),activeField:value.kind,stage:'draft',
      });
    }
  }, [onPositionProtectionDraftChange, onPendingOrderDraftChange]);

  const discard = () => {
    if (saving) return;
    setEdit(null);
    setAwaiting(null);
    setError('');
    onCancelPositionProtection?.();
    onCancelPendingOrderDraft?.();
  };

  const beginProtection = (id, kind, objectType='position') => {
    if (saving || isNewOrderPlanning || (mobile && managementDisabled) || !['tp','sl'].includes(kind)) return;
    if (mobile) setMobileOwner({objectType, objectId:String(id), context:contextRef.current});
    if (objectType === 'pending') {
      const order = pendingOrders.find(item => String(item.id) === String(id) &&
        String(item.symbol).toUpperCase() === String(symbol).toUpperCase() &&
        ['PENDING','ACCEPTED','TRIGGERED'].includes(String(item.status || 'PENDING').toUpperCase()));
      if (!order || accepted.some(level => level.objectType==='pending' &&
        level.objectId===String(id) && level.kind===kind)) return;
      // Match the existing trade planner's protective distance and rounding.
      // A Stop-Limit's execution boundary, not its trigger, is the risk basis.
      const fillReference = String(order.orderType).toLowerCase().replaceAll('_','-') === 'stop-limit'
        ? Number(order.limitPrice) : Number(order.entry);
      const distance=defaultPlannerStopDistance(instrument,fillReference);
      const side=String(order.side).toUpperCase();
      if (!(fillReference>0) || !(distance>0) || !['BUY','SELL'].includes(side)) return;
      const direction = (side==='BUY' ? 1 : -1) * (kind==='tp' ? 1 : -1);
      const raw = fillReference + direction * distance * (kind==='tp' ? 2 : 1);
      const proposedPrice=normalizeProtectionPrice(raw,instrument,side,kind);
      if (!(Number(proposedPrice)>0)) return;
      const pendingDraft={accountId,objectType:'pending',objectId:String(id),kind,proposedPrice};
      setEdit(pendingDraft);
      onSelectPending?.(id);
      onPendingOrderDraftChange?.(pendingDraft);
      setAwaiting(null);
      setError('');
      onCancelPositionProtection?.();
      return;
    }
    discard();
    onRequestPositionProtection?.(id, kind);
  };

  const confirm = async draft => {
    if (!draft || saving || !accountId || isNewOrderPlanning || (mobile && managementDisabled)) return;
    const objectType = draft.objectType;
    const objectId = String(draft.objectId || '');
    const kind = draft.kind;
    const price = Number(draft.proposedPrice);
    if (draft.accountId !== accountId || !Number.isFinite(price) || price <= 0 ||
        !objectId || !['sl','tp','entry','limitPrice'].includes(kind)) {
      setError('Invalid chart modification. Discard and try again.');
      return;
    }
    const owner = objectType === 'position'
      ? positions.find(item => String(item.id) === objectId && item.symbol === symbol)
      : pendingOrders.find(item => String(item.id) === objectId && item.symbol === symbol);
    if (!owner || (objectType === 'position' && kind === 'entry')) {
      setError('This position or pending order is no longer available.');
      return;
    }
    if (kind === 'limitPrice' && (objectType !== 'pending' ||
        String(owner.orderType || '').toLowerCase().replaceAll('_','-') !== 'stop-limit')) {
      setError('Only placed Stop-Limit orders have a separate limit boundary.');
      return;
    }
    const original = accepted.find(level => level.objectType === objectType && level.objectId === objectId && level.kind === kind);
    const tick = Number(instrument?.tickSize);
    const halfTick = Number.isFinite(tick) && tick > 0 ? tick / 2 : 1e-8;
    if (original && Math.abs(original.price - price) < halfTick) {
      setError('Move the proposed level at least one tick before confirming.');
      return;
    }
    const commandContext = contextRef.current;
    setSaving(true);
    setError('');
    try {
      const applied = objectType === 'position'
        ? await onUpdatePosition?.(objectId, { [kind]: price })
        : await onMovePending?.(objectId, price, kind);
      if (mobile && contextRef.current !== commandContext) return;
      if (applied === false || applied == null) {
        setError('Modification was not accepted. Review the price or Discard.');
        setSaving(false);
        return;
      }
      // The backend/store must confirm price before the dotted preview clears.
      const acceptedLimit=accepted.find(level=>level.objectType==='pending' &&
        level.objectId===objectId && level.kind==='limitPrice');
      const expectedLimitPrice = kind==='entry' &&
        String(owner.orderType || '').toLowerCase().replaceAll('_','-')==='stop-limit' &&
        acceptedLimit && original ? Number((acceptedLimit.price+price-original.price).toPrecision(12)) : null;
      setAwaiting({ accountId, objectType, objectId, kind, price, expectedLimitPrice });
    } catch (cause) {
      if (mobile && contextRef.current !== commandContext) return;
      setError(cause?.message || 'Unable to confirm the chart modification.');
      setSaving(false);
    }
  };

  const remove = async action => {
    if (!action || saving || removalRequest.current || isNewOrderPlanning || (mobile && managementDisabled) ||
        action.accountId !== accountId || !['sl','tp'].includes(action.kind) ||
        !['position','pending'].includes(action.objectType)) return;
    // Reject stale or fabricated level targets: only an accepted level owned by
    // the active chart account is eligible for one-click removal.
    const level = accepted.find(item => item.accountId === accountId &&
      item.objectType === action.objectType && item.objectId === String(action.objectId) &&
      item.kind === action.kind);
    if (!level) return;
    const token = {};
    removalRequest.current = token; // synchronous guard against double-clicks
    setRemoving({ id: level.id, token, awaitingSnapshot: false });
    setSaving(true);
    setError('');
    try {
      const result = action.objectType === 'position'
        ? await onRemovePositionProtection?.(action.objectId, action.kind)
        : await onMovePending?.(action.objectId, null, action.kind);
      if (removalRequest.current !== token) return; // account may have changed
      if (result === false || result == null) {
        removalRequest.current = null;
        setRemoving(null);
        setSaving(false);
        setError('Removal was not accepted; the original level remains.');
      } else {
        // A successful HTTP response is not sufficient confirmation. Only the
        // incoming account snapshot may remove the accepted chart level.
        setRemoving({ id: level.id, token, awaitingSnapshot: true });
        return true;
      }
    } catch (cause) {
      if (removalRequest.current !== token) return;
      removalRequest.current = null;
      setRemoving(null);
      setSaving(false);
      setError(cause?.message || 'Could not remove the protection.');
    }
  };

  useEffect(() => {
    if (!mobile || !edit || accepted.some(level => level.objectType === edit.objectType && level.objectId === String(edit.objectId) && level.kind === 'entry')) return;
    setEdit(null); setAwaiting(null); setSaving(false); setError('');
    setMobileOwner(null);
  }, [mobile, edit, accepted]);

  useEffect(() => {
    if (!mobileClosing) return undefined;
    const actual = accepted.find(level => level.objectType === mobileClosing.objectType && level.objectId === mobileClosing.objectId && level.kind === 'entry');
    if (!actual || (mobileClosing.percentage < 100 && Number(actual.volume) < mobileClosing.originalVolume)) {
      setMobileClosing(null); setSaving(false); if (!actual) setMobileOwner(null); setError('');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setMobileClosing(null); setSaving(false);
      setError('Account confirmation is delayed. Refresh before retrying.');
    },12000);
    return () => window.clearTimeout(timer);
  }, [mobileClosing, accepted]);

  const chartEditActions = !isNewOrderPlanning && activeEdit?.objectType === 'position'
    ? { positionId: activeEdit.objectId, kind: activeEdit.kind, saving,
        onConfirm: () => confirm(activeEdit), onDiscard: discard }
    : null;

  // Publish a small view model to the existing mobile dock. Stable proxies
  // use the latest handlers without triggering render/effect feedback loops.
  const selectMobile = (objectType, objectId) => {
    if (saving || isNewOrderPlanning) return;
    discard();
    setMobileOwner({objectType, objectId:String(objectId), context:contextRef.current});
    if (objectType === 'position') onSelectPosition?.(objectId);
    else onSelectPending?.(objectId);
  };
  useEffect(() => {
    if (mobile && mobileTradeSelection?.id != null) setMobileOwner({objectType:mobileTradeSelection.objectType,objectId:String(mobileTradeSelection.id), context:contextRef.current});
  }, [mobile, mobileTradeSelection]);
  const currentOwner = mobileOwner?.context === contextRef.current ? mobileOwner : null;
  const selectedType = currentOwner?.objectType || parentEdit?.objectType;
  const selectedId = currentOwner?.objectId || parentEdit?.objectId;
  const selectedOwner = (selectedType === 'pending' ? pendingOrders : positions).find(owner =>
    String(owner.id) === String(selectedId) && String(owner.symbol).toUpperCase() === String(symbol).toUpperCase());
  mobileActions.current = {
    done: () => { if (saving) return; discard(); setMobileOwner(null); },
    discard,
    confirm: () => confirm(activeEdit),
    edit: kind => {
      if (!selectedOwner || saving || managementDisabled) return;
      const level = accepted.find(item => item.objectType === selectedType && item.objectId === String(selectedOwner.id) && item.kind === kind);
      if (level) begin({...level, levelId:level.id, confirmedPrice:level.price, proposedPrice:level.price});
      else beginProtection(selectedOwner.id, kind, selectedType);
    },
    command: async kind => {
      if (!selectedOwner || saving || managementDisabled) return false;
      if (['close','close25','close50','close75','cancel'].includes(kind)) {
        const percentage = kind === 'close' ? 100 : Number(kind.slice(5));
        const context = contextRef.current;
        setSaving(true); setError('');
        try {
          const result = kind.startsWith('close') ? await onClosePosition?.(selectedOwner.id,percentage) : await onCancelPending?.(selectedOwner.id);
          if (contextRef.current !== context) return false;
          if (result === false || result == null) {setSaving(false); return false;}
          setMobileClosing({objectType:selectedType,objectId:String(selectedOwner.id),percentage,originalVolume:Number(selectedOwner.volume ?? selectedOwner.lots)});
          return true;
        } catch (cause) {
          if (contextRef.current === context) {setSaving(false);setError(cause?.message || 'Change was not accepted.');}
          return false;
        }
      }
      const level = accepted.find(item => item.objectType === selectedType && item.objectId === String(selectedOwner.id) && item.kind === kind);
      if (level) return remove({...level});
      return false;
    },
  };
  const stableMobileActions = useMemo(() => Object.fromEntries(['done','discard','confirm','edit','command'].map(key =>
    [key, (...args) => mobileActions.current[key](...args)])), []);
  useEffect(() => {
    if (!mobile || !onMobileManagementChange) return;
    onMobileManagementChange(!isNewOrderPlanning && selectedOwner ? {
      owner:selectedOwner, objectType:selectedType, edit:activeEdit, saving,
      error, awaiting:Boolean(awaiting || mobileClosing || removing?.awaitingSnapshot), disabled:managementDisabled, actions:stableMobileActions,
    } : null);
  }, [mobile, onMobileManagementChange, isNewOrderPlanning, selectedOwner, selectedType, activeEdit, saving, error, awaiting, mobileClosing, removing, managementDisabled, stableMobileActions]);
  useEffect(() => {
    if (isNewOrderPlanning) setMobileOwner(null);
  }, [isNewOrderPlanning]);

  return <>
    {!mobile && renderPositionEntries?.(chartEditActions, beginProtection)}
    <V4ChartOrderLayer mobile={mobile} selectedOwner={mobileOwner} accountId={accountId} symbol={symbol}
      positions={positions} pendingOrders={pendingOrders}
      coordinateApi={coordinateApi} height={height}
      formatPrice={value => formatInstrumentPrice(value, instrument)}
      formatVolume={value => Number(value).toFixed(2) + ' lots'}
      formatPnl={value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) + ' ' + (account?.currency || 'USD') : '—'}
      edit={activeEdit} saving={saving} removingLevelId={removing?.id || null} hoveredPositionId={hoveredPositionId}
      hidePositionEntries={!mobile} readOnly={isNewOrderPlanning || (mobile && managementDisabled)}
      instrument={instrument} accountCurrency={account?.currency || 'USD'}
      onBeginEdit={isNewOrderPlanning ? null : begin} onChangeEdit={isNewOrderPlanning ? null : changeEdit}
      onSaveEdit={isNewOrderPlanning ? null : confirm} onCancelEdit={isNewOrderPlanning ? null : discard}
      onAddProtection={isNewOrderPlanning ? null : beginProtection}
      onRemoveProtection={isNewOrderPlanning ? null : remove}
      onSelectPosition={isNewOrderPlanning ? null : mobile ? id => selectMobile('position', id) : onSelectPosition}
      onSelectPending={isNewOrderPlanning ? null : mobile ? id => selectMobile('pending', id) : onSelectPending}
      onClosePosition={isNewOrderPlanning ? null : onClosePosition}
      onCancelPending={isNewOrderPlanning ? null : onCancelPending}/>
    {!mobile && !isNewOrderPlanning && error && <div role="alert" data-v4-chart-error
      className="pointer-events-auto absolute bottom-12 right-[148px] z-[70] max-w-[360px] rounded border border-[#a34556] bg-[#221116]/95 p-2 text-[11px] text-white">
      {error}
      <button type="button" className="ml-3 underline" onClick={discard}>Discard</button>
    </div>}
    {!mobile && !isNewOrderPlanning && awaiting && <div role="status" className="pointer-events-none absolute bottom-3 right-[148px] z-[70] rounded bg-[#15191e]/95 px-2 py-1 text-[10px] text-white">
      Waiting for confirmed server price…
    </div>}
  </>;
}
