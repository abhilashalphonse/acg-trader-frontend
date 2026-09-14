import { useEffect, useRef } from 'react'
import { CandlestickSeries, ColorType, createChart } from 'lightweight-charts'

const BASE_PRICES = {
  EURUSD: 1.1742,
  GBPUSD: 1.3561,
  USDJPY: 147.92,
  USDCHF: 0.7961,
  AUDUSD: 0.6620,
  USDCAD: 1.3814,
  NZDUSD: 0.6036,
}

function makeCandles(symbol, count = 90) {
  const base = BASE_PRICES[symbol] ?? 1.1742
  const step = symbol === 'USDJPY' ? 0.018 : 0.000018
  const now = Math.floor(Date.now() / 60000) * 60
  let price = base

  return Array.from({ length: count }, (_, index) => {
    const wave = Math.sin(index * 0.42) * step * 7
    const drift = (index / count) * step * 8
    const open = price
    const close = base + wave + drift + Math.sin(index * 1.73) * step * 3
    const high = Math.max(open, close) + step * (3 + (index % 4))
    const low = Math.min(open, close) - step * (2 + (index % 3))
    price = close
    return {
      time: now - (count - index) * 900,
      open,
      high,
      low,
      close,
    }
  })
}

export default function TradingChart({ symbol, timeframe = 'M15' }) {
  const containerRef = useRef(null)
  const seriesRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return undefined

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#090e13' },
        textColor: '#596573',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#121a22' },
        horzLines: { color: '#171e26' },
      },
      crosshair: {
        vertLine: { color: '#526174', width: 1, style: 2 },
        horzLine: { color: '#526174', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: '#202731',
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#202731',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { mouseWheel: true, pinch: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#3eb77d',
      downColor: '#c9656a',
      borderUpColor: '#3eb77d',
      borderDownColor: '#c9656a',
      wickUpColor: '#3eb77d',
      wickDownColor: '#c9656a',
      priceLineVisible: true,
      lastValueVisible: true,
    })

    const data = makeCandles(symbol)
    series.setData(data)
    chart.timeScale().fitContent()
    seriesRef.current = series

    const decimals = symbol === 'USDJPY' ? 3 : 5
    const tickStep = symbol === 'USDJPY' ? 0.001 : 0.00001
    timerRef.current = window.setInterval(() => {
      const last = data[data.length - 1]
      const move = (Math.random() - 0.47) * tickStep * 4
      const close = last.close + move
      const next = {
        ...last,
        close,
        high: Math.max(last.high, close),
        low: Math.min(last.low, close),
      }
      data[data.length - 1] = next
      series.update(next)
      void decimals
    }, 900)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      seriesRef.current = null
      chart.remove()
    }
  }, [symbol, timeframe])

  return <div className="trading-chart" ref={containerRef} aria-label={`${symbol} ${timeframe} chart`} />
}
