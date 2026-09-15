import React, { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';

export default function ExecutionPanel({ market }) {
  const [lots, setLots] = useState(0.10);
  const decrease = () => setLots(v => Math.max(0.01, +(v - 0.01).toFixed(2)));
  const increase = () => setLots(v => +(v + 0.01).toFixed(2));

  return (
    <section className="mt-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)] gap-2">
        <button
          type="button"
          className="flex h-[66px] flex-col items-start justify-center rounded-[16px] border border-[#8a2b39] bg-gradient-to-br from-[#461b24] via-[#32131b] to-[#251017] px-4 text-left text-[#ff6975] shadow-[0_0_22px_rgba(255,68,91,0.09),inset_0_1px_rgba(255,255,255,0.035)]"
        >
          <span className="text-[12px] font-extrabold tracking-[0.035em]">SELL</span>
          <strong className="mt-1 text-[27px] font-black leading-none tracking-[-0.045em] text-[#f9f3f4]">{market.bid}</strong>
        </button>

        <div className="grid h-[66px] grid-cols-2 grid-rows-[auto_auto_1fr] items-center rounded-[16px] border border-[#1c2d3d] bg-[#09131d] px-2.5 py-1.5 text-center shadow-[inset_0_1px_rgba(255,255,255,0.025)]">
          <button type="button" className="col-span-2 mx-auto flex items-center gap-1 text-[16px] font-black leading-none text-[#f4f7fb]">
            {lots.toFixed(2)} <ChevronDown size={14} className="text-[#74879d]" />
          </button>
          <span className="col-span-2 -mt-0.5 text-[9px] font-medium text-[#718398]">Lots</span>
          <div className="col-span-2 flex items-end justify-between pt-1">
            <button type="button" onClick={decrease} aria-label="Decrease lot size" className="grid h-6 w-[32px] place-items-center rounded-lg border border-[#142535] bg-[#0e1b27] text-[#93a4b7]">
              <Minus size={15} />
            </button>
            <button type="button" onClick={increase} aria-label="Increase lot size" className="grid h-6 w-[32px] place-items-center rounded-lg border border-[#142535] bg-[#0e1b27] text-[#93a4b7]">
              <Plus size={15} />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="flex h-[66px] flex-col items-end justify-center rounded-[16px] border border-[#16865f] bg-gradient-to-bl from-[#0b6048] via-[#0b4838] to-[#0b2e27] px-4 text-right text-[#44dda9] shadow-[0_0_24px_rgba(32,209,151,0.10),inset_0_1px_rgba(255,255,255,0.035)]"
        >
          <span className="text-[12px] font-extrabold tracking-[0.035em]">BUY</span>
          <strong className="mt-1 text-[27px] font-black leading-none tracking-[-0.045em] text-[#f3fbf8]">{market.ask}</strong>
        </button>
      </div>

      <div className="mt-2 flex min-h-7 items-center gap-2 overflow-x-auto whitespace-nowrap px-0.5 text-[9px] font-medium text-[#7a8ba0] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span>Spread <b className="ml-1 font-semibold text-[#b6c2d0]">0.5 pips</b></span>
        <span className="h-3 w-px shrink-0 bg-[#243442]" />
        <span>Commission <b className="ml-1 font-semibold text-[#b6c2d0]">$0</b></span>
        <span className="h-3 w-px shrink-0 bg-[#243442]" />
        <span>Leverage <b className="ml-1 font-semibold text-[#b6c2d0]">1:100</b></span>
        <span className="ml-auto pl-2">Margin Required <b className="ml-1 font-semibold text-[#c8d2dd]">$99.37</b></span>
      </div>
    </section>
  );
}
