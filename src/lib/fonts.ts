import { collection, doc, getDocs, writeBatch } from 'firebase/firestore'
import type { PresentationFont, PresentationFonts } from '../types/presentation'
import { registerFonts } from '../utils/fonts/faces'
import { db } from './firebase'

/**
 * Fontes embutidas de uma sala: `rooms/{code}/fonts`.
 *
 * Como as imagens, ficam fora do documento da sala (limite de 1 MiB e leitura
 * a cada troca de slide). Uma fonte pode passar do limite de um documento, então
 * é dividida em partes: `{id}`, `{id}~1`, `{id}~2`... Cada aparelho lê a
 * coleção inteira uma vez por versão da sala e junta as partes.
 */

interface FontDoc {
  fontId: string
  family: string
  weight: PresentationFont['weight']
  style: PresentationFont['style']
  part: number
  parts: number
  /** Pedaço do `dataUrl`. */
  data: string
  createdAt: number
}

/** Tamanho de cada parte, longe do limite de 1 MiB do documento. */
const CHUNK_CHARS = 700_000
const BATCH_MAX_CHARS = 7_000_000
const BATCH_MAX_DOCS = 8

export interface RoomFonts {
  fonts: PresentationFonts
  /** Documentos de cada fonte (para apagar todas as partes). */
  docIds: Record<string, string[]>
}

export function fontsCol(code: string) {
  return collection(db, 'rooms', code, 'fonts')
}

/** Leituras por `código#revisão`: uma edição da sala pode trocar as fontes. */
const cache = new Map<string, Promise<RoomFonts>>()

export function fetchRoomFonts(code: string, revision = 0): Promise<RoomFonts> {
  const key = `${code}#${revision}`
  let pending = cache.get(key)
  if (!pending) {
    pending = getDocs(fontsCol(code))
      .then((snap) => {
        const groups = new Map<string, { meta: FontDoc; parts: string[]; ids: string[] }>()
        snap.forEach((d) => {
          const data = d.data() as FontDoc
          let group = groups.get(data.fontId)
          if (!group) {
            group = { meta: data, parts: [], ids: [] }
            groups.set(data.fontId, group)
          }
          group.parts[data.part] = data.data
          group.ids.push(d.id)
        })
        const result: RoomFonts = { fonts: {}, docIds: {} }
        for (const [id, { meta, parts, ids }] of groups) {
          result.docIds[id] = ids
          // Uma fonte com parte faltando fica de fora: o texto usa a próxima da lista.
          if (parts.length !== meta.parts || parts.some((p) => p === undefined)) continue
          result.fonts[id] = { id, family: meta.family, weight: meta.weight, style: meta.style, dataUrl: parts.join('') }
        }
        return result
      })
      .catch((error: unknown) => {
        cache.delete(key)
        throw error
      })
    cache.set(key, pending)
  }
  return pending
}

/** Lê as fontes da sala e as registra no navegador (texto e canvas). */
export async function loadRoomFonts(code: string, revision = 0): Promise<void> {
  const { fonts } = await fetchRoomFonts(code, revision)
  await registerFonts(Object.values(fonts))
}

function fontDocs(font: PresentationFont): { id: string; data: FontDoc }[] {
  const parts = Math.max(1, Math.ceil(font.dataUrl.length / CHUNK_CHARS))
  const createdAt = Date.now()
  return Array.from({ length: parts }, (_, part) => ({
    id: part === 0 ? font.id : `${font.id}~${part}`,
    data: {
      fontId: font.id,
      family: font.family,
      weight: font.weight,
      style: font.style,
      part,
      parts,
      data: font.dataUrl.slice(part * CHUNK_CHARS, (part + 1) * CHUNK_CHARS),
      createdAt,
    },
  }))
}

/** Grava as fontes na sala (só o dono consegue; ver firestore.rules). */
export async function uploadFonts(code: string, fonts: PresentationFont[]): Promise<void> {
  let batch = writeBatch(db)
  let size = 0
  let count = 0
  const commits: Promise<void>[] = []
  for (const font of fonts) {
    for (const { id, data } of fontDocs(font)) {
      if (count > 0 && (size + data.data.length > BATCH_MAX_CHARS || count >= BATCH_MAX_DOCS)) {
        commits.push(batch.commit())
        batch = writeBatch(db)
        size = 0
        count = 0
      }
      batch.set(doc(fontsCol(code), id), data)
      size += data.data.length
      count++
    }
  }
  if (count > 0) commits.push(batch.commit())
  await Promise.all(commits)
}

/** Apaga documentos de fontes que nenhum slide usa mais. */
export async function deleteFontDocs(code: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) batch.delete(doc(fontsCol(code), id))
    await batch.commit()
  }
}
