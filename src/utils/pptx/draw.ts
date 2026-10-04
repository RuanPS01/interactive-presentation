import { resolveColor, toCss } from './colors'
import type { ColorContext, Rgba } from './colors'
import { toPath2D } from './geometry'
import type { Geometry, PathFillMode, PathOp } from './geometry'
import { attr, child, children, num, relAttr } from './xml'

/**
 * Preenchimentos, contornos e sombras do OOXML desenhados num canvas. É o que
 * transforma formas, fundos e conectores em imagem na importação.
 */

export type Fill =
  | { kind: 'solid'; color: Rgba }
  | { kind: 'gradient'; stops: { pos: number; color: Rgba }[]; angle: number; radial: boolean }
  | {
      kind: 'image'
      image: CanvasImageSource & { width: number; height: number }
      /** Ladrilho: tamanho de cada cópia e deslocamento, em px da moldura. */
      tile: { w: number; h: number; tx: number; ty: number } | null
      alpha: number
    }
  | { kind: 'pattern'; preset: string; fg: Rgba; bg: Rgba }

export interface LineEnd {
  type: string
  w: string
  len: string
}

export interface Stroke {
  color: Rgba
  width: number
  dash: number[] | null
  cap: CanvasLineCap
  join: CanvasLineJoin
  head?: LineEnd
  tail?: LineEnd
}

export interface Shadow {
  color: Rgba
  blur: number
  dx: number
  dy: number
}

/** Dados para ler preenchimentos de uma parte (slide, layout, mestre ou tema). */
export interface StyleContext {
  colors: ColorContext
  /** px da moldura por EMU. */
  k: number
  /** Imagem já carregada de um `r:embed` da parte em leitura. */
  image: (rId: string) => (CanvasImageSource & { width: number; height: number }) | null
}

export interface DrawableShape {
  x: number
  y: number
  w: number
  h: number
  rotation: number
  flipH: boolean
  flipV: boolean
  geometry: Geometry
  fill: Fill | null
  stroke: Stroke | null
  shadow: Shadow | null
}

const FILL_TAGS = ['noFill', 'solidFill', 'gradFill', 'blipFill', 'pattFill', 'grpFill']

/**
 * Preenchimento declarado dentro de `container` (spPr, bgPr, tcPr...).
 * `undefined`: nada declarado (vale o herdado); `null`: sem preenchimento.
 */
export function findFill(container: Element | null | undefined, ctx: StyleContext): Fill | null | undefined {
  const el = children(container).find((c) => FILL_TAGS.includes(c.localName))
  if (!el) return undefined
  return parseFillElement(el, ctx)
}

export function parseFillElement(el: Element, ctx: StyleContext): Fill | null {
  switch (el.localName) {
    case 'noFill':
    case 'grpFill':
      return null
    case 'solidFill': {
      const color = resolveColor(el, ctx.colors)
      return color ? { kind: 'solid', color } : null
    }
    case 'gradFill': {
      const stops = children(child(el, 'gsLst'), 'gs')
        .map((gs) => ({ pos: (num(gs, 'pos') ?? 0) / 100000, color: resolveColor(gs, ctx.colors) }))
        .filter((s): s is { pos: number; color: Rgba } => s.color !== null)
        .sort((a, b) => a.pos - b.pos)
      if (stops.length === 0) return null
      const lin = child(el, 'lin')
      const pathEl = child(el, 'path')
      return {
        kind: 'gradient',
        stops,
        angle: (num(lin, 'ang') ?? 5400000) / 60000,
        radial: Boolean(pathEl),
      }
    }
    case 'blipFill': {
      const blip = child(el, 'blip')
      const rId = relAttr(blip, 'embed')
      const image = rId ? ctx.image(rId) : null
      if (!image) return null
      const tile = child(el, 'tile')
      const alphaFix = child(blip, 'alphaModFix')
      return {
        kind: 'image',
        image,
        // A imagem do ladrilho vale 96 dpi: 9525 EMU por pixel, na escala pedida.
        tile: tile
          ? {
              w: image.width * 9525 * ctx.k * ((num(tile, 'sx') ?? 100000) / 100000),
              h: image.height * 9525 * ctx.k * ((num(tile, 'sy') ?? 100000) / 100000),
              tx: (num(tile, 'tx') ?? 0) * ctx.k,
              ty: (num(tile, 'ty') ?? 0) * ctx.k,
            }
          : null,
        alpha: alphaFix ? (num(alphaFix, 'amt') ?? 100000) / 100000 : 1,
      }
    }
    case 'pattFill': {
      const fg = resolveColor(child(el, 'fgClr'), ctx.colors) ?? { r: 0, g: 0, b: 0, a: 1 }
      const bg = resolveColor(child(el, 'bgClr'), ctx.colors) ?? { r: 255, g: 255, b: 255, a: 1 }
      return { kind: 'pattern', preset: attr(el, 'prst') ?? 'pct50', fg, bg }
    }
  }
  return null
}

