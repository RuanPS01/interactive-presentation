import type {
  FreeBullet,
  FreeNumbering,
  FreeTextAlign,
  FreeTextParagraph,
  FreeTextRun,
  FreeTextStyle,
  FreeVerticalAlign,
} from '../../types/presentation'
import { cleanStyle } from '../richText'
import { fromHex, resolveColor, toHex } from './colors'
import type { ColorContext, Rgba } from './colors'
import { attr, child, children, num } from './xml'

/**
 * Texto do PowerPoint para o modelo do slide livre.
 *
 * Quase nada vem escrito no próprio trecho: tamanho, fonte e cor costumam ser
 * herdados, nesta ordem, do parágrafo, da lista de estilos da forma, do
 * placeholder do layout, do placeholder do mestre, dos estilos de texto do
 * mestre e, por fim, do estilo padrão da apresentação. `lstStyles` traz essas
 * fontes da mais específica para a mais geral.
 */

export interface TextContext {
  colors: ColorContext
  /** px da moldura por EMU. */
  k: number
  majorFont: string
  minorFont: string
  /**
   * Listas de estilos da própria forma e dos placeholders de que ela herda
   * (`a:lstStyle`, `p:titleStyle`...), da mais específica à mais geral.
   */
  lstStyles: (Element | null)[]
  /**
   * Padrões gerais (`p:otherStyle`, `p:defaultTextStyle`): perdem para a cor
   * e a fonte do estilo da forma (`fontRef`), como no PowerPoint, em que o
   * texto de um retângulo azul sai branco mesmo com o padrão preto.
   */
  globalStyles?: (Element | null)[]
  /** Fonte e cor do estilo da forma (`p:style/a:fontRef`) ou da tabela. */
  fontRef?: { font?: string; color?: Rgba }
  /** Ajuste automático: escala da fonte e redução do espaçamento (0 a 1). */
  fontScale?: number
  lineReduction?: number
  slideNumber: number
}

export interface BodyProps {
  /** Espaço interno em px: cima, direita, baixo, esquerda. */
  padding: [number, number, number, number]
  verticalAlign: FreeVerticalAlign
  wrap: boolean
  fontScale: number
  lineReduction: number
  vertical: boolean
}

/** Propriedades do corpo do texto (`a:bodyPr`), herdando de placeholders. */
export function readBodyProps(chain: (Element | null)[], k: number): BodyProps {
  const pick = (name: string) => {
    for (const el of chain) {
      const value = attr(el, name)
      if (value !== null) return value
    }
    return null
  }
  const emu = (name: string, fallback: number) => Number(pick(name) ?? fallback) * k
  const anchor = pick('anchor')
  let fontScale = 1
  let lineReduction = 0
  for (const el of chain) {
    const autofit = child(el, 'normAutofit')
    if (autofit) {
      fontScale = (num(autofit, 'fontScale') ?? 100000) / 100000
      lineReduction = (num(autofit, 'lnSpcReduction') ?? 0) / 100000
      break
    }
    if (child(el, 'noAutofit') || child(el, 'spAutoFit')) break
  }
  const vert = pick('vert')
  return {
    padding: [emu('tIns', 45720), emu('rIns', 91440), emu('bIns', 45720), emu('lIns', 91440)],
    verticalAlign: anchor === 'ctr' ? 'middle' : anchor === 'b' ? 'bottom' : 'top',
    wrap: pick('wrap') !== 'none',
    fontScale,
    lineReduction,
    vertical: vert !== null && vert !== 'horz',
  }
}

const ALIGN: Record<string, FreeTextAlign> = {
  l: 'left',
  ctr: 'center',
  r: 'right',
  just: 'justify',
  dist: 'justify',
  justLow: 'justify',
}

/** Caracteres de marcador em fontes de símbolos (Wingdings, Symbol) no equivalente Unicode. */
const SYMBOL_BULLETS: Record<string, string> = {
  l: '●',
  n: '■',
  q: '❑',
  u: '◆',
  v: '❖',
  Ø: '➢',
  ü: '✓',
  '§': '▪',
  à: '➔',
  è: '➔',
  o: '○',
  w: '◆',
  '·': '•',
  '': '•',
}

