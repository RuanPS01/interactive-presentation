import type {
  PresentationSettings,
  Slide,
} from '../types/presentation'
import { clampTimerSeconds, resolveSlideSettings } from './settings'

/**
 * Cronômetro gravado na sala: a qual slide pertence e quando termina
 * (epoch ms). O apresentador escreve uma única vez, na troca de slide, e todos
 * os navegadores contam a partir desse mesmo instante.
 */
export interface SlideTimer {
  slideId: string
  endsAt: number
}

/**
 * Segundos que o gabarito fica em suspense ("A resposta certa é…") antes de
 * revelar. O atraso existe para absorver a diferença de milissegundos com que
 * cada celular recebe a troca de slide: todo mundo vê a revelação junto.
 */
export const REVEAL_DELAY_SECONDS = 3

/**
 * Duração do cronômetro deste slide, em segundos (0 = sem cronômetro).
 * Só slides de questionário (`quiz`) têm cronômetro: nos demais a plateia
 * responde enquanto o apresentador quiser.
 */
export function slideTimerSeconds(
  slide: Slide | undefined,
  settings: PresentationSettings,
): number {
  if (slide?.type !== 'quiz') return 0
  return clampTimerSeconds(settings.quizTimerSeconds)
}

/**
 * Cronômetro a gravar ao entrar num slide, ou `null` quando ele não tem
 * cronômetro. O instante final sai do relógio de quem apresenta — é a
 * referência única para a contagem em todas as telas.
 */
export function nextSlideTimer(
  slide: Slide | undefined,
  global: Partial<PresentationSettings> | undefined,
  now: number = Date.now(),
): SlideTimer | null {
  if (!slide) return null
  const seconds = slideTimerSeconds(slide, resolveSlideSettings(global, slide))
  return seconds > 0 ? { slideId: slide.id, endsAt: now + seconds * 1000 } : null
}
