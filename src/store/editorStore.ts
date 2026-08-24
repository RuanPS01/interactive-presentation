import { create } from 'zustand'
import type {
  AnswerSlide,
  Presentation,
  PresentationSettings,
  Slide,
  SlideOverrides,
  SlideType,
} from '../types/presentation'
import { createAnswerSlide, createDefaultSlide } from '../utils/slideFactory'
import { DEFAULT_SETTINGS, withDefaults } from '../utils/settings'

interface EditorState {
  title: string
  slides: Slide[]
  settings: PresentationSettings
  selectedIndex: number

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
  select: (index: number) => void

  loadPresentation: (presentation: Presentation) => void
  getPresentation: () => Presentation
  reset: () => void
}

const INITIAL = {
  title: 'Minha apresentação',
  slides: [] as Slide[],
  settings: DEFAULT_SETTINGS,
  selectedIndex: 0,
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

export const useEditorStore = create<EditorState>((set, get) => ({
  ...INITIAL,

  setTitle: (title) => set({ title }),

  updateSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  setOverride: (id, key, value) =>
    set((s) => ({
      slides: s.slides.map((slide) => {
        if (slide.id !== id) return slide
        const overrides = { ...(slide.overrides ?? {}) }
        if (value === undefined) delete overrides[key]
        else overrides[key] = value
        return (
          Object.keys(overrides).length > 0
            ? { ...slide, overrides }
            : // Sem sobrescritas o campo some, e o slide volta a herdar tudo.
              { ...slide, overrides: undefined }
        ) as Slide
      }),
    })),

  addSlide: (type) =>
    set((s) => {
      const slide = createDefaultSlide(type)
      return applySlides([...s.slides, slide], slide.id, s.slides.length)
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
      return applySlides(slides, undefined, s.selectedIndex)
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

  select: (index) => set((s) => ({ selectedIndex: clampIndex(index, s.slides.length) })),

  loadPresentation: (presentation) =>
    set({
      title: presentation.title,
      settings: withDefaults(presentation.settings),
      ...applySlides(presentation.slides, undefined, 0),
      selectedIndex: 0,
    }),

  getPresentation: () => {
    const { title, slides, settings } = get()
    return { title, slides, settings }
  },

  reset: () => set({ ...INITIAL, slides: [] }),
}))
