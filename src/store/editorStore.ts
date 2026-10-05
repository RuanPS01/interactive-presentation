import { createContext, useContext } from 'react'
import { createStore, useStore } from 'zustand'
import type { StoreApi } from 'zustand'
import type {
  AnswerSlide,
  FreeElement,
  FreeSlide,
  Presentation,
  PresentationAsset,
  PresentationAssets,
  PresentationFont,
  PresentationFonts,
  PresentationSettings,
  Slide,
  SlideOverrides,
  SlideType,
} from '../types/presentation'
import { pickFonts } from '../utils/fonts/faces'
import { fitFreeSlideToFrame, pickAssets } from '../utils/freeSlide'
import { createAnswerSlide, createDefaultSlide } from '../utils/slideFactory'
import { DEFAULT_SETTINGS, SLIDE_FRAMES, withDefaults } from '../utils/settings'

/** Trecho selecionado no texto em edição (deslocamentos no texto corrido). */
export interface TextSelection {
  elementId: string
  start: number
  end: number
}

export interface EditorState {
  title: string
  slides: Slide[]
  settings: PresentationSettings
  selectedIndex: number
  /** Imagens dos slides livres, pelo id. */
  assets: PresentationAssets
  /** Fontes embutidas (de PowerPoints importados), pelo id. */
  fonts: PresentationFonts
  /** Elemento selecionado no slide livre aberto. */
  selectedElementId: string | null
  /** Caixa de texto com edição aberta (cursor dentro dela). */
  editingElementId: string | null
  /** Última seleção feita no texto em edição; os controles de estilo usam esta. */
  textSelection: TextSelection | null

  setTitle: (title: string) => void
  updateSettings: (patch: Partial<PresentationSettings>) => void
  /** Sobrescritas de um slide; `undefined` no valor volta a herdar o global. */
  setOverride: <K extends keyof SlideOverrides>(
    id: string,
    key: K,
    value: SlideOverrides[K],
  ) => void

  addSlide: (type: SlideType) => void
  updateSlide: (id: string, patch: Partial<Slide>) => void
  removeSlide: (id: string) => void
  moveSlide: (from: number, to: number) => void
  /**
   * Nova ordem pela lista de ids (o arraste na lista de slides). A seleção
   * fica no mesmo slide, e cada gabarito volta para logo depois da pergunta.
   */
  reorderSlides: (ids: string[]) => void
  select: (index: number) => void

  addAssets: (assets: PresentationAsset[]) => void
  selectElement: (id: string | null) => void
  setEditingElement: (id: string | null) => void
  setTextSelection: (selection: TextSelection | null) => void
  /** Altera um elemento de um slide livre. */
  updateElement: (slideId: string, elementId: string, patch: Partial<FreeElement>) => void
  /** Troca a lista de elementos de um slide livre (adicionar, remover, reordenar). */
  setElements: (slideId: string, elements: FreeElement[]) => void
  /** Acrescenta slides (de um PPTX importado) depois dos existentes. */
  appendSlides: (slides: Slide[], assets: PresentationAsset[], fonts?: PresentationFont[]) => void

  loadPresentation: (presentation: Presentation) => void
  getPresentation: () => Presentation
  reset: () => void
}

const INITIAL = {
  title: 'Minha apresentação',
  slides: [] as Slide[],
  settings: DEFAULT_SETTINGS,
  selectedIndex: 0,
  assets: {} as PresentationAssets,
  fonts: {} as PresentationFonts,
  selectedElementId: null,
  editingElementId: null,
  textSelection: null,
}

/** Sem elemento selecionado nem texto em edição (ao trocar de slide, por exemplo). */
const NO_ELEMENT = { selectedElementId: null, editingElementId: null, textSelection: null }

function mapFreeSlide(
  slides: Slide[],
  slideId: string,
  change: (slide: FreeSlide) => FreeSlide,
): Slide[] {
  return slides.map((slide) => (slide.id === slideId && slide.type === 'free' ? change(slide) : slide))
}

