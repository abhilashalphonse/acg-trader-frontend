import { useEffect } from 'react';

function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || target.isContentEditable;
}

export default function useTradingHotkeys({
  enabled = true,
  onBuy = () => {},
  onSell = () => {},
  onFullscreen = () => {},
  onCancel = () => {},
  onCloseLatest = () => {},
  onCloseAll = () => {},
  onLotsDelta = () => {},
  onTimeframe = () => {},
}) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const handler = event => {
      if (isTypingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.repeat) return;
      const key = event.key;
      const lower = key.toLowerCase();

      if (lower === 'b' && !event.shiftKey) { event.preventDefault(); onBuy(); return; }
      if (lower === 's' && !event.shiftKey) { event.preventDefault(); onSell(); return; }
      if (lower === 'f') { event.preventDefault(); onFullscreen(); return; }
      if (key === 'Escape') { onCancel(); return; }
      if (lower === 'c' && event.shiftKey) { event.preventDefault(); onCloseAll(); return; }
      if (lower === 'c') { event.preventDefault(); onCloseLatest(); return; }
      if (key === '+' || key === '=') { event.preventDefault(); onLotsDelta(0.01); return; }
      if (key === '-' || key === '_') { event.preventDefault(); onLotsDelta(-0.01); return; }

      const timeframeMap = { '1': '1m', '2': '5m', '3': '15m', '4': '1h' };
      if (timeframeMap[key]) {
        event.preventDefault();
        onTimeframe(timeframeMap[key]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onBuy, onSell, onFullscreen, onCancel, onCloseLatest, onCloseAll, onLotsDelta, onTimeframe]);
}
