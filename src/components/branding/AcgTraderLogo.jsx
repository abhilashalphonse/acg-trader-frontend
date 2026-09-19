import React from 'react';

export default function AcgTraderLogo({ className = '', iconClassName = 'h-6 w-6', textClassName = 'text-[14px]' }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 512 512" className={iconClassName} aria-hidden="true">
        <defs>
          <linearGradient id="acg-top-ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="100%" stopColor="#0072FF" />
          </linearGradient>
          <linearGradient id="acg-right-ribbon" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0072FF" />
            <stop offset="100%" stopColor="#0033AA" />
          </linearGradient>
          <linearGradient id="acg-bottom-ribbon" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#0033AA" />
            <stop offset="100%" stopColor="#0055FF" />
          </linearGradient>
          <linearGradient id="acg-left-ribbon" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0055FF" />
            <stop offset="100%" stopColor="#00F2FE" />
          </linearGradient>
        </defs>
        <path d="M160 64H352C410 64 448 102 448 160V240C390 190 350 176 280 176H176C176 140 165 100 160 64Z" fill="url(#acg-top-ribbon)" />
        <path d="M448 160V352C448 410 410 448 352 448H272C322 390 336 350 336 280V176C372 176 412 165 448 160Z" fill="url(#acg-right-ribbon)" />
        <path d="M352 448H160C102 448 64 410 64 352V272C122 322 162 336 232 336H336C336 372 347 412 352 448Z" fill="url(#acg-bottom-ribbon)" />
        <path d="M64 352V160C64 102 102 64 160 64H240C190 122 176 162 176 232V336C140 336 100 347 64 352Z" fill="url(#acg-left-ribbon)" />
      </svg>
      <span className={`font-extrabold tracking-[-0.03em] text-white ${textClassName}`}>
        ACG <span className="font-semibold text-[#b3b3b3]">Trader</span>
      </span>
    </div>
  );
}
