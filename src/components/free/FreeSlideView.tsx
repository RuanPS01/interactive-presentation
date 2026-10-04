import type { FreeSlide, PresentationAssets } from '../../types/presentation'
import { ScaledFrame } from '../slides/ScaledFrame'
import { FreeImageContent, FreeTextContent } from './FreeElementContent'
import { elementBoxStyle } from './layout'

interface FreeSlideViewProps {
  slide: FreeSlide
  assets: PresentationAssets
  className?: string
}

/** Slide livre desenhado na moldura lógica: os elementos, na ordem de desenho. */
export function FreeSlideStage({ slide, assets }: Omit<FreeSlideViewProps, 'className'>) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: slide.width, height: slide.height, background: slide.background }}
    >
      {slide.elements.map((element) => (
        <div key={element.id} style={elementBoxStyle(element)}>
          {element.kind === 'text' ? (
            <FreeTextContent element={element} />
          ) : (
            <FreeImageContent element={element} asset={assets[element.assetId]} />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Slide livre ajustado ao espaço disponível (projetor, celular, miniatura),
 * sem distorcer: sobra faixa nas laterais ou em cima e embaixo quando o
 * formato da tela é outro.
 */
export function FreeSlideView({ slide, assets, className }: FreeSlideViewProps) {
  return (
    <ScaledFrame width={slide.width} height={slide.height} className={className} frameClassName="shadow-sm">
      <FreeSlideStage slide={slide} assets={assets} />
    </ScaledFrame>
  )
}
