import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  onSnapshot,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import { deleteAssets, uploadAssets } from './assets'
import { deleteFontDocs, uploadFonts } from './fonts'
import { generatePresenterToken, generateRoomCode } from './roomCode'
import { withDefaults } from '../utils/settings'
import type { Presentation, Room, RoomStatus, SlideTimers } from '../types/presentation'

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

/**
 * Limite prático do documento da sala. O Firestore aceita até 1 MiB; a conta
 * aqui é pelo JSON, um pouco maior que o tamanho real, então sobra folga.
 */
const MAX_ROOM_BYTES = 1_000_000

function assertRoomFits(data: object): void {
  const bytes = new Blob([JSON.stringify(data)]).size
  if (bytes > MAX_ROOM_BYTES) {
    throw new Error(
      `A apresentação ficou grande demais para uma sala (${Math.round(bytes / 1024)} KB; ` +
        'o limite do Firestore é 1 MiB por documento). Divida-a em menos slides ou encurte os textos.',
    )
  }
}

/** O que a sala já tem guardado nas subcoleções (para a edição só enviar o novo). */
export interface StoredRoomFiles {
  assetIds: string[]
  /** Documentos de cada fonte, pelo id da fonte. */
  fontDocIds: Record<string, string[]>
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
    // Imagens e fontes não entram no documento da sala: vão para as subcoleções.
    const { assets = {}, fonts = {}, ...content } = presentation
    const room: Room = {
      ...content,
      // O Firestore rejeita `undefined`: a sala sempre nasce com a configuração
      // completa, mesmo que a apresentação importada não a traga.
      settings: withDefaults(presentation.settings),
      creatorUid,
      currentSlideIndex: 0,
      status: 'live',
      createdAt: now,
      updatedAt: now,
      // Os cronômetros nascem vazios: cada um é iniciado pela tela do
      // apresentador quando o slide correspondente entra no ar.
      timers: {},
      revealedSlideIds: [],
    }
    assertRoomFits(room)
    // Sala + doc privado (token) numa escrita atômica.
    const batch = writeBatch(db)
    batch.set(ref, room)
    batch.set(presenterRef(code), { token, ownerUid: creatorUid, createdAt: now })
    await batch.commit()
    // Depois da sala, porque as regras só deixam o dono dela gravar imagens e fontes.
    try {
      await Promise.all([uploadAssets(code, Object.values(assets)), uploadFonts(code, Object.values(fonts))])
    } catch (e) {
      throw new Error(`A sala foi criada, mas as imagens ou fontes não foram enviadas: ${(e as Error).message}`)
    }
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

/**
 * Troca o slide atual e grava os cronômetros na mesma escrita — o slide que
 * sai é pausado e o que entra é iniciado/retomado de uma vez só (ver
 * `advanceTimers`). Separar as duas escritas abriria um intervalo em que a
 * plateia veria o novo slide com o tempo do anterior.
 */
export async function setCurrentSlide(
  code: string,
  index: number,
  timers: SlideTimers,
): Promise<void> {
  await updateDoc(roomRef(code), {
    currentSlideIndex: index,
    timers,
    updatedAt: Date.now(),
  })
}

/**
 * Grava os cronômetros sem trocar de slide — usado quando o apresentador abre
 * ou retoma a sala num slide cujo tempo ainda não começou (ou ficou pausado).
 */
export async function saveSlideTimers(
  code: string,
  timers: SlideTimers,
): Promise<void> {
  await updateDoc(roomRef(code), { timers, updatedAt: Date.now() })
}

/**
 * Registra que o suspense de um gabarito terminou. `arrayUnion` deixa a
 * escrita idempotente: repetir não duplica o id.
 */
export async function markAnswerRevealed(
  code: string,
  slideId: string,
): Promise<void> {
  await updateDoc(roomRef(code), {
    revealedSlideIds: arrayUnion(slideId),
    updatedAt: Date.now(),
  })
}

export async function setStatus(code: string, status: RoomStatus): Promise<void> {
  await updateDoc(roomRef(code), { status, updatedAt: Date.now() })
}

/**
 * Grava a apresentação editada numa sala já iniciada e a recomeça do primeiro
 * slide, numa escrita só.
 *
 * Recomeçar é o que mantém a sala coerente depois da edição: o slide no ar
 * pode ter mudado de lugar ou deixado de existir, e os cronômetros e gabaritos
 * já revelados se referem à versão anterior (um tempo novo nas opções, por
 * exemplo, só vale para cronômetros que ainda não começaram). Como todos os
 * navegadores seguem `currentSlideIndex`, a plateia volta ao início junto com
 * o apresentador, sem mensagem direta a ninguém.
 *
 * As respostas já enviadas ficam guardadas: cada uma pertence a um slide pelo
 * id, que a edição preserva, e só o próprio participante pode apagá-la.
 *
 * Imagens e fontes: `stored` diz o que a sala já tem. Só as novas são
 * enviadas (antes do documento, para nenhum aparelho ver um slide sem elas),
 * e as que deixaram de ser usadas são apagadas no fim.
 */
export async function saveAndRestartRoom(
  code: string,
  presentation: Presentation,
  stored: StoredRoomFiles = { assetIds: [], fontDocIds: {} },
): Promise<void> {
  const { assets = {}, fonts = {}, ...content } = presentation
  const storedAssets = new Set(stored.assetIds)
  const data = {
    title: content.title,
    slides: content.slides,
    // O Firestore rejeita `undefined`: grava a configuração completa.
    settings: withDefaults(content.settings),
    currentSlideIndex: 0,
    status: 'live',
    timers: {},
    revealedSlideIds: [],
    updatedAt: Date.now(),
  }
  assertRoomFits(data)
  await Promise.all([
    uploadAssets(
      code,
      Object.values(assets).filter((asset) => !storedAssets.has(asset.id)),
    ),
    uploadFonts(
      code,
      Object.values(fonts).filter((font) => !stored.fontDocIds[font.id]),
    ),
  ])
  await updateDoc(roomRef(code), {
    ...data,
    // Avisa quem está na sala que a apresentação mudou (ver `RoomPage`).
    revision: increment(1),
  })
  // Limpeza: falhar aqui só deixa uma imagem ou fonte sobrando, nada quebra.
  const unusedAssets = stored.assetIds.filter((id) => !assets[id])
  if (unusedAssets.length > 0) await deleteAssets(code, unusedAssets).catch(() => {})
  const unusedFontDocs = Object.entries(stored.fontDocIds)
    .filter(([id]) => !fonts[id])
    .flatMap(([, ids]) => ids)
  if (unusedFontDocs.length > 0) await deleteFontDocs(code, unusedFontDocs).catch(() => {})
}
