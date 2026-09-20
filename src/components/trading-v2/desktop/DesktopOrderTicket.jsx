import React from 'react';
import ExecutionPanel from '../ExecutionPanel.jsx';

export default function DesktopOrderTicket(props) {
  return (
    <section className="shrink-0 border-t border-white/[0.08] bg-black/30">
      <div className="flex h-8 items-center justify-between border-b border-white/[0.06] px-2.5">
        <strong className="text-[8px] font-extrabold uppercase tracking-[0.08em] text-[#c5d0da]">Order</strong>
        <span className="text-[7px] text-[#5f7388]">1-click execution</span>
      </div>
      <div className="px-2 pb-2">
        <ExecutionPanel desktopSidebar {...props} />
      </div>
    </section>
  );
}
