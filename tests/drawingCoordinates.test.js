import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawingBarsBetween,
  drawingTimeToLogical,
  logicalToDrawingTime,
} from '../src/utils/drawingCoordinates.js';

const bars = [
  { time: 1000 },
  { time: 1060 },
  { time: 1120 },
  { time: 1300 },
];

test('drawing coordinates interpolate inside loaded history', () => {
  assert.equal(logicalToDrawingTime(1.5, bars, 'M1'), 1090);
  assert.equal(drawingTimeToLogical(1090, bars, 'M1'), 1.5);
});

test('drawing coordinates extrapolate into future whitespace', () => {
  assert.equal(logicalToDrawingTime(5, bars, 'M1'), 1420);
  assert.equal(drawingTimeToLogical(1420, bars, 'M1'), 5);
});

test('drawing coordinates extrapolate before loaded history', () => {
  assert.equal(logicalToDrawingTime(-2, bars, 'M1'), 880);
  assert.equal(drawingTimeToLogical(880, bars, 'M1'), -2);
});


test('drawing bar distance follows logical candles instead of wall-clock gaps', () => {
  assert.equal(drawingBarsBetween(1000, 1300, bars, 'M1'), 3);
  assert.equal(drawingBarsBetween(1060, 1300, bars, 'M1'), 2);
});
