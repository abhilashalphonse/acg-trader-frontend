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
  const white = '#f5f5f5';
  const muted = '#7f858b';

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (photoTemplate) {
    drawImageCover(ctx, photo, 0, 0, canvas.width, canvas.height);
    const shade = ctx.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, 'rgba(0,0,0,0.38)');
    shade.addColorStop(0.42, 'rgba(0,0,0,0.62)');
    shade.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const glow = ctx.createRadialGradient(940, 120, 30, 940, 120, 720);
    glow.addColorStop(0, 'rgba(83,199,255,0.16)');
    glow.addColorStop(0.42, 'rgba(33,104,135,0.07)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ACG structural frame.
  ctx.strokeStyle = 'rgba(83,199,255,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, 984, 1254);

  // Very subtle terminal grid. It should read as atmosphere, not content.
  ctx.strokeStyle = 'rgba(83,199,255,0.055)';
  ctx.lineWidth = 1;
  for (let x = 82; x <= 998; x += 152) {
    ctx.beginPath();
    ctx.moveTo(x, 300);
    ctx.lineTo(x, 1082);
    ctx.stroke();
  }
  for (let y = 330; y <= 1082; y += 126) {
    ctx.beginPath();
    ctx.moveTo(82, y);
    ctx.lineTo(998, y);
    ctx.stroke();
  }

  // Soft market-trace motif unique to ACG's terminal language.
  ctx.strokeStyle = 'rgba(83,199,255,0.14)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(610, 208);
  ctx.lineTo(690, 184);
  ctx.lineTo(746, 220);
  ctx.lineTo(822, 146);
  ctx.lineTo(884, 172);
  ctx.lineTo(958, 112);
  ctx.stroke();

  // Header.
  ctx.fillStyle = white;
  ctx.font = '900 30px Inter, Arial, sans-serif';
  ctx.fillText('ACG TRADER', 82, 108);

  ctx.strokeStyle = 'rgba(83,199,255,0.34)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(82, 136);
  ctx.lineTo(998, 136);
  ctx.stroke();

  // Trader identity.
  drawCircleAvatar(ctx, photo, 82, 166, 74, displayName);
  ctx.fillStyle = white;
  ctx.font = '800 30px Inter, Arial, sans-serif';
  ctx.fillText(displayName, 180, 199);
  ctx.fillStyle = muted;
  ctx.font = '700 17px Inter, Arial, sans-serif';
  ctx.fillText('TRADER PROFILE', 180, 226);

  drawRoundedRect(ctx, 852, 168, 146, 46, 8, 'rgba(83,199,255,0.28)', 'rgba(0,0,0,0.38)');
  ctx.fillStyle = cyan;
  ctx.font = '800 18px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LIVE', 925, 198);
  ctx.textAlign = 'left';

  // Instrument.
  ctx.fillStyle = white;
  const symbolSize = fitText(ctx, model.symbol, 720, 64, 40, 850);
  ctx.font = '850 ' + symbolSize + 'px Inter, Arial, sans-serif';
  ctx.fillText(model.symbol, 82, 360);

  drawRoundedRect(ctx, 82, 392, 146, 48, 7, sideColor, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = sideColor;
  ctx.font = '800 20px Inter, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(model.side, 155, 423);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#b7b7b7';
  ctx.font = '700 21px Inter, Arial, sans-serif';
  ctx.fillText(model.volume.toFixed(2) + ' LOTS', 258, 423);

  // Hero result panel.
  drawRoundedRect(ctx, 82, 492, 916, 304, 14, 'rgba(83,199,255,0.16)', 'rgba(3,8,12,0.76)');
  ctx.fillStyle = cyan;
  ctx.fillRect(82, 492, 5, 304);

  ctx.fillStyle = '#9b9b9b';
  ctx.font = '800 19px Inter, Arial, sans-serif';
  ctx.fillText(model.roiPercent == null ? 'OPEN P&L' : 'RETURN ON MARGIN', 120, 542);

  if (model.roiPercent != null) {
    const roiText = (model.roiPercent >= 0 ? '+' : '') + model.roiPercent.toFixed(2) + '%';
    const roiSize = fitText(ctx, roiText, 790, 124, 78, 900);
    ctx.fillStyle = resultColor;
    ctx.font = '900 ' + roiSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(roiText, 116, 675);

    ctx.fillStyle = white;
    ctx.font = '850 47px Inter, Arial, sans-serif';
    ctx.fillText(formatSharePnl(model.pnl, model.currency), 120, 742);

    ctx.fillStyle = muted;
    ctx.font = '700 17px Inter, Arial, sans-serif';
    ctx.fillText('UNREALIZED P&L', 120, 772);
  } else {
    const pnlText = formatSharePnl(model.pnl, model.currency);
    const pnlSize = fitText(ctx, pnlText, 790, 112, 70, 900);
    ctx.fillStyle = resultColor;
    ctx.font = '900 ' + pnlSize + 'px Inter, Arial, sans-serif';
    ctx.fillText(pnlText, 116, 674);

    ctx.fillStyle = muted;
    ctx.font = '700 17px Inter, Arial, sans-serif';
    ctx.fillText('LIVE MARK-TO-MARKET', 120, 730);
  }

  // Two balanced metric tiles.
  const tileY = 846;
  const tileW = 445;
  const tileGap = 26;
  const tileXs = [82, 82 + tileW + tileGap];
  const stats = [
    ['ENTRY', model.entryDisplay || '—', 'POSITION OPEN'],
    ['LAST', model.currentDisplay || '—', 'MARK PRICE'],
  ];

  stats.forEach(([label, value, helper], index) => {
    const x = tileXs[index];
    drawRoundedRect(ctx, x, tileY, tileW, 138, 12, 'rgba(255,255,255,0.09)', 'rgba(8,8,8,0.92)');
    ctx.fillStyle = '#777777';
    ctx.font = '800 16px Inter, Arial, sans-serif';
    ctx.fillText(label, x + 22, tileY + 34);

    ctx.fillStyle = white;
    const valueSize = fitText(ctx, value, tileW - 44, 34, 20, 800);
    ctx.font = '750 ' + valueSize + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(value, x + 22, tileY + 88);

    ctx.fillStyle = '#555555';
    ctx.font = '650 14px Inter, Arial, sans-serif';
    ctx.fillText(helper, x + 22, tileY + 116);
  });

  // Status line.
  ctx.strokeStyle = 'rgba(83,199,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(82, 1046);
  ctx.lineTo(998, 1046);
  ctx.stroke();

  ctx.fillStyle = '#777777';
  ctx.font = '700 16px Inter, Arial, sans-serif';
  ctx.fillText('POSITION STATUS', 82, 1094);

  ctx.fillStyle = white;
  ctx.font = '800 21px Inter, Arial, sans-serif';
  ctx.fillText('OPEN / LIVE', 82, 1128);

  const date = model.generatedAt instanceof Date ? model.generatedAt : new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

  ctx.fillStyle = '#686868';
  ctx.font = '600 17px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(stamp, 998, 1128);
  ctx.textAlign = 'left';

  // Footer band.
  ctx.fillStyle = '#050505';
  ctx.fillRect(49, 1184, 982, 117);
  ctx.strokeStyle = 'rgba(83,199,255,0.20)';
  ctx.beginPath();
  ctx.moveTo(49, 1184);
  ctx.lineTo(1031, 1184);
  ctx.stroke();

  ctx.fillStyle = white;
  ctx.font = '900 34px Inter, Arial, sans-serif';
  ctx.fillText('ACG Trader', 82, 1248);
  ctx.fillStyle = cyan;
  ctx.fillRect(82, 1268, 152, 4);

  ctx.fillStyle = '#696969';
  ctx.font = '650 17px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TRADE. TRACK. IMPROVE.', 998, 1248);
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
