import type {
  FreeTextParagraph,
  FreeTextRun,
  FreeTextStyle,
} from '../types/presentation'

/**
 * Texto rico do slide livre como dados: parágrafos de trechos (`runs`), cada
 * um com o próprio estilo. As posições usadas aqui são deslocamentos no texto
 * corrido, em que a passagem de um parágrafo para o seguinte conta 1 caractere
 * (como um Enter). É a mesma contagem que `richTextDom.ts` faz na seleção do
 * navegador, o que permite aplicar estilo só ao trecho selecionado.
 */

export type StyleKey = keyof FreeTextStyle

/** Remove chaves `undefined`; devolve `undefined` quando não sobra nada. */
export function cleanStyle(style: FreeTextStyle | undefined): FreeTextStyle | undefined {
  if (!style) return undefined
  const out: FreeTextStyle = {}
  for (const [key, value] of Object.entries(style) as [StyleKey, unknown][]) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value
  }
  return Object.keys(out).length > 0 ? out : undefined
}

function sameStyle(a: FreeTextStyle | undefined, b: FreeTextStyle | undefined): boolean {
  const ca = cleanStyle(a) ?? {}
  const cb = cleanStyle(b) ?? {}
  const keys = new Set([...Object.keys(ca), ...Object.keys(cb)]) as Set<StyleKey>
  for (const key of keys) if (ca[key] !== cb[key]) return false
  return true
}

/** Estilo efetivo de um trecho: caixa, depois parágrafo, depois o trecho. */
export function resolveStyle(
  base: FreeTextStyle,
  paragraph: FreeTextStyle | undefined,
  run: FreeTextStyle | undefined,
): FreeTextStyle {
  return { ...base, ...cleanStyle(paragraph), ...cleanStyle(run) }
}

/** Junta trechos vizinhos de mesmo estilo e descarta os vazios (sobra ao menos um). */
export function normalizeParagraph(paragraph: FreeTextParagraph): FreeTextParagraph {
  const runs: FreeTextRun[] = []
  for (const run of paragraph.runs) {
    if (run.text === '') continue
    const last = runs[runs.length - 1]
    const style = cleanStyle(run.style)
    if (last && sameStyle(last.style, style)) {
      runs[runs.length - 1] = { ...last, text: last.text + run.text }
    } else {
      runs.push(style ? { text: run.text, style } : { text: run.text })
    }
  }
  if (runs.length === 0) {
    // Parágrafo vazio guarda o estilo do primeiro trecho: é ele que define a
    // altura da linha em branco.
    const style = cleanStyle(paragraph.runs[0]?.style)
    runs.push(style ? { text: '', style } : { text: '' })
  }
  return { ...paragraph, runs }
}

export function paragraphLength(paragraph: FreeTextParagraph): number {
  return paragraph.runs.reduce((sum, run) => sum + run.text.length, 0)
}

/** Tamanho do texto corrido (com 1 por quebra de parágrafo). */
export function textLength(paragraphs: FreeTextParagraph[]): number {
  return paragraphs.reduce((sum, p) => sum + paragraphLength(p), 0) + Math.max(0, paragraphs.length - 1)
}

/** Divide trechos para que `offset` caia numa fronteira; devolve o índice do trecho que começa nele. */
function splitAt(runs: FreeTextRun[], offset: number): number {
  let pos = 0
  for (let i = 0; i < runs.length; i++) {
    const len = runs[i].text.length
    if (offset === pos) return i
    if (offset < pos + len) {
      const run = runs[i]
      const cut = offset - pos
      runs.splice(i, 1, { ...run, text: run.text.slice(0, cut) }, { ...run, text: run.text.slice(cut) })
      return i + 1
    }
    pos += len
  }
  return runs.length
}

interface ParagraphSpan {
  index: number
  /** Início e fim locais, dentro do parágrafo. */
  start: number
  end: number
}

/** Parágrafos tocados por [start, end) e o trecho de cada um. */
function spansOf(paragraphs: FreeTextParagraph[], start: number, end: number): ParagraphSpan[] {
  const spans: ParagraphSpan[] = []
  let pos = 0
  paragraphs.forEach((paragraph, index) => {
    const len = paragraphLength(paragraph)
    const pStart = pos
    const pEnd = pos + len
    // Um parágrafo vazio entra quando a seleção passa por ele.
    const touches = start === end ? start >= pStart && start <= pEnd : start <= pEnd && end > pStart
    if (touches) {
      spans.push({
        index,
        start: Math.max(0, start - pStart),
        end: Math.min(len, end - pStart),
      })
    }
    pos = pEnd + 1
  })
  return spans
}

/**
 * Aplica `change` ao estilo dos trechos dentro de [start, end). Parágrafos
 * vazios no caminho recebem a mudança no estilo do parágrafo, para a linha em
 * branco acompanhar (o tamanho dela, por exemplo).
 */
export function mapRangeStyle(
  paragraphs: FreeTextParagraph[],
  start: number,
  end: number,
  change: (style: FreeTextStyle | undefined) => FreeTextStyle | undefined,
): FreeTextParagraph[] {
  if (end <= start) return paragraphs
  const next = paragraphs.map((p) => ({ ...p, runs: [...p.runs] }))
  for (const span of spansOf(paragraphs, start, end)) {
    const paragraph = next[span.index]
    if (paragraphLength(paragraph) === 0) {
      paragraph.style = cleanStyle(change(paragraph.style))
      paragraph.runs = paragraph.runs.map((r) => ({ ...r, style: cleanStyle(change(r.style)) }))
      continue
    }
    if (span.end <= span.start) continue
    const from = splitAt(paragraph.runs, span.start)
    const to = splitAt(paragraph.runs, span.end)
    for (let i = from; i < to; i++) {
      paragraph.runs[i] = { ...paragraph.runs[i], style: cleanStyle(change(paragraph.runs[i].style)) }
    }
  }
  return next.map(normalizeParagraph)
}

