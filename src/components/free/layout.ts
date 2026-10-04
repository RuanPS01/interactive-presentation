import type { CSSProperties } from 'react'
import type { FreeElement, FreeTextElement, FreeTextStyle } from '../../types/presentation'
import { fontStack } from '../../utils/freeSlide'

/** Posição e tamanho de um elemento (o editor passa a versão em arrasto). */
export interface ElementGeometry {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

/** Caixa posicionada de um elemento, em px da moldura lógica. */
export function elementBoxStyle(element: FreeElement, geometry: ElementGeometry = element): CSSProperties {
  return {
    position: 'absolute',
    left: geometry.x,
    top: geometry.y,
    width: geometry.width,
    height: geometry.height,
    transform: geometry.rotation ? `rotate(${geometry.rotation}deg)` : undefined,
    opacity: element.opacity ?? 1,
  }
}

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const

/** Estilo base herdável (sem sublinhado/tachado, que vão por trecho). */
export function baseTextCss(style: FreeTextStyle): CSSProperties {
  return {
    fontFamily: fontStack(style.fontFamily),
    fontSize: style.fontSize,
    color: style.color,
    fontWeight: style.bold ? 700 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
  }
}

/** A caixa de texto: espaço interno, alinhamento vertical e fundo. */
export function textBoxCss(element: FreeTextElement): CSSProperties {
  const [top, right, bottom, left] = element.padding ?? [0, 0, 0, 0]
  return {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: JUSTIFY[element.verticalAlign ?? 'top'],
    padding: `${top}px ${right}px ${bottom}px ${left}px`,
    background: element.background,
    boxSizing: 'border-box',
  }
}

/** O texto em si: estilo base e altura de linha. */
export function textContentCss(element: FreeTextElement): CSSProperties {
  return { ...baseTextCss(element.style), lineHeight: element.lineHeight ?? 1.2 }
}
