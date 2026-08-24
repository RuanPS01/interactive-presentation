import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { ResponseDoc, ResponseType } from '../types/presentation'

/**
 * Cada participante tem no máximo UM documento de resposta por slide
 * (id determinístico), o que permite reenviar/editar sem duplicar.
 */
export function responsesCol(code: string) {
  return collection(db, 'rooms', code, 'responses')
}

function responseId(slideId: string, participantUid: string): string {
  return `${slideId}__${participantUid}`
}

/** Salva (ou sobrescreve) a resposta do participante para o slide atual. */
export async function saveResponse(
  code: string,
  slideId: string,
  participantUid: string,
  type: ResponseType,
  value: string[],
  participantName?: string | null,
): Promise<void> {
  const payload: ResponseDoc = {
    slideId,
    participantUid,
    type,
    value,
    createdAt: Date.now(),
    // Só grava o nome quando a sala pede identificação (campo `undefined` não
    // é aceito pelo Firestore).
    ...(participantName?.trim() ? { participantName: participantName.trim() } : {}),
  }
  await setDoc(doc(responsesCol(code), responseId(slideId, participantUid)), payload)
}

/** Remove a resposta do participante (usado ao limpar/cancelar). */
export async function clearResponse(
  code: string,
  slideId: string,
  participantUid: string,
): Promise<void> {
  await deleteDoc(doc(responsesCol(code), responseId(slideId, participantUid)))
}

/** Assina todas as respostas de um slide (visão do apresentador). */
export function subscribeResponses(
  code: string,
  slideId: string,
  onData: (responses: ResponseDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(responsesCol(code), where('slideId', '==', slideId))
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as ResponseDoc)),
    (error) => onError?.(error),
  )
}

/** Busca (uma vez) todas as respostas da sala, de todos os slides. */
export async function getAllResponses(code: string): Promise<ResponseDoc[]> {
  const snap = await getDocs(responsesCol(code))
  return snap.docs.map((d) => d.data() as ResponseDoc)
}

/** Assina apenas a resposta do próprio participante (visão do aluno). */
export function subscribeMyResponse(
  code: string,
  slideId: string,
  participantUid: string,
  onData: (response: ResponseDoc | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(responsesCol(code), responseId(slideId, participantUid)),
    (snap) => onData(snap.exists() ? (snap.data() as ResponseDoc) : null),
    (error) => onError?.(error),
  )
}