/** Define (ou remove, com `undefined`) uma propriedade de estilo no trecho. */
export function setRangeStyle<K extends StyleKey>(
  paragraphs: FreeTextParagraph[],
  start: number,
  end: number,
  key: K,
  value: FreeTextStyle[K],
): FreeTextParagraph[] {
  return mapRangeStyle(paragraphs, start, end, (style) => ({ ...style, [key]: value }))
}

/**
 * Valor efetivo de uma propriedade no trecho: o valor quando é o mesmo em
 * tudo, `'misto'` quando varia. Com a seleção recolhida, vale o caractere
 * antes do cursor.
 */
export function rangeStyleValue<K extends StyleKey>(
  paragraphs: FreeTextParagraph[],
  base: FreeTextStyle,
  start: number,
  end: number,
  key: K,
): FreeTextStyle[K] | 'misto' {
  const values: FreeTextStyle[K][] = []
  const collapsed = end <= start
  for (const span of spansOf(paragraphs, start, collapsed ? start : end)) {
    const paragraph = paragraphs[span.index]
    let pos = 0
    if (paragraphLength(paragraph) === 0) {
      values.push(resolveStyle(base, paragraph.style, paragraph.runs[0]?.style)[key])
      continue
    }
    for (const run of paragraph.runs) {
      const runStart = pos
      const runEnd = pos + run.text.length
      pos = runEnd
      const inside = collapsed
        ? span.start > runStart && span.start <= runEnd
        : runEnd > span.start && runStart < span.end
      if (inside || (collapsed && span.start === 0 && runStart === 0)) {
        values.push(resolveStyle(base, paragraph.style, run.style)[key])
      }
    }
  }
  if (values.length === 0) return base[key]
  return values.every((v) => v === values[0]) ? values[0] : 'misto'
}

/** Remove a propriedade de todos os trechos e parágrafos, para valer a da caixa. */
export function clearStyleKey(paragraphs: FreeTextParagraph[], key: StyleKey): FreeTextParagraph[] {
  const strip = (style: FreeTextStyle | undefined) => {
    if (!style || style[key] === undefined) return style
    const copy = { ...style }
    delete copy[key]
    return cleanStyle(copy)
  }
  return paragraphs
    .map((p) => ({ ...p, style: strip(p.style), runs: p.runs.map((r) => ({ ...r, style: strip(r.style) })) }))
    .map(normalizeParagraph)
}

/** Aplica propriedades de parágrafo (alinhamento, marcador) aos parágrafos do trecho. */
export function setParagraphProps(
  paragraphs: FreeTextParagraph[],
  start: number,
  end: number,
  patch: Partial<Omit<FreeTextParagraph, 'runs'>>,
): FreeTextParagraph[] {
  const touched = new Set(spansOf(paragraphs, start, Math.max(start, end)).map((s) => s.index))
  return paragraphs.map((p, i) => (touched.has(i) ? { ...p, ...patch } : p))
}

/** Valor de uma propriedade de parágrafo no trecho (`'misto'` se variar). */
export function rangeParagraphValue<K extends keyof Omit<FreeTextParagraph, 'runs'>>(
  paragraphs: FreeTextParagraph[],
  start: number,
  end: number,
  key: K,
): FreeTextParagraph[K] | 'misto' {
  const values = spansOf(paragraphs, start, Math.max(start, end)).map((s) => paragraphs[s.index][key])
  if (values.length === 0) return undefined
  return values.every((v) => JSON.stringify(v) === JSON.stringify(values[0])) ? values[0] : 'misto'
}

const ROMAN: [number, string][] = [
  [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'],
  [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
]

function toRoman(n: number): string {
  let out = ''
  for (const [value, letters] of ROMAN) {
    while (n >= value) {
      out += letters
      n -= value
    }
  }
  return out
}

function toAlpha(n: number): string {
  let out = ''
  while (n > 0) {
    n -= 1
    out = String.fromCharCode(97 + (n % 26)) + out
    n = Math.floor(n / 26)
  }
  return out
}

/**
 * Texto do marcador de cada parágrafo ("•", "1.", "b)"...), ou `null`. A
 * numeração segue por nível de recuo e recomeça quando a lista é
 * interrompida por um parágrafo de recuo menor ou igual sem numeração.
 */
export function paragraphMarkers(paragraphs: FreeTextParagraph[]): (string | null)[] {
  const counters = new Map<number, number>()
  return paragraphs.map((p) => {
    const level = Math.round(p.indent ?? 0)
    if (!p.bullet) {
      for (const key of [...counters.keys()]) if (key >= level) counters.delete(key)
      return null
    }
    // Um nível mais raso encerra a contagem dos mais fundos.
    for (const key of [...counters.keys()]) if (key > level) counters.delete(key)
    if (p.bullet.kind === 'char') {
      counters.delete(level)
      return p.bullet.char
    }
    const n = counters.has(level) ? (counters.get(level) as number) + 1 : (p.bullet.startAt ?? 1)
    counters.set(level, n)
    const label =
      p.bullet.format === 'arabic'
        ? String(n)
        : p.bullet.format === 'alphaLower'
          ? toAlpha(n)
          : p.bullet.format === 'alphaUpper'
            ? toAlpha(n).toUpperCase()
            : p.bullet.format === 'romanLower'
              ? toRoman(n)
              : toRoman(n).toUpperCase()
    return label + p.bullet.suffix
  })
}
