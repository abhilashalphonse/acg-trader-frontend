import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marketApi } from '../../api/market.js';

const identityCache = new Map();
const identityRequests = new Map();
const REMOTE_IDENTITY_CLASSES = new Set(['FOREX', 'CRYPTO', 'EQUITY', 'METAL', 'ENERGY', 'INDEX', 'OTHER']);

const CURRENCY_REGIONS = Object.freeze({
  EUR: 'EU',
  USD: 'US',
  GBP: 'GB',
  JPY: 'JP',
  CHF: 'CH',
  AUD: 'AU',
  NZD: 'NZ',
  CAD: 'CA',
  SGD: 'SG',
  HKD: 'HK',
  CNH: 'CN',
  CNY: 'CN',
  MXN: 'MX',
  ZAR: 'ZA',
  TRY: 'TR',
  PLN: 'PL',
  SEK: 'SE',
  NOK: 'NO',
  DKK: 'DK',
  CZK: 'CZ',
  HUF: 'HU',
  INR: 'IN',
  KRW: 'KR',
});

const INDEX_REGIONS = Object.freeze({
  US500: 'US',
  US100: 'US',
  US30: 'US',
  US2000: 'US',
  VIX: 'US',
  UK100: 'GB',
  GER40: 'DE',
  FRA40: 'FR',
  EU50: 'EU',
  ESP35: 'ES',
  IT40: 'IT',
  NETH25: 'NL',
  SWI20: 'CH',
  JPN225: 'JP',
  HK50: 'HK',
  CHINA50: 'CN',
  AUS200: 'AU',
  INDIA50: 'IN',
  KOR200: 'KR',
  SG30: 'SG',
});

const METAL_LABELS = Object.freeze({
  XAUUSD: 'Au',
  XAGUSD: 'Ag',
  XPTUSD: 'Pt',
  XPDUSD: 'Pd',
});

const CRYPTO_GLYPHS = Object.freeze({
  BTC: '₿',
  ETH: 'Ξ',
  SOL: '◎',
  XRP: 'X',
  BNB: 'B',
  ADA: '₳',
  DOGE: 'Ð',
  LTC: 'Ł',
  BCH: 'B',
  DOT: '●',
  LINK: '⬡',
  AVAX: 'A',
});

const AGRICULTURE_SYMBOLS = new Set([
  'CORN',
  'WHEAT',
  'SOYBEAN',
  'SUGAR',
  'COFFEE',
  'COCOA',
  'COTTON',
  'CATTLE',
  'HOGS',
]);

function embeddedIdentity(instrument) {
  const value = instrument?.identity;
  if (!value || value.status !== 'READY') return null;
  return value;
}

async function requestIdentity(symbol) {
  if (!symbol) return null;
  if (identityCache.has(symbol)) return identityCache.get(symbol);
  if (identityRequests.has(symbol)) return identityRequests.get(symbol);

  const task = marketApi.instrumentIdentity(symbol)
    .then(response => {
      const identity = response?.identity?.status === 'READY' ? response.identity : null;
      identityCache.set(symbol, identity);
      return identity;
    })
    .catch(() => {
      identityCache.set(symbol, null);
      return null;
    })
    .finally(() => identityRequests.delete(symbol));

  identityRequests.set(symbol, task);
  return task;
}

function flagEmoji(region) {
  const value = String(region || '').toUpperCase();
  if (value.length !== 2 || !/^[A-Z]{2}$/.test(value)) return '';
  return String.fromCodePoint(...[...value].map(letter => 127397 + letter.charCodeAt(0)));
}

function pairTokens(instrument) {
  const base = String(instrument?.baseCurrency || '').toUpperCase();
  const quote = String(instrument?.quoteCurrency || '').toUpperCase();
  if (base && quote) return [base, quote];

  const display = String(instrument?.displaySymbol || '');
  if (display.includes('/')) {
    const [left, right] = display.split('/');
    if (left && right) return [left.toUpperCase(), right.toUpperCase()];
  }

  const symbol = String(instrument?.symbol || '').toUpperCase();
  if (symbol.length === 6) return [symbol.slice(0, 3), symbol.slice(3)];
  return [symbol.slice(0, 3), ''];
}

function IdentityImage({ src, onBroken, className = '' }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      onError={() => onBroken?.(src)}
      draggable="false"
    />
  );
}

function CircleShell({ size, children, className = '' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#263b4b] bg-[#0c1923] shadow-[0_2px_7px_rgba(0,0,0,.32)] ${className}`}
      style={{ width: size, height: size }}
    >
      {children}
    </span>
  );
}

function FlagVisual({ currency, size }) {
  const emoji = flagEmoji(CURRENCY_REGIONS[String(currency || '').toUpperCase()]);
  return (
    <CircleShell size={size} className="bg-[#101c25]">
      <span
        className="grid size-full place-items-center leading-none"
        style={{ fontSize: Math.max(11, Math.round(size * 0.72)) }}
      >
        {emoji || String(currency || '').slice(0, 2)}
      </span>
    </CircleShell>
  );
}

