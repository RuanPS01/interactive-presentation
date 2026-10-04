import presetShapeDefinitions from 'modern-openxml/presetShapeDefinitions'
import { attr, child, children, num, parseXml } from './xml'

/**
 * Geometria das formas do OOXML.
 *
 * As ~190 formas pré-definidas do PowerPoint (retângulo, seta, estrela...)
 * são descritas na especificação por guias com fórmulas e caminhos. A tabela
 * oficial (`presetShapeDefinitions.xml`) vem do pacote `modern-openxml`
 * (licença MIT); aqui fica o avaliador das fórmulas, o mesmo usado para as
 * formas livres (`custGeom`), que trazem as próprias guias e caminhos.
 */

export type PathOp =
  | { op: 'M'; x: number; y: number }
  | { op: 'L'; x: number; y: number }
  | { op: 'Q'; x1: number; y1: number; x: number; y: number }
  | { op: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { op: 'Z' }

export type PathFillMode = 'norm' | 'none' | 'darken' | 'darkenLess' | 'lighten' | 'lightenLess'

export interface ShapePath {
  ops: PathOp[]
  fill: PathFillMode
  stroke: boolean
}

export interface Geometry {
  paths: ShapePath[]
  /** Área do texto dentro da forma (px, relativa ao canto da forma). */
  textRect: { l: number; t: number; r: number; b: number }
}

let presets: Map<string, Element> | null = null

function presetDefinition(name: string): Element | null {
  if (!presets) {
    const doc = parseXml(presetShapeDefinitions)
    presets = new Map(children(doc.documentElement).map((el) => [el.localName, el]))
  }
  return presets.get(name) ?? null
}

function builtins(w: number, h: number): Map<string, number> {
  const ss = Math.min(w, h)
  const ls = Math.max(w, h)
  const entries: [string, number][] = [
    ['l', 0], ['t', 0], ['r', w], ['b', h], ['w', w], ['h', h],
    ['hc', w / 2], ['vc', h / 2], ['ss', ss], ['ls', ls],
    ['cd2', 10800000], ['cd4', 5400000], ['cd8', 2700000],
    ['3cd4', 16200000], ['3cd8', 8100000], ['5cd8', 13500000], ['7cd8', 18900000],
  ]
  for (const d of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    entries.push([`wd${d}`, w / d], [`hd${d}`, h / d], [`ssd${d}`, ss / d])
  }
  return new Map(entries)
}

const ANGLE = 60000
const rad = (angle: number) => ((angle / ANGLE) * Math.PI) / 180

function evaluate(fmla: string, vars: Map<string, number>): number {
  const [op, ...args] = fmla.trim().split(/\s+/)
  const v = args.map((a) => {
    const known = vars.get(a)
    if (known !== undefined) return known
    const n = Number(a)
    return Number.isFinite(n) ? n : 0
  })
  const [x = 0, y = 0, z = 0] = v
  switch (op) {
    case 'val':
      return x
    case '*/':
      return z === 0 ? 0 : (x * y) / z
    case '+-':
      return x + y - z
    case '+/':
      return z === 0 ? 0 : (x + y) / z
    case '?:':
      return x > 0 ? y : z
    case 'abs':
      return Math.abs(x)
    case 'sqrt':
      return Math.sqrt(Math.max(0, x))
    case 'max':
      return Math.max(x, y)
    case 'min':
      return Math.min(x, y)
    case 'mod':
      return Math.sqrt(x * x + y * y + z * z)
    case 'pin':
      return y < x ? x : y > z ? z : y
    case 'at2':
      return (Math.atan2(y, x) * 180 * ANGLE) / Math.PI
    case 'cat2':
      return x * Math.cos(Math.atan2(z, y))
    case 'sat2':
      return x * Math.sin(Math.atan2(z, y))
    case 'cos':
      return x * Math.cos(rad(y))
    case 'sin':
      return x * Math.sin(rad(y))
    case 'tan':
      return x * Math.tan(rad(y))
    default:
      return 0
  }
}

function value(token: string | null, vars: Map<string, number>): number {
  if (token === null) return 0
  const known = vars.get(token)
  if (known !== undefined) return known
  const n = Number(token)
  return Number.isFinite(n) ? n : 0
}

/** Ponto da elipse no ângulo visual dado (o OOXML mede ângulos assim, não pelo parâmetro). */
function ellipsePoint(wR: number, hR: number, degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180
  const t = Math.atan2(wR * Math.sin(a), hR * Math.cos(a))
  return [wR * Math.cos(t), hR * Math.sin(t)]
}

function buildPath(pathEl: Element, vars: Map<string, number>, w: number, h: number): ShapePath {
  const pw = num(pathEl, 'w')
  const ph = num(pathEl, 'h')
  const sx = pw ? w / pw : 1
  const sy = ph ? h / ph : 1
  const fill = (attr(pathEl, 'fill') ?? 'norm') as PathFillMode
  const strokeAttr = attr(pathEl, 'stroke')
  const ops: PathOp[] = []
  let cx = 0
  let cy = 0
  const pt = (el: Element | null): [number, number] => [value(attr(el, 'x'), vars) * sx, value(attr(el, 'y'), vars) * sy]

  for (const cmd of children(pathEl)) {
    switch (cmd.localName) {
      case 'moveTo': {
        ;[cx, cy] = pt(child(cmd, 'pt'))
        ops.push({ op: 'M', x: cx, y: cy })
        break
      }
      case 'lnTo': {
        ;[cx, cy] = pt(child(cmd, 'pt'))
        ops.push({ op: 'L', x: cx, y: cy })
        break
      }
      case 'quadBezTo': {
        const [p1, p2] = children(cmd, 'pt').map(pt)
        if (!p1 || !p2) break
        ops.push({ op: 'Q', x1: p1[0], y1: p1[1], x: p2[0], y: p2[1] })
        ;[cx, cy] = p2
        break
      }
      case 'cubicBezTo': {
        const [p1, p2, p3] = children(cmd, 'pt').map(pt)
        if (!p1 || !p2 || !p3) break
        ops.push({ op: 'C', x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], x: p3[0], y: p3[1] })
        ;[cx, cy] = p3
        break
      }
      case 'arcTo': {
        const wR = value(attr(cmd, 'wR'), vars) * sx
        const hR = value(attr(cmd, 'hR'), vars) * sy
        const st = value(attr(cmd, 'stAng'), vars) / ANGLE
        const sw = value(attr(cmd, 'swAng'), vars) / ANGLE
        if (wR <= 0 || hR <= 0 || sw === 0) break
        const [ox, oy] = ellipsePoint(wR, hR, st)
        const centerX = cx - ox
        const centerY = cy - oy
        // Arco em segmentos curtos: na resolução desenhada, não se nota.
        const steps = Math.max(2, Math.ceil(Math.abs(sw) / 3))
        for (let i = 1; i <= steps; i++) {
          const [px, py] = ellipsePoint(wR, hR, st + (sw * i) / steps)
          cx = centerX + px
          cy = centerY + py
          ops.push({ op: 'L', x: cx, y: cy })
        }
        break
      }
      case 'close':
        ops.push({ op: 'Z' })
        break
    }
  }
  return { ops, fill, stroke: strokeAttr !== 'false' && strokeAttr !== '0' }
}

