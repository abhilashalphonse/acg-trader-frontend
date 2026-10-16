import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const workspaceNumber = value => value!==null && value!==undefined && value!=='' && Number.isFinite(Number(value));
export function workspaceMoney(value,currency='USD') {
  if (!workspaceNumber(value)) return '—';
  try {return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(Number(value));}catch{return '—';}
}
export const workspaceTone = value => !workspaceNumber(value) ? '' : Number(value)>0 ? 'is-profit' : Number(value)<0 ? 'is-loss' : '';
export function workspaceDate(value,dayOnly=false) {
  const date=new Date(value);
  return value && Number.isFinite(date.getTime()) ? date.toLocaleString('en-GB',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric',...(dayOnly?{}:{hour:'2-digit',minute:'2-digit',hour12:false})}) : 'Date unavailable';
}
export function MobileWorkspaceV4({title,onClose,children,actions,surface}) {
  return <section data-mobile-v4-surface={surface} data-mobile-workspace-v4 className="mobile-workspace-v4">
    <header className="mw-header"><button type="button" onClick={onClose} aria-label="Back to chart"><ChevronLeft size={19}/></button><h2>{title}</h2><div className="mw-header-actions">{actions}</div></header>
    {children}
  </section>;
}
export function WorkspaceMetric({label,value,tone=''}) {return <div className="mw-metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;}
export function WorkspaceDetails({rows}) {return <dl className="mw-details">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>;}
