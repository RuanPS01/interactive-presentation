import { drawRichText } from '../canvasText'
import { fromHex, resolveColor, toCss } from './colors'
import type { ColorContext, Rgba } from './colors'
import { findFill, paintFill, parseStroke } from './draw'
import type { Fill, StyleContext, Stroke } from './draw'
import { parseTextBody } from './text'
import type { TextContext } from './text'
import { attr, child, children, num } from './xml'

/**
 * Tabela do PowerPoint desenhada como imagem: preenchimentos e bordas das
 * células (do estilo da tabela e das próprias células) e o texto de cada uma.
 */

export interface TableEnv {
  style: StyleContext
  text: Omit<TextContext, 'lstStyles' | 'fontRef'>
  /** Estilos de lista herdados (padrão da apresentação). */
  lstStyles: (Element | null)[]
  /** `ppt/tableStyles.xml`, quando existir. */
  tableStyles: Document | null
}

interface PartStyle {
  fill?: Fill | null
  textColor?: Rgba
  bold?: boolean
  borders: Partial<Record<'left' | 'right' | 'top' | 'bottom' | 'insideH' | 'insideV', Stroke | null>>
}

/** Estilos embutidos mais comuns: "Médio 2" em cada cor de destaque. */
const MEDIUM_2: Record<string, string> = {
  '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}': 'accent1',
  '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE8}': 'accent2',
  '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}': 'accent3',
  '{00A15C55-8517-42AA-B614-E9B94910E393}': 'accent4',
  '{7DF18680-E054-41AD-8BC1-D1AEF772440D}': 'accent5',
  '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}': 'accent6',
  '{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}': 'dk1',
}
const NO_STYLE_GRID = '{5940675A-B579-460E-94D1-54222C63F5DA}'
const NO_STYLE = '{2D5ABB26-0587-4C30-8999-92F81FD0307C}'

function schemeColor(colors: ColorContext, name: string): Rgba {
  return fromHex(colors.scheme[colors.map[name] ?? name] ?? colors.scheme[name] ?? '000000')
}

function tint(c: Rgba, amount: number): Rgba {
  return {
    r: Math.round(c.r + (255 - c.r) * (1 - amount)),
    g: Math.round(c.g + (255 - c.g) * (1 - amount)),
    b: Math.round(c.b + (255 - c.b) * (1 - amount)),
    a: c.a,
  }
}

/** Aproximação de um estilo embutido (o PowerPoint não grava a definição deles). */
function builtinParts(id: string, env: TableEnv): Record<string, PartStyle> {
  const colors = env.style.colors
  const light = schemeColor(colors, 'lt1')
  const dark = schemeColor(colors, 'dk1')
  const k = env.style.k
  const line = (color: Rgba, emu: number): Stroke => ({
    color,
    width: Math.max(0.75, emu * k),
    dash: null,
    cap: 'butt',
    join: 'miter',
  })
  if (id === NO_STYLE || id === NO_STYLE_GRID) {
    const grid = id === NO_STYLE_GRID ? line(dark, 12700) : null
    return {
      wholeTbl: {
        textColor: dark,
        borders: { left: grid, right: grid, top: grid, bottom: grid, insideH: grid, insideV: grid },
      },
    }
  }
  const accent = schemeColor(colors, MEDIUM_2[id] ?? 'accent1')
  const thin = line(light, 12700)
  const thick = line(light, 38100)
  return {
    wholeTbl: {
      fill: { kind: 'solid', color: tint(accent, 0.2) },
      textColor: dark,
      borders: { left: thin, right: thin, top: thin, bottom: thin, insideH: thin, insideV: thin },
    },
    band1H: { fill: { kind: 'solid', color: tint(accent, 0.4) }, borders: {} },
    band1V: { fill: { kind: 'solid', color: tint(accent, 0.4) }, borders: {} },
    firstCol: { fill: { kind: 'solid', color: accent }, textColor: light, bold: true, borders: {} },
    lastCol: { fill: { kind: 'solid', color: accent }, textColor: light, bold: true, borders: {} },
    lastRow: { fill: { kind: 'solid', color: accent }, textColor: light, bold: true, borders: { top: thick } },
    firstRow: { fill: { kind: 'solid', color: accent }, textColor: light, bold: true, borders: { bottom: thick } },
  }
}

