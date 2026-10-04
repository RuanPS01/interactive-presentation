import type {
  FreeElement,
  FreeSlide,
  FreeTextElement,
  PresentationAsset,
  SlideAspect,
} from '../../types/presentation'
import { drawRichText } from '../canvasText'
import { blobToAsset, canvasToAsset, loadImage } from '../images'
import { SLIDE_FRAMES } from '../settings'
import { drawChart } from './chart'
import { readColorMap, readScheme, resolveColor, toHex } from './colors'
import type { ColorContext, Rgba } from './colors'
import {
  drawShape,
  fillColor,
  findFill,
  paintFill,
  parseFillElement,
  parseShadow,
  parseStroke,
  shapeBounds,
} from './draw'
import type { DrawableShape, Fill, Shadow, StyleContext, Stroke } from './draw'
import { buildGeometry, toPath2D } from './geometry'
import { isDrawableImage, PptxPackage } from './package'
import { drawTable } from './table'
import { parseTextBody, readBodyProps } from './text'
import type { TextContext } from './text'
import { attr, bool, child, children, descendant, num, path, relAttr, resolveAlternate } from './xml'

/**
 * Importação de um arquivo PowerPoint (.pptx): cada slide vira um slide
 * livre. Textos continuam texto (editáveis, com fonte, tamanho, cor e
 * estilos), fotos continuam imagem, e todo o resto (formas, fundos em
 * gradiente ou ladrilho, SVG, tabelas, gráficos, SmartArt) vira imagem.
 *
 * Formas vizinhas na ordem de desenho, sem texto ou foto entre elas, viram
 * uma imagem só: um slide com dezenas de formas decorativas resulta em poucas
 * camadas, fáceis de mover ou apagar, e em poucos arquivos para a sala ler.
 */

export interface PptxProgress {
  done: number
  total: number
  message: string
}

