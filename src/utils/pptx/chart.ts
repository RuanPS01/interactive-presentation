import { fontStack } from '../freeSlide'
import { fromHex, resolveColor, toCss } from './colors'
import type { ColorContext, Rgba } from './colors'
import { attr, child, children, descendant, num, path } from './xml'

/**
 * Gráfico do PowerPoint como imagem, a partir dos valores que o arquivo
 * guarda em cache. É uma versão simplificada (título, legenda, eixos, grade e
 * as séries), não uma reprodução exata do desenho do Office.
 */

export interface ChartEnv {
  colors: ColorContext
  font: string
}

interface Series {
  name: string
  categories: string[]
  values: number[]
  xValues: number[]
  color: Rgba
  pointColors: Map<number, Rgba>
}

const GRID = '#d9d9d9'
const AXIS_TEXT = '#595959'

function cacheValues(el: Element | null): string[] {
  const cache =
    descendant(el, 'strCache') ?? descendant(el, 'numCache') ?? descendant(el, 'strLit') ?? descendant(el, 'numLit')
  if (!cache) return []
  const count = num(child(cache, 'ptCount'), 'val') ?? 0
  const out: string[] = new Array(count).fill('')
  for (const pt of children(cache, 'pt')) {
    const idx = num(pt, 'idx') ?? 0
    out[idx] = child(pt, 'v')?.textContent ?? ''
  }
  return out
}

function accent(env: ChartEnv, index: number): Rgba {
  const base = fromHex(env.colors.scheme[`accent${(index % 6) + 1}`] ?? '4472c4')
  // Da 7ª série em diante, os mesmos tons mais escuros (como o Office faz).
  const round = Math.floor(index / 6)
  if (round === 0) return base
  const factor = round % 2 === 1 ? 0.6 : 0.8
  return { r: Math.round(base.r * factor), g: Math.round(base.g * factor), b: Math.round(base.b * factor), a: 1 }
}

function seriesColor(ser: Element, env: ChartEnv, index: number, line: boolean): Rgba {
  const spPr = child(ser, 'spPr')
  const fill = line ? child(child(spPr, 'ln'), 'solidFill') : child(spPr, 'solidFill')
  return resolveColor(fill, env.colors) ?? resolveColor(child(spPr, 'solidFill'), env.colors) ?? accent(env, index)
}