const clampIndex = (index: number, length: number): number => {
  if (length === 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

/**
 * Mantém os slides de gabarito em dia: todo `quiz` com `revealAnswer` ganha um
 * slide `answer` logo depois; desligar a opção (ou apagar o quiz) remove o
 * gabarito. Reaproveita o slide existente para preservar id, título e ajustes.
 */
function syncAnswerSlides(slides: Slide[]): Slide[] {
  const existing = new Map<string, AnswerSlide>()
  for (const slide of slides) {
    if (slide.type === 'answer' && !existing.has(slide.quizSlideId)) {
      existing.set(slide.quizSlideId, slide)
    }
  }

  const result: Slide[] = []
  for (const slide of slides) {
    // Os `answer` são reinseridos ao lado do seu quiz (ou descartados, se o
    // quiz sumiu ou desligou a revelação).
    if (slide.type === 'answer') continue
    result.push(slide)
    if (slide.type === 'quiz' && slide.revealAnswer) {
      result.push(existing.get(slide.id) ?? createAnswerSlide(slide.id, 'Resposta correta'))
    }
  }
  return result
}

/** Aplica uma nova lista de slides mantendo a seleção no mesmo slide. */
function applySlides(
  slides: Slide[],
  keepId: string | undefined,
  fallbackIndex: number,
): Pick<EditorState, 'slides' | 'selectedIndex'> {
  const synced = syncAnswerSlides(slides)
  const found = keepId ? synced.findIndex((s) => s.id === keepId) : -1
  return {
    slides: synced,
    selectedIndex: found >= 0 ? found : clampIndex(fallbackIndex, synced.length),
  }
}

export type EditorStore = StoreApi<EditorState>

/**
 * Cria um editor independente. A tela de criação usa um que vive enquanto a
 * aba estiver aberta; a edição de uma sala em andamento cria o seu, para não
 * sobrescrever o rascunho de quem estava montando outra apresentação.
 */
export function createEditorStore(): EditorStore {
  return createStore<EditorState>()((set, get) => ({
    ...INITIAL,

    setTitle: (title) => set({ title }),

    updateSettings: (patch) =>
      set((s) => {
        const settings = { ...s.settings, ...patch }
        if (!patch.slideAspect || patch.slideAspect === s.settings.slideAspect) return { settings }
        // Trocar o formato leva junto os slides livres que estavam na moldura
        // antiga; um slide com tamanho próprio (de um PPTX diferente) fica como está.
        const from = SLIDE_FRAMES[s.settings.slideAspect]
        const to = SLIDE_FRAMES[patch.slideAspect]
        const slides = s.slides.map((slide) =>
          slide.type === 'free' && slide.width === from.width && slide.height === from.height
            ? fitFreeSlideToFrame(slide, to)
            : slide,
        )
        return { settings, slides }
      }),

    setOverride: (id, key, value) =>
      set((s) => ({
        slides: s.slides.map((slide) => {
          if (slide.id !== id) return slide
          const overrides = { ...(slide.overrides ?? {}) }
          if (value === undefined) delete overrides[key]
          else overrides[key] = value
          if (Object.keys(overrides).length > 0) return { ...slide, overrides } as Slide
          // Sem sobrescritas o campo some, e o slide volta a herdar tudo. Apagar
          // a chave (em vez de deixá-la `undefined`) importa: o Firestore recusa
          // `undefined` ao gravar a sala.
          const inheriting = { ...slide }
          delete inheriting.overrides
          return inheriting
        }),
      })),

    addSlide: (type) =>
      set((s) => {
        const slide = createDefaultSlide(type, s.settings.slideAspect)
        return { ...applySlides([...s.slides, slide], slide.id, s.slides.length), ...NO_ELEMENT }
      }),

    updateSlide: (id, patch) =>
      set((s) => {
        const slides = s.slides.map((slide) =>
          slide.id === id ? ({ ...slide, ...patch } as Slide) : slide,
        )
        return applySlides(slides, id, s.selectedIndex)
      }),

    removeSlide: (id) =>
      set((s) => {
        const target = s.slides.find((slide) => slide.id === id)
        // Apagar um gabarito equivale a desligar a revelação no quiz de origem.
        const slides =
          target?.type === 'answer'
            ? s.slides.map((slide) =>
                slide.id === target.quizSlideId && slide.type === 'quiz'
                  ? { ...slide, revealAnswer: false }
                  : slide,
              )
            : s.slides.filter((slide) => slide.id !== id)
        return { ...applySlides(slides, undefined, s.selectedIndex), ...NO_ELEMENT }
      }),

    moveSlide: (from, to) =>
      set((s) => {
        if (to < 0 || to >= s.slides.length) return s
        const slides = [...s.slides]
        const [moved] = slides.splice(from, 1)
        slides.splice(to, 0, moved)
        // O gabarito acompanha o quiz: `syncAnswerSlides` o recoloca em seguida.
        return applySlides(slides, moved.id, to)
      }),

    reorderSlides: (ids) =>
      set((s) => {
        const byId = new Map(s.slides.map((slide) => [slide.id, slide]))
        const ordered = ids.map((id) => byId.get(id)).filter((x): x is Slide => Boolean(x))
        // Um id que a lista não trouxe (slide criado durante o arraste) não se perde.
        const seen = new Set(ordered.map((slide) => slide.id))
        const slides = [...ordered, ...s.slides.filter((slide) => !seen.has(slide.id))]
        // Nada mudou: não gera estado novo (nem renderização).
        if (slides.every((slide, i) => slide.id === s.slides[i]?.id)) return {}
        return applySlides(slides, s.slides[s.selectedIndex]?.id, s.selectedIndex)
      }),

    select: (index) =>
      set((s) => {
        const selectedIndex = clampIndex(index, s.slides.length)
        return selectedIndex === s.selectedIndex ? {} : { selectedIndex, ...NO_ELEMENT }
      }),

    addAssets: (assets) =>
      set((s) => {
        if (assets.every((a) => s.assets[a.id])) return {}
        const next = { ...s.assets }
        for (const asset of assets) next[asset.id] = asset
        return { assets: next }
      }),

    selectElement: (id) =>
      set((s) =>
        id === s.selectedElementId
          ? {}
          : { selectedElementId: id, editingElementId: null, textSelection: null },
      ),

    setEditingElement: (id) =>
      set((s) => ({
        editingElementId: id,
        selectedElementId: id ?? s.selectedElementId,
        textSelection: id ? s.textSelection : null,
      })),

    setTextSelection: (textSelection) => set({ textSelection }),

    updateElement: (slideId, elementId, patch) =>
      set((s) => ({
        slides: mapFreeSlide(s.slides, slideId, (slide) => ({
          ...slide,
          elements: slide.elements.map((element) =>
            element.id === elementId ? ({ ...element, ...patch } as FreeElement) : element,
          ),
        })),
      })),

    setElements: (slideId, elements) =>
      set((s) => {
        const slides = mapFreeSlide(s.slides, slideId, (slide) => ({ ...slide, elements }))
        // Um elemento que saiu da lista não pode continuar selecionado.
        const gone = (id: string | null) => id !== null && !elements.some((e) => e.id === id)
        return {
          slides,
          ...(gone(s.selectedElementId) || gone(s.editingElementId) ? NO_ELEMENT : {}),
        }
      }),

    appendSlides: (slides, assets, fonts = []) =>
      set((s) => {
        const nextAssets = { ...s.assets }
        for (const asset of assets) nextAssets[asset.id] = asset
        const nextFonts = { ...s.fonts }
        for (const font of fonts) nextFonts[font.id] = font
        const first = slides[0]
        return {
          assets: nextAssets,
          fonts: nextFonts,
          ...applySlides([...s.slides, ...slides], first?.id, s.slides.length),
          ...NO_ELEMENT,
        }
      }),

    loadPresentation: (presentation) =>
      set({
        title: presentation.title,
        settings: withDefaults(presentation.settings),
        ...applySlides(presentation.slides, undefined, 0),
        selectedIndex: 0,
        assets: presentation.assets ?? {},
        fonts: presentation.fonts ?? {},
        ...NO_ELEMENT,
      }),

    getPresentation: () => {
      const { title, slides, settings, assets, fonts } = get()
      // Só as imagens e as fontes ainda em uso; sem nenhuma, o campo nem
      // aparece no JSON.
      const presentation: Presentation = { title, slides, settings }
      const usedAssets = pickAssets(assets, slides)
      if (Object.keys(usedAssets).length > 0) presentation.assets = usedAssets
      const usedFonts = pickFonts(fonts, slides)
      if (Object.keys(usedFonts).length > 0) presentation.fonts = usedFonts
      return presentation
    },

    reset: () => set({ ...INITIAL, slides: [] }),
  }))
}

/**
 * Editor que os componentes de `components/editor/` enxergam. Sem provedor em
 * volta, é o da tela de criação (`defaultEditorStore`, cujo rascunho é
 * guardado no navegador, ver `store/editorDraft.ts`); a edição de sala troca
 * por um editor próprio.
 */
export const defaultEditorStore = createEditorStore()

export const EditorStoreContext = createContext<EditorStore>(defaultEditorStore)

/** Lê (e assina) uma parte do editor em uso. */
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(useContext(EditorStoreContext), selector)
}

/**
 * O editor em uso, para ler o estado atual fora da renderização (ao terminar
 * uma tarefa assíncrona, por exemplo, quando o slide pode já ter mudado).
 */
export function useEditorStoreApi(): EditorStore {
  return useContext(EditorStoreContext)
}