export interface PptxImportResult {
  title: string
  slides: FreeSlide[]
  assets: PresentationAsset[]
  /** Formato reconhecido do arquivo; `null` quando não é 16:9 nem 4:3. */
  aspect: SlideAspect | null
  warnings: string[]
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Placed extends Box {
  /** Rotação em graus. */
  rot: number
  flipH: boolean
  flipV: boolean
}

/** Mapeia uma caixa (em EMU, no espaço do pai) para px da moldura. */
type Mapper = (x: number, y: number, w: number, h: number, rot: number, flipH: boolean, flipV: boolean) => Placed

type Item =
  | { kind: 'graphic'; name: string; bounds: Box; draw: (ctx: CanvasRenderingContext2D) => void; background?: boolean }
  | {
      kind: 'picture'
      name: string
      placed: Placed
      opacity: number
      draw: (ctx: CanvasRenderingContext2D) => void
      build: () => Promise<PresentationAsset | null>
    }
  | { kind: 'text'; element: FreeTextElement; title: boolean }

interface Theme {
  scheme: Record<string, string>
  majorFont: string
  minorFont: string
  fills: Element[]
  lines: Element[]
  effects: Element[]
  bgFills: Element[]
}

interface Master {
  path: string
  root: Element
  theme: Theme
  colorMap: Record<string, string>
}

interface Layout {
  path: string
  root: Element
  master: Master
}

interface Env {
  pkg: PptxPackage
  k: number
  frame: { width: number; height: number }
  defaultTextStyle: Element | null
  tableStyles: Document | null
  warnings: Set<string>
  images: Map<string, Promise<HTMLImageElement | null>>
}

/** Uma parte (slide, layout ou mestre) com o que é preciso para ler as formas dela. */
interface Part {
  env: Env
  path: string
  kind: 'slide' | 'layout' | 'master'
  colors: ColorContext
  theme: Theme
  master: Master
  layout: Layout | null
  /** Imagens já carregadas, pelo `r:embed` desta parte. */
  images: Map<string, HTMLImageElement>
  slideNumber: number
  /** Cor de fundo do slide (para formas com `useBgFill`). */
  background: Rgba | null
}

function newId(): string {
  return crypto.randomUUID()
}

function normalizeAngle(deg: number): number {
  let a = deg % 360
  if (a > 180) a -= 360
  if (a <= -180) a += 360
  return Math.round(a * 100) / 100
}

function readXfrm(xfrm: Element | null) {
  const off = child(xfrm, 'off')
  const ext = child(xfrm, 'ext')
  return {
    x: num(off, 'x') ?? 0,
    y: num(off, 'y') ?? 0,
    w: num(ext, 'cx') ?? 0,
    h: num(ext, 'cy') ?? 0,
    rot: (num(xfrm, 'rot') ?? 0) / 60000,
    flipH: bool(xfrm, 'flipH') ?? false,
    flipV: bool(xfrm, 'flipV') ?? false,
  }
}

function rootMapper(k: number): Mapper {
  return (x, y, w, h, rot, flipH, flipV) => ({ x: x * k, y: y * k, w: w * k, h: h * k, rot, flipH, flipV })
}

/** Transformação de um grupo: escala do espaço dos filhos, espelhamento e rotação. */
function groupMapper(parent: Mapper, xfrm: Element | null): Mapper {
  const g = readXfrm(xfrm)
  const chOff = child(xfrm, 'chOff')
  const chExt = child(xfrm, 'chExt')
  const chx = num(chOff, 'x') ?? g.x
  const chy = num(chOff, 'y') ?? g.y
  const sx = (num(chExt, 'cx') ?? g.w) ? g.w / (num(chExt, 'cx') ?? g.w) : 1
  const sy = (num(chExt, 'cy') ?? g.h) ? g.h / (num(chExt, 'cy') ?? g.h) : 1
  const gcx = g.x + g.w / 2
  const gcy = g.y + g.h / 2
  const angle = (g.rot * Math.PI) / 180
  return (x, y, w, h, rot, flipH, flipV) => {
    const nw = w * sx
    const nh = h * sy
    let cx = g.x + (x - chx) * sx + nw / 2
    let cy = g.y + (y - chy) * sy + nh / 2
    if (g.flipH) cx = 2 * gcx - cx
    if (g.flipV) cy = 2 * gcy - cy
    if (g.rot) {
      const dx = cx - gcx
      const dy = cy - gcy
      cx = gcx + dx * Math.cos(angle) - dy * Math.sin(angle)
      cy = gcy + dx * Math.sin(angle) + dy * Math.cos(angle)
    }
    const mirrored = g.flipH !== g.flipV
    return parent(cx - nw / 2, cy - nh / 2, nw, nh, (mirrored ? -rot : rot) + g.rot, flipH !== g.flipH, flipV !== g.flipV)
  }
}

function union(boxes: Box[]): Box {
  const x1 = Math.min(...boxes.map((b) => b.x))
  const y1 = Math.min(...boxes.map((b) => b.y))
  const x2 = Math.max(...boxes.map((b) => b.x + b.w))
  const y2 = Math.max(...boxes.map((b) => b.y + b.h))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function rotatedBounds(p: Placed): Box {
  const a = (p.rot * Math.PI) / 180
  const cos = Math.abs(Math.cos(a))
  const sin = Math.abs(Math.sin(a))
  const w = p.w * cos + p.h * sin
  const h = p.w * sin + p.h * cos
  return { x: p.x + p.w / 2 - w / 2, y: p.y + p.h / 2 - h / 2, w, h }
}

/* Tema, mestre e layout --------------------------------------------------- */

function readTheme(pkg: PptxPackage, themePath: string | undefined): Theme {
  const root = themePath ? pkg.xml(themePath)?.documentElement : null
  const elements = child(root, 'themeElements')
  const fonts = child(elements, 'fontScheme')
  const fmt = child(elements, 'fmtScheme')
  return {
    scheme: readScheme(child(elements, 'clrScheme')),
    majorFont: attr(path(fonts, 'majorFont', 'latin'), 'typeface') || 'Calibri Light',
    minorFont: attr(path(fonts, 'minorFont', 'latin'), 'typeface') || 'Calibri',
    fills: children(child(fmt, 'fillStyleLst')),
    lines: children(child(fmt, 'lnStyleLst')),
    effects: children(child(fmt, 'effectStyleLst')),
    bgFills: children(child(fmt, 'bgFillStyleLst')),
  }
}

/** Carrega (uma vez por arquivo de mídia) as imagens citadas numa parte. */
async function loadPartImages(env: Env, partPath: string, root: Element): Promise<Map<string, HTMLImageElement>> {
  const rels = env.pkg.rels(partPath)
  const ids = new Set<string>()
  for (const tag of ['blip', 'svgBlip']) {
    for (const el of Array.from(root.getElementsByTagNameNS('*', tag))) {
      const id = relAttr(el, 'embed')
      if (id) ids.add(id)
    }
  }
  const map = new Map<string, HTMLImageElement>()
  for (const id of ids) {
    const rel = rels.get(id)
    if (!rel || rel.external) continue
    if (!isDrawableImage(rel.target)) {
      const ext = rel.target.split('.').pop()?.toUpperCase() ?? '?'
      env.warnings.add(`Imagens em formato ${ext} não são exibidas por navegadores e ficaram de fora.`)
      continue
    }
    let pending = env.images.get(rel.target)
    if (!pending) {
      const blob = env.pkg.blob(rel.target)
      pending = blob ? loadImage(blob).catch(() => null) : Promise.resolve(null)
      env.images.set(rel.target, pending)
    }
    const img = await pending
    if (img) map.set(id, img)
  }
  return map
}

function styleContext(part: Part, colors: ColorContext = part.colors): StyleContext {
  return { colors, k: part.env.k, image: (rId) => part.images.get(rId) ?? null }
}

/** Contexto de cor com o `phClr` dos estilos do tema substituído. */
function withPlaceholder(part: Part, ref: Element | null): ColorContext {
  return { ...part.colors, placeholder: resolveColor(ref, part.colors) ?? undefined }
}

function themeFill(part: Part, fillRef: Element | null): Fill | null | undefined {
  const idx = num(fillRef, 'idx')
  if (idx === undefined) return undefined
  if (idx === 0) return null
  const el = idx >= 1001 ? part.theme.bgFills[idx - 1001] : part.theme.fills[idx - 1]
  if (!el) return undefined
  return parseFillElement(el, styleContext(part, withPlaceholder(part, fillRef)))
}

function themeLine(part: Part, lnRef: Element | null): { el: Element | null; ctx: StyleContext } {
  const idx = num(lnRef, 'idx') ?? 0
  return {
    el: idx > 0 ? (part.theme.lines[idx - 1] ?? null) : null,
    ctx: styleContext(part, withPlaceholder(part, lnRef)),
  }
}

function themeShadow(part: Part, effectRef: Element | null): Shadow | null {
  const idx = num(effectRef, 'idx') ?? 0
  const el = idx > 0 ? part.theme.effects[idx - 1] : null
  return el ? parseShadow(child(el, 'effectLst'), styleContext(part, withPlaceholder(part, effectRef))) : null
}

/* Placeholders ------------------------------------------------------------- */

interface Placeholder {
  type: string
  idx: string | null
}

function placeholderOf(el: Element): Placeholder | null {
  const nv = children(el).find((c) => c.localName.startsWith('nv'))
  const ph = path(nv, 'nvPr', 'ph')
  if (!ph) return null
  return { type: attr(ph, 'type') ?? 'obj', idx: attr(ph, 'idx') }
}

const TITLE_TYPES = new Set(['title', 'ctrTitle'])

function masterType(type: string): string {
  if (TITLE_TYPES.has(type)) return 'title'
  if (type === 'dt' || type === 'ftr' || type === 'sldNum') return type
  return 'body'
}

function findPlaceholder(root: Element | null, ph: Placeholder, byIndex: boolean): Element | null {
  const tree = path(root, 'cSld', 'spTree')
  const candidates = Array.from(tree?.children ?? []).filter((el) => placeholderOf(el))
  if (byIndex && ph.idx !== null) {
    const match = candidates.find((el) => placeholderOf(el)?.idx === ph.idx)
    if (match) return match
  }
  const wanted = byIndex ? ph.type : masterType(ph.type)
  return (
    candidates.find((el) => {
      const other = placeholderOf(el) as Placeholder
      const type = byIndex ? other.type : masterType(other.type)
      return type === wanted || (TITLE_TYPES.has(type) && TITLE_TYPES.has(wanted))
    }) ?? null
  )
}

/** Placeholders do layout e do mestre de que uma forma do slide herda. */
function inheritedPlaceholders(el: Element, part: Part): { layout: Element | null; master: Element | null; ph: Placeholder | null } {
  const ph = placeholderOf(el)
  if (!ph) return { layout: null, master: null, ph: null }
  if (part.kind === 'slide') {
    return {
      ph,
      layout: findPlaceholder(part.layout?.root ?? null, ph, true),
      master: findPlaceholder(part.master.root, ph, false),
    }
  }
  if (part.kind === 'layout') return { ph, layout: null, master: findPlaceholder(part.master.root, ph, false) }
  return { ph, layout: null, master: null }
}

function textStyleFor(part: Part, ph: Placeholder | null): Element | null {
  const styles = path(part.master.root, 'txStyles')
  if (!ph) return null
  if (TITLE_TYPES.has(ph.type)) return child(styles, 'titleStyle')
  if (ph.type === 'dt' || ph.type === 'ftr' || ph.type === 'sldNum') return child(styles, 'otherStyle')
  return child(styles, 'bodyStyle')
}

/* Conversão das formas ----------------------------------------------------- */

function hasText(txBody: Element | null): boolean {
  return Array.from(txBody?.getElementsByTagNameNS('*', 't') ?? []).some((t) => (t.textContent ?? '').trim() !== '')
}

function textContext(part: Part, lstStyles: (Element | null)[], globalStyles: (Element | null)[], fontRef: Element | null, body: { fontScale: number; lineReduction: number }): TextContext {
  const fontIdx = attr(fontRef, 'idx')
  const fontColor = resolveColor(fontRef, part.colors)
  return {
    colors: part.colors,
    k: part.env.k,
    majorFont: part.theme.majorFont,
    minorFont: part.theme.minorFont,
    lstStyles,
    globalStyles,
    fontRef: fontRef
      ? {
          font: fontIdx === 'major' ? part.theme.majorFont : fontIdx === 'minor' ? part.theme.minorFont : undefined,
          color: fontColor ?? undefined,
        }
      : undefined,
    fontScale: body.fontScale,
    lineReduction: body.lineReduction,
    slideNumber: part.slideNumber,
  }
}

function convertShape(el: Element, part: Part, mapper: Mapper, items: Item[]): void {
  if (attr(path(children(el).find((c) => c.localName.startsWith('nv')) ?? null, 'cNvPr'), 'hidden') === '1') return
  const { layout: layoutPh, master: masterPh, ph } = inheritedPlaceholders(el, part)
  // Placeholders do layout e do mestre são moldes: não aparecem no slide.
  if (ph && part.kind !== 'slide') return
  const spPr = child(el, 'spPr')
  const chain = [spPr, child(layoutPh, 'spPr'), child(masterPh, 'spPr')]
  const xfrmEl = chain.map((s) => child(s, 'xfrm')).find(Boolean) ?? null
  if (!xfrmEl) return
  const xf = readXfrm(xfrmEl)
  const placed = mapper(xf.x, xf.y, xf.w, xf.h, xf.rot, xf.flipH, xf.flipV)
  const name = attr(path(children(el).find((c) => c.localName.startsWith('nv')) ?? null, 'cNvPr'), 'name') ?? 'Forma'
  const geomEl = chain.map((s) => child(s, 'prstGeom') ?? child(s, 'custGeom')).find(Boolean) ?? null
  const geometry = buildGeometry(geomEl, placed.w, placed.h)
  const styleEl = child(el, 'style')
  const ctx = styleContext(part)

  let fill: Fill | null | undefined
  for (const s of chain) {
    fill = findFill(s, ctx)
    if (fill !== undefined) break
  }
  if (fill === undefined) fill = themeFill(part, child(styleEl, 'fillRef'))
  if (attr(el, 'useBgFill') === '1' && part.background) fill = { kind: 'solid', color: part.background }

  const ln = chain.map((s) => child(s, 'ln')).find(Boolean) ?? null
  const theme = themeLine(part, child(styleEl, 'lnRef'))
  const stroke: Stroke | null = el.localName === 'cxnSp' || ln || theme.el ? parseStroke(ln, theme.el, ctx, theme.ctx) : null
  const shadow = parseShadow(child(spPr, 'effectLst'), ctx) ?? (child(spPr, 'effectLst') ? null : themeShadow(part, child(styleEl, 'effectRef')))

  if (fill || stroke) {
    const shape: DrawableShape = {
      x: placed.x,
      y: placed.y,
      w: placed.w,
      h: placed.h,
      rotation: placed.rot,
      flipH: placed.flipH,
      flipV: placed.flipV,
      geometry,
      fill: fill ?? null,
      stroke,
      shadow,
    }
    items.push({ kind: 'graphic', name, bounds: shapeBounds(shape), draw: (c) => drawShape(c, shape) })
  }

  const txBody = child(el, 'txBody')
  if (!hasText(txBody) || !txBody) return
  const body = readBodyProps(
    [child(txBody, 'bodyPr'), path(layoutPh, 'txBody', 'bodyPr'), path(masterPh, 'txBody', 'bodyPr')],
    part.env.k,
  )
  if (body.vertical) part.env.warnings.add('Textos verticais foram importados na horizontal.')
  const own = [child(txBody, 'lstStyle'), path(layoutPh, 'txBody', 'lstStyle'), path(masterPh, 'txBody', 'lstStyle'), textStyleFor(part, ph)]
  const global = ph ? [part.env.defaultTextStyle] : [path(part.master.root, 'txStyles', 'otherStyle'), part.env.defaultTextStyle]
  const parsed = parseTextBody(txBody, textContext(part, own, global, child(styleEl, 'fontRef'), body))

  // A área de texto vem da geometria (numa elipse, o retângulo inscrito); o
  // texto gira com a forma, mas não espelha.
  const tr = geometry.textRect
  let lx = tr.l + (tr.r - tr.l) / 2 - placed.w / 2
  let ly = tr.t + (tr.b - tr.t) / 2 - placed.h / 2
  if (placed.flipH) lx = -lx
  if (placed.flipV) ly = -ly
  const a = (placed.rot * Math.PI) / 180
  const cx = placed.x + placed.w / 2 + lx * Math.cos(a) - ly * Math.sin(a)
  const cy = placed.y + placed.h / 2 + lx * Math.sin(a) + ly * Math.cos(a)
  const baseWidth = Math.max(1, tr.r - tr.l)
  const height = Math.max(1, tr.b - tr.t)
  let left = cx - baseWidth / 2
  let width = baseWidth
  if (!body.wrap) {
    // Sem quebra automática, a caixa do PowerPoint cresce com o texto; aqui
    // ela ganha folga para a fonte substituta não quebrar a linha, do lado
    // para onde o texto cresce (à direita, se alinhado à esquerda).
    const extra = baseWidth * 0.15
    const align = parsed.paragraphs[0]?.align ?? 'left'
    if (align === 'center') left -= extra / 2
    else if (align === 'right') left -= extra
    width += extra
  }
  const element: FreeTextElement = {
    id: newId(),
    kind: 'text',
    name,
    x: Math.round(left * 10) / 10,
    y: Math.round((cy - height / 2) * 10) / 10,
    width: Math.round(width * 10) / 10,
    height: Math.round(height * 10) / 10,
    paragraphs: parsed.paragraphs,
    style: parsed.style,
    verticalAlign: body.verticalAlign,
    padding: body.padding.map((n) => Math.round(n * 10) / 10) as [number, number, number, number],
    lineHeight: Math.round(parsed.lineHeight * 1000) / 1000,
  }
  const rotation = normalizeAngle(placed.rot)
  if (rotation) element.rotation = rotation
  items.push({ kind: 'text', element, title: Boolean(ph && TITLE_TYPES.has(ph.type)) })
}

function convertPicture(el: Element, part: Part, mapper: Mapper, items: Item[], frameXfrm?: Element | null): void {
  const nv = children(el).find((c) => c.localName.startsWith('nv')) ?? null
  if (attr(child(nv, 'cNvPr'), 'hidden') === '1') return
  const { layout: layoutPh, master: masterPh, ph } = inheritedPlaceholders(el, part)
  if (ph && part.kind !== 'slide') return
  const spPr = child(el, 'spPr')
  const xfrmEl =
    child(spPr, 'xfrm') ?? frameXfrm ?? child(child(layoutPh, 'spPr'), 'xfrm') ?? child(child(masterPh, 'spPr'), 'xfrm')
  if (!xfrmEl) return
  const xf = readXfrm(xfrmEl)
  const placed = mapper(xf.x, xf.y, xf.w, xf.h, xf.rot, xf.flipH, xf.flipV)
  const name = attr(child(nv, 'cNvPr'), 'name') ?? 'Imagem'
  if (path(nv, 'nvPr', 'videoFile') || path(nv, 'nvPr', 'audioFile')) {
    part.env.warnings.add('Vídeos e áudios viraram apenas a imagem de capa.')
  }

  const blipFill = child(el, 'blipFill')
  const blip = child(blipFill, 'blip')
  const svgBlip = descendant(blip, 'svgBlip')
  const svgId = relAttr(svgBlip, 'embed')
  const rasterId = relAttr(blip, 'embed')
  const img = (svgId && part.images.get(svgId)) || (rasterId && part.images.get(rasterId)) || null
  if (!img) return
  const rel = rasterId ? part.env.pkg.rels(part.path).get(rasterId) : undefined

  const src = child(blipFill, 'srcRect')
  const crop = {
    l: (num(src, 'l') ?? 0) / 100000,
    t: (num(src, 't') ?? 0) / 100000,
    r: (num(src, 'r') ?? 0) / 100000,
    b: (num(src, 'b') ?? 0) / 100000,
  }
  const cropped = crop.l !== 0 || crop.t !== 0 || crop.r !== 0 || crop.b !== 0
  const geomEl = child(spPr, 'prstGeom') ?? child(spPr, 'custGeom')
  const clipped = Boolean(geomEl && !(geomEl.localName === 'prstGeom' && attr(geomEl, 'prst') === 'rect'))
  const stroke = child(spPr, 'ln') ? parseStroke(child(spPr, 'ln'), null, styleContext(part)) : null
  const gray = Boolean(child(blip, 'grayscl'))
  const alphaFix = child(blip, 'alphaModFix')
  const opacity = alphaFix ? (num(alphaFix, 'amt') ?? 100000) / 100000 : 1

  /** Desenha a foto em (0, 0, w, h), com recorte, máscara e contorno. */
  const paint = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const geometry = buildGeometry(geomEl, w, h)
    ctx.save()
    if (clipped) {
      const clip = new Path2D()
      for (const p of geometry.paths) clip.addPath(toPath2D(p))
      ctx.clip(clip)
    }
    if (gray) ctx.filter = 'grayscale(1)'
    const fw = 1 - crop.l - crop.r || 1
    const fh = 1 - crop.t - crop.b || 1
    ctx.drawImage(img, (-crop.l * w) / fw, (-crop.t * h) / fh, w / fw, h / fh)
    ctx.restore()
    if (stroke) {
      drawShape(ctx, { x: 0, y: 0, w, h, rotation: 0, flipH: false, flipV: false, geometry, fill: null, stroke, shadow: null })
    }
  }

  items.push({
    kind: 'picture',
    name,
    placed,
    opacity,
    draw: (ctx) => {
      ctx.save()
      ctx.globalAlpha *= opacity
      ctx.translate(placed.x + placed.w / 2, placed.y + placed.h / 2)
      if (placed.rot) ctx.rotate((placed.rot * Math.PI) / 180)
      ctx.scale(placed.flipH ? -1 : 1, placed.flipV ? -1 : 1)
      ctx.translate(-placed.w / 2, -placed.h / 2)
      paint(ctx, placed.w, placed.h)
      ctx.restore()
    },
    build: async () => {
      const untouched = !cropped && !clipped && !stroke && !gray && !placed.flipH && !placed.flipV && !svgId
      const blob = rel ? part.env.pkg.blob(rel.target) : null
      if (untouched && blob) return blobToAsset(blob)
      // Recorte, máscara, espelho ou SVG: a imagem é redesenhada já pronta.
      const natural = (img.naturalWidth || img.width) * (1 - crop.l - crop.r)
      const scale = Math.max(0.5, Math.min(2, natural / Math.max(1, placed.w), 1920 / Math.max(placed.w, placed.h)))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(placed.w * scale))
      canvas.height = Math.max(1, Math.round(placed.h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.scale(scale, scale)
      ctx.translate(placed.w / 2, placed.h / 2)
      ctx.scale(placed.flipH ? -1 : 1, placed.flipV ? -1 : 1)
      ctx.translate(-placed.w / 2, -placed.h / 2)
      paint(ctx, placed.w, placed.h)
      return canvasToAsset(canvas)
    },
  })
}

async function convertFrame(el: Element, part: Part, mapper: Mapper, items: Item[]): Promise<void> {
  const xfrmEl = child(el, 'xfrm')
  const xf = readXfrm(xfrmEl)
  const placed = mapper(xf.x, xf.y, xf.w, xf.h, xf.rot, xf.flipH, xf.flipV)
  const box = { x: placed.x, y: placed.y, w: placed.w, h: placed.h }
  const name = attr(path(el, 'nvGraphicFramePr', 'cNvPr'), 'name') ?? 'Objeto'
  const data = path(el, 'graphic', 'graphicData')
  const env = part.env

  const tbl = child(data, 'tbl')
  if (tbl) {
    items.push({
      kind: 'graphic',
      name,
      bounds: box,
      draw: (ctx) =>
        drawTable(ctx, tbl, box, {
          style: styleContext(part),
          text: {
            colors: part.colors,
            k: env.k,
            majorFont: part.theme.majorFont,
            minorFont: part.theme.minorFont,
            slideNumber: part.slideNumber,
          },
          lstStyles: [env.defaultTextStyle],
          tableStyles: env.tableStyles,
        }),
    })
    return
  }

  const chartRef = descendant(data, 'chart')
  const chartId = relAttr(chartRef, 'id')
  if (chartId) {
    const rel = env.pkg.rels(part.path).get(chartId)
    const doc = rel ? env.pkg.xml(rel.target) : null
    if (doc) {
      env.warnings.add('Gráficos viraram imagens simplificadas, desenhadas a partir dos dados do arquivo.')
      items.push({
        kind: 'graphic',
        name,
        bounds: box,
        draw: (ctx) => drawChart(ctx, doc, box, { colors: part.colors, font: part.theme.minorFont }),
      })
    }
    return
  }

  const relIds = descendant(data, 'relIds')
  if (relIds) {
    await convertDiagram(relIds, part, box, name, items)
    return
  }

  // Objeto OLE (planilha, equação...): fica a imagem de prévia que vem junto.
  const pic = descendant(data, 'pic')
  if (pic) {
    convertPicture(pic, part, mapper, items, xfrmEl)
    return
  }
  env.warnings.add('Alguns objetos que não são forma, imagem, tabela, gráfico ou SmartArt ficaram de fora.')
}

/** SmartArt: as formas já posicionadas do "desenho" que o PowerPoint guarda junto. */
async function convertDiagram(relIds: Element, part: Part, box: Box, name: string, items: Item[]): Promise<void> {
  const env = part.env
  const rels = env.pkg.rels(part.path)
  const dataRel = rels.get(relAttr(relIds, 'dm') ?? '')
  const dataDoc = dataRel ? env.pkg.xml(dataRel.target) : null
  const drawingRelId = attr(descendant(dataDoc?.documentElement, 'dataModelExt'), 'relId')
  const drawingRel =
    (drawingRelId ? rels.get(drawingRelId) : undefined) ??
    [...rels.values()].find((r) => r.type.endsWith('/diagramDrawing'))
  const drawing = drawingRel ? env.pkg.xml(drawingRel.target) : null
  const tree = descendant(drawing?.documentElement, 'spTree')
  if (!drawingRel || !drawing || !tree) {
    env.warnings.add('Um SmartArt sem desenho salvo ficou de fora.')
    return
  }
  env.warnings.add('SmartArt virou imagem.')
  const sub: Part = { ...part, path: drawingRel.target, images: await loadPartImages(env, drawingRel.target, drawing.documentElement) }
  const offset: Mapper = (x, y, w, h, rot, flipH, flipV) => ({
    x: box.x + x * env.k,
    y: box.y + y * env.k,
    w: w * env.k,
    h: h * env.k,
    rot,
    flipH,
    flipV,
  })
  const shapes = children(tree, 'sp')
  items.push({
    kind: 'graphic',
    name,
    bounds: box,
    draw: (ctx) => {
      for (const sp of shapes) {
        const inner: Item[] = []
        convertShape(sp, sub, offset, inner)
        for (const item of inner) {
          if (item.kind === 'graphic') item.draw(ctx)
        }
        // O texto do SmartArt vai junto na imagem, na área própria de texto.
        const txBody = child(sp, 'txBody')
        if (!hasText(txBody) || !txBody) continue
        const xfrm = child(sp, 'txXfrm') ?? path(sp, 'spPr', 'xfrm')
        const t = readXfrm(xfrm)
        const placed = offset(t.x, t.y, t.w, t.h, t.rot, false, false)
        const body = readBodyProps([child(txBody, 'bodyPr')], env.k)
        const parsed = parseTextBody(
          txBody,
          textContext(sub, [child(txBody, 'lstStyle')], [env.defaultTextStyle], path(sp, 'style', 'fontRef'), body),
        )
        ctx.save()
        ctx.translate(placed.x + placed.w / 2, placed.y + placed.h / 2)
        if (placed.rot) ctx.rotate((placed.rot * Math.PI) / 180)
        drawRichText(ctx, parsed.paragraphs, parsed.style, {
          x: -placed.w / 2,
          y: -placed.h / 2,
          width: placed.w,
          height: placed.h,
          padding: body.padding,
          verticalAlign: body.verticalAlign,
          lineHeight: parsed.lineHeight,
        })
        ctx.restore()
      }
    },
  })
}

async function convertTree(tree: Element | null, part: Part, mapper: Mapper, items: Item[]): Promise<void> {
  for (const node of children(tree)) {
    for (const el of resolveAlternate(node)) {
      switch (el.localName) {
        case 'sp':
        case 'cxnSp':
          convertShape(el, part, mapper, items)
          break
        case 'pic':
          convertPicture(el, part, mapper, items)
          break
        case 'graphicFrame':
          await convertFrame(el, part, mapper, items)
          break
        case 'grpSp':
          await convertGroup(el, part, mapper, items)
          break
      }
    }
  }
}

/**
 * Grupo com texto: os filhos entram um a um (o texto continua editável).
 * Grupo sem texto (um ícone feito de formas, por exemplo): vira uma imagem só.
 */
async function convertGroup(el: Element, part: Part, mapper: Mapper, items: Item[]): Promise<void> {
  const nested = groupMapper(mapper, path(el, 'grpSpPr', 'xfrm'))
  if (hasText(el)) {
    await convertTree(el, part, nested, items)
    return
  }
  const inner: Item[] = []
  await convertTree(el, part, nested, inner)
  const drawable = inner.filter((i): i is Exclude<Item, { kind: 'text' }> => i.kind !== 'text')
  if (drawable.length === 0) return
  items.push({
    kind: 'graphic',
    name: attr(path(el, 'nvGrpSpPr', 'cNvPr'), 'name') ?? 'Grupo',
    bounds: union(drawable.map((i) => (i.kind === 'graphic' ? i.bounds : rotatedBounds(i.placed)))),
    draw: (ctx) => drawable.forEach((i) => i.draw(ctx)),
  })
}

/* Fundo --------------------------------------------------------------------- */

function backgroundOf(part: Part, roots: { root: Element | null; part: Part }[]): { color: Rgba; item: Item | null } {
  const white = { r: 255, g: 255, b: 255, a: 1 }
  for (const { root, part: owner } of roots) {
    const bg = path(root, 'cSld', 'bg')
    if (!bg) continue
    const bgPr = child(bg, 'bgPr')
    const bgRef = child(bg, 'bgRef')
    let fill: Fill | null | undefined
    if (bgPr) fill = findFill(bgPr, styleContext(owner))
    else if (bgRef) fill = themeFill(owner, bgRef)
    if (fill === undefined) continue
    if (!fill) return { color: white, item: null }
    const color = fillColor(fill) ?? white
    if (fill.kind === 'solid') return { color: fill.color, item: null }
    const { width, height } = part.env.frame
    const solidFill = fill
    return {
      color: { ...color, a: 1 },
      item: {
        kind: 'graphic',
        name: 'Fundo',
        background: true,
        bounds: { x: 0, y: 0, w: width, h: height },
        draw: (ctx) => {
          const rect = new Path2D()
          rect.rect(0, 0, width, height)
          paintFill(ctx, solidFill, rect, width, height)
        },
      },
    }
  }
  return { color: white, item: null }
}

/* Montagem do slide ------------------------------------------------------- */

/** Desenha um conjunto de itens numa imagem que cobre a área deles (cortada à moldura). */
async function rasterize(
  drawables: { bounds: Box; draw: (ctx: CanvasRenderingContext2D) => void }[],
  frame: { width: number; height: number },
  opaque: boolean,
): Promise<{ asset: PresentationAsset; box: Box } | null> {
  const area = union(drawables.map((d) => d.bounds))
  const x1 = Math.max(0, Math.floor(area.x))
  const y1 = Math.max(0, Math.floor(area.y))
  const x2 = Math.min(frame.width, Math.ceil(area.x + area.w))
  const y2 = Math.min(frame.height, Math.ceil(area.y + area.h))
  const box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
  if (box.w < 1 || box.h < 1) return null
  const scale = Math.min(1.5, 2400 / Math.max(box.w, box.h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(box.w * scale))
  canvas.height = Math.max(1, Math.round(box.h * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(scale, scale)
  ctx.translate(-box.x, -box.y)
  for (const d of drawables) d.draw(ctx)
  return { asset: await canvasToAsset(canvas, opaque ? { opaque: true } : {}), box }
}

async function assemble(items: Item[], frame: { width: number; height: number }, assets: Map<string, PresentationAsset>): Promise<FreeElement[]> {
  const elements: FreeElement[] = []
  let run: Extract<Item, { kind: 'graphic' }>[] = []

  const image = (asset: PresentationAsset, box: Box, name: string, extra: Partial<FreeElement> = {}): FreeElement => {
    assets.set(asset.id, asset)
    return {
      id: newId(),
      kind: 'image',
      name,
      assetId: asset.id,
      x: Math.round(box.x * 10) / 10,
      y: Math.round(box.y * 10) / 10,
      width: Math.round(box.w * 10) / 10,
      height: Math.round(box.h * 10) / 10,
      fit: 'fill',
      ...extra,
    } as FreeElement
  }

  const flush = async () => {
    if (run.length === 0) return
    const done = await rasterize(run, frame, false)
    if (done) elements.push(image(done.asset, done.box, run.length === 1 ? run[0].name : `Formas (${run.length})`))
    run = []
  }

  for (const item of items) {
    if (item.kind === 'graphic' && !item.background) {
      run.push(item)
      continue
    }
    await flush()
    if (item.kind === 'graphic') {
      const done = await rasterize([item], frame, true)
      if (done) elements.push(image(done.asset, done.box, item.name))
    } else if (item.kind === 'picture') {
      const asset = await item.build().catch(() => null)
      if (!asset) continue
      const rotation = normalizeAngle(item.placed.rot)
      elements.push(
        image(asset, item.placed, item.name, {
          ...(rotation ? { rotation } : {}),
          ...(item.opacity < 1 ? { opacity: item.opacity } : {}),
        }),
      )
    } else {
      elements.push(item.element)
    }
  }
  await flush()
  return elements
}

/* Entrada ---------------------------------------------------------------- */

function frameFor(cx: number, cy: number): { frame: { width: number; height: number }; aspect: SlideAspect | null } {
  const ratio = cx / cy
  if (Math.abs(ratio - 16 / 9) < 0.03) return { frame: SLIDE_FRAMES['16:9'], aspect: '16:9' }
  if (Math.abs(ratio - 4 / 3) < 0.03) return { frame: SLIDE_FRAMES['4:3'], aspect: '4:3' }
  return { frame: { width: 1920, height: Math.round((1920 * cy) / cx) }, aspect: null }
}

function presentationTitle(pkg: PptxPackage): string {
  const coreRel = pkg.relByType('', '/core-properties')
  const core = pkg.xml(coreRel?.target ?? 'docProps/core.xml')
  return descendant(core?.documentElement, 'title')?.textContent?.trim() ?? ''
}

/** Lê o arquivo e devolve os slides livres e as imagens que eles usam. */
export async function importPptx(file: Blob, onProgress?: (progress: PptxProgress) => void): Promise<PptxImportResult> {
  const pkg = new PptxPackage(new Uint8Array(await file.arrayBuffer()))
  const presRel = pkg.relByType('', '/officeDocument')
  const presPath = presRel?.target ?? 'ppt/presentation.xml'
  const pres = pkg.xml(presPath)?.documentElement
  if (!pres) throw new Error('O arquivo não parece ser uma apresentação do PowerPoint.')

  const size = child(pres, 'sldSz')
  const cx = num(size, 'cx') ?? 12192000
  const cy = num(size, 'cy') ?? 6858000
  const { frame, aspect } = frameFor(cx, cy)
  const tableStylesRel = pkg.relByType(presPath, '/tableStyles')
  const env: Env = {
    pkg,
    k: frame.width / cx,
    frame,
    defaultTextStyle: child(pres, 'defaultTextStyle'),
    tableStyles: tableStylesRel ? pkg.xml(tableStylesRel.target) : null,
    warnings: new Set(),
    images: new Map(),
  }

  const presRels = pkg.rels(presPath)
  const slidePaths = children(child(pres, 'sldIdLst'), 'sldId')
    .map((s) => presRels.get(relAttr(s, 'id') ?? '')?.target)
    .filter((p): p is string => Boolean(p && pkg.has(p)))

  const masters = new Map<string, Master>()
  const layouts = new Map<string, Layout>()
  const assets = new Map<string, PresentationAsset>()
  const slides: FreeSlide[] = []
  let hidden = 0

  for (let i = 0; i < slidePaths.length; i++) {
    const slidePath = slidePaths[i]
    onProgress?.({ done: i, total: slidePaths.length, message: `Convertendo o slide ${i + 1} de ${slidePaths.length}…` })
    // Deixa a tela respirar entre um slide e outro (a barra de progresso anda).
    await new Promise((resolve) => setTimeout(resolve, 0))
    const slideRoot = pkg.xml(slidePath)?.documentElement
    if (!slideRoot) continue
    if (attr(slideRoot, 'show') === '0') {
      hidden++
      continue
    }

    const layoutPath = pkg.relByType(slidePath, '/slideLayout')?.target
    let layout = layoutPath ? layouts.get(layoutPath) : undefined
    if (layoutPath && !layout) {
      const masterPath = pkg.relByType(layoutPath, '/slideMaster')?.target ?? ''
      let master = masters.get(masterPath)
      if (!master) {
        const root = pkg.xml(masterPath)?.documentElement
        if (!root) throw new Error('Slide mestre ausente no arquivo.')
        master = {
          path: masterPath,
          root,
          theme: readTheme(pkg, pkg.relByType(masterPath, '/theme')?.target),
          colorMap: readColorMap(child(root, 'clrMap')),
        }
        masters.set(masterPath, master)
      }
      const root = pkg.xml(layoutPath)?.documentElement
      if (root) {
        layout = { path: layoutPath, root, master }
        layouts.set(layoutPath, layout)
      }
    }
    if (!layout) continue
    const master = layout.master

    // Mapa de cores: o do mestre, com as substituições do layout e do slide.
    const override = (root: Element) => child(child(root, 'clrMapOvr'), 'overrideClrMapping')
    const colorMap = { ...master.colorMap, ...readColorMap(override(layout.root)), ...readColorMap(override(slideRoot)) }
    const colors: ColorContext = { scheme: master.theme.scheme, map: colorMap }

    const makePart = async (path: string, root: Element, kind: Part['kind']): Promise<Part> => ({
      env,
      path,
      kind,
      colors,
      theme: master.theme,
      master,
      layout,
      images: await loadPartImages(env, path, root),
      slideNumber: i + 1,
      background: null,
    })
    const slidePart = await makePart(slidePath, slideRoot, 'slide')
    const layoutPart = await makePart(layout.path, layout.root, 'layout')
    const masterPart = await makePart(master.path, master.root, 'master')

    const background = backgroundOf(slidePart, [
      { root: slideRoot, part: slidePart },
      { root: layout.root, part: layoutPart },
      { root: master.root, part: masterPart },
    ])
    for (const p of [slidePart, layoutPart, masterPart]) p.background = background.color

    const items: Item[] = []
    if (background.item) items.push(background.item)
    const mapper = rootMapper(env.k)
    const showMaster = attr(slideRoot, 'showMasterSp') !== '0'
    if (showMaster && attr(layout.root, 'showMasterSp') !== '0') {
      await convertTree(path(master.root, 'cSld', 'spTree'), masterPart, mapper, items)
    }
    if (showMaster) await convertTree(path(layout.root, 'cSld', 'spTree'), layoutPart, mapper, items)
    await convertTree(path(slideRoot, 'cSld', 'spTree'), slidePart, mapper, items)

    const titleItem = items.find((it): it is Extract<Item, { kind: 'text' }> => it.kind === 'text' && it.title)
    const titleText = titleItem
      ? titleItem.element.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join(' ').replace(/\s+/g, ' ').trim()
      : ''

    slides.push({
      id: newId(),
      type: 'free',
      title: titleText ? titleText.slice(0, 80) : `Slide ${i + 1}`,
      width: frame.width,
      height: frame.height,
      background: toHex({ ...background.color, a: 1 }),
      elements: await assemble(items, frame, assets),
    })
  }

  onProgress?.({ done: slidePaths.length, total: slidePaths.length, message: 'Concluído.' })
  if (hidden > 0) env.warnings.add(`${hidden} slide(s) oculto(s) no PowerPoint ficaram de fora.`)
  return {
    title: presentationTitle(pkg),
    slides,
    assets: [...assets.values()],
    aspect,
    warnings: [...env.warnings],
  }
}