/** Primeira cor de um preenchimento (para usar onde só cabe uma cor). */
export function fillColor(fill: Fill | null | undefined): Rgba | null {
  if (!fill) return null
  if (fill.kind === 'solid') return fill.color
  if (fill.kind === 'gradient') return fill.stops[0].color
  if (fill.kind === 'pattern') return fill.bg
  return null
}

const DASHES: Record<string, number[]> = {
  dash: [4, 3],
  dot: [1, 3],
  sysDash: [3, 1],
  sysDot: [1, 1],
  dashDot: [4, 3, 1, 3],
  lgDash: [8, 3],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDashDot: [3, 1, 1, 1],
  sysDashDotDot: [3, 1, 1, 1, 1, 1],
}

/**
 * Contorno a partir de `a:ln`, sobre o estilo do tema (`lnRef`) quando houver.
 * `null` quando a linha não aparece.
 */
export function parseStroke(
  ln: Element | null,
  themeLn: Element | null,
  ctx: StyleContext,
  themeCtx: StyleContext = ctx,
): Stroke | null {
  if (!ln && !themeLn) return null
  const fillOf = (el: Element | null, c: StyleContext) => {
    const f = children(el).find((x) => FILL_TAGS.includes(x.localName))
    return f ? parseFillElement(f, c) : undefined
  }
  const own = fillOf(ln, ctx)
  if (own === null) return null
  const color = fillColor(own) ?? fillColor(fillOf(themeLn, themeCtx) ?? null)
  if (!color) return null
  const pick = (name: string) => attr(ln, name) ?? attr(themeLn, name)
  const width = Math.max(0.5, (Number(pick('w') ?? 9525) || 9525) * ctx.k)
  const dashEl = child(ln, 'prstDash') ?? child(themeLn, 'prstDash')
  const dash = DASHES[attr(dashEl, 'val') ?? 'solid'] ?? null
  const cap = pick('cap')
  const joinEl = child(ln, 'miter') ?? child(ln, 'bevel') ?? child(ln, 'round')
  const end = (name: string): LineEnd | undefined => {
    const el = child(ln, name) ?? child(themeLn, name)
    const type = attr(el, 'type')
    if (!el || !type || type === 'none') return undefined
    return { type, w: attr(el, 'w') ?? 'med', len: attr(el, 'len') ?? 'med' }
  }
  return {
    color,
    width,
    dash: dash ? dash.map((d) => d * width) : null,
    cap: cap === 'rnd' ? 'round' : cap === 'sq' ? 'square' : 'butt',
    join: joinEl?.localName === 'miter' ? 'miter' : joinEl?.localName === 'bevel' ? 'bevel' : 'round',
    head: end('headEnd'),
    tail: end('tailEnd'),
  }
}

/** Sombra externa (`a:outerShdw`) de uma lista de efeitos. */
export function parseShadow(effectLst: Element | null, ctx: StyleContext): Shadow | null {
  const shadow = child(effectLst, 'outerShdw')
  if (!shadow) return null
  const color = resolveColor(shadow, ctx.colors)
  if (!color) return null
  const dist = (num(shadow, 'dist') ?? 0) * ctx.k
  const dir = ((num(shadow, 'dir') ?? 0) / 60000) * (Math.PI / 180)
  return { color, blur: (num(shadow, 'blurRad') ?? 0) * ctx.k, dx: dist * Math.cos(dir), dy: dist * Math.sin(dir) }
}

const END_SIZE: Record<string, number> = { sm: 2, med: 3, lg: 5 }

/** Quanto o desenho pode passar da caixa da forma (contorno, setas, sombra). */
export function shapeMargin(shape: Pick<DrawableShape, 'stroke' | 'shadow'>): number {
  let margin = 1
  if (shape.stroke) {
    margin += shape.stroke.width / 2
    if (shape.stroke.head || shape.stroke.tail) margin += shape.stroke.width * 5
  }
  if (shape.shadow) margin += shape.shadow.blur + Math.max(Math.abs(shape.shadow.dx), Math.abs(shape.shadow.dy))
  return margin
}