const RECT_GEOMETRY = (w: number, h: number): Geometry => ({
  paths: [
    {
      ops: [
        { op: 'M', x: 0, y: 0 },
        { op: 'L', x: w, y: 0 },
        { op: 'L', x: w, y: h },
        { op: 'L', x: 0, y: h },
        { op: 'Z' },
      ],
      fill: 'norm',
      stroke: true,
    },
  ],
  textRect: { l: 0, t: 0, r: w, b: h },
})

/**
 * Caminhos de uma forma (`a:prstGeom` ou `a:custGeom`) no tamanho dado, em px.
 * Sem geometria (ou com uma desconhecida), um retângulo.
 */
export function buildGeometry(geom: Element | null, w: number, h: number): Geometry {
  if (!geom || w <= 0 || h <= 0) return RECT_GEOMETRY(Math.max(w, 0), Math.max(h, 0))
  let def: Element | null = null
  let overrides: Element | null = null
  if (geom.localName === 'prstGeom') {
    def = presetDefinition(attr(geom, 'prst') ?? 'rect')
    overrides = child(geom, 'avLst')
  } else if (geom.localName === 'custGeom') {
    def = geom
  }
  if (!def) return RECT_GEOMETRY(w, h)

  const vars = builtins(w, h)
  const guides = (list: Element | null) => {
    for (const gd of children(list, 'gd')) {
      const name = attr(gd, 'name')
      const fmla = attr(gd, 'fmla')
      if (name && fmla) vars.set(name, evaluate(fmla, vars))
    }
  }
  guides(child(def, 'avLst'))
  guides(overrides)
  guides(child(def, 'gdLst'))

  const rect = child(def, 'rect')
  const paths = children(child(def, 'pathLst'), 'path').map((p) => buildPath(p, vars, w, h))
  if (paths.length === 0) return RECT_GEOMETRY(w, h)
  return {
    paths,
    textRect: rect
      ? {
          l: value(attr(rect, 'l'), vars),
          t: value(attr(rect, 't'), vars),
          r: value(attr(rect, 'r'), vars),
          b: value(attr(rect, 'b'), vars),
        }
      : { l: 0, t: 0, r: w, b: h },
  }
}

/** `Path2D` de um caminho, para preencher e contornar no canvas. */
export function toPath2D(path: ShapePath): Path2D {
  const p = new Path2D()
  for (const op of path.ops) {
    switch (op.op) {
      case 'M':
        p.moveTo(op.x, op.y)
        break
      case 'L':
        p.lineTo(op.x, op.y)
        break
      case 'Q':
        p.quadraticCurveTo(op.x1, op.y1, op.x, op.y)
        break
      case 'C':
        p.bezierCurveTo(op.x1, op.y1, op.x2, op.y2, op.x, op.y)
        break
      case 'Z':
        p.closePath()
        break
    }
  }
  return p
}
