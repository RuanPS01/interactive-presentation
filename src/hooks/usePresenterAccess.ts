import { useEffect, useRef, useState } from 'react'
import { claimPresenter } from '../lib/rooms'
import { savePresenterSession } from '../lib/presenterSessions'
import type { Room } from '../types/presentation'

export type PresenterAccess = 'checking' | 'granted' | 'denied'

/**
 * Decide se este navegador controla a sala: apresentar e editar exigem a mesma
 * prova. Vale quem já é o dono (mesmo uid) ou quem tem o token secreto da URL,
 * que reivindica o controle (recarregou a página ou trocou de navegador). A
 * plateia, que só tem o código, recebe `denied`.
 *
 * Com o acesso concedido, a sala fica lembrada neste dispositivo para a tela
 * inicial oferecer "Retomar" e "Exportar PDF".
 */
export function usePresenterAccess(
  code: string | undefined,
  token: string | undefined,
  room: Room | null,
  uid: string | null,
): PresenterAccess {
  const [access, setAccess] = useState<PresenterAccess>('checking')
  const claimTriedRef = useRef(false)

  const creatorUid = room?.creatorUid
  useEffect(() => {
    if (!code || !creatorUid || !uid) return // ainda carregando
    if (access !== 'checking') return // já decidido
    if (creatorUid === uid) {
      // Já é o dono neste navegador (criou a sala ou já reivindicou).
      setAccess('granted')
      return
    }
    if (!token) {
      setAccess('denied')
      return
    }
    if (claimTriedRef.current) return
    claimTriedRef.current = true
    // Recarregou ou trocou de navegador: prova o token e reassume o controle.
    claimPresenter(code, uid, token)
      .then(() => setAccess('granted'))
      .catch(() => setAccess('denied'))
  }, [code, creatorUid, uid, token, access])

  const roomTitle = room?.title
  useEffect(() => {
    if (access === 'granted' && code && token) {
      savePresenterSession({ code, token, title: roomTitle ?? '' })
    }
  }, [access, code, token, roomTitle])

  return access
}
