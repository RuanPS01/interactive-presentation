import type { QuizSlide, Slide } from '../types/presentation'

/**
 * O `quiz` referenciado por um slide de gabarito (`answer`). Devolve
 * `undefined` se o slide não for de gabarito ou se a pergunta foi removida.
 */
export function findQuizSlide(
  slide: Slide,
  slides: Slide[] | undefined,
): QuizSlide | undefined {
  if (slide.type !== 'answer') return undefined
  const found = slides?.find((s) => s.id === slide.quizSlideId)
  return found?.type === 'quiz' ? found : undefined
}
