import React, {useState} from 'react';
import {Check,ChevronDown,Loader2,Settings,CircleHelp} from 'lucide-react';
import {accountStatusLabel,accountStatusToneClass,accountTypeLabel} from '../../utils/accountPresentation.js';
import {MobileWorkspaceV4,WorkspaceMetric,WorkspaceDetails,workspaceMoney,workspaceTone,workspaceNumber} from './MobileWorkspaceV4.jsx';
import '../../styles/mobileWorkspacesV4.css';
import SignOutAction from './SignOutAction.jsx';
import MobileContextActions from './MobileContextActions.jsx';

export default function MobileAccountsV4({account={},accounts=[],activeAccountId,accountSwitching=false,accountSwitchError,onSelectAccount,onClose,onPlatformSettings,onHelp,commandPending=false,executionUncertain=false}) {
  const [details,setDetails]=useState(false);
  const [switching,setSwitching]=useState(false);
  const [error,setError]=useState('');
  const currency=account.currency || 'USD';
  const busy=accountSwitching || switching;
  const list=accounts.length?accounts:account.id?[account]:[];
  const select=async id=>{
    if(busy)return;
    setSwitching(true);setError('');
    try {if(await onSelectAccount(id)===false)setError('Account switch was not accepted. Please retry.');}
    catch(cause){setError(cause?.message || 'Unable to switch account.');}
    finally{setSwitching(false);}
  };
  return <MobileWorkspaceV4 title="Accounts" surface="MobileAccountSheet" onClose={onClose} actions={<span>{busy?'Syncing account…':currency}</span>}>
    <div className="mw-account-hero" data-v4-account-overview>
      <div className="mw-row mw-account-meta"><div><strong>{account.accountCode || 'Trading account'}</strong><div style={{marginTop:5}}>{accountTypeLabel(account)}</div></div><span className={`mw-side ${accountStatusToneClass(account.status)}`}>{accountStatusLabel(account.status)}</span></div>
      <span style={{fontSize:11,color:'#929ba5'}}>Account equity</span><strong className="mw-hero-value">{workspaceMoney(account.equity,currency)}</strong>
      <div className="mw-account-bottom"><WorkspaceMetric label="Balance" value={workspaceMoney(account.balance,currency)}/><WorkspaceMetric label="Unrealized P&L" value={workspaceMoney(account.floatingPnl,currency)} tone={workspaceTone(account.floatingPnl)}/></div>
    </div>
    <div className="mw-summary" data-v4-account-margin><WorkspaceMetric label="Used margin" value={workspaceMoney(account.usedMargin,currency)}/><WorkspaceMetric label="Free margin" value={workspaceMoney(account.freeMargin,currency)}/><WorkspaceMetric label="Margin level" value={workspaceNumber(account.usedMargin)&&Number(account.usedMargin)===0?'—':workspaceNumber(account.marginLevel)?`${Number(account.marginLevel).toFixed(1)}%`:'—'}/></div>
    {(error || accountSwitchError) && <div className="mw-notice is-loss" role="alert">{error || accountSwitchError}</div>}
    <div className="mw-scroll">
      <h3 className="mw-section-title">Your accounts <span>{list.length} available</span></h3>
      {busy && <p className="mw-notice" role="status">Trading stays locked while the selected account synchronizes.</p>}
      <div className="mw-card" data-v4-account-switcher>{list.map(item=>{
        const selected=String(item.id)===String(activeAccountId);
        return <button type="button" className="mw-account-row" key={item.id} aria-pressed={selected} aria-label={`Switch to ${item.accountCode || item.id}`} disabled={busy&&!selected} onClick={()=>select(item.id)}>
          <div className="mw-row-copy"><strong>{item.accountCode || item.id}</strong><small>{accountTypeLabel(item)} · {accountStatusLabel(item.status)}</small></div>
          <div className="mw-row-balance">{workspaceMoney(item.balance,item.currency || currency)}<small>{selected?'Selected':item.currency || currency}</small></div>
          {selected && (busy?<Loader2 size={14} className="animate-spin"/>:<Check size={14}/>)}
        </button>;
      })}{!list.length && <div className="mw-empty">No trading accounts available.</div>}</div>
      <button type="button" className="mw-section-title" style={{width:'100%',background:'none',border:0,padding:0,color:'inherit'}} onClick={()=>setDetails(v=>!v)} aria-expanded={details}>Account details<ChevronDown size={14} style={{transform:details?'rotate(180deg)':undefined}}/></button>
      {details && <div className="mw-card" style={{padding:'0 12px'}}><WorkspaceDetails rows={[
        ['Account ID',account.id],['Currency',currency],['Leverage',account.leverage?`1:${account.leverage}`:'—'],['Status',accountStatusLabel(account.status)],['Valuation',account.valuationStatus || 'Unavailable'],
      ]}/></div>}
      <div className="mw-account-footer"><button type="button" className="mw-action" onClick={onPlatformSettings}><Settings size={14}/>Settings</button><button type="button" className="mw-action" onClick={onHelp}><CircleHelp size={14}/>Help & support</button></div>
      <MobileContextActions blocked={busy} commandPending={commandPending} executionUncertain={executionUncertain} />
      <SignOutAction variant="mobile-v4" />
    </div>
  </MobileWorkspaceV4>;
}
