import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('ACG Trader UI crashed', error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center bg-[#050b12] px-6 text-center text-[#eef4f8]">
        <div className="w-full max-w-[420px] rounded-2xl border border-[#5b3037] bg-[#181014] p-5 shadow-2xl">
          <h1 className="text-lg font-black">Trading terminal needs to recover</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#bfaeb2]">No trading command is submitted by this recovery screen. Reload to restore the latest authoritative account state.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-4 h-11 w-full rounded-xl border border-[#2b5d7e] bg-[#0d2a3e] text-sm font-black text-[#dff5ff]">Reload terminal</button>
        </div>
      </div>
    );
  }
}
