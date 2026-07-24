import { create } from 'zustand'
import type {
  Presentation,
  Slide,
  SlideType,
  ThemeMode,
} from '../types/presentation'
import { createDefaultSlide } from '../utils/slideFactory'

interface EditorState {
  title: string
  theme: ThemeMode
  slides: Slide[]
  selectedIndex: number

  setTitle: (title: string) => void
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void

  addSlide: (type: SlideType) => void
  updateSlide: (id: string, patch: Partial<Slide>) => void
  removeSlide: (id: string) => void
  moveSlide: (from: number, to: number) => void
  select: (index: number) => void

  loadPresentation: (presentation: Presentation) => void
  getPresentation: () => Presentation
  reset: () => void
}

const INITIAL: Pick<EditorState, 'title' | 'theme' | 'slides' | 'selectedIndex'> = {
  title: 'Minha apresentação',
  theme: 'light',
  slides: [],
  selectedIndex: 0,
}

const clampIndex = (index: number, length: number): number => {
  if (length === 0) return 0
  return Math.max(0, Math.min(index, length - 1))
}

export const useEditorStore = create<EditorState>((set, get) => ({
  ...INITIAL,

  setTitle: (title) => set({ title }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  addSlide: (type) =>
    set((s) => {
      const slides = [...s.slides, createDefaultSlide(type)]
      return { slides, selectedIndex: slides.length - 1 }
    }),

  updateSlide: (id, patch) =>
    set((s) => ({
      slides: s.slides.map((slide) =>
        slide.id === id ? ({ ...slide, ...patch } as Slide) : slide,
      ),
    })),

  removeSlide: (id) =>
    set((s) => {
      const slides = s.slides.filter((slide) => slide.id !== id)
      return { slides, selectedIndex: clampIndex(s.selectedIndex, slides.length) }
    }),

  moveSlide: (from, to) =>
    set((s) => {
      if (to < 0 || to >= s.slides.length) return s
      const slides = [...s.slides]
      const [moved] = slides.splice(from, 1)
      slides.splice(to, 0, moved)
      return { slides, selectedIndex: to }
    }),

  select: (index) => set((s) => ({ selectedIndex: clampIndex(index, s.slides.length) })),

  loadPresentation: (presentation) =>
    set({
      title: presentation.title,
      theme: presentation.theme,
      slides: presentation.slides,
      selectedIndex: 0,
    }),

  getPresentation: () => {
    const { title, theme, slides } = get()
    return { title, theme, slides }
  },

  reset: () => set({ ...INITIAL, slides: [] }),
}))
