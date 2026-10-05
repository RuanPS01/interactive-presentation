import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { ParticipantDoc } from '../types/presentation'

/**
 * Presença na sala: um documento por participante, com id = uid.
 *
 * Existe para separar "quantas pessoas estão na sala" de "quantas responderam".
 * Antes o apresentador contava participantes a partir das respostas, então o
 * número só subia quando alguém votava. Agora o simples fato de abrir a sala
 * já registra o participante.
 */
export function participantsCol(code: string) {
  return collection(db, 'rooms', code, 'participants')
}

/**
 * Registra (ou atualiza) a presença do participante. É chamado ao abrir a sala
 * e sempre que o nome muda; não há heartbeat periódico, para não multiplicar
 * escritas no Firestore com plateias grandes.
 *
 * `joinedAt` só é gravado na criação: reentrar (recarregar a página, voltar
 * para a sala) não muda quando a pessoa chegou. `lastSeenAt` guarda a última
 * entrada.
 */
export async function joinRoom(
  code: string,
  uid: string,
  name?: string,
): Promise<void> {
  const ref = doc(participantsCol(code), uid)
  const now = Date.now()
  const existing = await getDoc(ref)
  const payload: Partial<ParticipantDoc> & { uid: string } = {
    uid,
    lastSeenAt: now,
    ...(existing.exists() ? {} : { joinedAt: now }),
    ...(name?.trim() ? { name: name.trim() } : {}),
  }
  // `merge` preserva os campos não enviados (o `joinedAt` e o nome).
  await setDoc(ref, payload, { merge: true })
}

/** Assina a lista de participantes da sala (visão do apresentador). */
export function subscribeParticipants(
  code: string,
  onData: (participants: ParticipantDoc[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    participantsCol(code),
    (snap) => onData(snap.docs.map((d) => d.data() as ParticipantDoc)),
    (error) => onError?.(error),
  )
}
