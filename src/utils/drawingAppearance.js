// Shared defaults for new drawings. Existing persisted drawing styles are never
// recolored or resized during migration/normalization.
export const DEFAULT_DRAWING_COLOR = '#AEB6C2';
export const DEFAULT_DRAWING_WIDTH = 1;

export const DEFAULT_DRAWING_STYLE = Object.freeze({
  color: DEFAULT_DRAWING_COLOR,
  width: DEFAULT_DRAWING_WIDTH,
  opacity: 1,
  dash: 'solid',
  fillOpacity: 0.07,
});

export const DRAWING_TOOL_DEFAULTS = Object.freeze({
  ruler: { dash: 'dashed' },
  text: { fontSize: 12 },
});

export function drawingStrokeWidth(style) {
  const width = Number(style?.width);
  return Number.isFinite(width) && width > 0 ? width : DEFAULT_DRAWING_WIDTH;
}

export function drawingOpacity(style) {
  const value = Number(style?.opacity);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export function canonicalDrawingColor(color) {
  const text = String(color || '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(text) ? text : DEFAULT_DRAWING_COLOR;
}

function hslHex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const channel = n => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))))
      .toString(16).padStart(2, '0').toUpperCase();
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const greyRow = ['#FFFFFF','#ECEEEF','#D8DBDF','#C4C8CC','#AEB6C2','#9399A2',
  '#727880','#555B63','#3A3D43','#202327','#050609'];
const hues = [354, 23, 43, 60, 142, 166, 189, 208, 230, 266, 320];
// Familiar TradingView-like grid: neutral row first; consistent vertical
// hue families with graduated lightness and saturation (not their branding).
export const DRAWING_PALETTE_ROWS = Object.freeze([
  Object.freeze(greyRow),
  ...[
    [0.92,0.86], [0.75,0.74], [0.65,0.64], [0.72,0.54],
    [0.82,0.45], [0.84,0.36], [0.88,0.27], [0.90,0.19],
  ].map(([sat,light]) => Object.freeze(hues.map(hue => hslHex(hue,sat,light)))),
]);
