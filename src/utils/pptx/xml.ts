/**
 * Leitura de XML do OOXML. A busca é pelo nome local do elemento (`sp`,
 * `spPr`...), sem depender do prefixo: arquivos de ferramentas diferentes
 * usam prefixos diferentes para os mesmos namespaces.
 */

export const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('XML inválido dentro do arquivo')
  }
  return doc
}

/** Primeiro filho direto com o nome local dado. */
export function child(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null
  for (let node = el.firstElementChild; node; node = node.nextElementSibling) {
    if (node.localName === name) return node
  }
  return null
}

/** Todos os filhos diretos com o nome local dado (ou todos, sem nome). */
export function children(el: Element | null | undefined, name?: string): Element[] {
  if (!el) return []
  const out: Element[] = []
  for (let node = el.firstElementChild; node; node = node.nextElementSibling) {
    if (!name || node.localName === name) out.push(node)
  }
  return out
}

/** Desce por filhos diretos: `path(sp, 'spPr', 'xfrm', 'off')`. */
export function path(el: Element | null | undefined, ...names: string[]): Element | null {
  let current: Element | null = el ?? null
  for (const name of names) {
    current = child(current, name)
    if (!current) return null
  }
  return current
}

/** Primeiro descendente com o nome local dado. */
export function descendant(el: Element | null | undefined, name: string): Element | null {
  if (!el) return null
  const all = el.getElementsByTagNameNS('*', name)
  return all.length > 0 ? all[0] : null
}

export function attr(el: Element | null | undefined, name: string): string | null {
  return el ? el.getAttribute(name) : null
}

export function num(el: Element | null | undefined, name: string): number | undefined {
  const value = attr(el, name)
  if (value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Atributo booleano do OOXML: "1"/"true" ou "0"/"false"; ausente = `undefined`. */
export function bool(el: Element | null | undefined, name: string): boolean | undefined {
  const value = attr(el, name)
  if (value === null) return undefined
  return value === '1' || value === 'true'
}

/** Id de relação (`r:embed`, `r:id`...), qualquer que seja o prefixo. */
export function relAttr(el: Element | null | undefined, name: string): string | null {
  if (!el) return null
  return el.getAttributeNS(REL_NS, name) || el.getAttribute(`r:${name}`)
}

/**
 * Conteúdo alternativo (`mc:AlternateContent`): fica com o `Fallback`, que é
 * a versão feita para leitores que não conhecem as extensões do `Choice`.
 */
export function resolveAlternate(el: Element): Element[] {
  if (el.localName !== 'AlternateContent') return [el]
  const fallback = child(el, 'Fallback')
  const choice = child(el, 'Choice')
  return children(fallback ?? choice)
}
