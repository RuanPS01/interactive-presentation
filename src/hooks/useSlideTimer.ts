import { useEffect, useState } from 'react'
import type { PresentationSettings, Room, Slide } from '../types/presentation'
import { slideTimerSeconds, timerRemainingMs } from '../utils/timer'

export interface SlideTimerState {
  /** O slide tem cronômetro. */
  active: boolean
  /** Instante final enquanto corre; `null` quando parado (só o projetor usa). */
  endsAt: number | null
  /** Tempo restante em ms, amostrado a cada 250 ms enquanto corre. */
  remainingMs: number
  /**
   * A **sala** declarou a pergunta encerrada (o apresentador congelou o
   * cronômetro em zero). É o único sinal que bloqueia a plateia: se cada
   * celular decidisse pelo próprio relógio, um aparelho adiantado travaria as
   * opções segundos antes de o tempo acabar no projetor.
   */
  closed: boolean
  /**
   * A contagem local zerou com o cronômetro ainda correndo. Só o apresentador
   * age nisso — é o gatilho para encerrar a pergunta para todo mundo.
   */
  runOut: boolean
}

const IDLE: SlideTimerState = {
  active: false,
  endsAt: null,
  remainingMs: 0,
  closed: false,
  runOut: false,
}

/**
 * Cronômetro do slide atual, lido da sala.
 *
 * O apresentador grava só o instante final (`timers[slideId].endsAt`) e, ao
 * zerar, congela o registro em zero. A contagem exibida é local (a partir de
 * `endsAt`), sem uma escrita por segundo no Firestore; já o **encerramento** é
 * o estado congelado, que vale igual para todos os aparelhos.
 */
export function useSlideTimer(
  room: Room | null,
  slide: Slide | undefined,
  settings: PresentationSettings,
): SlideTimerState {
  const total = slideTimerSeconds(slide, settings)
  const entry = total > 0 && slide ? room?.timers?.[slide.id] : undefined
  // Só um cronômetro correndo precisa de tique: parado e encerrado são fixos.
  const endsAt = entry?.endsAt ?? null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    // 250 ms basta para a lógica; a exibição em milissegundos é animada pelo
    // próprio `SlideCountdown`, sem redesenhar o slide inteiro.
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (total <= 0) return IDLE

  // Sem registro, o apresentador ainda vai gravar o início: mostrar o tempo
  // cheio evita a contagem piscar na tela por uma fração de segundo.
  const remainingMs = entry
    ? Math.min(timerRemainingMs(entry, now) ?? 0, total * 1000)
    : total * 1000

  return {
    active: true,
    endsAt,
    remainingMs,
    closed: entry !== undefined && entry.endsAt === null && entry.remainingMs <= 0,
    runOut: endsAt !== null && remainingMs <= 0,
  }
}