/** Partes de um estilo gravado em `tableStyles.xml`. */
function storedParts(styleEl: Element, env: TableEnv): Record<string, PartStyle> {
  const parts: Record<string, PartStyle> = {}
  for (const part of children(styleEl)) {
    const tcStyle = child(part, 'tcStyle')
    const txStyle = child(part, 'tcTxStyle')
    const fillHolder = child(tcStyle, 'fill')
    const style: PartStyle = { borders: {} }
    const fill = findFill(fillHolder, env.style)
    if (fill !== undefined) style.fill = fill
    const textColor = resolveColor(txStyle, env.style.colors)
    if (textColor) style.textColor = textColor
    const b = attr(txStyle, 'b')
    if (b) style.bold = b === 'on'
    const bdr = child(tcStyle, 'tcBdr')
    for (const side of ['left', 'right', 'top', 'bottom', 'insideH', 'insideV'] as const) {
      const ln = child(child(bdr, side), 'ln')
      if (ln) style.borders[side] = parseStroke(ln, null, env.style)
    }
    parts[part.localName] = style
  }
  return parts
}

interface Cell {
  el: Element
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  tbl: Element,
  box: { x: number; y: number; w: number; h: number },
  env: TableEnv,
): void {
  const k = env.style.k
  const tblPr = child(tbl, 'tblPr')
  const flags = {
    firstRow: attr(tblPr, 'firstRow') === '1',
    lastRow: attr(tblPr, 'lastRow') === '1',
    firstCol: attr(tblPr, 'firstCol') === '1',
    lastCol: attr(tblPr, 'lastCol') === '1',
    bandRow: attr(tblPr, 'bandRow') === '1',
    bandCol: attr(tblPr, 'bandCol') === '1',
  }
  const styleId = child(tblPr, 'tableStyleId')?.textContent?.trim() ?? ''
  const stored = children(env.tableStyles?.documentElement, 'tblStyle').find((s) => attr(s, 'styleId') === styleId)
  const parts = stored ? storedParts(stored, env) : builtinParts(styleId || '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}', env)

  const colWidths = children(child(tbl, 'tblGrid'), 'gridCol').map((c) => (num(c, 'w') ?? 0) * k)
  const rows = children(tbl, 'tr')
  const rowHeights = rows.map((r) => (num(r, 'h') ?? 0) * k)
  // A moldura guarda o tamanho final (linhas crescem com o texto): ajusta a ele.
  const scaleX = colWidths.reduce((a, b) => a + b, 0) > 0 ? box.w / colWidths.reduce((a, b) => a + b, 0) : 1
  const totalH = rowHeights.reduce((a, b) => a + b, 0)
  const scaleY = totalH > 0 && box.h > totalH ? box.h / totalH : 1
  const xs = [box.x]
  for (const w of colWidths) xs.push(xs[xs.length - 1] + w * scaleX)
  const ys = [box.y]
  for (const h of rowHeights) ys.push(ys[ys.length - 1] + h * scaleY)

  const cells: Cell[] = []
  rows.forEach((tr, r) => {
    children(tr, 'tc').forEach((tc, c) => {
      if (attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1') return
      cells.push({ el: tc, row: r, col: c, rowSpan: num(tc, 'rowSpan') ?? 1, colSpan: num(tc, 'gridSpan') ?? 1 })
    })
  })
  const lastRow = rows.length - 1
  const lastCol = colWidths.length - 1

  const partsFor = (cell: Cell): PartStyle[] => {
    const list: PartStyle[] = []
    const add = (name: string) => {
      if (parts[name]) list.push(parts[name])
    }
    add('wholeTbl')
    if (flags.bandCol) add((cell.col - (flags.firstCol ? 1 : 0)) % 2 === 0 ? 'band1V' : 'band2V')
    const headerRow = flags.firstRow && cell.row === 0
    const footerRow = flags.lastRow && cell.row === lastRow
    if (flags.bandRow && !headerRow && !footerRow) {
      add((cell.row - (flags.firstRow ? 1 : 0)) % 2 === 0 ? 'band1H' : 'band2H')
    }
    if (flags.lastCol && cell.col + cell.colSpan - 1 === lastCol) add('lastCol')
    if (flags.firstCol && cell.col === 0) add('firstCol')
    if (footerRow) add('lastRow')
    if (headerRow) add('firstRow')
    return list
  }

  for (const cell of cells) {
    const x = xs[cell.col]
    const y = ys[cell.row]
    const w = (xs[Math.min(cell.col + cell.colSpan, xs.length - 1)] ?? x) - x
    const h = (ys[Math.min(cell.row + cell.rowSpan, ys.length - 1)] ?? y) - y
    const applied = partsFor(cell)
    const tcPr = child(cell.el, 'tcPr')

    let fill: Fill | null | undefined = findFill(tcPr, env.style)
    if (fill === undefined) {
      for (const part of applied) if (part.fill !== undefined) fill = part.fill
    }
    if (fill) {
      const rect = new Path2D()
      rect.rect(0, 0, w, h)
      ctx.save()
      ctx.translate(x, y)
      paintFill(ctx, fill, rect, w, h)
      ctx.restore()
    }

    // Texto: cor e negrito do estilo, a menos que o trecho diga outra coisa.
    let textColor: Rgba | undefined
    let bold: boolean | undefined
    for (const part of applied) {
      if (part.textColor) textColor = part.textColor
      if (part.bold !== undefined) bold = part.bold
    }
    const txBody = child(cell.el, 'txBody')
    if (txBody) {
      const parsed = parseTextBody(txBody, {
        ...env.text,
        lstStyles: [child(txBody, 'lstStyle')],
        // O padrão da apresentação perde para a cor do estilo da tabela.
        globalStyles: env.lstStyles,
        fontRef: textColor ? { color: textColor } : undefined,
      })
      const base = bold !== undefined && parsed.style.bold === undefined ? { ...parsed.style, bold } : parsed.style
      const mar = (name: string, fallback: number) => (num(tcPr, name) ?? fallback) * k
      const anchor = attr(tcPr, 'anchor')
      drawRichText(ctx, parsed.paragraphs, base, {
        x,
        y,
        width: w,
        height: h,
        padding: [mar('marT', 45720), mar('marR', 91440), mar('marB', 45720), mar('marL', 91440)],
        verticalAlign: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
        lineHeight: parsed.lineHeight,
      })
    }

    // Bordas: as da célula valem mais que as do estilo.
    const border = (own: string, side: 'left' | 'right' | 'top' | 'bottom', inner: 'insideH' | 'insideV', isOuter: boolean) => {
      const ln = child(tcPr, own)
      if (ln) return parseStroke(ln, null, env.style)
      let stroke: Stroke | null | undefined
      for (const part of applied) {
        const value = isOuter ? part.borders[side] : (part.borders[side] ?? part.borders[inner])
        if (value !== undefined) stroke = value
      }
      return stroke ?? null
    }
    const edges: [Stroke | null, number, number, number, number][] = [
      [border('lnT', 'top', 'insideH', cell.row === 0), x, y, x + w, y],
      [border('lnB', 'bottom', 'insideH', cell.row + cell.rowSpan - 1 === lastRow), x, y + h, x + w, y + h],
      [border('lnL', 'left', 'insideV', cell.col === 0), x, y, x, y + h],
      [border('lnR', 'right', 'insideV', cell.col + cell.colSpan - 1 === lastCol), x + w, y, x + w, y + h],
    ]
    for (const [stroke, x1, y1, x2, y2] of edges) {
      if (!stroke) continue
      ctx.save()
      ctx.strokeStyle = toCss(stroke.color)
      ctx.lineWidth = stroke.width
      ctx.setLineDash(stroke.dash ?? [])
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      ctx.restore()
    }
  }
}
