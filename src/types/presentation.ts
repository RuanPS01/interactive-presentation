/** Tipos centrais do domínio da apresentação interativa. */

export type SlideType = 'wordcloud' | 'bar' | 'pie' | 'text'
export type ThemeMode = 'light' | 'dark'

/** Quantas palavras o participante pode enviar numa nuvem de palavras. */
export type WordLimitMode = 'one' | 'range' | 'unlimited'

export type TextAlign = 'left' | 'center' | 'right'

export interface ChoiceOption {
  id: string
  label: string
}

interface SlideBase {
  id: string
  type: SlideType
  title: string
}

export interface WordCloudSlide extends SlideBase {
  type: 'wordcloud'
  wordLimitMode: WordLimitMode
  /** Máximo de palavras quando `wordLimitMode === 'range'`. */
  maxWords: number
}

export interface BarSlide extends SlideBase {
  type: 'bar'
  options: ChoiceOption[]
  allowMultiple: boolean
}

export interface PieSlide extends SlideBase {
  type: 'pie'
  options: ChoiceOption[]
  allowMultiple: boolean
}

export interface TextSlide extends SlideBase {
  type: 'text'
  content: string
  align: TextAlign
  fontSize: number
}

export type Slide = WordCloudSlide | BarSlide | PieSlide | TextSlide

/** Slides de barras e pizza compartilham a mesma configuração de opções. */
export type ChoiceSlide = BarSlide | PieSlide

export function isChoiceSlide(slide: Slide): slide is ChoiceSlide {
  return slide.type === 'bar' || slide.type === 'pie'
}

/** Estrutura serializável (import/export JSON). */
export interface Presentation {
  title: string
  theme: ThemeMode
  slides: Slide[]
}

export type RoomStatus = 'live' | 'ended'

/** Documento salvo em `rooms/{roomCode}` no Firestore. */
export interface Room extends Presentation {
  creatorUid: string
  currentSlideIndex: number
  status: RoomStatus
  createdAt: number
  updatedAt: number
}

export type ResponseType = 'word' | 'choice'

/** Documento em `rooms/{roomCode}/responses/{id}`. Um doc por participante/slide. */
export interface ResponseDoc {
  slideId: string
  participantUid: string
  type: ResponseType
  /** Palavras enviadas, ou ids das opções escolhidas. */
  value: string[]
  createdAt: number
}
