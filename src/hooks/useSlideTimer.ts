import { useEffect, useState } from 'react'
import type { PresentationSettings, Room, Slide } from '../types/presentation'
import { slideTimerSeconds, timerRemainingMs } from '../utils/timer'

export interface SlideTimerState {
  /** O slide tem cronômetro (mostre a contagem). */
  active: boolean
  /** Segundos que faltam, arredondados para cima (0 quando acabou). */
  seconds: number
  /** O tempo acabou — a entrada dos participantes fica bloqueada. */
  expired: boolean
  /**
   * O cronômetro está parado: pausado porque o apresentador saiu do slide no
   * meio da contagem, ou esgotado numa passagem anterior. Um cronômetro
   * congelado em zero **não** dispara a troca automática para o gabarito —
   * voltar para uma pergunta encerrada é para revê-la, não para avançar.
   */
  frozen: boolean
}

const IDLE: SlideTimerState = {
  active: false,
  seconds: 0,
  expired: false,
  frozen: false,
}

/**
 * Contagem regressiva do slide atual, lida da sala.
 *
 * O apresentador grava só o instante final (`timers[slideId].endsAt`); cada
 * navegador conta localmente a partir dele, sem uma escrita por segundo no
 * Firestore. Como a comparação usa o relógio do próprio dispositivo, o tempo
 * restante é limitado à duração do slide: um relógio atrasado não faz a
 * contagem começar acima do que a pergunta vale.
 */
export function useSlideTimer(
  room: Room | null,
  slide: Slide | undefined,
  settings: PresentationSettings,
): SlideTimerState {
  const total = slideTimerSeconds(slide, settings)
  const entry = total > 0 && slide ? room?.timers?.[slide.id] : undefined
  // Só um cronômetro correndo precisa de tique: pausado e esgotado são fixos.
  const endsAt = entry?.endsAt ?? null

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    setNow(Date.now())
    // 250 ms: o segundo exibido troca sem atraso perceptível e o custo é nulo.
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (total <= 0) return IDLE

  // Sem registro, o apresentador ainda vai gravar o início: mostrar o tempo
  // cheio evita a contagem piscar na tela por uma fração de segundo.
  const remaining = entry
    ? Math.min(timerRemainingMs(entry, now) ?? 0, total * 1000)
    : total * 1000

  return {
    active: true,
    seconds: Math.ceil(remaining / 1000),
    expired: entry !== undefined && remaining <= 0,
    frozen: entry !== undefined && entry.endsAt === null,
  }
}
