import type { FreeTextElement, FreeTextParagraph, FreeTextStyle } from '../types/presentation'
import {
  clearStyleKey,
  rangeParagraphValue,
  rangeStyleValue,
  setParagraphProps,
  setRangeStyle,
  textLength,
} from './richText'
import type { StyleKey } from './richText'

/**
 * Formatação de uma caixa de texto do slide livre, como no PowerPoint: com um
 * trecho selecionado, o estilo vale só para ele; sem seleção (caixa apenas
 * selecionada, ou cursor parado no texto), vale para a caixa inteira.
 */

export interface TextRange {
  start: number
  end: number
}

type ParagraphKey = keyof Omit<FreeTextParagraph, 'runs'>

function wholeText(element: FreeTextElement): TextRange {
  return { start: 0, end: textLength(element.paragraphs) }
}

/** Valor mostrado nos controles: o do trecho, o do cursor ou o da caixa inteira. */
export function textStyleValue<K extends StyleKey>(
  element: FreeTextElement,
  range: TextRange | null,
  key: K,
): FreeTextStyle[K] | 'misto' {
  const r = range ?? wholeText(element)
  return rangeStyleValue(element.paragraphs, element.style, r.start, r.end, key)
}

/** Mudança de estilo pronta para `updateElement`. */
export function formatTextStyle<K extends StyleKey>(
  element: FreeTextElement,
  range: TextRange | null,
  key: K,
  value: FreeTextStyle[K],
): Partial<FreeTextElement> {
  if (range && range.end > range.start) {
    return { paragraphs: setRangeStyle(element.paragraphs, range.start, range.end, key, value) }
  }
  // Caixa inteira: o valor vai para o estilo base e os trechos param de
  // sobrescrevê-lo, senão a mudança não apareceria onde havia exceção.
  return {
    style: { ...element.style, [key]: value },
    paragraphs: clearStyleKey(element.paragraphs, key),
  }
}

/** Liga ou desliga negrito, itálico, sublinhado ou tachado. */
export function toggleTextFlag(
  element: FreeTextElement,
  range: TextRange | null,
  key: 'bold' | 'italic' | 'underline' | 'strike',
): Partial<FreeTextElement> {
  const target = range && range.end > range.start ? range : null
  const current = textStyleValue(element, target, key)
  return formatTextStyle(element, target, key, current !== true)
}

export function paragraphValue<K extends ParagraphKey>(
  element: FreeTextElement,
  range: TextRange | null,
  key: K,
): FreeTextParagraph[K] | 'misto' {
  const r = range ?? wholeText(element)
  return rangeParagraphValue(element.paragraphs, r.start, r.end, key)
}

/** Alinhamento, marcador e espaçamento: nos parágrafos do trecho (ou em todos). */
export function formatParagraphs(
  element: FreeTextElement,
  range: TextRange | null,
  patch: Partial<Omit<FreeTextParagraph, 'runs'>>,
): Partial<FreeTextElement> {
  const r = range ?? wholeText(element)
  return { paragraphs: setParagraphProps(element.paragraphs, r.start, r.end, patch) }
}
