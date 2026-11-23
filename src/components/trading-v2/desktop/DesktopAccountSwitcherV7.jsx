import React, { useState } from 'react';
import { Archive, Check, ChevronRight, Loader2, Wallet } from 'lucide-react';
import { accountStatusLabel, accountTypeBadge } from '../../../utils/accountPresentation.js';
import { v4HeaderAccountLabel } from '../../../utils/v4HeaderPresentation.js';
import { accountSwitcherId, buildAccountSwitcherSections, isArchivedAccount } from '../../../utils/accountSwitcherPresentation.js';
import './DesktopAccountSwitcherV7.css';

const statusOf = item => String(item?.status || 'UNKNOWN').toUpperCase();
const detailOf = (item, formatSize) => {
  const phase = item?.challenge?.phase ? 'Phase ' + item.challenge.phase : null;
  const size = formatSize(item?.initialBalance ?? item?.startingBalance ?? item?.challenge?.accountSize ?? item?.balance);
  return [accountTypeBadge(item) === 'ACCOUNT' ? 'Account' : accountTypeBadge(item).toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    size !== '—' ? '$' + size : null, phase].filter(Boolean).join(' · ');
};

export default function DesktopAccountSwitcherV7({
  account, accounts, activeAccountId, currency, accountPnl,
  accountSwitching, accountSwitchError, onChooseAccount, onClose,
  formatMoney, formatPnl, formatSize, signOutAction, readOnly,
}) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const { current, other, archived, total, activeCount, archivedCount } =
    buildAccountSwitcherSections(accounts, account, activeAccountId);
  const currentStatus = statusOf(current);
  const showArchivedInfo = archivedCount > 0;
  const choose = item => {
    const id = accountSwitcherId(item);
    if (!id || (accountSwitching && id !== String(activeAccountId || ''))) return;
    onChooseAccount(id);
  };
  const row = (item, archivedRow = false) => {
    const id = accountSwitcherId(item);
    const status = statusOf(item);
    const locked = accountSwitching || !id;
    const label = v4HeaderAccountLabel(item);
    const action = archivedRow ? 'Review' : 'Switch to';
    return (
      <button key={id || item.accountCode} type="button"
        data-acg-account-row={archivedRow ? 'archived' : 'available'}
        data-account-id={id} disabled={locked}
        title={item?.accountCode || label}
        aria-label={action + ' ' + label + (archivedRow ? ' (history)' : '')}
        onClick={() => choose(item)}
        className="acg-acct-row">
        <span className="acg-acct-row-avatar" aria-hidden="true">A</span>
        <span className="acg-acct-row-body">
          <span className="acg-acct-row-code">{label}</span>
          <span className="acg-acct-row-sub">{detailOf(item, formatSize)}</span>
        </span>
        {archivedRow
          ? <span className="acg-acct-status acg-acct-status-archived">{accountStatusLabel(status)}</span>
          : <span className={'acg-acct-status' + (status === 'ACTIVE' ? ' acg-acct-status-active' : '')}>{accountStatusLabel(status)}</span>}
        <ChevronRight aria-hidden="true" size={13} strokeWidth={1.65} className="acg-acct-row-chevron"/>
      </button>
    );
  };

  return (
    <div role="dialog" aria-label="Trading accounts" data-v4-header-menu="account"
      data-acg-account-switcher="v7" className="acg-account-switcher acg-motion-popover absolute right-0 top-10 z-[140]"
      onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose?.(); } }}>
      <div className="acg-acct-head">
        <span className="acg-acct-heading">Accounts</span>
        <span className="acg-acct-total">{total} {total === 1 ? 'account' : 'accounts'}</span>
      </div>
      <div className="acg-acct-scroll">
        <div className="acg-acct-current-block">
          <div className="acg-acct-eyebrow">Current account</div>
          {current ? (
            <section className="acg-acct-selected" aria-label="Current trading account">
              <div className="acg-acct-identity">
                <span className="acg-acct-avatar" aria-hidden="true">A</span>
                <div className="acg-acct-identity-text">
                  <strong className="acg-acct-current-code" title={current.accountCode || ''}>{v4HeaderAccountLabel(current)}</strong>
                  <span className="acg-acct-subline">{detailOf(current, formatSize)}
                    {currentStatus !== 'ACTIVE' && <span> · {accountStatusLabel(currentStatus)}</span>}
                  </span>
                </div>
                <span className="acg-acct-selected-state">
                  {accountSwitching ? <Loader2 size={13} aria-hidden="true" className="animate-spin"/> : <Check size={13} strokeWidth={1.9} aria-hidden="true"/>}
                  {accountSwitching ? 'Switching' : 'Selected'}
                </span>
              </div>
              <div className="acg-acct-financials">
                <div className="acg-acct-metric">
                  <span>Equity</span>
                  <strong>{formatMoney(account?.equity ?? current.equity, account?.currency || currency)}</strong>
                </div>
                <div className="acg-acct-metric">
                  <span>Unrealized P&amp;L</span>
                  <strong className={Number.isFinite(accountPnl) && accountPnl < 0 ? 'acg-acct-negative' : ''}>
                    {accountPnl == null ? '—' : formatPnl(accountPnl, currency)}
                  </strong>
                </div>
              </div>
            </section>
          ) : (
            <div className="acg-acct-no-current">No trading account is selected.</div>
          )}
          {readOnly && <p className="acg-acct-readonly" role="status">Read-only account · trading is disabled. History remains available.</p>}
          {accountSwitching && <p className="acg-acct-notice" role="status">Switching account · waiting for a fresh account snapshot and trade history.</p>}
          {accountSwitchError && <p className="acg-acct-error" role="alert">{accountSwitchError} · Select an account to retry.</p>}
        </div>

        <div className="acg-acct-section">
          <div className="acg-acct-group-head">
            <span>Your accounts</span>
            <span>{activeCount} active{archivedCount ? ' · ' + archivedCount + ' archived' : ''}</span>
          </div>
          {other.length > 0 && <div className="acg-acct-other-list" aria-label="Other accounts">
            {other.map(item => row(item))}
          </div>}
          {showArchivedInfo && (
            <>
              <button type="button" className="acg-acct-archive-trigger"
                aria-expanded={archiveOpen} aria-controls="acg-account-archive-list"
                onClick={() => setArchiveOpen(open => !open)}>
                <Archive aria-hidden="true" size={15} strokeWidth={1.65}/>
                <span>Previous accounts</span>
                <span className="acg-acct-archive-count">{archived.length} {archived.every(item => statusOf(item) === 'BREACHED') ? 'breached' : 'archived'}</span>
                <ChevronRight className={archiveOpen ? 'acg-acct-expand-chevron is-open' : 'acg-acct-expand-chevron'} size={14} aria-hidden="true"/>
              </button>
              {archiveOpen && <div id="acg-account-archive-list" className="acg-acct-archive-list" aria-label="Previous accounts">
                {archived.map(item => row(item, true))}
              </div>}
            </>
          )}
          {other.length === 0 && !showArchivedInfo && total === 0 && <div className="acg-acct-no-current">No accounts are available.</div>}
        </div>
      </div>
      <div className="acg-acct-footer">
        <span className="acg-acct-footer-copy">Trading accounts</span>
        {signOutAction}
      </div>
    </div>
  );
}
