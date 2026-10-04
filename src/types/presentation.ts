/** Tipos centrais do domínio da apresentação interativa. */

export type SlideType = 'wordcloud' | 'bar' | 'pie' | 'quiz' | 'answer' | 'text' | 'free'
export type ThemeMode = 'light' | 'dark'

/** Formato (proporção) dos slides da apresentação. */
export type SlideAspect = '16:9' | '4:3'

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
  /**
   * Segundos do cronômetro dos slides de questionário (`quiz`). Zerado, o
   * slide fica sem cronômetro e a pergunta espera o apresentador avançar.
   */
  quizTimerSeconds: number
  /**
   * Formato dos slides: a moldura da prévia no editor e o tamanho de cada
   * slide livre novo. A tela do projetor continua ocupando a tela inteira.
   */
  slideAspect: SlideAspect
}

/**
 * Sobrescritas por slide. Campo ausente = herda a configuração global.
 * `askName` e `slideAspect` não aparecem aqui: o nome é pedido uma única vez,
 * antes de entrar na sala, e o formato vale para a apresentação inteira.
 */
export type SlideOverrides = Partial<Omit<PresentationSettings, 'askName' | 'slideAspect'>>

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
  /**
   * Mostrar na tela do apresentador o que os participantes responderam
   * (contagem por alternativa e, se a sala identificar, os nomes).
   *
   * Padrão `false`: numa pergunta e resposta, exibir as respostas enquanto a
   * pergunta está no ar entrega o resultado antes da hora.
   */
  showResponses: boolean
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

/* ------------------------------------------------------------------------
   Slide livre: composição de textos e imagens posicionados à mão (ou vindos
   de um PPTX importado). Só exibição, como o slide de texto.

   Coordenadas e tamanhos estão em px de uma moldura lógica (`width` x
   `height` do slide, 1920 x 1080 no 16:9). A tela redimensiona a moldura
   inteira de uma vez, então texto e imagens mantêm a proporção em qualquer
   tela.
   ------------------------------------------------------------------------ */

/** Estilo de um trecho de texto. Ausente = herda do parágrafo e da caixa. */
export interface FreeTextStyle {
  fontFamily?: string
  /** Tamanho em px da moldura lógica. */
  fontSize?: number
  /** Cor em `#rrggbb` (ou `#rrggbbaa`). */
  color?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  /** Cor de realce atrás do texto. */
  highlight?: string
}

export type FreeTextAlign = 'left' | 'center' | 'right' | 'justify'
export type FreeVerticalAlign = 'top' | 'middle' | 'bottom'

/** Trecho de texto com estilo próprio. `\n` é quebra de linha no parágrafo. */
export interface FreeTextRun {
  text: string
  style?: FreeTextStyle
}

export type FreeNumbering = 'arabic' | 'alphaLower' | 'alphaUpper' | 'romanLower' | 'romanUpper'

/** Marcador de lista: um caractere ("•") ou numeração automática. */
export type FreeBullet =
  | { kind: 'char'; char: string; color?: string }
  | { kind: 'number'; format: FreeNumbering; suffix: '.' | ')'; startAt?: number }

export interface FreeTextParagraph {
  runs: FreeTextRun[]
  align?: FreeTextAlign
  /** Estilo padrão dos trechos deste parágrafo (e da linha quando vazio). */
  style?: FreeTextStyle
  bullet?: FreeBullet
  /** Margem esquerda do texto (px). */
  indent?: number
  /** Quanto o marcador fica pendurado à esquerda da margem (px). */
  hanging?: number
  /** Espaço antes e depois do parágrafo (px). */
  spaceBefore?: number
  spaceAfter?: number
  /** Altura da linha, em múltiplos do tamanho da fonte. */
  lineHeight?: number
}

interface FreeElementBase {
  id: string
  /** Nome na lista de camadas. */
  name?: string
  x: number
  y: number
  width: number
  height: number
  /** Rotação em graus, em torno do centro. */
  rotation?: number
  /** 0 a 1. Ausente = opaco. */
  opacity?: number
}

export interface FreeTextElement extends FreeElementBase {
  kind: 'text'
  paragraphs: FreeTextParagraph[]
  /** Estilo base de todos os parágrafos. */
  style: FreeTextStyle
  verticalAlign?: FreeVerticalAlign
  /** Espaço interno (px): cima, direita, baixo, esquerda. */
  padding?: [number, number, number, number]
  /** Cor de fundo da caixa. */
  background?: string
  /** Altura de linha padrão, em múltiplos do tamanho da fonte. */
  lineHeight?: number
}

