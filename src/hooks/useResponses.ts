import { useEffect, useState } from 'react'
import { subscribeResponses } from '../lib/responses'
import type { ResponseDoc } from '../types/presentation'

/** Assina em tempo real as respostas de um slide (para agregação/exibição). */
export function useResponses(
  code: string | undefined,
  slideId: string | undefined,
): ResponseDoc[] {
  const [responses, setResponses] = useState<ResponseDoc[]>([])

  useEffect(() => {
    if (!code || !slideId) {
      setResponses([])
      return
    }
    const unsub = subscribeResponses(code, slideId, setResponses)
    return unsub
  }, [code, slideId])

  return responses
}