const NUMBERING: Record<string, { format: FreeNumbering; suffix: '.' | ')' }> = {
  arabicPeriod: { format: 'arabic', suffix: '.' },
  arabicParenR: { format: 'arabic', suffix: ')' },
  arabicParenBoth: { format: 'arabic', suffix: ')' },
  arabicPlain: { format: 'arabic', suffix: '.' },
  alphaLcPeriod: { format: 'alphaLower', suffix: '.' },
  alphaLcParenR: { format: 'alphaLower', suffix: ')' },
  alphaLcParenBoth: { format: 'alphaLower', suffix: ')' },
  alphaUcPeriod: { format: 'alphaUpper', suffix: '.' },
  alphaUcParenR: { format: 'alphaUpper', suffix: ')' },
  alphaUcParenBoth: { format: 'alphaUpper', suffix: ')' },
  romanLcPeriod: { format: 'romanLower', suffix: '.' },
  romanLcParenR: { format: 'romanLower', suffix: ')' },
  romanUcPeriod: { format: 'romanUpper', suffix: '.' },
  romanUcParenR: { format: 'romanUpper', suffix: ')' },
}

function resolveFont(typeface: string | null, ctx: TextContext): string | undefined {
  if (!typeface) return undefined
  if (typeface.startsWith('+mj')) return ctx.majorFont
  if (typeface.startsWith('+mn')) return ctx.minorFont
  return typeface
}

interface LevelEntry {
  el: Element
  /** Vem dos padrões gerais (perde para o `fontRef` em cor e fonte). */
  global: boolean
}

/** Propriedades de parágrafo da mais específica para a mais geral, num nível. */
function levelChain(pPr: Element | null, level: number, ctx: TextContext): LevelEntry[] {
  const chain: LevelEntry[] = []
  if (pPr) chain.push({ el: pPr, global: false })
  const lists = [
    ...ctx.lstStyles.map((el) => ({ el, global: false })),
    ...(ctx.globalStyles ?? []).map((el) => ({ el, global: true })),
  ]
  for (const list of lists) {
    const lvl = child(list.el, `lvl${level + 1}pPr`)
    if (lvl) chain.push({ el: lvl, global: list.global })
  }
  for (const list of lists) {
    const def = child(list.el, 'defPPr')
    if (def) chain.push({ el: def, global: list.global })
  }
  return chain
}

/** Estilo de um trecho: o `rPr` dele e depois os `defRPr` herdados. */
function runStyle(rPr: Element | null, defaultsChain: LevelEntry[], ctx: TextContext): FreeTextStyle {
  const defaults = defaultsChain.map((d) => d.el)
  const sources = [rPr, ...defaults].filter((el): el is Element => el !== null)
  // Cor e fonte: o trecho e os estilos próprios, depois o `fontRef`, depois os gerais.
  const ownSources = [rPr, ...defaultsChain.filter((d) => !d.global).map((d) => d.el)].filter(
    (el): el is Element => el !== null,
  )
  const globalSources = defaultsChain.filter((d) => d.global).map((d) => d.el)
  const childIn = (list: Element[], name: string) => {
    for (const el of list) {
      const found = child(el, name)
      if (found) return found
    }
    return null
  }
  const first = (name: string) => {
    for (const el of sources) {
      const value = attr(el, name)
      if (value !== null) return value
    }
    return null
  }
  const firstChild = (name: string) => {
    for (const el of sources) {
      const found = child(el, name)
      if (found) return found
    }
    return null
  }

  const size = Number(first('sz') ?? 1800) / 100
  const style: FreeTextStyle = {
    // pt para px da moldura (1 pt = 12700 EMU), com o ajuste automático.
    fontSize: Math.round(size * 12700 * ctx.k * (ctx.fontScale ?? 1) * 10) / 10,
    fontFamily:
      resolveFont(attr(childIn(ownSources, 'latin'), 'typeface'), ctx) ??
      ctx.fontRef?.font ??
      resolveFont(attr(childIn(globalSources, 'latin'), 'typeface'), ctx) ??
      ctx.minorFont,
  }
  const b = first('b')
  if (b !== null) style.bold = b === '1' || b === 'true'
  const i = first('i')
  if (i !== null) style.italic = i === '1' || i === 'true'
  const u = first('u')
  if (u !== null && u !== 'none') style.underline = true
  const strike = first('strike')
  if (strike !== null && strike !== 'noStrike') style.strike = true

  const fillColorOf = (list: Element[]): Rgba | null => {
    for (const el of list) {
      const fill = child(el, 'solidFill') ?? child(el, 'gradFill')
      if (fill?.localName === 'solidFill') return resolveColor(fill, ctx.colors)
      if (fill?.localName === 'gradFill') return resolveColor(child(child(fill, 'gsLst'), 'gs'), ctx.colors)
    }
    return null
  }
  let color: Rgba | null = fillColorOf(ownSources)
  // Hiperlink sem cor própria aparece na cor de link do tema, sublinhado.
  if (!color && rPr && child(rPr, 'hlinkClick')) {
    const hlink = ctx.colors.scheme.hlink
    if (hlink) color = fromHex(hlink)
    style.underline = true
  }
  color = color ?? ctx.fontRef?.color ?? fillColorOf(globalSources) ?? resolveTextColor(ctx)
  if (color) style.color = toHex(color)
  const highlight = resolveColor(firstChild('highlight'), ctx.colors)
  if (highlight) style.highlight = toHex(highlight)
  return style
}

