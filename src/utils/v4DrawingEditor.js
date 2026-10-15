import { isRiskDrawingTool, riskDrawingGeometry } from './drawingTools.js';

// Projection candidates only. Never patch persisted drawing entry, stop or target.
export function riskTargetProjectionCandidates(drawing) {
  if (!isRiskDrawingTool(drawing?.type) || !drawing?.a || !drawing?.b) return [];
  const savedPrice = Number(drawing.riskTarget?.price);
  const inferred = riskDrawingGeometry(drawing.type, drawing.a, drawing.b).riskTarget;
  const price = drawing.riskTarget && Number.isFinite(savedPrice) && savedPrice > 0
    ? savedPrice : Number(inferred?.price);
  if (!Number.isFinite(price) || price <= 0) return [];
  const times = [drawing.riskTarget?.time, drawing.b.time, drawing.a.time];
  return [...new Set(times.map(Number).filter(Number.isFinite))]
    .map(time => ({ time, price }));
}

export function clampDrawingEditorPosition(position, chartSize, editorSize) {
  const width = Math.max(1, Number(chartSize?.width) || 1);
  const height = Math.max(1, Number(chartSize?.height) || 1);
  const editorWidth = Math.min(width, Math.max(1, Number(editorSize?.width) || 1));
  const editorHeight = Math.min(height, Math.max(1, Number(editorSize?.height) || 44));
  const bound = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  return { left:bound(position?.left, 8, Math.max(8, width - editorWidth - 8)),
    top:bound(position?.top, 8, Math.max(8, height - editorHeight - 8)) };
}

export function drawingEditorStartPosition(anchor, chartSize, editorSize) {
  const width = Math.max(1, Number(chartSize?.width) || 1);
  return clampDrawingEditorPosition({
    left:(Number.isFinite(anchor?.x) ? anchor.x : width / 2) - Number(editorSize?.width || 440) / 2,
    top:(Number.isFinite(anchor?.y) ? anchor.y : 54) - Number(editorSize?.height || 44) - 8,
  }, chartSize, editorSize);
}
