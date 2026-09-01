import type {
  PresentationSettings,
  Slide,
  SlideTimer,
  SlideTimers,
} from '../types/presentation'
import { clampTimerSeconds, resolveSlideSettings } from './settings'

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
 * Tempo que falta num cronômetro, correndo ou pausado. `null` quando o slide
 * ainda não teve cronômetro iniciado.
 */
export function timerRemainingMs(
  timer: SlideTimer | undefined,
  now: number = Date.now(),
): number | null {
  if (!timer) return null
  if (timer.endsAt === null) return Math.max(0, timer.remainingMs)
  return Math.max(0, timer.endsAt - now)
}

/**
 * Cronômetros da sala depois de sair de um slide e entrar em outro.
 *
 * Sair **pausa** o que estava correndo; entrar **inicia** (primeira vez) ou
 * **retoma de onde parou**. Um cronômetro que chegou a zero permanece zerado:
 * voltar para a pergunta não abre uma contagem nova nem reabre as respostas —
 * elas ficam congeladas como estavam.
 *
 * Passe `from: undefined` para só iniciar/retomar o slide de destino (é o caso
 * de quem abre ou retoma a sala já parada num slide).
 */
export function advanceTimers(
  timers: SlideTimers | undefined,
  from: Slide | undefined,
  to: Slide | undefined,
  global: Partial<PresentationSettings> | undefined,
  now: number = Date.now(),
): SlideTimers {
  const next: SlideTimers = { ...(timers ?? {}) }

  if (from && from.id !== to?.id) {
    const leaving = next[from.id]
    // Só o que estava correndo precisa ser congelado; o resto já está parado.
    if (leaving && leaving.endsAt !== null) {
      next[from.id] = {
        endsAt: null,
        remainingMs: Math.max(0, leaving.endsAt - now),
      }
    }
  }

  const total = to
    ? slideTimerSeconds(to, resolveSlideSettings(global, to)) * 1000
    : 0
  if (to && total > 0) {
    const entering = next[to.id]
    if (!entering) {
      next[to.id] = { endsAt: now + total, remainingMs: total }
    } else if (entering.endsAt === null && entering.remainingMs > 0) {
      next[to.id] = { endsAt: now + entering.remainingMs, remainingMs: entering.remainingMs }
    }
    // Esgotado (`remainingMs` 0) continua esgotado; já correndo continua
    // correndo — é o caso de recarregar a página sem sair do slide.
  }

  return next
}
