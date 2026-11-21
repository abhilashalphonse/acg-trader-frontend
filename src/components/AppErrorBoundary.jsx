import React from 'react';
import { formatUiCrashSummary, uiCrashSummary } from '../utils/uiCrashDiagnostic.js';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, diagnostic: null };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, diagnostic: uiCrashSummary(error) };
  }

  componentDidCatch(error, info) {
    console.error('ACG Trader UI crashed', error, info);
    // Never persist or transmit diagnostics. Show only a sanitized local
    // message and React component names so the operator can report a crash.
    this.setState({ diagnostic: uiCrashSummary(error, info) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const width = typeof window !== 'undefined' ? window.innerWidth : null;
    const diagnostic = formatUiCrashSummary(this.state.diagnostic, width);
    const diagnosticMode = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('acg_diag') === '1';
    return (
      <div className="grid min-h-dvh place-items-center bg-[#050b12] px-6 text-center text-[#eef4f8]">
        <div className="w-full max-w-[480px] rounded-2xl border border-[#5b3037] bg-[#181014] p-5 shadow-2xl">
          <h1 className="text-lg font-black">Trading terminal needs to recover</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#bfaeb2]">No trading command is submitted by this recovery screen. Reload to restore the latest authoritative account state.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 h-11 w-full rounded-xl border border-[#2b5d7e] bg-[#0d2a3e] text-sm font-black text-[#dff5ff]">Reload terminal</button>
          <details open={diagnosticMode} className="mt-4 rounded-lg border border-white/10 p-3 text-left">
            <summary className="cursor-pointer text-xs font-semibold text-[#bfc9d3]">Technical crash details (no credentials)</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#e4c5c9]">{diagnostic}</pre>
            <p className="mt-2 text-[11px] leading-relaxed text-[#bfc9d3]">You can screenshot these details for support. Do not include browser storage, authorization headers, or account credentials.</p>
          </details>
        </div>
      </div>
    );
  }
}
