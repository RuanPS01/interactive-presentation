import { ImageOff } from 'lucide-react'
import { useMemo } from 'react'
import type {
  FreeImageElement,
  FreeTextElement,
  PresentationAsset,
} from '../../types/presentation'
import { paragraphsToHtml } from '../../utils/richTextDom'
import { textBoxCss, textContentCss } from './layout'

/** Texto de uma caixa, só para exibir. */
export function FreeTextContent({ element }: { element: FreeTextElement }) {
  // O HTML é montado a partir do modelo, com todo texto escapado.
  const html = useMemo(
    () => paragraphsToHtml(element.paragraphs, element.style),
    [element.paragraphs, element.style],
  )
  return (
    <div className="h-full w-full" style={textBoxCss(element)}>
      <div className="ft-text" style={textContentCss(element)} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

const FIT = { fill: 'fill', contain: 'contain', cover: 'cover' } as const

/** Imagem de um elemento; sem o arquivo carregado, um espaço reservado. */
export function FreeImageContent({
  element,
  asset,
}: {
  element: FreeImageElement
  asset: PresentationAsset | undefined
}) {
  if (!asset) {
    return (
      <div
        className="flex h-full w-full items-center justify-center bg-neutral-200/70 text-neutral-400 dark:bg-neutral-800/70"
        style={{ borderRadius: element.radius }}
      >
        <ImageOff style={{ width: '20%', height: '20%', maxWidth: 96, maxHeight: 96 }} />
      </div>
    )
  }
  return (
    <img
      src={asset.dataUrl}
      alt=""
      draggable={false}
      className="pointer-events-none block h-full w-full select-none"
      style={{ objectFit: FIT[element.fit ?? 'fill'], borderRadius: element.radius }}
    />
  )
}