function CryptoVisual({ token, size }) {
  const normalized = String(token || '').toUpperCase();
  return (
    <CircleShell size={size} className="bg-gradient-to-br from-[#173149] to-[#09131d]">
      <span
        className="font-black leading-none text-[#dfeaf2]"
        style={{ fontSize: Math.max(8, Math.round(size * 0.47)) }}
      >
        {CRYPTO_GLYPHS[normalized] || normalized.slice(0, 2)}
      </span>
    </CircleShell>
  );
}

function MetalVisual({ symbol, size }) {
  const label = METAL_LABELS[symbol] || String(symbol || '').slice(0, 2);
  return (
    <CircleShell size={size} className="bg-gradient-to-br from-[#31404a] via-[#1b2730] to-[#0b1319]">
      <span className="relative grid size-full place-items-center">
        <svg viewBox="0 0 32 32" className="absolute inset-0 size-full" aria-hidden="true">
          <circle cx="16" cy="16" r="10.2" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#8fa4b4]" />
          <path d="M10 10.5l2-2m8 2l2-2M9 19l-2 2m18-2l-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-[#5d7588]" />
        </svg>
        <b className="relative z-10 text-[#e2e9ee]" style={{ fontSize: Math.max(8, Math.round(size * 0.34)) }}>{label}</b>
      </span>
    </CircleShell>
  );
}

function EnergyVisual({ symbol, size }) {
  const naturalGas = String(symbol || '').startsWith('NG');
  return (
    <CircleShell size={size} className="bg-gradient-to-br from-[#15364b] to-[#09151e]">
      <svg viewBox="0 0 32 32" className="size-[70%]" aria-hidden="true">
        {naturalGas ? (
          <path d="M17 3c1.5 5-3.5 6.5-3 11 1.3-1.6 2.6-2.2 4-2.7 4.2 3.1 6 6 5.1 9.6C22.2 25 19 28 15.5 28 10.2 28 6 24.1 6 18.8c0-4.4 2.5-8.4 7.3-12.1-.2 3.4.5 5.1 1.5 6.3C15.2 9.2 17.8 7.8 17 3Z" fill="currentColor" className="text-[#65caff]" />
        ) : (
          <path d="M16 3C13 8.3 8 13.5 8 19a8 8 0 1016 0c0-5.5-5-10.7-8-16Zm0 20.5a4.5 4.5 0 01-4.5-4.5c0-2.4 2.2-5.4 4.5-8.4 2.3 3 4.5 6 4.5 8.4a4.5 4.5 0 01-4.5 4.5Z" fill="currentColor" className="text-[#67cbff]" />
        )}
      </svg>
    </CircleShell>
  );
}

function CommodityVisual({ symbol, size }) {
  const agriculture = AGRICULTURE_SYMBOLS.has(symbol);
  return (
    <CircleShell size={size} className="bg-gradient-to-br from-[#173126] to-[#0a1712]">
      <svg viewBox="0 0 32 32" className="size-[72%]" aria-hidden="true">
        {agriculture ? (
          <>
            <path d="M16 27V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[#8ccaa6]" />
            <path d="M15.7 13c-4.6-.2-7.3-2.3-8.6-5.4 4.7-.3 7.5 1.7 8.6 5.4Zm.6 5.6c4.6-.2 7.3-2.3 8.6-5.4-4.7-.3-7.5 1.7-8.6 5.4Zm-.6 4.7c-4-.1-6.4-1.9-7.6-4.6 4.1-.2 6.5 1.5 7.6 4.6Z" fill="currentColor" className="text-[#65b986]" />
          </>
        ) : (
          <>
            <path d="M8 10l8-4 8 4-8 4-8-4Zm0 2.5 8 4 8-4V22l-8 4-8-4v-9.5Z" fill="currentColor" className="text-[#85a4b8]" />
            <path d="M16 16.5V26" stroke="currentColor" strokeWidth="1.4" className="text-[#526d80]" />
          </>
        )}
      </svg>
    </CircleShell>
  );
}

function IndexVisual({ symbol, size }) {
  const emoji = flagEmoji(INDEX_REGIONS[symbol]);
  return (
    <CircleShell size={size} className="bg-[#0e1b24]">
      <span className="relative grid size-full place-items-center">
        <span className="leading-none" style={{ fontSize: Math.max(10, Math.round(size * 0.62)) }}>{emoji || '◫'}</span>
        <svg viewBox="0 0 32 32" className="absolute inset-0 size-full" aria-hidden="true">
          <path d="M8 22l5-5 4 2 7-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white/70" />
        </svg>
      </span>
    </CircleShell>
  );
}

