import { useEffect, useState } from 'react'
import { subscribeAnswers } from '../lib/answers'
import type { AnswerKey } from '../lib/answers'

/**
 * Gabaritos da sala (`rooms/{code}/secret/answers`), só para o dono: o projetor
 * junta com os slides antes de desenhar. Fica desligado (`enabled` falso) até
 * o acesso de apresentador ser confirmado, porque as regras recusam a leitura
 * a qualquer outra pessoa.
 */
export function useRoomAnswers(code: string | undefined, enabled: boolean): AnswerKey | null {
  const [answers, setAnswers] = useState<AnswerKey | null>(null)

  useEffect(() => {
    if (!code || !enabled) {
      setAnswers(null)
      return
    }
    return subscribeAnswers(code, setAnswers, () => setAnswers(null))
  }, [code, enabled])

  return answers
}
