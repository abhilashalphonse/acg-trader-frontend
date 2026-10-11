import React, { useEffect, useRef } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  CHART_TIMEZONE_OPTIONS,
  DEFAULT_DESKTOP_CHART_SETTINGS,
} from '../../../utils/desktopChartSettings.js';

const COLOR_ROWS = [
  ['Body', 'upBody', 'downBody'],
  ['Borders', 'upBorder', 'downBorder'],
  ['Wick', 'upWick', 'downWick'],
];

function ColorCell({ value, onChange, label }) {
  return (
    <label className="relative grid size-8 cursor-pointer place-items-center rounded-md border border-white/[0.10] bg-[#111419] shadow-[inset_0_1px_0_rgba(255,255,255,.025)]" title={label}>
      <span className="size-5 rounded-[3px] border border-white/[0.16]" style={{ backgroundColor: value }}/>
      <input
        type="color"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      />
    </label>
  );
}

export default function DesktopChartSettingsPopover({
  open,
  settings,
  onChange = () => {},
  onClose = () => {},
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => {
      if (!panelRef.current?.contains(event.target)) onClose();
    };
    const onKeyDown = event => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const candle = settings?.candle || DEFAULT_DESKTOP_CHART_SETTINGS.candle;
  const viewport = settings?.viewport || DEFAULT_DESKTOP_CHART_SETTINGS.viewport;
  const patchCandle = patch => onChange({
    ...settings,
    candle: { ...candle, ...patch },
  });

  return (
    <div
      ref={panelRef}
      className="acg-motion-popover absolute right-[47px] top-1 z-[180] w-[286px] overflow-hidden rounded-[10px] border border-white/[0.10] bg-[#0B0E11]/[0.985] shadow-[0_24px_70px_rgba(0,0,0,.62)] backdrop-blur-xl"
      role="dialog"
      aria-label="Chart appearance settings"
    >
      <div className="flex h-10 items-center border-b border-white/[0.07] px-3">
        <div>
          <div className="text-[10px] font-bold text-[#E8EDF2]">Chart settings</div>
          <div className="text-[7px] font-semibold uppercase tracking-[0.08em] text-[#62717E]">Desktop</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto grid size-7 place-items-center rounded-md text-[#71808D] transition hover:bg-white/[0.05] hover:text-white"
          aria-label="Close chart settings"
        >
          <X size={14}/>
        </button>
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#687784]">Candles</div>
            <div className="mt-0.5 text-[8px] text-[#53616D]">Bullish / Bearish</div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-[7px] font-bold uppercase tracking-[0.08em] text-[#53616D]">
            <span>Up</span>
            <span>Down</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-black/30">
          {COLOR_ROWS.map(([label, upKey, downKey], index) => (
            <div key={label} className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2.5 py-2 ${index ? 'border-t border-white/[0.06]' : ''}`}>
              <span className="text-[9px] font-semibold text-[#B7C1CA]">{label}</span>
              <ColorCell
                value={candle[upKey]}
                onChange={value => patchCandle({ [upKey]: value })}
                label={`Bullish ${label.toLowerCase()} color`}
              />
              <ColorCell
                value={candle[downKey]}
                onChange={value => patchCandle({ [downKey]: value })}
                label={`Bearish ${label.toLowerCase()} color`}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-[#687784]">Chart spacing</div>
          {[
            ['Top space (%)', 'top', 100, 2, 30],
            ['Bottom space (%)', 'bottom', 100, 2, 30],
            ['Initial candles', 'bars', 1, 20, 200],
          ].map(([label, key, factor, min, max]) => (
            <label key={key} className="flex items-center justify-between text-[9px] text-[#B7C1CA]">
              {label}
              <input key={`${key}:${viewport[key]}`} type="number" min={min} max={max} step="1" aria-label={label}
                defaultValue={Math.round(viewport[key] * factor)}
                onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                onBlur={event => {
                  if (event.target.value !== '') onChange({ ...settings, viewport: { ...viewport, [key]: Number(event.target.value) / factor } });
                  else event.target.value = Math.round(viewport[key] * factor);
                }}
                className="h-7 w-16 rounded border border-white/10 bg-[#111419] px-2 text-[#D8E0E7]" />
            </label>
          ))}
          <div className="text-[7px] leading-4 text-[#566572]">Initial candles applies when opening or resetting a chart.</div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.08em] text-[#687784]">Timezone</div>
          <select
            value={settings?.timezone || 'UTC'}
            onChange={event => onChange({ ...settings, timezone: event.target.value })}
            className="h-9 w-full rounded-md border border-white/[0.09] bg-[#111419] px-2.5 text-[9px] font-semibold text-[#D8E0E7] outline-none transition focus:border-[#C9CDD2]/70"
            aria-label="Chart timezone"
          >
            {CHART_TIMEZONE_OPTIONS.map(option => (
              <option key={option.value} value={option.value} className="bg-[#111419]">
                {option.label}
              </option>
            ))}
          </select>
          <div className="mt-1.5 text-[7px] leading-4 text-[#566572]">
            Exchange time follows each instrument's configured market timezone.
          </div>
        </div>
      </div>

      <div className="flex items-center border-t border-white/[0.07] px-3 py-2.5">
        <button
          type="button"
          onClick={() => onChange({
            candle: { ...DEFAULT_DESKTOP_CHART_SETTINGS.candle },
            timezone: DEFAULT_DESKTOP_CHART_SETTINGS.timezone,
            viewport: { ...DEFAULT_DESKTOP_CHART_SETTINGS.viewport },
          })}
          className="flex h-8 items-center gap-1.5 rounded-md border border-white/[0.08] px-2.5 text-[8px] font-semibold text-[#8998A5] transition hover:bg-white/[0.04] hover:text-white"
        >
          <RotateCcw size={11}/>Reset
        </button>
        <span className="ml-auto text-[7px] font-semibold text-[#53616D]">Saved automatically</span>
      </div>
    </div>
  );
}
