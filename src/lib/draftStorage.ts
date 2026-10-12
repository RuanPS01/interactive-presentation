import type { PresentationAssets, PresentationFonts } from '../types/presentation'

/**
 * Onde o rascunho do editor fica guardado neste navegador.
 *
 * - O texto (título, slides, opções) vai para o `localStorage`
 *   (`ip-editor-draft`): pequeno, síncrono e lido logo ao abrir.
 * - As imagens e as fontes vão para o IndexedDB: são data URLs grandes e
 *   passariam do limite do `localStorage` (cerca de 5 MB).
 *
 * Tudo em `try/catch`: sem armazenamento (navegação privada restrita), o
 * editor funciona como antes, só em memória.
 */

export const DRAFT_KEY = 'ip-editor-draft'
const DB_NAME = 'ip-editor'
const DB_STORE = 'draft'
const FILES_KEY = 'files'

export interface DraftFiles {
  assets: PresentationAssets
  fonts: PresentationFonts
}

export function readDraftText(): unknown {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

/** Grava o texto do rascunho. Lança se o navegador recusar (cota cheia). */
export function writeDraftText(value: unknown): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(value))
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir o IndexedDB'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(DB_STORE, mode)
      const request = run(tx.objectStore(DB_STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? new Error('Falha no IndexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('Operação cancelada no IndexedDB'))
    })
  } finally {
    db.close()
  }
}

export async function readDraftFiles(): Promise<DraftFiles | null> {
  try {
    const value = await withStore<unknown>('readonly', (store) => store.get(FILES_KEY))
    if (!value || typeof value !== 'object') return null
    const files = value as Partial<DraftFiles>
    return { assets: files.assets ?? {}, fonts: files.fonts ?? {} }
  } catch {
    return null
  }
}

export async function writeDraftFiles(files: DraftFiles): Promise<void> {
  await withStore('readwrite', (store) => store.put(files, FILES_KEY))
}

/** Apaga o rascunho inteiro (texto e arquivos). */
export async function clearDraftStorage(): Promise<void> {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // ignora
  }
  try {
    await withStore('readwrite', (store) => store.delete(FILES_KEY))
  } catch {
    // ignora
  }
}
