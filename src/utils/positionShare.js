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
  const margin = finiteNumber(position?.margin);
  const roiPercent = margin != null && margin > 0 && pnl != null ? (pnl / margin) * 100 : null;
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
    margin,
    roiPercent,
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
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const positive = Number(model.pnl) >= 0;
  const accent = positive ? '#2ddb9f' : '#ff5f6d';
  const accentSoft = positive ? 'rgba(45,219,159,0.18)' : 'rgba(255,95,109,0.16)';
  const sideColor = model.side === 'BUY' ? '#2ddb9f' : '#ff5f6d';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(850, 180, 40, 850, 180, 780);
  glow.addColorStop(0, accentSoft);
  glow.addColorStop(0.55, positive ? 'rgba(5,69,48,0.09)' : 'rgba(92,18,29,0.08)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const bottomFade = ctx.createLinearGradient(0, 900, 0, 1350);
  bottomFade.addColorStop(0, 'rgba(0,0,0,0)');
  bottomFade.addColorStop(1, 'rgba(255,255,255,0.025)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(0, 800, canvas.width, 550);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '800 34px Inter, Arial, sans-serif';
  ctx.fillText('ACG TRADER', 82, 104);

  drawRoundedRect(ctx, 824, 66, 174, 52, 10, 'rgba(255,255,255,0.13)', '#080808');
  ctx.fillStyle = '#8a8a8a';
  ctx.font = '800 19px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OPEN POSITION', 911, 100);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#f5f5f5';
  const symbolSize = fitText(ctx, model.symbol, 720, 66, 42, 800);
  ctx.font = '800 ' + symbolSize + 'px Inter, Arial, sans-serif';
  ctx.fillText(model.symbol, 82, 260);

  drawRoundedRect(ctx, 82, 294, 154, 54, 8, sideColor, '#000000');
  ctx.fillStyle = sideColor;
  ctx.font = '800 23px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.side, 159, 329);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#9a9a9a';
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.fillText(model.volume.toFixed(2) + ' lots', 266, 329);

  ctx.fillStyle = '#b5b5b5';
  ctx.font = '650 28px Inter, Arial, sans-serif';
  ctx.fillText(model.roiPercent == null ? 'Unrealized P&L' : 'Trading ROI', 82, 482);

  if (model.roiPercent != null) {
    const roiText = (model.roiPercent >= 0 ? '+' : '') + model.roiPercent.toFixed(2) + '%';
    const roiSize = fitText(ctx, roiText, 900, 128, 78, 900);
    ctx.fillStyle = accent;
    ctx.font = '900 ' + roiSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(roiText, 82, 620);

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '800 46px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePnl(model.pnl, model.currency), 84, 704);

    ctx.fillStyle = '#777777';
    ctx.font = '600 24px Inter, Arial, sans-serif';
    ctx.fillText('Unrealized P&L', 84, 742);
  } else {
    const pnlText = formatSharePnl(model.pnl, model.currency);
    const pnlSize = fitText(ctx, pnlText, 900, 112, 68, 900);
    ctx.fillStyle = accent;
    ctx.font = '900 ' + pnlSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(pnlText, 82, 625);

    ctx.fillStyle = '#8a8a8a';
    ctx.font = '700 30px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePips(model.pips), 84, 694);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(82, 818);
  ctx.lineTo(998, 818);
  ctx.stroke();

  ctx.fillStyle = '#777777';
  ctx.font = '650 23px Inter, Arial, sans-serif';
  ctx.fillText('Entry Price', 82, 884);
  ctx.fillText('Last Price', 586, 884);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '700 43px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(model.entryDisplay || '—', 82, 945);
  ctx.fillText(model.currentDisplay || '—', 586, 945);

  ctx.fillStyle = '#777777';
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.fillText('Distance', 82, 1028);

  ctx.fillStyle = positive ? '#72e9bd' : '#ff9098';
  ctx.font = '750 33px Inter, Arial, sans-serif';
  ctx.fillText(formatSharePips(model.pips), 82, 1077);

  const date = model.generatedAt instanceof Date ? model.generatedAt : new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = '#606060';
  ctx.font = '600 21px Inter, Arial, sans-serif';
  ctx.fillText(stamp, 82, 1151);

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(0, 1200);
  ctx.lineTo(1080, 1200);
  ctx.stroke();

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 36px Inter, Arial, sans-serif';
  ctx.fillText('ACG', 82, 1281);
  ctx.fillStyle = '#53c7ff';
  ctx.fillText('TRADER', 174, 1281);

  ctx.fillStyle = '#6f6f6f';
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Trade. Track. Improve.', 998, 1280);
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
    text: model.roiPercent == null
      ? 'Open position P&L shared from ACG Trader: ' + formatSharePnl(model.pnl, model.currency)
      : 'Open position ROI shared from ACG Trader: ' + (model.roiPercent >= 0 ? '+' : '') + model.roiPercent.toFixed(2) + '% · ' + formatSharePnl(model.pnl, model.currency),
    files: [file],
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share(payload);
    return 'shared';
  }

  downloadPositionShare(blob, model);
  return 'downloaded';
}