/** Caixa alinhada aos eixos que contém a forma desenhada (girada e com margem). */
export function shapeBounds(shape: DrawableShape): { x: number; y: number; w: number; h: number } {
  const margin = shapeMargin(shape)
  const angle = (shape.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  const w = shape.w * cos + shape.h * sin + margin * 2
  const h = shape.w * sin + shape.h * cos + margin * 2
  const cx = shape.x + shape.w / 2
  const cy = shape.y + shape.h / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function patternCanvas(preset: string, fg: Rgba, bg: Rgba): HTMLCanvasElement {
  const size = 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = toCss(bg)
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = toCss(fg)
  ctx.strokeStyle = toCss(fg)
  const p = preset.toLowerCase()
  if (p.startsWith('pct')) {
    const pct = Number(p.slice(3)) || 50
    const dots = Math.round((pct / 100) * size * size)
    for (let i = 0; i < dots; i++) ctx.fillRect((i * 5) % size, Math.floor((i * 5) / size) % size, 1, 1)
  } else if (p.includes('cross') || p.includes('grid') || p.includes('check')) {
    ctx.fillRect(0, 0, size, 1)
    ctx.fillRect(0, 0, 1, size)
  } else if (p.includes('horz')) {
    ctx.fillRect(0, 0, size, p.startsWith('dk') || p.startsWith('wd') ? 3 : 1)
  } else if (p.includes('vert')) {
    ctx.fillRect(0, 0, p.startsWith('dk') || p.startsWith('wd') ? 3 : 1, size)
  } else if (p.includes('diag')) {
    ctx.lineWidth = p.startsWith('dk') || p.startsWith('wd') ? 2 : 1
    ctx.beginPath()
    if (p.includes('up')) {
      ctx.moveTo(0, size)
      ctx.lineTo(size, 0)
    } else {
      ctx.moveTo(0, 0)
      ctx.lineTo(size, size)
    }
    ctx.stroke()
  } else {
    ctx.globalAlpha = 0.5
    ctx.fillRect(0, 0, size, size)
  }
  return canvas
}

/** Aplica um preenchimento ao caminho, no sistema de coordenadas da forma (0..w, 0..h). */
export function paintFill(
  ctx: CanvasRenderingContext2D,
  fill: Fill,
  p: Path2D,
  w: number,
  h: number,
): void {
  switch (fill.kind) {
    case 'solid':
      ctx.fillStyle = toCss(fill.color)
      ctx.fill(p)
      return
    case 'gradient': {
      let gradient: CanvasGradient
      if (fill.radial) {
        gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2)
      } else {
        const a = (fill.angle * Math.PI) / 180
        const half = (Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a))) / 2
        const dx = Math.cos(a) * half
        const dy = Math.sin(a) * half
        gradient = ctx.createLinearGradient(w / 2 - dx, h / 2 - dy, w / 2 + dx, h / 2 + dy)
      }
      for (const stop of fill.stops) gradient.addColorStop(Math.max(0, Math.min(1, stop.pos)), toCss(stop.color))
      ctx.fillStyle = gradient
      ctx.fill(p)
      return
    }
    case 'pattern': {
      const pattern = ctx.createPattern(patternCanvas(fill.preset, fill.fg, fill.bg), 'repeat')
      if (pattern) ctx.fillStyle = pattern
      ctx.fill(p)
      return
    }
    case 'image': {
      ctx.save()
      ctx.clip(p)
      ctx.globalAlpha *= fill.alpha
      if (fill.tile) {
        const tile = document.createElement('canvas')
        tile.width = Math.max(1, Math.round(fill.tile.w))
        tile.height = Math.max(1, Math.round(fill.tile.h))
        tile.getContext('2d')?.drawImage(fill.image, 0, 0, tile.width, tile.height)
        const pattern = ctx.createPattern(tile, 'repeat')
        if (pattern) {
          pattern.setTransform(new DOMMatrix().translate(fill.tile.tx, fill.tile.ty))
          ctx.fillStyle = pattern
          ctx.fillRect(0, 0, w, h)
        }
      } else {
        ctx.drawImage(fill.image, 0, 0, w, h)
      }
      ctx.restore()
    }
  }
}

const MODE_OVERLAY: Partial<Record<PathFillMode, string>> = {
  darken: 'rgba(0, 0, 0, 0.4)',
  darkenLess: 'rgba(0, 0, 0, 0.2)',
  lighten: 'rgba(255, 255, 255, 0.4)',
  lightenLess: 'rgba(255, 255, 255, 0.2)',
}

