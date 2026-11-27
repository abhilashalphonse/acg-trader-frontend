import React,{useEffect,useState} from 'react';
import {projectWorkspaceReport} from './workspaceReport.js';
const utc=v=>new Date(v).toISOString().replace('T',' ').slice(0,19)+' UTC';
export default function VerifiedWorkspaceReport({envelope,expected,fixture=false,isolated=false}){
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    setNow(Date.now());
    const timer=setInterval(()=>setNow(Date.now()),250);
    return ()=>clearInterval(timer);
  },[envelope]);
  const report=projectWorkspaceReport(envelope,expected,Math.max(now,Date.now()));
  if(!report)return <div className="aic-report" data-ai-report-unavailable>Report expired, invalid, or no longer matches this workspace.</div>;
  return <section className="aic-report" data-ai-workspace-report aria-label="Historical workspace report">
    <div className="aic-report-heading"><strong>{fixture?'Sample historical report':'Historical report'}</strong><span>{report.symbol} · {report.timeframe}</span></div>
    <p>{fixture?'Synthetic fixture — not current market data.':isolated?'Isolated server-recomputed fixture evidence — not current market data.':'Server-recomputed historical evidence.'} No live price or model-generated answer.</p>
    <div className="aic-report-meta"><span>As of {utc(report.asOfMs)}</span><span>Source: {report.provider} · {report.coverage}</span></div>
    {report.status==='INSUFFICIENT_EVIDENCE'&&<p>Insufficient eligible closed candles. No market conclusion.</p>}
    <dl className="aic-report-facts">{report.facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.value}</dd><details><summary>Evidence</summary><span>Through {utc(f.throughCloseTimeMs)}</span><code>{f.sourceId}</code></details></div>)}</dl>
    {report.structure&&<p>{report.structure.text}</p>}
    <p>Not a prediction or execution instruction. Relevance and completeness are not proven. Valid until {utc(report.expiresAtMs)}.</p>
  </section>;
}
