import { useEffect, useState } from 'react'
import { REVEAL_DELAY_SECONDS } from '../utils/timer'

export interface RevealCountdownState {
  /** Ainda em suspense: mostre a mensagem no lugar da resposta. */
  pending: boolean
  /** Reticências da mensagem — um ponto a mais a cada segundo. */
  dots: number
}

/**
 * Suspense do gabarito: segura a revelação por alguns segundos e conta os
 * pontos de "A resposta certa é…".
 *
 * A contagem é local e recomeça a cada `key` (o id do slide). É de propósito:
 * o atraso serve justamente para absorver a diferença de milissegundos com que
 * cada celular recebe a troca de slide, de modo que ninguém veja a resposta
 * antes dos colegas.
 */
export function useRevealCountdown(
  key: string | null,
  seconds: number = REVEAL_DELAY_SECONDS,
): RevealCountdownState {
  // O passo é guardado junto da chave: trocar de slide já reinicia a contagem
  // na primeira renderização, sem um quadro exibindo o estado do slide anterior.
  const [progress, setProgress] = useState({ key, step: 0 })
  const step = progress.key === key ? progress.step : 0

  useEffect(() => {
    if (key === null || seconds <= 0) return
    setProgress({ key, step: 0 })
    let elapsed = 0
    const id = window.setInterval(() => {
      elapsed += 1
      setProgress({ key, step: elapsed })
      if (elapsed >= seconds) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [key, seconds])

  if (key === null || seconds <= 0) return { pending: false, dots: 0 }
  // Começa com um ponto e ganha mais um por segundo: "." -> ".." -> "..."
  return { pending: step < seconds, dots: Math.min(step + 1, seconds) }
}
