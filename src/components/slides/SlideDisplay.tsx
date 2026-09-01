import { clsx } from 'clsx'
import type {
  PresentationSettings,
  QuizSlide,
  ResponseDoc,
  Slide,
  TextAlign,
} from '../../types/presentation'
import { isInteractiveSlide } from '../../types/presentation'
import {
  aggregateChoices,
  aggregateWords,
  namedResponses,
  responseSummary,
} from '../../utils/aggregate'
import { DEFAULT_SETTINGS } from '../../utils/settings'
import { findQuizSlide } from '../../utils/slides'
import { BarChartView } from '../charts/BarChartView'
import { PieChartView } from '../charts/PieChartView'
import { WordCloudView } from '../charts/WordCloudView'
import { AnswerSuspense } from './AnswerSuspense'
import { NamedResponsesList } from './NamedResponsesList'
import { OptionsBoard } from './OptionsBoard'
import { SlideCountdown } from './SlideCountdown'

interface SlideDisplayProps {
  slide: Slide
  /**
   * Respostas que alimentam este slide. No slide de gabarito (`answer`) são as
   * respostas do `quiz` de origem — quem chama já assina o slide certo.
   */
  responses: ResponseDoc[]
  /** Configuração já resolvida (global + sobrescritas do slide). */
  settings?: PresentationSettings
  /** Pessoas presentes na sala (não só quem respondeu). */
  participants?: number
  /** Demais slides, para o gabarito achar o `quiz` que ele revela. */
  slides?: Slide[]
  /** Segundos restantes do cronômetro; `null` quando o slide não tem. */
  secondsLeft?: number | null
  /** Gabarito ainda em suspense ("A resposta certa é…"). */
  revealPending?: boolean
  /** Pontos já exibidos nas reticências do suspense. */
  revealDots?: number
}

const ALIGN_ITEMS: Record<TextAlign, string> = {
  left: 'justify-start text-left',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
}

/** Exibição do slide na tela do apresentador (projetor), com resultados ao vivo. */
export function SlideDisplay({
  slide,
  responses,
  settings = DEFAULT_SETTINGS,
  participants,
  slides,
  secondsLeft = null,
  revealPending = false,
  revealDots = 0,
}: SlideDisplayProps) {
  const quiz = findQuizSlide(slide, slides)
  // Num `quiz`, identificar as respostas também as revela — então a lista de
  // nomes só aparece quando o slide autoriza mostrar as respostas.
  const showNames =
    settings.identifyResponses &&
    isInteractiveSlide(slide) &&
    (slide.type !== 'quiz' || slide.showResponses)

  return (
    <div className="flex h-full flex-col">
      <h2
        className="mb-6 text-center font-bold text-neutral-900 dark:text-neutral-50"
        style={{ fontSize: `${settings.titleFontSize}px`, lineHeight: 1.15 }}
      >
        {slide.type === 'answer' ? (quiz?.title ?? slide.title) : slide.title}
      </h2>

      {secondsLeft !== null && (
        <SlideCountdown
          seconds={secondsLeft}
          fontSize={Math.max(settings.titleFontSize * 1.6, 64)}
          className="mb-6 shrink-0"
        />
      )}

      {/* Enquanto o gabarito está em suspense, nada do resultado aparece — nem
          o quadro de alternativas, nem os nomes, nem a contagem do rodapé. */}
      {revealPending ? (
        <div className="min-h-0 flex-1">
          <AnswerSuspense
            dots={revealDots}
            fontSize={Math.max(settings.titleFontSize, 40)}
          />
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <SlideBody slide={slide} responses={responses} settings={settings} quiz={quiz} />
          </div>

          {showNames && (
            <NamedResponsesList
              responses={namedResponses(responses, slide)}
              fontSize={settings.labelFontSize}
            />
          )}

          <SlideFooter
            slide={slide}
            responses={responses}
            settings={settings}
            participants={participants}
            quiz={quiz}
          />
        </>
      )}
    </div>
  )
}

interface BodyProps {
  slide: Slide
  responses: ResponseDoc[]
  settings: PresentationSettings
  quiz: QuizSlide | undefined
}

function SlideBody({ slide, responses, settings, quiz }: BodyProps) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudView words={aggregateWords(responses)} />
    case 'bar':
      return (
        <BarChartView
          data={aggregateChoices(responses, slide.options)}
          labelFontSize={settings.labelFontSize}
        />
      )
    case 'pie':
      return (
        <PieChartView
          data={aggregateChoices(responses, slide.options)}
          labelFontSize={settings.labelFontSize}
        />
      )
    case 'quiz':
      // Sem gráfico. A contagem por alternativa só aparece se o slide pedir:
      // por padrão a pergunta fica no ar sem entregar o resultado.
      return (
        <OptionsBoard
          options={slide.options}
          tallies={slide.showResponses ? aggregateChoices(responses, slide.options) : undefined}
          showVotes={slide.showResponses}
          fontSize={settings.bodyFontSize}
        />
      )
    case 'answer':
      if (!quiz) {
        return (
          <div className="flex h-full items-center justify-center text-center text-neutral-400">
            A pergunta deste gabarito não existe mais.
          </div>
        )
      }
      return (
        <OptionsBoard
          options={quiz.options}
          correctOptionIds={quiz.correctOptionIds}
          tallies={aggregateChoices(responses, quiz.options)}
          reveal
          showVotes
          fontSize={settings.bodyFontSize}
        />
      )
    case 'text':
      return (
        <div className={clsx('flex h-full items-center', ALIGN_ITEMS[slide.align])}>
          <p
            className="w-full whitespace-pre-wrap font-medium text-neutral-900 dark:text-neutral-50"
            style={{ fontSize: `${slide.fontSize}px`, lineHeight: 1.25 }}
          >
            {slide.content}
          </p>
        </div>
      )
  }
}

interface FooterProps extends BodyProps {
  participants?: number
}

/**
 * Rodapé com os números da sala. "Participantes" conta quem está conectado
 * (mesmo sem responder); o resto vem de `responseSummary`, que só acrescenta o
 * total de envios quando ele pode diferir de quem respondeu.
 */
function SlideFooter({ slide, responses, settings, participants, quiz }: FooterProps) {
  const source = slide.type === 'answer' ? quiz : slide
  if (!source || !isInteractiveSlide(source)) return null

  return (
    <p
      className="mt-4 text-center text-neutral-500 dark:text-neutral-400"
      style={{ fontSize: `${settings.labelFontSize * 0.85}px` }}
    >
      {participants !== undefined && <>{participants} participante(s) · </>}
      {responseSummary(source, responses)}
    </p>
  )
}
