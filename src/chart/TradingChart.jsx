import { useEffect, useRef } from 'react'
import { CandlestickSeries, ColorType, LineSeries, createChart } from 'lightweight-charts'

const BASE_PRICES = { AUDCAD: 0.99368, AUDCHF: 0.58286, AUDDKK: 4.61785, AUDHKD: 5.60626, AUDHUF: 220.748, AUDJPY: 110.287 }
const TIMEFRAME_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 }

function makeCandles(symbol, timeframe, count = 110) {
  const base = BASE_PRICES[symbol] ?? BASE_PRICES.AUDCAD
  const interval = TIMEFRAME_SECONDS[timeframe] ?? 60
  const step = symbol === 'AUDJPY' || symbol === 'AUDHUF' ? 0.018 : symbol === 'AUDDKK' || symbol === 'AUDHKD' ? 0.00055 : 0.000018
  const now = Math.floor(Date.now() / interval) * interval
  let current = base
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.34) * step * 5
    const drift = (i / count) * step * 5
    const open = current
    const close = base + wave + drift + Math.sin(i * 1.61) * step * 2.5
    const high = Math.max(open, close) + step * (2 + (i % 4))
    const low = Math.min(open, close) - step * (2 + (i % 3))
    current = close
    return { time: now - (count - i - 1) * interval, open, high, low, close }
  })
}

export default function TradingChart({ symbol, timeframe = 'M1', chartType = 'candles' }) {
  const ref = useRef(null)
  const timer = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!ref.current) return undefined

    const chart = createChart(ref.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#334155',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#f1f5f9' },
        horzLines: { color: '#f1f5f9' },
      },
      crosshair: {
        vertLine: { color: '#94a3b8', width: 1, style: 2, labelBackgroundColor: '#334155' },
        horzLine: { color: '#94a3b8', width: 1, style: 2, labelBackgroundColor: '#334155' },
      },
      rightPriceScale: {
        visible: true,
        borderColor: '#cbd5e1',
        textColor: '#334155',
        minimumWidth: 62,
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        visible: true,
        borderVisible: true,
        borderColor: '#cbd5e1',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 7,
        minBarSpacing: 3,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
    })
    chartRef.current = chart

    const data = makeCandles(symbol, timeframe)
    let series
    if (chartType === 'line') {
      series = chart.addSeries(LineSeries, {
        color: '#00a896',
        lineWidth: 2,
        priceLineVisible: true,
        priceLineColor: '#00a896',
        lastValueVisible: true,
      })
      series.setData(data.map((d) => ({ time: d.time, value: d.close })))
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor: '#00a896',
        downColor: '#ef4444',
        borderUpColor: '#00a896',
        borderDownColor: '#ef4444',
        wickUpColor: '#00a896',
        wickDownColor: '#ef4444',
        priceLineVisible: true,
        priceLineColor: '#00a896',
        lastValueVisible: true,
      })
      series.setData(data)
    }
    chart.timeScale().fitContent()

    const onZoom = (event) => {
      const range = chart.timeScale().getVisibleLogicalRange()
      if (!range) return
      const amount = event.detail === 'in' ? -8 : 8
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, range.from - amount),
        to: Math.min(data.length + 8, range.to + amount),
      })
    }
    const onReset = () => chart.timeScale().fitContent()
    window.addEventListener('acg-chart-zoom', onZoom)
    window.addEventListener('acg-chart-reset', onReset)

    const interval = TIMEFRAME_SECONDS[timeframe] ?? 60
    timer.current = window.setInterval(() => {
      const last = data[data.length - 1]
      const tick = symbol === 'AUDJPY' || symbol === 'AUDHUF' ? 0.001 : 0.00001
      const close = last.close + (Math.random() - 0.48) * tick * 3
      const point = { ...last, close, high: Math.max(last.high, close), low: Math.min(last.low, close) }
      data[data.length - 1] = point
      if (chartType === 'line') series.update({ time: point.time, value: close })
      else series.update(point)
      if (Date.now() >= (last.time + interval) * 1000) {
        const next = { time: last.time + interval, open: close, high: close, low: close, close }
        data.push(next)
        series.update(chartType === 'line' ? { time: next.time, value: close } : next)
      }
    }, 900)

    return () => {
      window.removeEventListener('acg-chart-zoom', onZoom)
      window.removeEventListener('acg-chart-reset', onReset)
      if (timer.current) window.clearInterval(timer.current)
      chart.remove()
      chartRef.current = null
    }
  }, [symbol, timeframe, chartType])

  return <div className="trading-chart" ref={ref} aria-label={`${symbol} ${timeframe} chart`} />
}
