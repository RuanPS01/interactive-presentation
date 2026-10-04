import type {
  FreeTextAlign,
  FreeTextParagraph,
  FreeTextStyle,
  FreeVerticalAlign,
} from '../types/presentation'
import { fontStack } from './freeSlide'
import { paragraphMarkers, resolveStyle } from './richText'

/**
 * Texto rico desenhado num canvas: quebra de linha por palavra, alinhamento,
 * marcadores, sublinhado, tachado e realce. Usado onde não há DOM para medir
 * (o PDF do slide livre e as imagens geradas na importação de um PPTX). É uma
 * aproximação do que o navegador faz na tela, não uma cópia exata.
 */

export interface TextBox {
  x: number
  y: number
  width: number
  height: number
  /** Cima, direita, baixo, esquerda. */
  padding?: [number, number, number, number]
  verticalAlign?: FreeVerticalAlign
  /** Altura de linha padrão, em múltiplos do tamanho da fonte. */
  lineHeight?: number
  /** Sem quebra automática (o texto passa da caixa em vez de quebrar). */
  noWrap?: boolean
}

export function canvasFont(style: FreeTextStyle): string {
  const size = style.fontSize ?? 16
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${size}px ${fontStack(style.fontFamily)}`
}

interface Piece {
  text: string
  style: FreeTextStyle
  width: number
  space: boolean
}

interface Line {
  pieces: Piece[]
  width: number
  size: number
  height: number
}

interface LaidParagraph {
  paragraph: FreeTextParagraph
  style: FreeTextStyle
  marker: string | null
  lines: Line[]
  indent: number
  spaceBefore: number
  spaceAfter: number
}

function measure(ctx: CanvasRenderingContext2D, text: string, style: FreeTextStyle): number {
  ctx.font = canvasFont(style)
  return ctx.measureText(text).width
}

function layoutParagraph(
  ctx: CanvasRenderingContext2D,
  paragraph: FreeTextParagraph,
  base: FreeTextStyle,
  maxWidth: number,
  lineHeight: number,
  noWrap: boolean,
): Line[] {
  const pStyle = resolveStyle(base, paragraph.style, undefined)
  const lineMul = paragraph.lineHeight ?? lineHeight
  const lines: Line[] = []
  let current: Line = { pieces: [], width: 0, size: 0, height: 0 }

  const finish = () => {
    // Espaços no fim da linha não contam para o alinhamento.
    while (current.pieces.length > 0 && current.pieces[current.pieces.length - 1].space) {
      current.width -= (current.pieces.pop() as Piece).width
    }
    const size = current.size || (pStyle.fontSize ?? 16)
    current.size = size
    current.height = size * lineMul
    lines.push(current)
    current = { pieces: [], width: 0, size: 0, height: 0 }
  }

  const push = (piece: Piece) => {
    current.pieces.push(piece)
    current.width += piece.width
    current.size = Math.max(current.size, piece.style.fontSize ?? 16)
  }

  for (const run of paragraph.runs) {
    const style = resolveStyle(base, paragraph.style, run.style)
    const tokens = run.text.match(/\n|[^\S\n]+|[^\s]+/g) ?? []
    for (const token of tokens) {
      if (token === '\n') {
        finish()
        continue
      }
      const space = /^\s+$/.test(token)
      if (space && current.pieces.length === 0 && lines.length > 0) continue
      const width = measure(ctx, token, style)
      if (!noWrap && !space && current.width + width > maxWidth && current.pieces.length > 0) {
        finish()
      }
      if (!noWrap && !space && width > maxWidth) {
        // Palavra maior que a linha: quebra por caractere.
        let chunk = ''
        for (const ch of token) {
          const w = measure(ctx, chunk + ch, style)
          if (w > maxWidth && chunk) {
            push({ text: chunk, style, width: measure(ctx, chunk, style), space: false })
            finish()
            chunk = ch
          } else {
            chunk += ch
          }
        }
        if (chunk) push({ text: chunk, style, width: measure(ctx, chunk, style), space: false })
        continue
      }
      push({ text: token, style, width, space })
    }
  }
  finish()
  return lines
}

/** Altura total do texto, para centralizar ou alinhar embaixo. */
function totalHeight(laid: LaidParagraph[]): number {
  return laid.reduce(
    (sum, p) => sum + p.spaceBefore + p.lines.reduce((s, l) => s + l.height, 0) + p.spaceAfter,
    0,
  )
}

const ALIGN_FACTOR: Record<FreeTextAlign, number> = { left: 0, justify: 0, center: 0.5, right: 1 }

/** Desenha os parágrafos dentro da caixa. */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  paragraphs: FreeTextParagraph[],
  base: FreeTextStyle,
  box: TextBox,
): void {
  const [pt, pr, pb, pl] = box.padding ?? [0, 0, 0, 0]
  const innerWidth = Math.max(1, box.width - pl - pr)
  const lineHeight = box.lineHeight ?? 1.2
  const markers = paragraphMarkers(paragraphs)

  const laid: LaidParagraph[] = paragraphs.map((paragraph, i) => {
    const indent = paragraph.indent ?? 0
    return {
      paragraph,
      style: resolveStyle(base, paragraph.style, undefined),
      marker: markers[i],
      indent,
      spaceBefore: paragraph.spaceBefore ?? 0,
      spaceAfter: paragraph.spaceAfter ?? 0,
      lines: layoutParagraph(ctx, paragraph, base, Math.max(1, innerWidth - indent), lineHeight, Boolean(box.noWrap)),
    }
  })

  const height = totalHeight(laid)
  const available = box.height - pt - pb
  const align = box.verticalAlign ?? 'top'
  let y = box.y + pt + (align === 'middle' ? (available - height) / 2 : align === 'bottom' ? available - height : 0)

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  for (const p of laid) {
    y += p.spaceBefore
    const left = box.x + pl + p.indent
    const lineWidth = innerWidth - p.indent
    p.lines.forEach((line, index) => {
      // O texto fica centrado na altura da linha, como no CSS.
      const baseline = y + (line.height - line.size) / 2 + line.size * 0.82
      const factor = ALIGN_FACTOR[p.paragraph.align ?? 'left']
      let x = left + (lineWidth - line.width) * factor
      if (index === 0 && p.marker) {
        const markerSize = p.style.fontSize ?? 16
        const hang = p.paragraph.hanging || markerSize * 1.1
        ctx.font = canvasFont(p.style)
        const bulletColor =
          p.paragraph.bullet?.kind === 'char' && p.paragraph.bullet.color ? p.paragraph.bullet.color : p.style.color
        ctx.fillStyle = bulletColor ?? '#000000'
        ctx.fillText(p.marker, left - hang, baseline)
      }
      for (const piece of line.pieces) {
        const size = piece.style.fontSize ?? 16
        if (piece.style.highlight) {
          ctx.fillStyle = piece.style.highlight
          ctx.fillRect(x, y, piece.width, line.height)
        }
        ctx.font = canvasFont(piece.style)
        ctx.fillStyle = piece.style.color ?? '#000000'
        if (!piece.space) ctx.fillText(piece.text, x, baseline)
        const thickness = Math.max(1, size * 0.06)
        if (piece.style.underline) ctx.fillRect(x, baseline + size * 0.1, piece.width, thickness)
        if (piece.style.strike) ctx.fillRect(x, baseline - size * 0.3, piece.width, thickness)
        x += piece.width
      }
      y += line.height
    })
    y += p.spaceAfter
  }
  ctx.restore()
}
