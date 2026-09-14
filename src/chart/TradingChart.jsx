import { useEffect, useRef } from 'react'
import { CandlestickSeries, ColorType, LineSeries, createChart } from 'lightweight-charts'

const BASE_PRICES = { AUDCAD: 0.99368, AUDCHF: 0.58286, AUDDKK: 4.61785, AUDHKD: 5.60626, AUDHUF: 220.748, AUDJPY: 110.287 }
const TIMEFRAME_SECONDS = { M1: 60, M5: 300, M15: 900, M30: 1800, H1: 3600, H4: 14400, D1: 86400, W1: 604800, MN: 2592000 }

function makeCandles(symbol, timeframe, count = 110) {
  const base = BASE_PRICES[symbol] ?? BASE_PRICES.AUDCAD
  const interval = TIMEFRAME_SECONDS[timeframe] ?? 60
  const step = symbol === 'AUDJPY' || symbol === 'AUDHUF' ? 0.018 : symbol === 'AUDDKK' || symbol === 'AUDHKD' ? 0.00055 : 0.000018
  const now = Math.floor(Date.now() / interval) * interval
  let price = base
  return Array.from({ length: count }, (_, i) => {
    const wave = Math.sin(i * 0.34) * step * 5
    const drift = (i / count) * step * 5
    const open = price
    const close = base + wave + drift + Math.sin(i * 1.61) * step * 2.5
    const high = Math.max(open, close) + step * (2 + (i % 4))
    const low = Math.min(open, close) - step * (2 + (i % 3))
    price = close
    return { time: now - (count - i - 1) * interval, open, high, low, close }
  })
}

function isDarkTheme() {
  const app = document.querySelector('.acg-app')
  return Boolean(
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    document.documentElement.dataset.theme === 'dark' ||
    document.body.dataset.theme === 'dark' ||
    app?.classList.contains('dark') ||
    app?.dataset.theme === 'dark'
  )
}

function chartTheme(dark) {
  return dark
    ? {
        background: '#0b111a',
        text: '#8f9bad',
        grid: '#172230',
        border: '#263241',
        crosshair: '#667386',
        up: '#26c281',
        down: '#f05b68',
        line: '#4da3ff',
      }
    : {
        background: '#ffffff',
        text: '#718096',
        grid: '#edf1f5',
        border: '#dfe5ec',
        crosshair: '#aeb9c7',
        up: '#1677ff',
        down: '#ef5350',
        line: '#1769e0',
      }
}

export default function TradingChart({ symbol, timeframe = 'M1', chartType = 'candles' }) {
  const ref = useRef(null)
  const timer = useRef(null)
  useEffect(() => {
    if (!ref.current) return undefined

    const render = () => {
      const dark = isDarkTheme()
      const theme = chartTheme(dark)
      const chart = createChart(ref.current, {
        autoSize: true,
        layout: { background: { type: ColorType.Solid, color: theme.background }, textColor: theme.text, fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', fontSize: 10 },
        grid: { vertLines: { color: theme.grid }, horzLines: { color: theme.grid } },
        crosshair: { vertLine: { color: theme.crosshair, width: 1, style: 2 }, horzLine: { color: theme.crosshair, width: 1, style: 2 } },
        rightPriceScale: { borderColor: theme.border, scaleMargins: { top: 0.08, bottom: 0.12 } },
        timeScale: { borderColor: theme.border, timeVisible: true, secondsVisible: false },
        handleScale: { mouseWheel: true, pinch: true },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      })

      const data = makeCandles(symbol, timeframe)
      let series
      if (chartType === 'line') {
        series = chart.addSeries(LineSeries, { color: theme.line, lineWidth: 2, priceLineVisible: true, lastValueVisible: true })
        series.setData(data.map((d) => ({ time: d.time, value: d.close })))
      } else {
        series = chart.addSeries(CandlestickSeries, {
          upColor: theme.up,
          downColor: theme.down,
          borderUpColor: theme.up,
          borderDownColor: theme.down,
          wickUpColor: theme.up,
          wickDownColor: theme.down,
          priceLineVisible: true,
          lastValueVisible: true,
        })
        series.setData(data)
      }
      chart.timeScale().fitContent()

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

      return chart
    }

    let chart = render()
    let previousDark = isDarkTheme()
    const observer = new MutationObserver(() => {
      const nextDark = isDarkTheme()
      if (nextDark === previousDark) return
      previousDark = nextDark
      if (timer.current) window.clearInterval(timer.current)
      chart.remove()
      chart = render()
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    const app = document.querySelector('.acg-app')
    if (app) observer.observe(app, { attributes: true, attributeFilter: ['class', 'data-theme'] })

    return () => {
      observer.disconnect()
      if (timer.current) window.clearInterval(timer.current)
      chart.remove()
    }
  }, [symbol, timeframe, chartType])
  return <div className="trading-chart" ref={ref} aria-label={`${symbol} ${timeframe} chart`} />
}
