import type { FreeTextParagraph, FreeTextRun, FreeTextStyle } from '../types/presentation'
import { fontStack } from './freeSlide'
import { cleanStyle, normalizeParagraph, paragraphMarkers, resolveStyle } from './richText'

/**
 * Texto rico do slide livre no DOM.
 *
 * O mesmo HTML serve para exibir e para editar (com `contentEditable`). Cada
 * parágrafo é um `<p>` e cada trecho um `<span>`; os dados originais vão em
 * atributos `data-p` e `data-s` (JSON), porque o navegador copia os atributos
 * quando divide um parágrafo no Enter ou um trecho ao digitar. Assim a leitura
 * de volta (`htmlToParagraphs`) recupera o modelo sem depender do CSS.
 */

const COLOR = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function px(n: number): string {
  return `${Math.round(n * 100) / 100}px`
}

/** CSS herdável de um estilo (sem decorações, que não se desfazem num filho). */
export function inheritableCss(style: FreeTextStyle | undefined): string {
  if (!style) return ''
  const parts: string[] = []
  if (style.fontFamily) parts.push(`font-family:${fontStack(style.fontFamily)}`)
  if (style.fontSize !== undefined) parts.push(`font-size:${px(style.fontSize)}`)
  if (style.color && COLOR.test(style.color)) parts.push(`color:${style.color}`)
  if (style.bold !== undefined) parts.push(`font-weight:${style.bold ? 700 : 400}`)
  if (style.italic !== undefined) parts.push(`font-style:${style.italic ? 'italic' : 'normal'}`)
  return parts.join(';')
}

/** Sublinhado, tachado e realce, calculados sobre o estilo já resolvido. */
function decorationCss(resolved: FreeTextStyle): string {
  const lines = [resolved.underline && 'underline', resolved.strike && 'line-through'].filter(Boolean)
  const parts: string[] = []
  if (lines.length > 0) parts.push(`text-decoration-line:${lines.join(' ')}`)
  if (resolved.highlight && COLOR.test(resolved.highlight)) {
    parts.push(`background-color:${resolved.highlight}`)
  }
  return parts.join(';')
}

/** Propriedades do parágrafo guardadas em `data-p`. */
type ParagraphProps = Omit<FreeTextParagraph, 'runs'>

function paragraphProps(paragraph: FreeTextParagraph): ParagraphProps {
  const props: Partial<FreeTextParagraph> = { ...paragraph }
  delete props.runs
  return props
}

function paragraphCss(paragraph: FreeTextParagraph): string {
  const parts: string[] = []
  if (paragraph.align) parts.push(`text-align:${paragraph.align}`)
  if (paragraph.indent) parts.push(`padding-left:${px(paragraph.indent)}`)
  if (paragraph.bullet) {
    // Sem medida própria, o marcador ocupa um pouco mais que a largura de um caractere.
    parts.push(`--ft-hang:${paragraph.hanging ? px(paragraph.hanging) : '1.1em'}`)
    if (paragraph.bullet.kind === 'char' && paragraph.bullet.color && COLOR.test(paragraph.bullet.color)) {
      parts.push(`--ft-marker-color:${paragraph.bullet.color}`)
    }
  }
  if (paragraph.spaceBefore) parts.push(`margin-top:${px(paragraph.spaceBefore)}`)
  if (paragraph.spaceAfter) parts.push(`margin-bottom:${px(paragraph.spaceAfter)}`)
  if (paragraph.lineHeight) parts.push(`line-height:${paragraph.lineHeight}`)
  const inherited = inheritableCss(paragraph.style)
  if (inherited) parts.push(inherited)
  return parts.join(';')
}

function runHtml(run: FreeTextRun, resolved: FreeTextStyle): string {
  const style = cleanStyle(run.style)
  const css = [inheritableCss(style), decorationCss(resolved)].filter(Boolean).join(';')
  const data = style ? ` data-s="${escapeAttr(JSON.stringify(style))}"` : ''
  const styleAttr = css ? ` style="${escapeAttr(css)}"` : ''
  return `<span${data}${styleAttr}>${escapeHtml(run.text)}</span>`
}

/** HTML dos parágrafos, para exibir (`innerHTML`) ou começar a edição. */
export function paragraphsToHtml(paragraphs: FreeTextParagraph[], base: FreeTextStyle): string {
  const markers = paragraphMarkers(paragraphs)
  return paragraphs
    .map((paragraph, i) => {
      const text = paragraph.runs.map((r) => r.text).join('')
      const inner =
        text === ''
          ? '<br>'
          : paragraph.runs
              .filter((run) => run.text !== '')
              .map((run) => runHtml(run, resolveStyle(base, paragraph.style, run.style)))
              .join('') +
            // Uma quebra no fim do parágrafo só aparece com uma linha a mais.
            (text.endsWith('\n') ? '<br>' : '')
      const marker = markers[i] !== null ? ` data-marker="${escapeAttr(markers[i] as string)}"` : ''
      const css = paragraphCss(paragraph)
      return (
        `<p data-p="${escapeAttr(JSON.stringify(paragraphProps(paragraph)))}"${marker}` +
        `${css ? ` style="${escapeAttr(css)}"` : ''}>${inner}</p>`
      )
    })
    .join('')
}

