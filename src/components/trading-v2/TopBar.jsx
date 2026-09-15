import React from 'react';
import { Bell, Search } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="v2-topbar">
      <div className="v2-brand">
        <div className="v2-brand-mark">a</div>
        <div className="v2-brand-copy">
          <div className="v2-brand-title">ACG Trader <span>V2</span></div>
          <div className="v2-brand-subtitle">Trade Without Limits</div>
        </div>
      </div>

      <div className="v2-topbar-actions">
        <button className="v2-icon-button" aria-label="Search"><Search size={17} /></button>
        <button className="v2-icon-button v2-notification" aria-label="Notifications"><Bell size={17} /><i /></button>
        <div className="v2-account-pill">
          <strong>$12,458.32</strong>
          <span><i /> Live</span>
        </div>
        <button className="v2-avatar" aria-label="Profile">AA</button>
      </div>
    </header>
  );
}
