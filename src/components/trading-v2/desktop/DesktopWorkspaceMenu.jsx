import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, LayoutDashboard, LayoutGrid, Square, Columns2, Grid2X2, Link2, Link2Off, Plus, Save, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'acg-trader-workspaces-v1';

const BUILT_INS = [
  {
    id: 'preset-scalper',
    name: 'Scalper',
    builtIn: true,
    layout: { sidebarWidth: 350, dockHeight: 180, sidebarCollapsed: false, dockCollapsed: false },
    trading: { timeframe: '1m', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.5, orderType: 'market' },
  },
  {
    id: 'preset-standard',
    name: 'Standard',
    builtIn: true,
    layout: { sidebarWidth: 390, dockHeight: 210, sidebarCollapsed: false, dockCollapsed: false },
    trading: { timeframe: '5m', chartMode: 'candles', sizingMode: 'lots', riskPercent: 0.5, orderType: 'market' },
  },
  {
    id: 'preset-chart',
    name: 'Chart Focus',
    builtIn: true,
    layout: { sidebarWidth: 360, dockHeight: 190, sidebarCollapsed: true, dockCollapsed: true },
    trading: { timeframe: '15m', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.5, orderType: 'market' },
  },
  {
    id: 'preset-risk',
    name: 'Risk',
    builtIn: true,
    layout: { sidebarWidth: 420, dockHeight: 240, sidebarCollapsed: false, dockCollapsed: false },
    trading: { timeframe: '5m', chartMode: 'candles', sizingMode: 'risk', riskPercent: 0.25, orderType: 'market' },
  },
];

function loadCustom() {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function persist(items) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* optional preference */ }
}

export default function DesktopWorkspaceMenu({
  snapshot, onApply = () => {}, compact = false,
  chartLayout = 1, onChartLayoutChange = () => {},
  chartLinked = false, onToggleChartLink = () => {},
  onCopyIndicators = () => {}, indicatorCount = 0,
  open: controlledOpen, onOpenChange,
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen === undefined ? localOpen : controlledOpen;
  const setOpen = next => {
    const value = typeof next === 'function' ? next(open) : next;
    if (controlledOpen === undefined) setLocalOpen(value);
    else onOpenChange?.(value);
  };
  const [custom, setCustom] = useState(loadCustom);
  const workspaces = useMemo(() => [...BUILT_INS, ...custom], [custom]);

  const saveCurrent = () => {
    const name = window.prompt('Workspace name', 'My Workspace');
    if (!name?.trim()) return;
    const item = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      builtIn: false,
      createdAt: new Date().toISOString(),
      ...snapshot,
    };
    const next = [...custom, item].slice(-12);
    setCustom(next);
    persist(next);
  };

  const remove = id => {
    const next = custom.filter(item => item.id !== id);
    setCustom(next);
    persist(next);
  };

  return (
    <div className="relative">
      <button type="button" data-v4-header-tool={compact ? 'layout' : undefined}
        aria-label={compact ? 'Layout' : undefined} aria-expanded={open}
        onClick={() => setOpen(value => !value)}
        className={compact ? 'acg-v4-header-layout-tool' : 'flex h-8 items-center gap-1 rounded-md border border-white/[0.06] bg-black/20 px-2 text-[9px] font-semibold text-[#6F8191] hover:text-white'}
        title={compact ? 'Layout' : 'Layouts'}>
        {compact ? <LayoutGrid size={18}/> : <><LayoutDashboard size={12}/>Layout<ChevronDown size={10}/></>}
      </button>

      {open && (
        <div data-v4-header-menu={compact ? 'layout' : undefined} className="acg-v3-popover absolute right-0 top-9 z-[90] w-[230px] overflow-hidden rounded-md border border-white/[0.10] bg-[#111113] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
          {compact && <>
            <div className="px-2 pb-1 pt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#A6A6AF]">Chart grid</div>
            {[[1, Square, 'Single chart'], [2, Columns2, 'Two charts'], [4, Grid2X2, 'Four charts']].map(([value, Icon, label]) => (
              <button key={value} type="button" aria-pressed={chartLayout === value}
                onClick={() => { onChartLayoutChange(value); setOpen(false); }}
                className="flex min-h-9 w-full items-center justify-between gap-2 rounded px-2 text-left text-[11px] text-[#D8D8DE] hover:bg-white/[0.045]">
                <span className="flex items-center gap-2"><Icon size={14}/>{label}</span>
                {chartLayout === value && <Check size={13}/>}
              </button>
            ))}
            {chartLayout > 1 && <>
              <div className="my-1 border-t border-white/[0.06]"/>
              <button type="button" onClick={() => { onToggleChartLink(); setOpen(false); }}
                className="flex min-h-9 w-full items-center justify-between px-2 text-[10px] text-[#B6B6C0] hover:bg-white/[0.045]">
                <span className="flex items-center gap-2">{chartLinked ? <Link2 size={13}/> : <Link2Off size={13}/>}Link symbols</span>
                <span>{chartLinked ? 'On' : 'Off'}</span>
              </button>
              <button type="button" onClick={() => { onCopyIndicators(); setOpen(false); }}
                className="flex min-h-9 w-full items-center justify-between px-2 text-[10px] text-[#B6B6C0] hover:bg-white/[0.045]">
                Copy indicators to all <span>ƒx {indicatorCount}</span>
              </button>
            </>}
            <div className="my-2 border-t border-white/[0.07]"/>
          </>}
          <div className="px-1 pb-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-[#6F8191]">Layout presets</div>
          {workspaces.map(item => (
            <div key={item.id} className="group flex items-center gap-1 rounded hover:bg-white/[0.025]">
              <button type="button" onClick={() => { onApply(item); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
                <span className="grid size-5 place-items-center rounded border border-white/[0.06] bg-black text-[#CCD1D6]"><Check size={10}/></span>
                <span className="min-w-0"><b className="block truncate text-[10px] font-semibold text-[#E6EDF3]">{item.name}</b><small className="mt-0.5 block text-[8px] text-[#6F8191]">{item.builtIn ? 'Built-in preset' : 'Saved workspace'}</small></span>
              </button>
              {!item.builtIn && <button type="button" onClick={() => remove(item.id)} className="grid size-7 place-items-center text-[#6F8191] opacity-0 transition hover:text-[#FF6F7A] group-hover:opacity-100" aria-label={`Delete ${item.name}`}><Trash2 size={11}/></button>}
            </div>
          ))}
          <button type="button" onClick={saveCurrent} className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded border border-[#55595F] bg-[#222225] text-[9px] font-semibold text-[#CCD1D6]"><Save size={11}/>Save current workspace</button>
          <div className="mt-1 flex items-center gap-1 px-1 text-[8px] text-[#44515D]"><Plus size={9}/>Up to 12 custom workspaces are stored locally.</div>
        </div>
      )}
    </div>
  );
}
