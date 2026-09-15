import React, { useState } from 'react';
import TopBar from './TopBar.jsx';
import MarketPanel from './MarketPanel.jsx';
import ExecutionPanel from './ExecutionPanel.jsx';
import PositionsPanel from './PositionsPanel.jsx';
import BottomNavbar from './BottomNavbar.jsx';
import '../../styles/acg-trader-v2.css';

export default function TradingTerminalV2({ market, tick }) {
  const [timeframe, setTimeframe] = useState('1m');
  const [selectedTool, setSelectedTool] = useState('cursor');
  const [activeNav, setActiveNav] = useState('trade');

  return (
    <main className="acg-v2-terminal">
      <TopBar />
      <div className="acg-v2-content">
        <MarketPanel
          market={market}
          tick={tick}
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          selectedTool={selectedTool}
          setSelectedTool={setSelectedTool}
        />
        <ExecutionPanel market={market}/>
        <PositionsPanel/>
      </div>
      <BottomNavbar active={activeNav} onChange={setActiveNav}/>
    </main>
  );
}
