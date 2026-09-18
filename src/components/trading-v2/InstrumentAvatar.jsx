import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marketApi } from '../../api/market.js';

const identityCache = new Map();
const identityRequests = new Map();
const REMOTE_IDENTITY_CLASSES = new Set(['FOREX', 'CRYPTO', 'EQUITY']);

const METAL_LABELS = Object.freeze({
  XAUUSD: 'Au',
  XAGUSD: 'Ag',
  XPTUSD: 'Pt',
  XPDUSD: 'Pd',
});

const INDEX_LABELS = Object.freeze({
  US500: 'US',
  US100: 'US',
  US30: 'US',
  US2000: 'US',
  VIX: 'VIX',
  UK100: 'UK',
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
      const identity = response?.identity || null;
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

function fallbackToken(instrument) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const assetClass = String(instrument?.assetClass || '').toUpperCase();

  if (assetClass === 'METAL') return METAL_LABELS[symbol] || String(instrument?.baseCurrency || symbol).slice(0, 2);
  if (assetClass === 'INDEX') return INDEX_LABELS[symbol] || symbol.slice(0, 3);
  if (assetClass === 'ENERGY') {
    if (symbol.startsWith('WTI')) return 'WTI';
    if (symbol.startsWith('XBR')) return 'BR';
    if (symbol.startsWith('NG')) return 'NG';
    return symbol.slice(0, 3);
  }
  if (assetClass === 'CRYPTO') return String(instrument?.baseCurrency || symbol.replace(/USD$/, '')).slice(0, 4);
  if (assetClass === 'EQUITY') return symbol.slice(0, 3);
  if (assetClass === 'OTHER') return symbol.slice(0, 3);
  return String(instrument?.baseCurrency || symbol.slice(0, 3)).slice(0, 3);
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

function IdentityImage({ src, alt, className, style, onBroken }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className={className}
      style={style}
      onError={onBroken}
    />
  );
}

export default function InstrumentAvatar({ instrument, size = 30, className = '' }) {
  const symbol = String(instrument?.symbol || '').toUpperCase();
  const assetClass = String(instrument?.assetClass || '').toUpperCase();
  const rootRef = useRef(null);
  const [identity, setIdentity] = useState(() => embeddedIdentity(instrument) || identityCache.get(symbol) || null);
  const [broken, setBroken] = useState(false);

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
    setBroken(false);
  }, [embeddedKey, symbol]);

  useEffect(() => {
    if (!symbol || identity || !REMOTE_IDENTITY_CLASSES.has(assetClass)) return undefined;
    const node = rootRef.current;
    let disposed = false;

    const load = () => {
      void requestIdentity(symbol).then(value => {
        if (!disposed && value?.status === 'READY') setIdentity(value);
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

  const pair = assetClass === 'FOREX' || assetClass === 'CRYPTO';
  const [baseToken, quoteToken] = useMemo(() => pairTokens(instrument), [instrument]);
  const baseLogo = !broken ? identity?.baseLogoUrl : null;
  const quoteLogo = !broken ? identity?.quoteLogoUrl : null;
  const singleLogo = !broken ? identity?.logoUrl : null;
  const outer = Math.max(22, Number(size) || 30);
  const coin = Math.max(16, Math.round(outer * 0.72));

  if (pair && (baseLogo || quoteLogo)) {
    return (
      <span
        ref={rootRef}
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: outer, height: outer }}
        aria-hidden="true"
      >
        <IdentityImage
          src={baseLogo}
          alt=""
          onBroken={() => setBroken(true)}
          className="absolute left-0 top-1/2 rounded-full border border-[#263c4d] bg-white object-cover shadow-sm"
          style={{ width: coin, height: coin, transform: 'translateY(-50%)' }}
        />
        <IdentityImage
          src={quoteLogo}
          alt=""
          onBroken={() => setBroken(true)}
          className="absolute right-0 top-1/2 rounded-full border border-[#263c4d] bg-white object-cover shadow-sm"
          style={{ width: coin, height: coin, transform: 'translateY(-50%)' }}
        />
      </span>
    );
  }

  if (!pair && singleLogo) {
    return (
      <span
        ref={rootRef}
        className={`grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#243746] bg-white ${className}`}
        style={{ width: outer, height: outer }}
        aria-hidden="true"
      >
        <IdentityImage
          src={singleLogo}
          alt=""
          onBroken={() => setBroken(true)}
          className="size-full object-contain p-[2px]"
        />
      </span>
    );
  }

  if (pair) {
    return (
      <span
        ref={rootRef}
        className={`relative inline-block shrink-0 ${className}`}
        style={{ width: outer, height: outer }}
        aria-hidden="true"
      >
        <span
          className="absolute left-0 top-1/2 grid place-items-center rounded-full border border-[#294052] bg-[#102331] font-black text-[#a9bdcc]"
          style={{ width: coin, height: coin, transform: 'translateY(-50%)', fontSize: Math.max(6, Math.round(coin * 0.34)) }}
        >
          {baseToken.slice(0, 3)}
        </span>
        <span
          className="absolute right-0 top-1/2 grid place-items-center rounded-full border border-[#294052] bg-[#0b1822] font-black text-[#8398aa]"
          style={{ width: coin, height: coin, transform: 'translateY(-50%)', fontSize: Math.max(6, Math.round(coin * 0.34)) }}
        >
          {quoteToken.slice(0, 3)}
        </span>
      </span>
    );
  }

  return (
    <span
      ref={rootRef}
      className={`grid shrink-0 place-items-center rounded-full border border-[#263b4b] bg-gradient-to-br from-[#112735] to-[#09151e] font-black tracking-[-0.04em] text-[#a9bdcc] shadow-[inset_0_1px_rgba(255,255,255,.04)] ${className}`}
      style={{ width: outer, height: outer, fontSize: Math.max(7, Math.round(outer * 0.29)) }}
      aria-hidden="true"
      title={instrument?.name || symbol}
    >
      {fallbackToken(instrument)}
    </span>
  );
}