/** Cor padrão do texto: `tx1` do mapa de cores. */
function resolveTextColor(ctx: TextContext): Rgba | null {
  const hex = ctx.colors.scheme[ctx.colors.map.tx1 ?? 'dk1']
  return hex ? fromHex(hex) : null
}

function isUpper(rPr: Element | null, defaults: LevelEntry[]): boolean {
  for (const el of [rPr, ...defaults.map((d) => d.el)]) {
    const cap = attr(el, 'cap')
    if (cap !== null) return cap === 'all'
  }
  return false
}

/** Diferença entre dois estilos: o que `full` tem de diferente de `base`. */
export function styleDiff(full: FreeTextStyle, base: FreeTextStyle): FreeTextStyle | undefined {
  const out: FreeTextStyle = {}
  for (const [key, value] of Object.entries(full) as [keyof FreeTextStyle, unknown][]) {
    const fallback = key === 'bold' || key === 'italic' || key === 'underline' || key === 'strike' ? false : undefined
    if (value !== (base[key] ?? fallback)) (out as Record<string, unknown>)[key] = value
  }
  return cleanStyle(out)
}

function spacing(el: Element | null, fontSize: number, k: number): number | undefined {
  if (!el) return undefined
  const pts = child(el, 'spcPts')
  if (pts) return ((num(pts, 'val') ?? 0) / 100) * 12700 * k
  const pct = child(el, 'spcPct')
  if (pct) return ((num(pct, 'val') ?? 0) / 100000) * fontSize
  return undefined
}

export interface ParsedText {
  paragraphs: FreeTextParagraph[]
  /** Estilo base da caixa (o do primeiro parágrafo). */
  style: FreeTextStyle
  /** Altura de linha da caixa, em múltiplos da fonte. */
  lineHeight: number
  plainText: string
}