function endpoints(ops: PathOp[]): { start: [number, number, number, number]; end: [number, number, number, number] } | null {
  const points: [number, number][] = []
  for (const op of ops) {
    if (op.op === 'M' || op.op === 'L') points.push([op.x, op.y])
    else if (op.op === 'Q') points.push([op.x1, op.y1], [op.x, op.y])
    else if (op.op === 'C') points.push([op.x1, op.y1], [op.x2, op.y2], [op.x, op.y])
  }
  if (points.length < 2) return null
  const [a, b] = points
  const z = points[points.length - 1]
  const y = points[points.length - 2]
  return { start: [a[0], a[1], b[0], b[1]], end: [z[0], z[1], y[0], y[1]] }
}

/** Ponta de seta em (x, y), apontando para longe de (fromX, fromY). */
function drawLineEnd(
  ctx: CanvasRenderingContext2D,
  end: LineEnd,
  x: number,
  y: number,
  fromX: number,
  fromY: number,
  stroke: Stroke,
) {
  const width = stroke.width * (END_SIZE[end.w] ?? 3)
  const length = stroke.width * (END_SIZE[end.len] ?? 3)
  const angle = Math.atan2(y - fromY, x - fromX)
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.fillStyle = toCss(stroke.color)
  ctx.strokeStyle = toCss(stroke.color)
  ctx.lineWidth = stroke.width
  ctx.setLineDash([])
  ctx.beginPath()
  switch (end.type) {
    case 'oval':
      ctx.ellipse(0, 0, length / 2, width / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      break
    case 'diamond':
      ctx.moveTo(length / 2, 0)
      ctx.lineTo(0, width / 2)
      ctx.lineTo(-length / 2, 0)
      ctx.lineTo(0, -width / 2)
      ctx.closePath()
      ctx.fill()
      break
    case 'arrow':
      ctx.moveTo(-length, -width / 2)
      ctx.lineTo(0, 0)
      ctx.lineTo(-length, width / 2)
      ctx.stroke()
      break
    case 'stealth':
      ctx.moveTo(0, 0)
      ctx.lineTo(-length, -width / 2)
      ctx.lineTo(-length * 0.6, 0)
      ctx.lineTo(-length, width / 2)
      ctx.closePath()
      ctx.fill()
      break
    default:
      ctx.moveTo(0, 0)
      ctx.lineTo(-length, -width / 2)
      ctx.lineTo(-length, width / 2)
      ctx.closePath()
      ctx.fill()
  }
  ctx.restore()
}

/** Desenha a forma no canvas (já em coordenadas da moldura lógica). */
export function drawShape(ctx: CanvasRenderingContext2D, shape: DrawableShape): void {
  const { w, h } = shape
  ctx.save()
  ctx.translate(shape.x + w / 2, shape.y + h / 2)
  if (shape.rotation) ctx.rotate((shape.rotation * Math.PI) / 180)
  ctx.scale(shape.flipH ? -1 : 1, shape.flipV ? -1 : 1)
  ctx.translate(-w / 2, -h / 2)

  const paths = shape.geometry.paths.map((p) => ({ path: p, p2d: toPath2D(p) }))
  let shadowPending = Boolean(shape.shadow)
  const applyShadow = () => {
    if (!shadowPending || !shape.shadow) return
    ctx.shadowColor = toCss(shape.shadow.color)
    ctx.shadowBlur = shape.shadow.blur
    ctx.shadowOffsetX = shape.shadow.dx
    ctx.shadowOffsetY = shape.shadow.dy
  }
  const clearShadow = () => {
    shadowPending = false
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  if (shape.fill) {
    for (const { path, p2d } of paths) {
      if (path.fill === 'none') continue
      applyShadow()
      paintFill(ctx, shape.fill, p2d, w, h)
      clearShadow()
      const overlay = MODE_OVERLAY[path.fill]
      if (overlay) {
        ctx.fillStyle = overlay
        ctx.fill(p2d)
      }
    }
  }

  const stroke = shape.stroke
  if (stroke) {
    ctx.strokeStyle = toCss(stroke.color)
    ctx.lineWidth = stroke.width
    ctx.lineCap = stroke.cap
    ctx.lineJoin = stroke.join
    ctx.setLineDash(stroke.dash ?? [])
    for (const { path, p2d } of paths) {
      if (!path.stroke) continue
      applyShadow()
      ctx.stroke(p2d)
      clearShadow()
    }
    const open = paths.find(({ path }) => path.stroke && !path.ops.some((op) => op.op === 'Z'))
    const ends = open ? endpoints(open.path.ops) : null
    if (ends && stroke.head) drawLineEnd(ctx, stroke.head, ends.start[0], ends.start[1], ends.start[2], ends.start[3], stroke)
    if (ends && stroke.tail) drawLineEnd(ctx, stroke.tail, ends.end[0], ends.end[1], ends.end[2], ends.end[3], stroke)
  }
  ctx.restore()
}