/* Leitura do DOM -------------------------------------------------------- */

const BLOCK = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE'])

interface Leaf {
  node: Node
  /** Posição no texto corrido. */
  start: number
  length: number
}

interface Unit {
  /** O `<p>` do parágrafo, ou `null` quando é texto solto direto na raiz. */
  el: Element | null
  nodes: Node[]
  start: number
  length: number
  leaves: Leaf[]
  /** `<br>` final que só segura a altura de uma linha vazia. */
  placeholder: Node | null
}

function isBlock(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && BLOCK.has((node as Element).tagName)
}

/** Divide a raiz em parágrafos: cada bloco é um; nós soltos vizinhos formam outro. */
function collectUnits(root: Element): Unit[] {
  const groups: { el: Element | null; nodes: Node[] }[] = []
  let loose: Node[] = []
  const flush = () => {
    if (loose.length > 0) groups.push({ el: null, nodes: loose })
    loose = []
  }
  root.childNodes.forEach((node) => {
    if (isBlock(node)) {
      flush()
      groups.push({ el: node as Element, nodes: [node] })
    } else {
      loose.push(node)
    }
  })
  flush()

  const units: Unit[] = []
  let pos = 0
  for (const group of groups) {
    const raw: Node[] = []
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.textContent ?? '').length > 0) raw.push(node)
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if ((node as Element).tagName === 'BR') raw.push(node)
        else node.childNodes.forEach(walk)
      }
    }
    group.nodes.forEach(walk)
    const last = raw[raw.length - 1]
    const placeholder = last && last.nodeType === Node.ELEMENT_NODE ? last : null
    const leaves: Leaf[] = []
    let local = 0
    for (const node of raw) {
      if (node === placeholder) continue
      const length = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').length : 1
      leaves.push({ node, start: pos + local, length })
      local += length
    }
    units.push({ ...group, start: pos, length: local, leaves, placeholder })
    pos += local + 1
  }
  if (units.length === 0) {
    units.push({ el: null, nodes: [], start: 0, length: 0, leaves: [], placeholder: null })
  }
  return units
}

function styleFromCss(el: HTMLElement): FreeTextStyle {
  const style: FreeTextStyle = {}
  const tag = el.tagName
  if (tag === 'B' || tag === 'STRONG') style.bold = true
  if (tag === 'I' || tag === 'EM') style.italic = true
  if (tag === 'U') style.underline = true
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') style.strike = true
  const css = el.style
  if (css.fontWeight) style.bold = css.fontWeight === 'bold' || Number(css.fontWeight) >= 600
  if (css.fontStyle) style.italic = css.fontStyle === 'italic'
  if (css.fontSize.endsWith('px')) style.fontSize = parseFloat(css.fontSize)
  const color = cssColorToHex(css.color)
  if (color) style.color = color
  const deco = css.textDecorationLine || css.textDecoration
  if (deco.includes('underline')) style.underline = true
  if (deco.includes('line-through')) style.strike = true
  return style
}

/** `rgb(1, 2, 3)` ou `#abc` em `#rrggbb`. */
export function cssColorToHex(value: string): string | undefined {
  if (!value) return undefined
  if (COLOR.test(value)) return value.toLowerCase()
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (!m) return undefined
  return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')
}

function leafStyle(node: Node, stop: Node | null, root: Element): FreeTextStyle {
  const chain: Element[] = []
  let current = node.parentNode
  while (current && current !== stop && current !== root) {
    if (current.nodeType === Node.ELEMENT_NODE) chain.unshift(current as Element)
    current = current.parentNode
  }
  let style: FreeTextStyle = {}
  for (const el of chain) {
    const data = el.getAttribute('data-s')
    if (data) {
      try {
        style = { ...style, ...(JSON.parse(data) as FreeTextStyle) }
        continue
      } catch {
        /* atributo corrompido: cai para o CSS */
      }
    }
    style = { ...style, ...styleFromCss(el as HTMLElement) }
  }
  return style
}

function readParagraphProps(el: Element | null): ParagraphProps {
  if (!el) return {}
  const data = el.getAttribute('data-p')
  if (data) {
    try {
      return JSON.parse(data) as ParagraphProps
    } catch {
      /* ignora e segue com o CSS */
    }
  }
  const align = (el as HTMLElement).style.textAlign
  return align === 'left' || align === 'center' || align === 'right' || align === 'justify' ? { align } : {}
}

