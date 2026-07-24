import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import { generateRoomCode } from './roomCode'
import type {
  Presentation,
  Room,
  RoomStatus,
  Slide,
  ThemeMode,
} from '../types/presentation'

const ROOMS = 'rooms'

export function roomRef(code: string) {
  return doc(db, ROOMS, code)
}

/**
 * Cria uma sala com um código único e grava a apresentação inicial.
 * Retorna o código gerado.
 */
export async function createRoom(
  creatorUid: string,
  presentation: Presentation,
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode()
    const ref = roomRef(code)
    const existing = await getDoc(ref)
    if (existing.exists()) continue

    const now = Date.now()
    const room: Room = {
      ...presentation,
      creatorUid,
      currentSlideIndex: 0,
      status: 'live',
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(ref, room)
    return code
  }
  throw new Error('Não foi possível gerar um código de sala único. Tente novamente.')
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

export async function setTheme(code: string, theme: ThemeMode): Promise<void> {
  await updateDoc(roomRef(code), { theme, updatedAt: Date.now() })
}

export async function setStatus(code: string, status: RoomStatus): Promise<void> {
  await updateDoc(roomRef(code), { status, updatedAt: Date.now() })
}

/** Atualiza os slides de uma sala já criada (edição durante a apresentação). */
export async function updateSlides(code: string, slides: Slide[]): Promise<void> {
  await updateDoc(roomRef(code), { slides, updatedAt: Date.now() })
}
