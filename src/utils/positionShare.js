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

function drawAcgBrand(ctx, x, y, scale = 0.12) {
  const paths = [
    ['M160 64H352C410 64 448 102 448 160V240C390 190 350 176 280 176H176C176 140 165 100 160 64Z', '#00d8f4', '#0072ff'],
    ['M448 160V352C448 410 410 448 352 448H272C322 390 336 350 336 280V176C372 176 412 165 448 160Z', '#0072ff', '#0033aa'],
    ['M352 448H160C102 448 64 410 64 352V272C122 322 162 336 232 336H336C336 372 347 412 352 448Z', '#0033aa', '#0055ff'],
    ['M64 352V160C64 102 102 64 160 64H240C190 122 176 162 176 232V336C140 336 100 347 64 352Z', '#0055ff', '#00d8f4'],
  ];

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  paths.forEach(([pathData, from, to], index) => {
    const gradient = index === 1
      ? ctx.createLinearGradient(0, 0, 0, 512)
      : ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fill(new Path2D(pathData));
  });
  ctx.restore();
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
  const accent = positive ? '#2ddb9f' : '#ff5f6d';
  const sideColor = model.side === 'BUY' ? '#2ddb9f' : '#ff5f6d';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (photoTemplate) {
    drawImageCover(ctx, photo, 0, 0, canvas.width, canvas.height);
    const photoShade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    photoShade.addColorStop(0, 'rgba(0,0,0,0.24)');
    photoShade.addColorStop(0.48, 'rgba(0,0,0,0.42)');
    photoShade.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = photoShade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const sideShade = ctx.createLinearGradient(0, 0, canvas.width, 0);
    sideShade.addColorStop(0, 'rgba(0,0,0,0.42)');
    sideShade.addColorStop(0.7, 'rgba(0,0,0,0.02)');
    ctx.fillStyle = sideShade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const glow = ctx.createRadialGradient(880, 170, 30, 880, 170, 820);
    glow.addColorStop(0, positive ? 'rgba(45,219,159,0.22)' : 'rgba(255,95,109,0.20)');
    glow.addColorStop(0.5, positive ? 'rgba(5,69,48,0.10)' : 'rgba(92,18,29,0.09)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawCircleAvatar(ctx, photo, 82, 76, 82, displayName);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '800 34px Inter, Arial, sans-serif';
  ctx.fillText(displayName, 190, 118);

  ctx.fillStyle = '#8a8a8a';
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.fillText('ACG Trader', 190, 151);

  ctx.fillStyle = '#f5f5f5';
  const symbolSize = fitText(ctx, model.symbol, 800, 66, 42, 800);
  ctx.font = '800 ' + symbolSize + 'px Inter, Arial, sans-serif';
  ctx.fillText(model.symbol, 82, 306);

  drawRoundedRect(ctx, 82, 340, 154, 54, 8, sideColor, 'rgba(0,0,0,0.46)');
  ctx.fillStyle = sideColor;
  ctx.font = '800 23px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.side, 159, 375);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#b0b0b0';
  ctx.font = '600 24px Inter, Arial, sans-serif';
  ctx.fillText(model.volume.toFixed(2) + ' lots', 266, 375);

  ctx.fillStyle = '#e5e5e5';
  ctx.font = '650 30px Inter, Arial, sans-serif';
  ctx.fillText(model.roiPercent == null ? 'Unrealized P&L' : 'Trading ROI%', 82, 528);

  if (model.roiPercent != null) {
    const roiText = (model.roiPercent >= 0 ? '+' : '') + model.roiPercent.toFixed(2) + '%';
    const roiSize = fitText(ctx, roiText, 900, 132, 80, 900);
    ctx.fillStyle = accent;
    ctx.font = '900 ' + roiSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(roiText, 82, 675);

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '800 50px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePnl(model.pnl, model.currency), 84, 760);

    ctx.fillStyle = '#949494';
    ctx.font = '600 23px Inter, Arial, sans-serif';
    ctx.fillText('Unrealized P&L', 84, 797);
  } else {
    const pnlText = formatSharePnl(model.pnl, model.currency);
    const pnlSize = fitText(ctx, pnlText, 900, 118, 72, 900);
    ctx.fillStyle = accent;
    ctx.font = '900 ' + pnlSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(pnlText, 82, 682);

    ctx.fillStyle = positive ? '#72e9bd' : '#ff9098';
    ctx.font = '750 34px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePips(model.pips), 84, 744);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(82, 858);
  ctx.lineTo(998, 858);
  ctx.stroke();

  ctx.fillStyle = '#8a8a8a';
  ctx.font = '650 23px Inter, Arial, sans-serif';
  ctx.fillText('Entry Price', 82, 924);
  ctx.fillText('Last Price', 586, 924);

  ctx.fillStyle = '#f5f5f5';
  ctx.font = '700 43px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(model.entryDisplay || '—', 82, 986);
  ctx.fillText(model.currentDisplay || '—', 586, 986);

  ctx.fillStyle = '#777777';
  ctx.font = '600 23px Inter, Arial, sans-serif';
  ctx.fillText('Distance', 82, 1068);
  ctx.fillStyle = positive ? '#72e9bd' : '#ff9098';
  ctx.font = '750 32px Inter, Arial, sans-serif';
  ctx.fillText(formatSharePips(model.pips), 82, 1114);

  const date = model.generatedAt instanceof Date ? model.generatedAt : new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  ctx.fillStyle = '#686868';
  ctx.font = '600 20px Inter, Arial, sans-serif';
  ctx.fillText(stamp, 82, 1172);

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.moveTo(0, 1210);
  ctx.lineTo(1080, 1210);
  ctx.stroke();

  drawAcgBrand(ctx, 76, 1241, 0.13);
  ctx.fillStyle = '#f5f5f5';
  ctx.font = '900 34px Inter, Arial, sans-serif';
  ctx.fillText('ACG', 150, 1294);
  ctx.fillStyle = '#b3b3b3';
  ctx.font = '700 31px Inter, Arial, sans-serif';
  ctx.fillText('Trader', 224, 1294);

  ctx.fillStyle = '#6f6f6f';
  ctx.font = '600 19px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Trade. Track. Improve.', 998, 1292);
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
