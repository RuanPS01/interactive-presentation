import { useEffect, useState } from 'react'
import { subscribeMyResponse } from '../lib/responses'
import type { ResponseDoc } from '../types/presentation'

/** Assina apenas a resposta do próprio participante para o slide atual. */
export function useMyResponse(
  code: string | undefined,
  slideId: string | undefined,
  participantUid: string | null,
): ResponseDoc | null {
  const [response, setResponse] = useState<ResponseDoc | null>(null)

  useEffect(() => {
    if (!code || !slideId || !participantUid) {
      setResponse(null)
      return
    }
    const unsub = subscribeMyResponse(code, slideId, participantUid, setResponse)
    return unsub
  }, [code, slideId, participantUid])

  return response
}
