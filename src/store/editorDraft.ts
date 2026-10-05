import { create } from 'zustand'
import {
  clearDraftStorage,
  readDraftFiles,
  readDraftText,
  writeDraftFiles,
  writeDraftText,
} from '../lib/draftStorage'
import type { Presentation } from '../types/presentation'
import { pickFonts } from '../utils/fonts/faces'
import { pickAssets } from '../utils/freeSlide'
import { presentationShapeSchema } from '../utils/validation'
import type { EditorStore } from './editorStore'

/**
 * Rascunho do editor de CRIAÇÃO guardado neste navegador: recarregar a página
 * (ou fechar e voltar) não perde a apresentação em montagem. O editor da
 * edição de sala não usa isto: ele parte sempre do que está no ar.
 */

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'error'

export const useDraftStatus = create<{ status: DraftStatus }>(() => ({ status: 'idle' }))

/** Espera depois da última mudança antes de gravar. */
const SAVE_DELAY_MS = 600
const INITIAL_TITLE = 'Minha apresentação'

interface DraftText {
  version: 1
  title: string
  slides: unknown
  settings: unknown
  selectedIndex: number
  savedAt: number
}

let started = false
let timer: number | undefined
let target: EditorStore | null = null
/** Imagens e fontes da última gravação no IndexedDB (ids), para não regravar à toa. */
let savedFilesKey: string | null = null

function isPristine(store: EditorStore): boolean {
  const state = store.getState()
  return state.slides.length === 0 && state.title === INITIAL_TITLE
}

/**
 * Restaura o texto do rascunho na hora (sem piscar o editor vazio) e as
 * imagens e fontes logo depois, quando o IndexedDB responder.
 */
function hydrate(store: EditorStore): Promise<void> {
  const text = readDraftText() as Partial<DraftText> | null
  if (!text || !isPristine(store)) return Promise.resolve()
  const parsed = presentationShapeSchema.safeParse({
    title: text.title,
    slides: text.slides,
    settings: text.settings,
  })
  if (!parsed.success) return Promise.resolve()
  const state = store.getState()
  state.loadPresentation(parsed.data as Presentation)
  if (typeof text.selectedIndex === 'number') state.select(text.selectedIndex)
  useDraftStatus.setState({ status: 'saved' })
  return readDraftFiles().then((files) => {
    if (!files) return
    // Valida os arquivos antes de entregá-los ao editor (vão direto para o CSS).
    const checked = presentationShapeSchema.safeParse({
      title: '',
      slides: [],
      assets: files.assets,
      fonts: files.fonts,
    })
    if (!checked.success) return
    store.setState((s) => ({
      assets: { ...(checked.data.assets ?? {}), ...s.assets },
      fonts: { ...(checked.data.fonts ?? {}), ...s.fonts },
    }))
  })
}

async function save(): Promise<void> {
  timer = undefined
  if (!target) return
  const s = target.getState()
  try {
    const text: DraftText = {
      version: 1,
      title: s.title,
      slides: s.slides,
      settings: s.settings,
      selectedIndex: s.selectedIndex,
      savedAt: Date.now(),
    }
    writeDraftText(text)
    // Só o que algum slide usa: imagens e fontes removidas não ficam guardadas.
    // E só quando o conjunto muda: digitar um texto não regrava megabytes.
    const assets = pickAssets(s.assets, s.slides)
    const fonts = pickFonts(s.fonts, s.slides)
    const filesKey = `${Object.keys(assets).sort().join('|')}#${Object.keys(fonts).sort().join('|')}`
    if (filesKey !== savedFilesKey) {
      await writeDraftFiles({ assets, fonts })
      savedFilesKey = filesKey
    }
    useDraftStatus.setState({ status: 'saved' })
  } catch {
    useDraftStatus.setState({ status: 'error' })
  }
}

/**
 * Liga o rascunho no editor da tela de criação. Idempotente: a primeira
 * chamada restaura o que estava guardado e passa a gravar cada mudança.
 */
export function startDraftPersistence(store: EditorStore): void {
  if (started) return
  started = true
  target = store
  const hydrated = hydrate(store)
  void hydrated.finally(() => {
    store.subscribe((state, prev) => {
      const changed =
        state.assets !== prev.assets ||
        state.fonts !== prev.fonts ||
        state.title !== prev.title ||
        state.slides !== prev.slides ||
        state.settings !== prev.settings ||
        state.selectedIndex !== prev.selectedIndex
      if (!changed) return
      useDraftStatus.setState({ status: 'saving' })
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void save(), SAVE_DELAY_MS)
    })
    // Fechar a aba com uma gravação pendente: grava o que der na hora.
    window.addEventListener('pagehide', () => {
      if (timer !== undefined) {
        window.clearTimeout(timer)
        void save()
      }
    })
  })
}

/** "Começar do zero": esvazia o editor e apaga o rascunho deste navegador. */
export async function discardDraft(store: EditorStore): Promise<void> {
  store.getState().reset()
  window.clearTimeout(timer)
  timer = undefined
  savedFilesKey = null
  await clearDraftStorage()
  useDraftStatus.setState({ status: 'idle' })
}
