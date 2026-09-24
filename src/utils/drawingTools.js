export const DRAWING_TOOL_GROUPS = Object.freeze([
  Object.freeze(['cursor']),
  Object.freeze(['trendline', 'ray', 'extended-line', 'hline', 'horizontal-ray', 'vline', 'ruler']),
  Object.freeze(['rectangle', 'fibonacci', 'text']),
  Object.freeze(['long-position', 'short-position']),
]);

export const DRAWING_TOOL_LABELS = Object.freeze({
  cursor: 'Select / move',
  trendline: 'Trend line',
  ray: 'Ray',
  'extended-line': 'Extended line',
  hline: 'Horizontal line',
  'horizontal-ray': 'Horizontal ray',
  vline: 'Vertical line',
  ruler: 'Measure / ruler',
  rectangle: 'Rectangle',
  fibonacci: 'Fibonacci retracement',
  text: 'Text',
  'long-position': 'Long position risk tool',
  'short-position': 'Short position risk tool',
});

export const DRAWING_CREATE_TOOL_IDS = Object.freeze(
  DRAWING_TOOL_GROUPS.flat().filter(id => id !== 'cursor'),
);

export const DRAWING_SINGLE_POINT_TOOL_IDS = Object.freeze([
  'hline',
  'horizontal-ray',
  'vline',
  'text',
]);

export const DRAWING_TWO_POINT_TOOL_IDS = Object.freeze(
  DRAWING_CREATE_TOOL_IDS.filter(id => !DRAWING_SINGLE_POINT_TOOL_IDS.includes(id)),
);

const DRAWING_CREATE_TOOL_SET = new Set(DRAWING_CREATE_TOOL_IDS);
const DRAWING_TWO_POINT_TOOL_SET = new Set(DRAWING_TWO_POINT_TOOL_IDS);
const RISK_DRAWING_TOOL_SET = new Set(['long-position', 'short-position']);

const TIMEFRAME_ALIASES = Object.freeze({
  S1:'S1','1s':'S1', S5:'S5','5s':'S5', S15:'S15','15s':'S15', S30:'S30','30s':'S30',
  M1:'M1','1m':'M1', M5:'M5','5m':'M5', M15:'M15','15m':'M15', M30:'M30','30m':'M30',
  H1:'H1','1H':'H1','1h':'H1', H4:'H4','4H':'H4','4h':'H4',
  D1:'D1','1D':'D1','1d':'D1', W1:'W1','1W':'W1','1w':'W1',
});

export const MIN_DRAWING_RISK_PERCENT = 0.1;
export const MAX_DRAWING_RISK_PERCENT = 5;

export function drawingToolLabel(type) {
  return DRAWING_TOOL_LABELS[type] || String(type || 'Drawing').replaceAll('-', ' ');
}
export function isDrawingCreateTool(type) { return DRAWING_CREATE_TOOL_SET.has(type); }
export function isTwoPointDrawingTool(type) { return DRAWING_TWO_POINT_TOOL_SET.has(type); }
export function isRiskDrawingTool(type) { return RISK_DRAWING_TOOL_SET.has(type); }

export function clampDrawingRiskPercent(value, fallback = 0.5) {
  const numeric=Number(value);
  const resolved=Number.isFinite(numeric)?numeric:Number(fallback);
  const safe=Number.isFinite(resolved)?resolved:0.5;
  return Math.min(MAX_DRAWING_RISK_PERCENT,Math.max(MIN_DRAWING_RISK_PERCENT,safe));
}

export function canonicalDrawingTimeframe(value) {
  const raw=String(value||'').trim();
  return TIMEFRAME_ALIASES[raw]||raw;
}

export function canonicalTimeframeVisibility(value) {
  if (!value || value === 'all') return 'all';
  if (Array.isArray(value)) {
    const normalized=[...new Set(value.map(canonicalDrawingTimeframe).filter(Boolean))];
    return normalized.length?normalized:'all';
  }
  return canonicalDrawingTimeframe(value)||'all';
}

export function riskDrawingGeometry(type, entryPoint, pointerPoint, snapStep = null) {
  if (!isRiskDrawingTool(type) || !entryPoint || !pointerPoint) {
    return { b:pointerPoint||entryPoint||null, riskTarget:null };
  }
  const entry=Number(entryPoint.price);
  const pointer=Number(pointerPoint.price);
  if (!Number.isFinite(entry) || !Number.isFinite(pointer)) return { b:pointerPoint, riskTarget:null };

  const rawDistance=Math.abs(pointer-entry);
  const step=Number(snapStep);
  const fallback=Number.isFinite(step)&&step>0 ? step*10 : Math.max(Math.abs(entry)*0.001,0.0001);
  const distance=Number.isFinite(rawDistance)&&rawDistance>0 ? rawDistance : fallback;
  const isLong=type==='long-position';
  return {
    b:{...pointerPoint,price:isLong?entry-distance:entry+distance},
    riskTarget:{...pointerPoint,price:isLong?entry+distance*2:entry-distance*2},
  };
}
