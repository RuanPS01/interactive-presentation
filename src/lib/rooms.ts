import {
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { generatePresenterToken, generateRoomCode } from './roomCode'
import { withDefaults } from '../utils/settings'
import type {
  Presentation,
  PresentationSettings,
  Room,
  RoomStatus,
  Slide,
} from '../types/presentation'

const ROOMS = 'rooms'

export function roomRef(code: string) {
  return doc(db, ROOMS, code)
}

/**
 * Documento privado da sala (subcoleção `private`). Guarda o token secreto do
 * apresentador. As regras do Firestore proíbem leitura por clientes, então os
 * participantes nunca veem o token — só quem já o tem (pela URL) consegue
 * reivindicar o controle. Ver firestore.rules.
 */
export function presenterRef(code: string) {
  return doc(db, ROOMS, code, 'private', 'presenter')
}

export interface CreatedRoom {
  code: string
  /** Token secreto do apresentador (vai na URL de apresentação). */
  token: string
}

/**
 * Cria uma sala com um código único, grava a apresentação inicial e um token
 * secreto de apresentador. Retorna o código e o token.
 */
export async function createRoom(
  creatorUid: string,
  presentation: Presentation,
): Promise<CreatedRoom> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode()
    const ref = roomRef(code)
    const existing = await getDoc(ref)
    if (existing.exists()) continue

    const now = Date.now()
    const token = generatePresenterToken()
    const room: Room = {
      ...presentation,
      // O Firestore rejeita `undefined`: a sala sempre nasce com a configuração
      // completa, mesmo que a apresentação importada não a traga.
      settings: withDefaults(presentation.settings),
      creatorUid,
      currentSlideIndex: 0,
      status: 'live',
      createdAt: now,
      updatedAt: now,
    }
    // Sala + doc privado (token) numa escrita atômica.
    const batch = writeBatch(db)
    batch.set(ref, room)
    batch.set(presenterRef(code), { token, ownerUid: creatorUid, createdAt: now })
    await batch.commit()
    return { code, token }
  }
  throw new Error('Não foi possível gerar um código de sala único. Tente novamente.')
}

/**
 * Reivindica o controle da sala provando posse do token (ex.: apresentador
 * recarregou a página ou trocou de navegador). O uid atual passa a ser o dono.
 * Lança se o token estiver errado (as regras rejeitam a escrita).
 */
export async function claimPresenter(
  code: string,
  uid: string,
  token: string,
): Promise<void> {
  // 1) Prova o token: só é aceito se `token` bater com o armazenado (regras).
  //    É este passo que concede (ou nega) o controle.
  await updateDoc(presenterRef(code), { ownerUid: uid, token })
  // 2) Otimização: assume a posse pública para as escritas seguintes (troca de
  //    slide) não precisarem consultar o doc privado. As regras já autorizam
  //    pelo ownerUid, então uma falha aqui não impede apresentar.
  try {
    await updateDoc(roomRef(code), { creatorUid: uid, updatedAt: Date.now() })
  } catch {
    /* segue com o controle concedido pelo doc privado */
  }
}

export async function getRoom(code: string): Promise<Room | null> {
  const snap = await getDoc(roomRef(code))
  return snap.exists() ? (snap.data() as Room) : null
}

/** Assina atualizações em tempo real do documento da sala. */
export function subscribeRoom(
  code: string,
  onData: (room: Room | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    roomRef(code),
    (snap) => onData(snap.exists() ? (snap.data() as Room) : null),
    (error) => onError?.(error),
  )
}

export async function setCurrentSlide(code: string, index: number): Promise<void> {
  await updateDoc(roomRef(code), { currentSlideIndex: index, updatedAt: Date.now() })
}

export async function setStatus(code: string, status: RoomStatus): Promise<void> {
  await updateDoc(roomRef(code), { status, updatedAt: Date.now() })
}

/** Atualiza os slides de uma sala já criada (edição durante a apresentação). */
export async function updateSlides(code: string, slides: Slide[]): Promise<void> {
  await updateDoc(roomRef(code), { slides, updatedAt: Date.now() })
}

/** Atualiza as opções globais de uma sala já criada. */
export async function updateSettings(
  code: string,
  settings: PresentationSettings,
): Promise<void> {
  await updateDoc(roomRef(code), { settings, updatedAt: Date.now() })
}
