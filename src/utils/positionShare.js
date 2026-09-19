import { formatInstrumentPrice, instrumentPipSize } from './instrumentFormatting.js';

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function currencySymbol(currency = 'USD') {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0);
    return parts.find(part => part.type === 'currency')?.value || currency;
  } catch {
    return currency;
  }
}

export function buildPositionShareModel(position, instrument, now = new Date()) {
  const side = String(position?.side || '').toUpperCase();
  const entryPrice = finiteNumber(position?.entry ?? position?.entryPrice);
  const fallbackClose = side === 'BUY' ? finiteNumber(instrument?.bid) : finiteNumber(instrument?.ask);
  const currentPrice = finiteNumber(position?.closePrice) ?? fallbackClose;
  const pnl = finiteNumber(position?.pnl ?? position?.floatingPnl);
  const volume = finiteNumber(position?.volume ?? position?.openVolume) ?? 0;
  const pipSize = instrumentPipSize(instrument);
  const rawMove = entryPrice != null && currentPrice != null && Number.isFinite(pipSize) && pipSize > 0
    ? (currentPrice - entryPrice) / pipSize
    : null;
  const pips = rawMove == null ? null : (side === 'SELL' ? -rawMove : rawMove);
  const currency = String(position?.pnlCurrency || instrument?.pnlCurrency || instrument?.quoteCurrency || 'USD').toUpperCase();

  return {
    status: 'OPEN',
    symbol: String(instrument?.displaySymbol || position?.symbol || '—'),
    side: side === 'SELL' ? 'SELL' : 'BUY',
    volume,
    entryPrice,
    currentPrice,
    pnl,
    pips,
    currency,
    entryDisplay: formatInstrumentPrice(entryPrice, instrument),
    currentDisplay: formatInstrumentPrice(currentPrice, instrument),
    generatedAt: now instanceof Date ? now : new Date(now),
  };
}

export function formatSharePnl(value, currency = 'USD') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  try {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(numeric));
    return `${numeric >= 0 ? '+' : '-'}${formatted}`;
  } catch {
    return `${numeric >= 0 ? '+' : '-'}${currencySymbol(currency)}${Math.abs(numeric).toFixed(2)}`;
  }
}

export function formatSharePips(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(1)} pips`;
}

function drawRoundedRect(ctx, x, y, width, height, radius, stroke, fill) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function fitText(ctx, text, maxWidth, startSize, minSize = 22, weight = 700) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

export async function renderPositionSharePng(model) {
  if (typeof document === 'undefined') throw new Error('Image generation is only available in the browser.');

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const positive = Number(model.pnl) >= 0;
  const sideColor = model.side === 'BUY' ? '#2ddb9f' : '#ff5f6d';
  const pnlColor = positive ? '#2ddb9f' : '#ff5f6d';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  ctx.strokeRect(34, 34, 1012, 1012);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '800 34px Inter, Arial, sans-serif';
  ctx.fillText('ACG TRADER', 78, 105);

  drawRoundedRect(ctx, 842, 71, 160, 50, 10, 'rgba(255,255,255,0.12)', '#080808');
  ctx.fillStyle = '#9ca3af';
  ctx.font = '800 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE POSITION', 922, 103);
  ctx.textAlign = 'left';

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(78, 150);
  ctx.lineTo(1002, 150);
  ctx.stroke();

  const symbolSize = fitText(ctx, model.symbol, 650, 72, 42, 800);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = `800 ${symbolSize}px Inter, Arial, sans-serif`;
  ctx.fillText(model.symbol, 78, 260);

  drawRoundedRect(ctx, 78, 295, 174, 58, 9, sideColor, '#000000');
  ctx.fillStyle = sideColor;
  ctx.font = '800 25px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.side, 165, 333);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#737373';
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.fillText(`${model.volume.toFixed(2)} lots`, 278, 333);

  ctx.fillStyle = '#737373';
  ctx.font = '700 23px Inter, Arial, sans-serif';
  ctx.fillText('UNREALIZED P&L', 78, 445);

  const pnlText = formatSharePnl(model.pnl, model.currency);
  const pnlSize = fitText(ctx, pnlText, 860, 112, 64, 900);
  ctx.fillStyle = pnlColor;
  ctx.font = `900 ${pnlSize}px Inter, Arial, sans-serif`;
  ctx.fillText(pnlText, 78, 565);

  ctx.fillStyle = positive ? '#70e7bc' : '#ff8992';
  ctx.font = '700 31px Inter, Arial, sans-serif';
  ctx.fillText(formatSharePips(model.pips), 80, 620);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(78, 678);
  ctx.lineTo(1002, 678);
  ctx.stroke();

  const rows = [
    ['ENTRY', model.entryDisplay],
    ['CURRENT', model.currentDisplay],
    ['SIZE', `${model.volume.toFixed(2)} lots`],
  ];

  rows.forEach(([label, value], index) => {
    const y = 748 + index * 72;
    ctx.fillStyle = '#737373';
    ctx.font = '700 21px Inter, Arial, sans-serif';
    ctx.fillText(label, 78, y);
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '700 29px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(value || '—', 1002, y);
    ctx.textAlign = 'left';
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(78, 963);
  ctx.lineTo(1002, 963);
  ctx.stroke();

  ctx.fillStyle = '#737373';
  ctx.font = '600 19px Inter, Arial, sans-serif';
  ctx.fillText('Generated by ACG Trader', 78, 1009);

  const date = model.generatedAt instanceof Date ? model.generatedAt : new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  ctx.textAlign = 'right';
  ctx.fillText(stamp, 1002, 1009);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to generate share image.')), 'image/png', 0.96);
  });
}

export function downloadPositionShare(blob, model) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeSymbol = String(model.symbol || 'position').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
  anchor.href = url;
  anchor.download = `acg-trader-${safeSymbol || 'position'}-pnl.png`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function sharePositionPnl(blob, model) {
  const file = new File([blob], 'acg-trader-position-pnl.png', { type: 'image/png' });
  const payload = {
    title: `${model.symbol} ${model.side} P&L`,
    text: `Open position P&L shared from ACG Trader: ${formatSharePnl(model.pnl, model.currency)}`,
    files: [file],
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(payload);
    return 'shared';
  }

  downloadPositionShare(blob, model);
  return 'downloaded';
}
