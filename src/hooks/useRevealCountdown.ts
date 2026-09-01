import { useEffect, useState } from 'react'
import { REVEAL_DELAY_SECONDS } from '../utils/timer'

export interface RevealCountdownOptions {
  /**
   * O gabarito já foi revelado numa passagem anterior (veio da sala). Nesse
   * caso não há suspense nenhum: quem volta ao slide quer rever a resposta.
   */
  revealed?: boolean
  seconds?: number
}

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
 * antes dos colegas. Só a **primeira** revelação passa por ela — depois o
 * apresentador marca o slide como revelado na sala (ver `markAnswerRevealed`)
 * e voltar ali mostra a resposta na hora, inclusive para quem chegou atrasado.
 */
export function useRevealCountdown(
  key: string | null,
  { revealed = false, seconds = REVEAL_DELAY_SECONDS }: RevealCountdownOptions = {},
): RevealCountdownState {
  // O passo é guardado junto da chave do slide: trocar de slide já reinicia a
  // contagem na primeira renderização, sem um quadro exibindo o estado antigo.
  const [progress, setProgress] = useState({ key, step: 0 })
  const step = progress.key === key ? progress.step : 0
  const skip = key === null || revealed || seconds <= 0

  useEffect(() => {
    // O reinício acontece mesmo quando não há contagem: assim `progress.key`
    // acompanha o slide no ar e uma volta ao MESMO gabarito (a1 -> outro ->
    // a1) enxerga a divergência de chave e recomeça do zero, em vez de
    // reaproveitar o passo final da passagem anterior.
    setProgress({ key, step: 0 })
    if (skip) return
    let elapsed = 0
    const id = window.setInterval(() => {
      elapsed += 1
      setProgress({ key, step: elapsed })
      if (elapsed >= seconds) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [key, seconds, skip])

  if (skip) return { pending: false, dots: 0 }
  // Começa com um ponto e ganha mais um por segundo: "." -> ".." -> "..."
  return { pending: step < seconds, dots: Math.min(step + 1, seconds) }
}
