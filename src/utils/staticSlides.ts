import type { FreeSlide, Presentation, ThemeMode } from '../types/presentation'
import { fitFreeSlideToFrame } from './freeSlide'
import { standardSlideToFree } from './pptxExport/standard'
import type { StaticSlideOptions } from './pptxExport/standard'
import { SLIDE_FRAMES, withDefaults } from './settings'

export interface StaticSlidesOptions extends StaticSlideOptions {
  /** Tema dos slides comuns (os livres têm cores próprias). */
  theme?: ThemeMode
  /** Deixa de fora os slides de gabarito (o modo leitura mostra o gabarito na própria pergunta). */
  skipAnswerSlides?: boolean
}

/**
 * A apresentação como slides livres estáticos, no formato dela: o mesmo
 * caminho da exportação para PowerPoint. Os slides livres são reenquadrados
 * na moldura do formato; os comuns viram enunciado e alternativas (o gabarito
 * destacado no slide de resposta). Usado pelo PDF dos slides e pelo modo
 * leitura; nenhum dado de resposta entra aqui.
 */
export function toStaticSlides(
  presentation: Presentation,
  { theme = 'light', skipAnswerSlides = false, ...options }: StaticSlidesOptions = {},
): FreeSlide[] {
  const settings = withDefaults(presentation.settings)
  const frame = SLIDE_FRAMES[settings.slideAspect]
  return presentation.slides
    .filter((slide) => !(skipAnswerSlides && slide.type === 'answer'))
    .map((slide) =>
      slide.type === 'free'
        ? fitFreeSlideToFrame(slide, frame)
        : standardSlideToFree(slide, presentation.slides, presentation.settings, frame, theme, options),
    )
}