/** Lê os parágrafos de um `txBody` com toda a cadeia de herança. */
export function parseTextBody(txBody: Element, ctx: TextContext): ParsedText {
  type Raw = Omit<FreeTextParagraph, 'style' | 'runs'> & { pStyle: FreeTextStyle; runs: FreeTextRun[] }
  const raws: Raw[] = []

  for (const p of children(txBody, 'p')) {
    const pPr = child(p, 'pPr')
    const level = Math.max(0, Math.min(8, num(pPr, 'lvl') ?? 0))
    const entries = levelChain(pPr, level, ctx)
    const chain = entries.map((e) => e.el)
    const defaults: LevelEntry[] = []
    for (const entry of entries) {
      const def = child(entry.el, 'defRPr')
      if (def) defaults.push({ el: def, global: entry.global })
    }
    const pAttr = (name: string) => {
      for (const el of chain) {
        const value = attr(el, name)
        if (value !== null) return value
      }
      return null
    }
    const pChild = (name: string) => {
      for (const el of chain) {
        const found = child(el, name)
        if (found) return found
      }
      return null
    }

    // Estilo do parágrafo: o que os trechos herdam (e o tamanho da linha vazia).
    const endPr = child(p, 'endParaRPr')
    const pStyle = runStyle(null, defaults, ctx)
    const runs: FreeTextRun[] = []
    for (const node of children(p)) {
      if (node.localName === 'r' || node.localName === 'fld') {
        const rPr = child(node, 'rPr')
        let text = child(node, 't')?.textContent ?? ''
        if (node.localName === 'fld' && attr(node, 'type') === 'slidenum') text = String(ctx.slideNumber)
        if (isUpper(rPr, defaults)) text = text.toLocaleUpperCase('pt-BR')
        runs.push({ text, style: runStyle(rPr, defaults, ctx) })
      } else if (node.localName === 'br') {
        runs.push({ text: '\n', style: runStyle(child(node, 'rPr'), defaults, ctx) })
      }
    }
    if (runs.length === 0) runs.push({ text: '', style: runStyle(endPr, defaults, ctx) })

    const fontSize = runs[0].style?.fontSize ?? pStyle.fontSize ?? 24
    const raw: Raw = { pStyle, runs }
    const align = ALIGN[pAttr('algn') ?? '']
    if (align) raw.align = align
    const marL = Number(pAttr('marL') ?? 0) * ctx.k
    const indent = Number(pAttr('indent') ?? 0) * ctx.k
    if (marL > 0) raw.indent = Math.round(marL * 10) / 10
    if (indent < 0) raw.hanging = Math.round(-indent * 10) / 10
    const before = spacing(pChild('spcBef'), fontSize, ctx.k)
    const after = spacing(pChild('spcAft'), fontSize, ctx.k)
    if (before) raw.spaceBefore = Math.round(before * 10) / 10
    if (after) raw.spaceAfter = Math.round(after * 10) / 10
    const lnSpc = pChild('lnSpc')
    if (lnSpc) {
      const pct = child(lnSpc, 'spcPct')
      const pts = child(lnSpc, 'spcPts')
      // No PowerPoint, espaçamento "simples" (100%) é cerca de 1,2 vez a fonte.
      if (pct) raw.lineHeight = Math.max(0.6, ((num(pct, 'val') ?? 100000) / 100000 - (ctx.lineReduction ?? 0)) * 1.2)
      else if (pts) raw.lineHeight = Math.max(0.6, (((num(pts, 'val') ?? 0) / 100) * 12700 * ctx.k) / fontSize)
    }

    // Marcador: vale o primeiro nível da cadeia que diz alguma coisa sobre ele.
    for (const el of chain) {
      if (child(el, 'buNone')) break
      const buChar = child(el, 'buChar')
      const buNum = child(el, 'buAutoNum')
      if (!buChar && !buNum && !child(el, 'buBlip')) continue
      const buColor = resolveColor(pChild('buClr'), ctx.colors)
      if (buChar) {
        const raw0 = attr(buChar, 'char') ?? '•'
        const font = attr(pChild('buFont'), 'typeface') ?? ''
        const symbolFont = /wingdings|symbol|webdings/i.test(font)
        const char = symbolFont ? (SYMBOL_BULLETS[raw0] ?? '•') : raw0
        const bullet: FreeBullet = { kind: 'char', char }
        if (buColor) bullet.color = toHex(buColor).slice(0, 7)
        raw.bullet = bullet
      } else if (buNum) {
        const scheme = NUMBERING[attr(buNum, 'type') ?? ''] ?? NUMBERING.arabicPeriod
        const startAt = num(buNum, 'startAt')
        raw.bullet = { kind: 'number', ...scheme, ...(startAt ? { startAt } : {}) }
      } else {
        raw.bullet = { kind: 'char', char: '•' }
      }
      break
    }
    raws.push(raw)
  }

  if (raws.length === 0) raws.push({ pStyle: runStyle(null, [], ctx), runs: [{ text: '' }] })

  // Estilo base da caixa = o do primeiro parágrafo; o resto guarda só a diferença.
  const base = { ...raws[0].pStyle }
  const paragraphs: FreeTextParagraph[] = raws.map(({ pStyle, runs, ...props }) => {
    const pDiff = styleDiff(pStyle, base)
    const effective = { ...base, ...(pDiff ?? {}) }
    const paragraph: FreeTextParagraph = {
      ...props,
      runs: runs.map((run) => {
        const diff = run.style ? styleDiff(run.style, effective) : undefined
        return diff ? { text: run.text, style: diff } : { text: run.text }
      }),
    }
    if (pDiff) paragraph.style = pDiff
    return paragraph
  })
  const plainText = paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
  return {
    paragraphs,
    style: base,
    lineHeight: Math.max(0.6, 1.2 * (1 - (ctx.lineReduction ?? 0))),
    plainText,
  }
}