/** Remove do trecho o que só repete o estilo herdado (da caixa e do parágrafo). */
function dropInherited(style: FreeTextStyle, inherited: FreeTextStyle): FreeTextStyle | undefined {
  const out: FreeTextStyle = {}
  for (const [key, value] of Object.entries(style) as [keyof FreeTextStyle, unknown][]) {
    const fallback = key === 'bold' || key === 'italic' || key === 'underline' || key === 'strike' ? false : undefined
    if (value !== (inherited[key] ?? fallback)) (out as Record<string, unknown>)[key] = value
  }
  return cleanStyle(out)
}

/** Lê os parágrafos de volta do HTML editado. */
export function htmlToParagraphs(root: Element, base: FreeTextStyle): FreeTextParagraph[] {
  return collectUnits(root).map((unit) => {
    const props = readParagraphProps(unit.el)
    const inherited = resolveStyle(base, props.style, undefined)
    const runs: FreeTextRun[] = []
    for (const leaf of unit.leaves) {
      const text = leaf.node.nodeType === Node.TEXT_NODE ? (leaf.node.textContent ?? '') : '\n'
      const style = dropInherited(leafStyle(leaf.node, unit.el, root), inherited)
      runs.push(style ? { text, style } : { text })
    }
    if (runs.length === 0 && unit.placeholder) {
      const style = dropInherited(leafStyle(unit.placeholder, unit.el, root), inherited)
      runs.push(style ? { text: '', style } : { text: '' })
    }
    return normalizeParagraph({ ...props, runs })
  })
}

/** Atualiza os marcadores (numeração) no DOM sem tocar no texto nem no cursor. */
export function refreshMarkers(root: Element, paragraphs: FreeTextParagraph[]): void {
  const markers = paragraphMarkers(paragraphs)
  collectUnits(root).forEach((unit, i) => {
    if (!unit.el) return
    const marker = markers[i]
    if (marker === null || marker === undefined) unit.el.removeAttribute('data-marker')
    else if (unit.el.getAttribute('data-marker') !== marker) unit.el.setAttribute('data-marker', marker)
  })
}

/* Seleção <-> deslocamento ---------------------------------------------- */

function unitOf(units: Unit[], node: Node): Unit | undefined {
  return units.find((u) => (u.el ? u.el === node || u.el.contains(node) : u.nodes.some((n) => n === node || n.contains(node))))
}

function pointToOffset(root: Element, units: Unit[], node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    for (const unit of units) {
      const leaf = unit.leaves.find((l) => l.node === node)
      if (leaf) return leaf.start + Math.min(offset, leaf.length)
    }
    const unit = unitOf(units, node)
    return unit ? unit.start : 0
  }
  if (node === root) {
    const child = root.childNodes[offset]
    if (!child) {
      const last = units[units.length - 1]
      return last.start + last.length
    }
    const unit = unitOf(units, child)
    return unit ? unit.start : 0
  }
  const unit = unitOf(units, node)
  if (!unit) return 0
  const child = node.childNodes[offset]
  if (child) {
    const leaf = unit.leaves.find(
      (l) =>
        l.node === child ||
        child.contains(l.node) ||
        Boolean(child.compareDocumentPosition(l.node) & Node.DOCUMENT_POSITION_FOLLOWING),
    )
    return leaf ? leaf.start : unit.start + unit.length
  }
  const inside = unit.leaves.filter((l) => node.contains(l.node))
  const last = inside[inside.length - 1]
  return last ? last.start + last.length : unit.start
}

/** Seleção atual dentro de `root`, como deslocamentos no texto corrido. */
export function getSelectionOffsets(root: Element): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const units = collectUnits(root)
  const a = pointToOffset(root, units, range.startContainer, range.startOffset)
  const b = pointToOffset(root, units, range.endContainer, range.endOffset)
  return { start: Math.min(a, b), end: Math.max(a, b) }
}

function offsetToPoint(units: Unit[], offset: number): { node: Node; offset: number } | null {
  const unit = units.find((u) => offset >= u.start && offset <= u.start + u.length) ?? units[units.length - 1]
  if (!unit) return null
  const target = Math.max(unit.start, Math.min(offset, unit.start + unit.length))
  for (const leaf of unit.leaves) {
    if (target > leaf.start + leaf.length) continue
    if (leaf.node.nodeType === Node.TEXT_NODE) return { node: leaf.node, offset: target - leaf.start }
    // Um <br>: o ponto fica antes dele.
    const parent = leaf.node.parentNode as Node
    return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, leaf.node) }
  }
  if (unit.placeholder) {
    const parent = unit.placeholder.parentNode as Node
    return { node: parent, offset: Array.prototype.indexOf.call(parent.childNodes, unit.placeholder) }
  }
  if (unit.el) return { node: unit.el, offset: unit.el.childNodes.length }
  return null
}

/** Coloca a seleção do navegador nos deslocamentos dados. */
export function setSelectionOffsets(root: Element, start: number, end: number): void {
  const units = collectUnits(root)
  const a = offsetToPoint(units, start)
  const b = offsetToPoint(units, end)
  const selection = window.getSelection()
  if (!a || !b || !selection) return
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  selection.removeAllRanges()
  selection.addRange(range)
}
