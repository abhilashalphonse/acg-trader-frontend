import { normalizePriceToTick } from './tradingCommandNormalization.js';

export const mobileSizingPreferenceKey = (accountId, symbol) => `acg-mobile-v4-sizing:${accountId || 'none'}:${symbol || 'none'}`;
export function readMobileSizingPreference(storage, key, minimum = 0.01) {
  const fallback = {mode:'lots',amount:String(minimum),orderType:'market',baseLots:null};
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null');
    if (!value || !['lots','margin','riskPercent','riskUSD'].includes(value.mode) ||
      !['market','limit','stop'].includes(value.orderType) || !(Number(value.amount)>0)) return fallback;
    return {mode:value.mode,amount:String(value.amount),orderType:value.orderType,baseLots:Number(value.baseLots)>0?Number(value.baseLots):null};
  } catch {return fallback;}
}
export function mobilePreciseChartEdit(edit, value, instrument) {
  if (!edit || !['sl','tp','entry','limitPrice'].includes(edit.kind) ||
      (edit.objectType === 'position' && !['sl','tp'].includes(edit.kind)) ||
      value == null || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value)<=0) return null;
  const proposedPrice = normalizePriceToTick(Number(value), instrument);
  return Number(proposedPrice)>0 ? {...edit,proposedPrice,precisionRequested:false} : null;
}