export type FreeImageFit = 'fill' | 'contain' | 'cover'

export interface FreeImageElement extends FreeElementBase {
  kind: 'image'
  /** Chave em `Presentation.assets` (e em `rooms/{code}/assets`). */
  assetId: string
  /** Como a imagem ocupa a caixa. Padrão: `fill` (estica). */
  fit?: FreeImageFit
  /** Arredondamento dos cantos (px). */
  radius?: number
}

export type FreeElement = FreeTextElement | FreeImageElement

export interface FreeSlide extends SlideBase {
  type: 'free'
  /** Tamanho da moldura lógica, em px. */
  width: number
  height: number
  /** Cor de fundo do slide. */
  background: string
  /** Em ordem de desenho: o último fica na frente. */
  elements: FreeElement[]
}

/**
 * Imagem usada por slides livres, já comprimida para caber num documento do
 * Firestore. Fica fora dos slides para a sala não estourar o limite de 1 MiB
 * do documento: os slides guardam só o `id`.
 */
export interface PresentationAsset {
  id: string
  /** `data:` URL da imagem. */
  dataUrl: string
  width: number
  height: number
}

export type PresentationAssets = Record<string, PresentationAsset>

/**
 * Fonte que veio embutida num PowerPoint. Os textos a usam pelo nome da
 * família, como qualquer outra fonte; ela só precisa estar registrada no
 * navegador (ver `utils/fonts/faces.ts`). Cada estilo (negrito, itálico) é
 * um arquivo e um registro.
 */
export interface PresentationFont {
  id: string
  /** Nome usado em `fontFamily` nos textos (o "typeface" do PowerPoint). */
  family: string
  weight: 'normal' | 'bold'
  style: 'normal' | 'italic'
  /** `data:font/woff;base64,...` */
  dataUrl: string
}

export type PresentationFonts = Record<string, PresentationFont>

export type Slide =
  | WordCloudSlide
  | BarSlide
  | PieSlide
  | QuizSlide
  | AnswerSlide
  | TextSlide
  | FreeSlide

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
  /**
   * Imagens dos slides livres, pelo id. Vão junto no JSON exportado; na sala
   * ficam numa subcoleção própria (ver `lib/assets.ts`).
   */
  assets?: PresentationAssets
  /**
   * Fontes embutidas usadas pelos slides livres, pelo id. Vão junto no JSON;
   * na sala ficam em `rooms/{code}/fonts` (ver `lib/fonts.ts`).
   */
  fonts?: PresentationFonts
}

export type RoomStatus = 'live' | 'ended'

/**
 * Cronômetro de um slide dentro da sala.
 *
 * - **correndo**: `endsAt` tem o instante final (epoch ms);
 * - **pausado**: `endsAt` é `null` e o que sobrou está em `remainingMs` — é o
 *   estado de um slide que o apresentador deixou no meio da contagem;
 * - **esgotado**: `endsAt` é `null` e `remainingMs` é 0. Voltar para a pergunta
 *   não reabre as respostas: elas ficam congeladas como estavam.
 */
export interface SlideTimer {
  endsAt: number | null
  remainingMs: number
}

/** Cronômetros da sala, indexados pelo id do slide. */
export type SlideTimers = Record<string, SlideTimer>

/**
 * Documento salvo em `rooms/{roomCode}` no Firestore. As imagens e as fontes
 * não vão nele (ficam em `rooms/{roomCode}/assets` e `rooms/{roomCode}/fonts`),
 * por isso `assets` e `fonts` ficam de fora.
 */
export interface Room extends Omit<Presentation, 'assets' | 'fonts'> {
  creatorUid: string
  currentSlideIndex: number
  status: RoomStatus
  createdAt: number
  updatedAt: number
  /**
   * Cronômetro de cada slide que já esteve no ar. Só o apresentador grava;
   * todos os navegadores contam a partir do mesmo instante final, o que
   * dispensa uma escrita por segundo. Ausente nas salas criadas antes do
   * cronômetro existir.
   */
  timers?: SlideTimers
  /**
   * Ids dos slides de gabarito cujo suspense já terminou. Voltar a um deles
   * mostra a resposta na hora: a espera de 3 s existe para sincronizar a
   * primeira revelação, não para atrasar a revisão.
   */
  revealedSlideIds?: string[]
  /**
   * Quantas vezes o apresentador editou a sala depois de iniciada. Cada edição
   * recomeça a apresentação do primeiro slide e soma 1 aqui; é por esse número
   * que a tela do participante percebe a mudança e avisa. Ausente = 0.
   */
  revision?: number
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
