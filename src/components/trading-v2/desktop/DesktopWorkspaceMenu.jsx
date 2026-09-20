import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, LayoutDashboard, Plus, Save, Trash2 } from 'lucide-react';

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

export default function DesktopWorkspaceMenu({ snapshot, onApply = () => {} }) {
  const [open, setOpen] = useState(false);
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
      <button type="button" onClick={() => setOpen(value => !value)} className="flex h-7 items-center gap-1 rounded-md border border-white/[0.07] bg-black/20 px-2 text-[7px] font-bold text-[#73889d] hover:text-white" title="Workspaces">
        <LayoutDashboard size={12}/>Workspace<ChevronDown size={10}/>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-[90] w-[230px] overflow-hidden rounded-md border border-white/[0.10] bg-[#0a0a0a] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,.55)]">
          <div className="px-1 pb-1 text-[6.5px] font-black uppercase tracking-[0.08em] text-[#5d7185]">Workspace presets</div>
          {workspaces.map(item => (
            <div key={item.id} className="group flex items-center gap-1 rounded hover:bg-white/[0.025]">
              <button type="button" onClick={() => { onApply(item); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
                <span className="grid size-5 place-items-center rounded border border-white/[0.07] bg-black text-[#63caff]"><Check size={10}/></span>
                <span className="min-w-0"><b className="block truncate text-[8px] text-[#cdd7df]">{item.name}</b><small className="mt-0.5 block text-[6px] text-[#5f7388]">{item.builtIn ? 'Built-in preset' : 'Saved workspace'}</small></span>
              </button>
              {!item.builtIn && <button type="button" onClick={() => remove(item.id)} className="grid size-7 place-items-center text-[#6e7f90] opacity-0 transition hover:text-[#ff727d] group-hover:opacity-100" aria-label={`Delete ${item.name}`}><Trash2 size={11}/></button>}
            </div>
          ))}
          <button type="button" onClick={saveCurrent} className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded border border-[#315b72] bg-[#0d1a22] text-[7.5px] font-bold text-[#63caff]"><Save size={11}/>Save current workspace</button>
          <div className="mt-1 flex items-center gap-1 px-1 text-[6px] text-[#526679]"><Plus size={9}/>Up to 12 custom workspaces are stored locally.</div>
        </div>
      )}
    </div>
  );
}
