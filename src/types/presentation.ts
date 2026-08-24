/** Tipos centrais do domínio da apresentação interativa. */

export type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text'
export type ThemeMode = 'light' | 'dark'

/** Quantas palavras o participante pode enviar numa nuvem de palavras. */
export type WordLimitMode = 'one' | 'range' | 'unlimited'

export type TextAlign = 'left' | 'center' | 'right'

export interface ChoiceOption {
  id: string
  label: string
}

/**
 * Opções que valem para a apresentação inteira. Cada slide pode sobrescrever
 * parte delas (ver `SlideOverrides`); o valor efetivo sai de
 * `resolveSlideSettings` (utils/settings.ts).
 */
export interface PresentationSettings {
  /** Participante pode limpar a resposta e escolher outra. */
  allowChangeAnswer: boolean
  /** Pedir o nome do participante antes de entrar na sala (nível da sala). */
  askName: boolean
  /** Mostrar quem respondeu o quê (exige `askName`). */
  identifyResponses: boolean
  /** Tamanho (px) do título do slide na tela do apresentador. */
  titleFontSize: number
  /** Tamanho (px) de rótulos: eixos, legendas, opções, nomes. */
  labelFontSize: number
  /** Tamanho (px) do corpo/conteúdo do slide. */
  bodyFontSize: number
}

/**
 * Sobrescritas por slide. Campo ausente = herda a configuração global.
 * `askName` não aparece aqui: a pergunta acontece uma única vez, antes de
 * entrar na sala, então só faz sentido no nível da apresentação.
 */
export type SlideOverrides = Partial<Omit<PresentationSettings, 'askName'>>

interface SlideBase {
  id: string
  type: SlideType
  title: string
  /** Ajustes que valem só para este slide (herda o global quando ausente). */
  overrides?: SlideOverrides
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

/**
 * Alternativas SEM gráfico: as opções aparecem grandes no centro da tela do
 * apresentador e na tela dos participantes. Feito para pergunta e resposta —
 * daí `correctOptionIds` e o slide de resposta gerado automaticamente.
 */
export interface QuizSlide extends SlideBase {
  type: 'quiz'
  options: ChoiceOption[]
  allowMultiple: boolean
  /** Ids das opções corretas (vazio = sem gabarito). */
  correctOptionIds: string[]
  /** Mantém um slide `answer` logo depois deste, revelando o gabarito. */
  revealAnswer: boolean
}

/**
 * Slide de revelação do gabarito. Não tem conteúdo próprio: aponta para o
 * `quiz` e reexibe as alternativas destacando as corretas. É inserido e
 * removido automaticamente pelo editor (ver `store/editorStore`).
 */
export interface AnswerSlide extends SlideBase {
  type: 'answer'
  /** Id do slide `quiz` que este slide revela. */
  quizSlideId: string
}

export interface TextSlide extends SlideBase {
  type: 'text'
  content: string
  align: TextAlign
  fontSize: number
}

export type Slide =
  | WordCloudSlide
  | BarSlide
  | PieSlide
  | QuizSlide
  | AnswerSlide
  | TextSlide

/** Slides de barras, pizza e alternativas compartilham opções e votação. */
export type ChoiceSlide = BarSlide | PieSlide | QuizSlide

export function isChoiceSlide(slide: Slide): slide is ChoiceSlide {
  return slide.type === 'bar' || slide.type === 'pie' || slide.type === 'quiz'
}

/** Slides que produzem resultado (participantes enviam algo). */
export function isInteractiveSlide(
  slide: Slide,
): slide is WordCloudSlide | ChoiceSlide {
  return slide.type === 'wordcloud' || isChoiceSlide(slide)
}

/** Estrutura serializável (import/export JSON). */
export interface Presentation {
  title: string
  slides: Slide[]
  /**
   * Opções globais. Opcional e parcial no JSON importado: o que faltar recebe
   * o padrão (ver `utils/settings.ts`). A sala criada guarda sempre a versão
   * completa.
   */
  settings?: Partial<PresentationSettings>
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
  /** Nome informado ao entrar (quando a sala pede identificação). */
  participantName?: string
  createdAt: number
}

/** Documento em `rooms/{roomCode}/participants/{uid}`: presença na sala. */
export interface ParticipantDoc {
  uid: string
  name?: string
  joinedAt: number
  /** Atualizado periodicamente enquanto a aba fica aberta. */
  lastSeenAt: number
}
