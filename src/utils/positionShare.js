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

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load profile image.'));
    image.src = src;
  });
}

function drawImageCover(ctx, image, x, y, width, height) {
  if (!image) return;
  const sourceRatio = image.width / image.height;
  const targetRatio = width / height;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;

  if (sourceRatio > targetRatio) {
    sw = image.height * targetRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / targetRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function drawCircleAvatar(ctx, image, x, y, size, name) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  if (image) {
    drawImageCover(ctx, image, x, y, size, size);
  } else {
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, '#16384d');
    gradient.addColorStop(1, '#0a1720');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#f5f5f5';
    ctx.font = `800 ${Math.round(size * 0.34)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initials = String(name || 'Trader').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'T';
    ctx.fillText(initials, x + size / 2, y + size / 2 + 1);
  }

  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

export async function renderPositionSharePng(model, profile = {}) {
  if (typeof document === 'undefined') throw new Error('Image generation is only available in the browser.');

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas rendering is unavailable.');

  const displayName = String(profile?.displayName || 'Trader').trim() || 'Trader';
  const photo = await loadCanvasImage(profile?.sharePhotoDataUrl || null).catch(() => null);
  const photoTemplate = profile?.shareTemplate === 'PHOTO' && Boolean(photo);
  const positive = Number(model.pnl) >= 0;
  const resultColor = positive ? '#2ddb9f' : '#ff5f6d';
  const sideColor = model.side === 'BUY' ? '#2ddb9f' : '#ff5f6d';
  const cyan = '#53c7ff';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (photoTemplate) {
    drawImageCover(ctx, photo, 0, 0, canvas.width, canvas.height);
    const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, 'rgba(0,0,0,0.34)');
    shade.addColorStop(0.5, 'rgba(0,0,0,0.60)');
    shade.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const glow = ctx.createRadialGradient(860, 160, 20, 860, 160, 760);
    glow.addColorStop(0, 'rgba(83,199,255,0.16)');
    glow.addColorStop(0.45, 'rgba(20,66,88,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.strokeStyle = 'rgba(83,199,255,0.13)';
  ctx.lineWidth = 1;
  for (let x = 82; x <= 998; x += 114) {
    ctx.beginPath(); ctx.moveTo(x, 250); ctx.lineTo(x, 1130); ctx.stroke();
  }
  for (let y = 250; y <= 1130; y += 110) {
    ctx.beginPath(); ctx.moveTo(82, y); ctx.lineTo(998, y); ctx.stroke();
  }

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 28px Inter, Arial, sans-serif';
  ctx.fillText('ACG TRADER', 82, 96);
  ctx.fillStyle = cyan;
  ctx.font = '800 17px Inter, Arial, sans-serif';
  ctx.fillText('/ POSITION SNAPSHOT', 265, 95);

  ctx.strokeStyle = 'rgba(83,199,255,0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(82, 126); ctx.lineTo(998, 126); ctx.stroke();

  drawCircleAvatar(ctx, photo, 82, 160, 74, displayName);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '800 31px Inter, Arial, sans-serif';
  ctx.fillText(displayName, 180, 196);
  ctx.fillStyle = '#737373';
  ctx.font = '650 18px Inter, Arial, sans-serif';
  ctx.fillText('TRADER PROFILE', 180, 224);

  ctx.fillStyle = '#f5f5f5';
  const symbolSize = fitText(ctx, model.symbol, 690, 62, 40, 850);
  ctx.font = '850 ' + symbolSize + 'px Inter, Arial, sans-serif';
  ctx.fillText(model.symbol, 82, 360);

  drawRoundedRect(ctx, 82, 390, 146, 48, 6, sideColor, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = sideColor;
  ctx.font = '800 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.side, 155, 421);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '700 21px Inter, Arial, sans-serif';
  ctx.fillText(model.volume.toFixed(2) + ' LOTS', 256, 421);

  ctx.strokeStyle = 'rgba(83,199,255,0.40)';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(82, 505); ctx.lineTo(82, 748); ctx.stroke();
  ctx.fillStyle = '#a3a3a3';
  ctx.font = '750 22px Inter, Arial, sans-serif';
  ctx.fillText(model.roiPercent == null ? 'OPEN P&L' : 'RETURN ON MARGIN', 116, 545);

  if (model.roiPercent != null) {
    const roiText = (model.roiPercent >= 0 ? '+' : '') + model.roiPercent.toFixed(2) + '%';
    const roiSize = fitText(ctx, roiText, 820, 126, 78, 900);
    ctx.fillStyle = resultColor;
    ctx.font = '900 ' + roiSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(roiText, 112, 674);
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '850 45px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePnl(model.pnl, model.currency), 116, 734);
  } else {
    const pnlText = formatSharePnl(model.pnl, model.currency);
    const pnlSize = fitText(ctx, pnlText, 820, 112, 70, 900);
    ctx.fillStyle = resultColor;
    ctx.font = '900 ' + pnlSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(pnlText, 112, 665);
  }

  ctx.fillStyle = '#737373';
  ctx.font = '700 18px Inter, Arial, sans-serif';
  ctx.fillText('LIVE MARK-TO-MARKET', 116, 772);

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(82, 835); ctx.lineTo(998, 835); ctx.stroke();

  const statX = [82, 410, 738];
  const labels = ['ENTRY', 'LAST', 'MOVE'];
  const values = [model.entryDisplay || '—', model.currentDisplay || '—', formatSharePips(model.pips)];
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = '#737373';
    ctx.font = '750 17px Inter, Arial, sans-serif';
    ctx.fillText(labels[i], statX[i], 895);
    ctx.fillStyle = i === 2 ? resultColor : '#f5f5f5';
    ctx.font = i === 2 ? '800 29px Inter, Arial, sans-serif' : '750 31px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(values[i], statX[i], 940);
  }

  ctx.strokeStyle = 'rgba(83,199,255,0.16)';
  ctx.beginPath(); ctx.moveTo(82, 1002); ctx.lineTo(998, 1002); ctx.stroke();

  ctx.fillStyle = '#8a8a8a';
  ctx.font = '650 18px Inter, Arial, sans-serif';
  ctx.fillText('POSITION STATUS', 82, 1060);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '800 21px Inter, Arial, sans-serif';
  ctx.fillText('OPEN / LIVE', 82, 1094);

  const date = model.generatedAt instanceof Date ? model.generatedAt : new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = '#737373';
  ctx.font = '600 18px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(stamp, 998, 1094);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 1184, 1080, 166);
  ctx.strokeStyle = 'rgba(83,199,255,0.24)';
  ctx.beginPath(); ctx.moveTo(0, 1184); ctx.lineTo(1080, 1184); ctx.stroke();
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 35px Inter, Arial, sans-serif';
  ctx.fillText('ACG Trader', 82, 1266);
  ctx.fillStyle = cyan;
  ctx.fillRect(82, 1287, 190, 4);
  ctx.fillStyle = '#6f6f6f';
  ctx.font = '650 18px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TERMINAL PERFORMANCE CARD', 998, 1265);
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