function niceStep(range: number): number {
  if (range <= 0) return 1
  const raw = range / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  return nice * magnitude
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString('pt-BR') : value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function richText(el: Element | null): string {
  return Array.from(el?.getElementsByTagNameNS('*', 't') ?? [])
    .map((t) => t.textContent ?? '')
    .join('')
}

export function drawChart(
  ctx: CanvasRenderingContext2D,
  doc: Document,
  box: { x: number; y: number; w: number; h: number },
  env: ChartEnv,
): void {
  const chart = path(doc.documentElement, 'chart')
  const plotArea = child(chart, 'plotArea')
  const group = children(plotArea).find((el) => el.localName.endsWith('Chart'))
  if (!chart || !group) return
  const type = group.localName
  const isPie = type === 'pieChart' || type === 'pie3DChart' || type === 'doughnutChart' || type === 'ofPieChart'
  const isLine = type === 'lineChart' || type === 'line3DChart' || type === 'radarChart'
  const isArea = type === 'areaChart' || type === 'area3DChart'
  const isScatter = type === 'scatterChart' || type === 'bubbleChart'
  const horizontal = attr(child(group, 'barDir'), 'val') === 'bar'
  const grouping = attr(child(group, 'grouping'), 'val') ?? 'clustered'
  const stacked = grouping === 'stacked' || grouping === 'percentStacked'
  const percent = grouping === 'percentStacked'

  const series: Series[] = children(group, 'ser').map((ser, i) => {
    const pointColors = new Map<number, Rgba>()
    for (const dPt of children(ser, 'dPt')) {
      const color = resolveColor(child(child(dPt, 'spPr'), 'solidFill'), env.colors)
      if (color) pointColors.set(num(child(dPt, 'idx'), 'val') ?? 0, color)
    }
    const nameRef = child(ser, 'tx')
    return {
      name: cacheValues(nameRef)[0] ?? child(nameRef, 'v')?.textContent ?? `Série ${i + 1}`,
      categories: cacheValues(child(ser, 'cat') ?? child(ser, 'xVal')),
      values: cacheValues(child(ser, 'val') ?? child(ser, 'yVal')).map((v) => Number(v) || 0),
      xValues: cacheValues(child(ser, 'xVal')).map((v) => Number(v) || 0),
      color: seriesColor(ser, env, i, isLine || isScatter),
      pointColors,
    }
  })
  if (series.length === 0) return
  const categories = series[0].categories.length > 0 ? series[0].categories : series[0].values.map((_, i) => String(i + 1))
  const varyColors = isPie || attr(child(group, 'varyColors'), 'val') === '1'
  const pointColor = (s: Series, i: number) =>
    s.pointColors.get(i) ?? (isPie ? accent(env, i) : s.color)

  const size = Math.max(10, Math.min(box.w, box.h) * 0.045)
  const font = (px: number, bold = false) => `${bold ? 700 : 400} ${px}px ${fontStack(env.font)}`
  const pad = size * 0.8
  let top = box.y + pad
  let bottom = box.y + box.h - pad
  let left = box.x + pad
  let right = box.x + box.w - pad

  // Título: o escrito, ou o nome da série única quando o título automático vale.
  const titleEl = child(chart, 'title')
  const autoDeleted = attr(child(chart, 'autoTitleDeleted'), 'val') === '1'
  const title = titleEl ? richText(child(titleEl, 'tx')) || (series.length === 1 ? series[0].name : '') : !autoDeleted && series.length === 1 ? series[0].name : ''
  ctx.save()
  ctx.textBaseline = 'middle'
  if (title) {
    ctx.font = font(size * 1.3, true)
    ctx.fillStyle = '#262626'
    ctx.textAlign = 'center'
    ctx.fillText(title, box.x + box.w / 2, top + size * 0.7, box.w - 2 * pad)
    top += size * 2
  }

  // Legenda.
  const legendEl = child(chart, 'legend')
  const legendPos = legendEl ? (attr(child(legendEl, 'legendPos'), 'val') ?? 'r') : null
  const entries = isPie || (varyColors && series.length === 1)
    ? categories.map((label, i) => ({ label, color: pointColor(series[0], i) }))
    : series.map((s) => ({ label: s.name, color: s.color }))
  if (legendPos && entries.length > 0) {
    ctx.font = font(size)
    ctx.textAlign = 'left'
    const swatch = size * 0.8
    if (legendPos === 'r' || legendPos === 'l' || legendPos === 'tr') {
      const width = Math.max(...entries.map((e) => ctx.measureText(e.label).width)) + swatch + size
      const x = legendPos === 'l' ? left : right - width
      let y = top + (bottom - top) / 2 - (entries.length * size * 1.5) / 2
      for (const entry of entries) {
        ctx.fillStyle = toCss(entry.color)
        ctx.fillRect(x, y + size * 0.75 - swatch / 2, swatch, swatch)
        ctx.fillStyle = AXIS_TEXT
        ctx.fillText(entry.label, x + swatch + size * 0.4, y + size * 0.75)
        y += size * 1.5
      }
      if (legendPos === 'l') left += width + pad
      else right -= width + pad
    } else {
      const widths = entries.map((e) => ctx.measureText(e.label).width + swatch + size * 1.4)
      const total = widths.reduce((a, b) => a + b, 0)
      let x = box.x + (box.w - total) / 2
      const y = legendPos === 't' ? top + size * 0.75 : bottom - size * 0.75
      entries.forEach((entry, i) => {
        ctx.fillStyle = toCss(entry.color)
        ctx.fillRect(x, y - swatch / 2, swatch, swatch)
        ctx.fillStyle = AXIS_TEXT
        ctx.fillText(entry.label, x + swatch + size * 0.4, y)
        x += widths[i]
      })
      if (legendPos === 't') top += size * 2
      else bottom -= size * 2
    }
  }

  if (isPie) {
    const s = series[0]
    const total = s.values.reduce((a, b) => a + Math.max(0, b), 0) || 1
    const cx = (left + right) / 2
    const cy = (top + bottom) / 2
    const radius = Math.max(4, Math.min(right - left, bottom - top) / 2 - size * 0.5)
    const hole = type === 'doughnutChart' ? (num(child(group, 'holeSize'), 'val') ?? 50) / 100 : 0
    let angle = -Math.PI / 2 + ((num(child(group, 'firstSliceAng'), 'val') ?? 0) * Math.PI) / 180
    s.values.forEach((value, i) => {
      const sweep = (Math.max(0, value) / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(angle) * radius * hole, cy + Math.sin(angle) * radius * hole)
      ctx.arc(cx, cy, radius, angle, angle + sweep)
      if (hole > 0) ctx.arc(cx, cy, radius * hole, angle + sweep, angle, true)
      else ctx.lineTo(cx, cy)
      ctx.closePath()
      ctx.fillStyle = toCss(pointColor(s, i))
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1, size * 0.1)
      ctx.stroke()
      angle += sweep
    })
    ctx.restore()
    return
  }

  // Escala de valores.
  const totals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0))
  let max = percent ? 100 : stacked ? Math.max(0, ...totals) : Math.max(0, ...series.flatMap((s) => s.values))
  let min = stacked ? Math.min(0, ...totals) : Math.min(0, ...series.flatMap((s) => s.values))
  const step = niceStep(max - min || 1)
  max = Math.ceil(max / step) * step || step
  min = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v)

  ctx.font = font(size * 0.9)
  const labelWidth = Math.max(...ticks.map((t) => ctx.measureText(formatNumber(t) + (percent ? '%' : '')).width))
  const catHeight = size * 1.6
  const plot = horizontal
    ? { x: left + Math.max(...categories.map((c) => ctx.measureText(c).width)) + size * 0.6, y: top, w: 0, h: 0 }
    : { x: left + labelWidth + size * 0.6, y: top, w: 0, h: 0 }
  plot.w = right - plot.x
  plot.h = bottom - top - catHeight
  if (plot.w <= 0 || plot.h <= 0) {
    ctx.restore()
    return
  }
  const valuePos = (v: number) =>
    horizontal ? plot.x + ((v - min) / (max - min)) * plot.w : plot.y + plot.h - ((v - min) / (max - min)) * plot.h

  // Grade e rótulos do eixo de valores.
  ctx.strokeStyle = GRID
  ctx.lineWidth = 1
  ctx.fillStyle = AXIS_TEXT
  for (const t of ticks) {
    const p = valuePos(t)
    ctx.beginPath()
    if (horizontal) {
      ctx.moveTo(p, plot.y)
      ctx.lineTo(p, plot.y + plot.h)
    } else {
      ctx.moveTo(plot.x, p)
      ctx.lineTo(plot.x + plot.w, p)
    }
    ctx.stroke()
    const label = formatNumber(t) + (percent ? '%' : '')
    if (horizontal) {
      ctx.textAlign = 'center'
      ctx.fillText(label, p, plot.y + plot.h + catHeight / 2)
    } else {
      ctx.textAlign = 'right'
      ctx.fillText(label, plot.x - size * 0.4, p)
    }
  }

  const band = (horizontal ? plot.h : plot.w) / Math.max(1, categories.length)
  // Rótulos das categorias.
  categories.forEach((label, i) => {
    const center = (horizontal ? plot.y : plot.x) + band * (i + 0.5)
    if (horizontal) {
      ctx.textAlign = 'right'
      ctx.fillText(label, plot.x - size * 0.4, center)
    } else {
      ctx.textAlign = 'center'
      ctx.fillText(label, center, plot.y + plot.h + catHeight / 2, band)
    }
  })

  if (isLine || isArea || isScatter) {
    const xMin = isScatter ? Math.min(...series.flatMap((s) => s.xValues)) : 0
    const xMax = isScatter ? Math.max(...series.flatMap((s) => s.xValues)) : 0
    for (const s of series) {
      const points = s.values.map((v, i): [number, number] => [
        isScatter && xMax > xMin
          ? plot.x + ((s.xValues[i] - xMin) / (xMax - xMin)) * plot.w
          : plot.x + band * (i + 0.5),
        valuePos(v),
      ])
      if (isArea && points.length > 0) {
        ctx.beginPath()
        ctx.moveTo(points[0][0], valuePos(Math.max(min, 0)))
        for (const [x, y] of points) ctx.lineTo(x, y)
        ctx.lineTo(points[points.length - 1][0], valuePos(Math.max(min, 0)))
        ctx.closePath()
        ctx.fillStyle = toCss({ ...s.color, a: 0.75 })
        ctx.fill()
      }
      if (!isScatter || attr(child(group, 'scatterStyle'), 'val')?.includes('Line')) {
        ctx.beginPath()
        points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
        ctx.strokeStyle = toCss(s.color)
        ctx.lineWidth = Math.max(2, size * 0.18)
        ctx.lineJoin = 'round'
        ctx.stroke()
      }
      ctx.fillStyle = toCss(s.color)
      for (const [x, y] of points) {
        ctx.beginPath()
        ctx.arc(x, y, Math.max(2.5, size * 0.22), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
    return
  }

  // Barras / colunas.
  const gap = (num(child(group, 'gapWidth'), 'val') ?? 150) / 100
  const slots = stacked ? 1 : series.length
  const barSize = band / (slots + gap)
  const offsets = categories.map(() => ({ pos: 0, neg: 0 }))
  series.forEach((s, si) => {
    s.values.forEach((raw, i) => {
      const value = percent ? (totals[i] ? (raw / totals[i]) * 100 : 0) : raw
      const start = (horizontal ? plot.y : plot.x) + band * i + (band - barSize * slots) / 2 + (stacked ? 0 : barSize * si)
      let from = 0
      let to = value
      if (stacked) {
        const o = offsets[i]
        if (value >= 0) {
          from = o.pos
          o.pos += value
          to = o.pos
        } else {
          from = o.neg
          o.neg += value
          to = o.neg
        }
      }
      const a = valuePos(from)
      const b = valuePos(to)
      ctx.fillStyle = toCss(varyColors && series.length === 1 ? pointColor(s, i) : (s.pointColors.get(i) ?? s.color))
      if (horizontal) ctx.fillRect(Math.min(a, b), start, Math.abs(b - a), barSize)
      else ctx.fillRect(start, Math.min(a, b), barSize, Math.abs(b - a))
    })
  })
  ctx.restore()
}
