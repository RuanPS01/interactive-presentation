import { useEffect, useState } from 'react'
import { subscribeParticipants } from '../lib/participants'
import type { ParticipantDoc } from '../types/presentation'

/**
 * Assina a lista de participantes presentes na sala. Diferente das respostas:
 * quem abriu a sala já conta, mesmo sem ter respondido nada ainda.
 */
export function useParticipants(code: string | undefined): ParticipantDoc[] {
  const [participants, setParticipants] = useState<ParticipantDoc[]>([])

  useEffect(() => {
    if (!code) {
      setParticipants([])
      return
    }
    const unsub = subscribeParticipants(code, setParticipants)
    return unsub
  }, [code])

  return participants
}
