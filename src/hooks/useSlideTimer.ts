import { useEffect, useState } from 'react'
import type { PresentationSettings, Room, Slide } from '../types/presentation'
import { slideTimerSeconds } from '../utils/timer'

export interface SlideTimerState {
  /** Existe cronômetro em vigor para o slide atual. */
  active: boolean
  /** Segundos que faltam, arredondados para cima (0 quando acabou). */
  seconds: number
  /** O tempo acabou — a entrada dos participantes fica bloqueada. */
  expired: boolean
}

const IDLE: SlideTimerState = { active: false, seconds: 0, expired: false }

/**
 * Contagem regressiva do slide atual, lida da sala.
 *
 * O apresentador grava só o instante final (`timerEndsAt`); cada navegador
 * conta localmente a partir dele, sem uma escrita por segundo no Firestore.
 * Como a comparação usa o relógio do próprio dispositivo, o tempo restante é
 * limitado à duração do slide: um relógio atrasado não faz a contagem começar
 * acima do que a pergunta vale.
 */
export function useSlideTimer(
  room: Room | null,
  slide: Slide | undefined,
  settings: PresentationSettings,
): SlideTimerState {
  const total = slideTimerSeconds(slide, settings)
  // O cronômetro só vale para o slide em que foi iniciado: ao trocar de slide o
  // valor antigo ainda chega num snapshot ou outro.
  const endsAt =
    total > 0 && slide && room?.timerSlideId === slide.id
      ? (room.timerEndsAt ?? null)
      : null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    // 250 ms: o segundo exibido troca sem atraso perceptível e o custo é nulo.
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (endsAt === null) return IDLE
  const remaining = Math.min(Math.max(endsAt - now, 0), total * 1000)
  return {
    active: true,
    seconds: Math.ceil(remaining / 1000),
    expired: remaining <= 0,
  }
}