function EquityVisual({ symbol, size }) {
  const label = String(symbol || '').replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return (
    <CircleShell size={size} className="bg-gradient-to-br from-[#173249] to-[#0a151f]">
      <span className="relative grid size-full place-items-center">
        <b className="text-[#dce8f0]" style={{ fontSize: Math.max(7, Math.round(size * 0.28)) }}>{label}</b>
        <svg viewBox="0 0 32 32" className="absolute inset-0 size-full opacity-30" aria-hidden="true">
          <path d="M7 23l5-6 4 2 8-10" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[#67c9ff]" />
        </svg>
      </span>
    </CircleShell>
  );
}

function fallbackVisual(instrument, size, token = null) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const assetClass = String(instrument?.assetClass || '').toUpperCase();

  if (assetClass === 'FOREX') return <FlagVisual currency={token || instrument?.baseCurrency} size={size} />;
  if (assetClass === 'CRYPTO') {
    const normalized = String(token || instrument?.baseCurrency || '').toUpperCase();
    if (CURRENCY_REGIONS[normalized]) return <FlagVisual currency={normalized} size={size} />;
    return <CryptoVisual token={normalized} size={size} />;
  }
  if (assetClass === 'METAL') return <MetalVisual symbol={symbol} size={size} />;
  if (assetClass === 'ENERGY') return <EnergyVisual symbol={symbol} size={size} />;
  if (assetClass === 'INDEX') return <IndexVisual symbol={symbol} size={size} />;
  if (assetClass === 'EQUITY') return <EquityVisual symbol={symbol} size={size} />;
  return <CommodityVisual symbol={symbol} size={size} />;
}

function RemoteOrFallback({ src, failedUrls, onBroken, instrument, size, token = null, className = '' }) {
  const usable = src && !failedUrls.has(src);
  if (!usable) return <span className={className}>{fallbackVisual(instrument, size, token)}</span>;
  return (
    <CircleShell size={size} className={`bg-white ${className}`}>
      <IdentityImage src={src} onBroken={onBroken} className="size-full object-contain p-[2px]" />
    </CircleShell>
  );
}

export default function InstrumentAvatar({ instrument, size = 30, className = '' }) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  const rootRef = useRef(null);
  const [identity, setIdentity] = useState(() => embeddedIdentity(instrument) || identityCache.get(symbol) || null);
  const [failedUrls, setFailedUrls] = useState(() => new Set());

  const embedded = embeddedIdentity(instrument);
  const embeddedKey = [
    embedded?.status || '',
    embedded?.logoUrl || '',
    embedded?.baseLogoUrl || '',
    embedded?.quoteLogoUrl || '',
    embedded?.checkedAt || '',
  ].join('|');

  useEffect(() => {
    if (embedded) {
      identityCache.set(symbol, embedded);
      setIdentity(embedded);
    } else {
      setIdentity(identityCache.get(symbol) || null);
    }
    setFailedUrls(new Set());
  }, [embeddedKey, symbol]);

  useEffect(() => {
    if (!symbol || identity || !REMOTE_IDENTITY_CLASSES.has(assetClass)) return undefined;
    const node = rootRef.current;
    let disposed = false;

    const load = () => {
      void requestIdentity(symbol).then(value => {
        if (!disposed && value) setIdentity(value);
      });
    };

    if (typeof IntersectionObserver === 'undefined' || !node) {
      load();
      return () => { disposed = true; };
    }

    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '180px' });
    observer.observe(node);

    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [assetClass, identity, symbol]);

  const onBroken = src => {
    if (!src) return;
    setFailedUrls(current => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
  };

  const pair = assetClass === 'FOREX' || assetClass === 'CRYPTO';
  const [baseToken, quoteToken] = useMemo(() => pairTokens(instrument), [instrument]);
  const outer = Math.max(20, Math.min(40, Number(size) || 30));
  const coin = Math.max(14, Math.min(29, Math.round(outer * 0.7)));

  if (pair) {
    return (
      <span
        ref={rootRef}
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: outer, height: outer }}
        aria-hidden="true"
        title={instrument?.name || symbol}
      >
        <span className="absolute bottom-0 left-0 z-0">
          <RemoteOrFallback
            src={identity?.quoteLogoUrl}
            failedUrls={failedUrls}
            onBroken={onBroken}
            instrument={instrument}
            size={coin}
            token={quoteToken}
          />
        </span>
        <span className="absolute right-0 top-0 z-10">
          <RemoteOrFallback
            src={identity?.baseLogoUrl}
            failedUrls={failedUrls}
            onBroken={onBroken}
            instrument={instrument}
            size={coin}
            token={baseToken}
          />
        </span>
      </span>
    );
  }

  const logoUrl = identity?.logoUrl && !failedUrls.has(identity.logoUrl) ? identity.logoUrl : null;
  return (
    <span
      ref={rootRef}
      className={`inline-grid shrink-0 place-items-center ${className}`}
      style={{ width: outer, height: outer }}
      aria-hidden="true"
      title={instrument?.name || symbol}
    >
      {logoUrl ? (
        <CircleShell size={outer} className="bg-white">
          <IdentityImage src={logoUrl} onBroken={onBroken} className="size-full object-contain p-[2px]" />
        </CircleShell>
      ) : fallbackVisual(instrument, outer)}
    </span>
  );
}
