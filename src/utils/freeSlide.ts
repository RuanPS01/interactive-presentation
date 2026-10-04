import type {
  FreeElement,
  FreeImageElement,
  FreeSlide,
  FreeTextElement,
  FreeTextParagraph,
  FreeTextStyle,
  PresentationAsset,
  PresentationAssets,
  Slide,
} from '../types/presentation'

export interface FrameSize {
  width: number
  height: number
}

/** Fonte padrão dos textos novos: existe em praticamente todo aparelho. */
export const FREE_DEFAULT_FONT = 'Arial'

/** Fontes oferecidas no editor (as de um PPTX importado aparecem junto). */
export const FONT_CHOICES = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Calibri',
  'Roboto',
  'Open Sans',
  'Georgia',
  'Cambria',
  'Times New Roman',
  'Garamond',
  'Courier New',
  'Impact',
  'Comic Sans MS',
]

const SERIF = /georgia|times|garamond|cambria|book|serif|minion|palatino|baskerville/i
const MONO = /courier|consol|mono|code/i

/**
 * Pilha CSS de uma fonte, com alternativas parecidas para quando ela não
 * estiver instalada no aparelho (um PPTX costuma usar Calibri, que não existe
 * fora do Windows; o Carlito tem as mesmas medidas).
 */
export function fontStack(family: string | undefined): string {
  const name = (family ?? FREE_DEFAULT_FONT).replace(/["\\<>;{}]/g, '').trim() || FREE_DEFAULT_FONT
  const fallback = MONO.test(name)
    ? '"Courier New", monospace'
    : SERIF.test(name)
      ? 'Georgia, "Times New Roman", serif'
      : /calibri/i.test(name)
        ? 'Carlito, Arial, sans-serif'
        : 'Arial, Helvetica, sans-serif'
  return `"${name}", ${fallback}`
}

function newElementId(): string {
  return crypto.randomUUID()
}

/** Parágrafos a partir de texto puro: cada linha vira um parágrafo. */
export function paragraphsFromText(text: string): FreeTextParagraph[] {
  return text.split('\n').map((line) => ({ runs: [{ text: line }] }))
}

/** Texto puro de uma caixa (para a lista de camadas e buscas). */
export function elementPlainText(element: FreeTextElement): string {
  return element.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')
}

export function createTextElement(
  frame: FrameSize,
  init: {
    text?: string
    x?: number
    y?: number
    width?: number
    height?: number
    style?: FreeTextStyle
    align?: FreeTextParagraph['align']
  } = {},
): FreeTextElement {
  const width = init.width ?? Math.round(frame.width * 0.5)
  const height = init.height ?? Math.round(frame.height * 0.15)
  const paragraphs = paragraphsFromText(init.text ?? 'Novo texto').map((p) => ({
    ...p,
    align: init.align ?? 'left',
  }))
  return {
    id: newElementId(),
    kind: 'text',
    x: init.x ?? Math.round((frame.width - width) / 2),
    y: init.y ?? Math.round((frame.height - height) / 2),
    width,
    height,
    paragraphs,
    style: {
      fontFamily: FREE_DEFAULT_FONT,
      fontSize: Math.round(frame.height * 0.05),
      color: '#171717',
      ...init.style,
    },
    verticalAlign: 'top',
  }
}

/**
 * Imagem nova centralizada (ou no ponto pedido), com no máximo metade da
 * moldura e a proporção original.
 */
export function createImageElement(
  asset: PresentationAsset,
  frame: FrameSize,
  center?: { x: number; y: number },
): FreeImageElement {
  const scale = Math.min(1, (frame.width * 0.5) / asset.width, (frame.height * 0.5) / asset.height)
  const width = Math.round(asset.width * scale)
  const height = Math.round(asset.height * scale)
  const cx = center?.x ?? frame.width / 2
  const cy = center?.y ?? frame.height / 2
  return {
    id: newElementId(),
    kind: 'image',
    assetId: asset.id,
    x: Math.round(cx - width / 2),
    y: Math.round(cy - height / 2),
    width,
    height,
    fit: 'fill',
  }
}

/** Slide livre novo, com um título pronto para editar. */
export function createFreeSlide(frame: FrameSize, id: string): FreeSlide {
  return {
    id,
    type: 'free',
    title: 'Slide livre',
    width: frame.width,
    height: frame.height,
    background: '#ffffff',
    elements: [
      createTextElement(frame, {
        text: 'Clique duas vezes para editar',
        x: Math.round(frame.width * 0.08),
        y: Math.round(frame.height * 0.1),
        width: Math.round(frame.width * 0.84),
        height: Math.round(frame.height * 0.16),
        style: { fontSize: Math.round(frame.height * 0.075), bold: true },
      }),
    ],
  }
}

export function duplicateElement(element: FreeElement, offset = 24): FreeElement {
  return {
    ...structuredClone(element),
    id: newElementId(),
    x: element.x + offset,
    y: element.y + offset,
  }
}

export type LayerMove = 'front' | 'back' | 'forward' | 'backward'

/** Muda a ordem de desenho de um elemento (o último da lista fica na frente). */
export function moveLayer(elements: FreeElement[], id: string, move: LayerMove): FreeElement[] {
  const index = elements.findIndex((e) => e.id === id)
  if (index < 0) return elements
  const target =
    move === 'front'
      ? elements.length - 1
      : move === 'back'
        ? 0
        : move === 'forward'
          ? Math.min(elements.length - 1, index + 1)
          : Math.max(0, index - 1)
  if (target === index) return elements
  const next = [...elements]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item)
  return next
}

/** Ids de todas as imagens usadas pelos slides (sem repetição). */
export function collectAssetIds(slides: Slide[]): string[] {
  const ids = new Set<string>()
  for (const slide of slides) {
    if (slide.type !== 'free') continue
    for (const element of slide.elements) {
      if (element.kind === 'image') ids.add(element.assetId)
    }
  }
  return [...ids]
}

/** Só as imagens que algum slide usa: as removidas não vão para o JSON nem para a sala. */
export function pickAssets(assets: PresentationAssets, slides: Slide[]): PresentationAssets {
  const picked: PresentationAssets = {}
  for (const id of collectAssetIds(slides)) {
    if (assets[id]) picked[id] = assets[id]
  }
  return picked
}

function scaleStyle(style: FreeTextStyle | undefined, factor: number): FreeTextStyle | undefined {
  if (!style || style.fontSize === undefined) return style
  return { ...style, fontSize: Math.max(1, Math.round(style.fontSize * factor * 10) / 10) }
}

function scaleText(element: FreeTextElement, factor: number): FreeTextElement {
  const scale = (n: number | undefined) => (n === undefined ? undefined : n * factor)
  return {
    ...element,
    style: scaleStyle(element.style, factor) ?? element.style,
    padding: element.padding?.map((n) => n * factor) as FreeTextElement['padding'],
    paragraphs: element.paragraphs.map((p) => ({
      ...p,
      style: scaleStyle(p.style, factor),
      indent: scale(p.indent),
      hanging: scale(p.hanging),
      spaceBefore: scale(p.spaceBefore),
      spaceAfter: scale(p.spaceAfter),
      runs: p.runs.map((r) => ({ ...r, style: scaleStyle(r.style, factor) })),
    })),
  }
}

/**
 * Leva um slide livre para outra moldura (ao trocar o formato da
 * apresentação): o conteúdo é reduzido ou ampliado por inteiro para caber, e
 * centralizado. Nada é cortado.
 */
export function fitFreeSlideToFrame(slide: FreeSlide, frame: FrameSize): FreeSlide {
  if (slide.width === frame.width && slide.height === frame.height) return slide
  const factor = Math.min(frame.width / slide.width, frame.height / slide.height)
  const offsetX = (frame.width - slide.width * factor) / 2
  const offsetY = (frame.height - slide.height * factor) / 2
  const elements = slide.elements.map((element): FreeElement => {
    const placed = {
      ...element,
      x: Math.round(offsetX + element.x * factor),
      y: Math.round(offsetY + element.y * factor),
      width: Math.round(element.width * factor),
      height: Math.round(element.height * factor),
    }
    if (placed.kind === 'image') {
      return placed.radius ? { ...placed, radius: placed.radius * factor } : placed
    }
    return scaleText(placed, factor)
  })
  return { ...slide, width: frame.width, height: frame.height, elements }
}
