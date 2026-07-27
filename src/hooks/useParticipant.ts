import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth'
import { auth } from '../lib/firebase'

interface ParticipantState {
  uid: string | null
  error: string | null
}

/**
 * Garante uma sessão anônima do Firebase (sem cadastro) e devolve o uid.
 * O uid persiste entre recarregamentos no mesmo navegador.
 */
export function useParticipant(): ParticipantState {
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUid(user.uid)
      } else {
        signInAnonymously(auth).catch((e: unknown) => {
          setError(e instanceof Error ? e.message : 'Falha ao autenticar anonimamente.')
        })
      }
    })
    return unsub
  }, [])

  return { uid, error }
}
