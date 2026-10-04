import { collection, doc, getDoc, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import type { PresentationAsset, PresentationAssets } from '../types/presentation'

/**
 * Imagens dos slides livres de uma sala: `rooms/{code}/assets/{assetId}`.
 *
 * Ficam fora do documento da sala porque ele tem limite de 1 MiB e é lido a
 * cada troca de slide por todos os aparelhos. Aqui cada imagem é lida uma vez
 * por aparelho (e guardada em memória): o id muda junto com o conteúdo, então
 * uma imagem com o mesmo id nunca fica desatualizada.
 */

interface AssetDoc {
  dataUrl: string
  width: number
  height: number
  createdAt: number
}

export function assetsCol(code: string) {
  return collection(db, 'rooms', code, 'assets')
}

/** Leituras em andamento ou concluídas, por `código/id`. */
const cache = new Map<string, Promise<PresentationAsset | null>>()

function cacheKey(code: string, id: string): string {
  return `${code}/${id}`
}

export function fetchAsset(code: string, id: string): Promise<PresentationAsset | null> {
  const key = cacheKey(code, id)
  let pending = cache.get(key)
  if (!pending) {
    pending = getDoc(doc(assetsCol(code), id))
      .then((snap) => {
        if (!snap.exists()) return null
        const data = snap.data() as AssetDoc
        return { id, dataUrl: data.dataUrl, width: data.width, height: data.height }
      })
      .catch((error: unknown) => {
        // Falha de rede não pode ficar guardada: a próxima tentativa lê de novo.
        cache.delete(key)
        throw error
      })
    cache.set(key, pending)
  }
  return pending
}

/** Lê várias imagens; as que não existirem (ou falharem) ficam de fora. */
export async function fetchAssets(code: string, ids: string[]): Promise<PresentationAssets> {
  const results = await Promise.allSettled(ids.map((id) => fetchAsset(code, id)))
  const found: PresentationAssets = {}
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value) found[result.value.id] = result.value
  })
  return found
}

/**
 * Lote do Firestore: até 10 MiB por requisição, e as regras de cada escrita
 * consultam o documento da sala. Lotes pequenos ficam longe dos dois limites.
 */
const BATCH_MAX_CHARS = 7_000_000
const BATCH_MAX_DOCS = 8

/** Grava as imagens na sala (só o dono consegue; ver firestore.rules). */
export async function uploadAssets(code: string, assets: PresentationAsset[]): Promise<void> {
  let batch = writeBatch(db)
  let size = 0
  let count = 0
  const commits: Promise<void>[] = []
  for (const asset of assets) {
    if (count > 0 && (size + asset.dataUrl.length > BATCH_MAX_CHARS || count >= BATCH_MAX_DOCS)) {
      commits.push(batch.commit())
      batch = writeBatch(db)
      size = 0
      count = 0
    }
    const data: AssetDoc = {
      dataUrl: asset.dataUrl,
      width: asset.width,
      height: asset.height,
      createdAt: Date.now(),
    }
    batch.set(doc(assetsCol(code), asset.id), data)
    size += asset.dataUrl.length
    count++
    // Quem enviou já tem a imagem: não precisa baixá-la de volta.
    cache.set(cacheKey(code, asset.id), Promise.resolve(asset))
  }
  if (count > 0) commits.push(batch.commit())
  await Promise.all(commits)
}

/** Apaga imagens que nenhum slide usa mais. */
export async function deleteAssets(code: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db)
    for (const id of ids.slice(i, i + 400)) {
      batch.delete(doc(assetsCol(code), id))
      cache.delete(cacheKey(code, id))
    }
    await batch.commit()
  }
}
