import React, { useEffect, useMemo, useState } from 'react';
import {
  Crosshair,
  TrendingUp,
  SlidersHorizontal,
  Square,
  Type,
  Shapes,
  Smile,
  Ruler,
  Magnet,
} from 'lucide-react';
import TradingChart from '../TradingChart.jsx';

const tools = [
  ['cursor', Crosshair],
  ['trendline', TrendingUp],
  ['lines', SlidersHorizontal],
  ['rectangle', Square],
  ['text', Type],
  ['geometry', Shapes],
  ['icon', Smile],
  ['measure', Ruler],
  ['magnet', Magnet],
];

const secondsByTimeframe = {
  S1: 1,
  S5: 5,
  S15: 15,
  S30: 30,
  M1: 60,
  M5: 300,
  M15: 900,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function ChartArea({
  symbol,
  chartTimeframe,
  tick,
  price,
  ask,
  chartMode,
  selectedTool,
  onSelectTool,
}) {
  const timeframeSeconds = secondsByTimeframe[chartTimeframe] || 60;
  const [remaining, setRemaining] = useState(() => timeframeSeconds - (Math.floor(Date.now() / 1000) % timeframeSeconds));

  useEffect(() => {
    const update = () => {
      const now = Math.floor(Date.now() / 1000);
      const mod = now % timeframeSeconds;
      setRemaining(mod === 0 ? timeframeSeconds : timeframeSeconds - mod);
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [timeframeSeconds]);

  const formattedPrice = useMemo(() => price || '0.99368', [price]);

  return (
    <div className="grid h-[270px] grid-cols-[34px_minmax(0,1fr)] gap-2 px-2 pb-2 md:h-[300px]">
      <aside className="flex min-h-0 flex-col items-center gap-0.5 rounded-xl border border-[#1b2c3d] bg-[#09131d] py-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.02)]" aria-label="Drawing tools">
        {tools.map(([id, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelectTool(id)}
            aria-label={id}
            className={`grid size-[27px] place-items-center rounded-lg transition ${
              selectedTool === id ? 'bg-[#0f3149] text-[#59c8ff]' : 'text-[#74879c] hover:bg-white/[0.035] hover:text-[#d7e4f1]'
            }`}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        ))}
      </aside>

      <div className="relative min-h-0 min-w-0 overflow-hidden rounded-xl border border-[#1b2c3d] bg-[#080f17]">
        <TradingChart
          symbol={symbol}
          timeframe={chartTimeframe}
          tick={tick}
          chartMode={chartMode}
          bidPrice={price}
          askPrice={ask}
        />

        <div className="pointer-events-none absolute right-0 top-[31%] z-10 flex -translate-y-1/2 flex-col items-end">
          <span className="rounded-l-md bg-[#22a77d] px-2 py-1 text-[10px] font-extrabold leading-none text-[#e9fff8] shadow-[0_0_14px_rgba(34,167,125,0.18)]">{formattedPrice}</span>
          <small className="mt-0.5 rounded-bl bg-[#16684f] px-2 py-0.5 text-[8px] font-semibold leading-none text-[#a6e7cf]">{formatCountdown(remaining)}</small>
        </div>
      </div>
    </div>
  );
}
