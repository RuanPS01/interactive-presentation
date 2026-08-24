import type { ResponseDoc, Room, Slide } from '../../types/presentation'
import { aggregateChoices, aggregateWords } from '../../utils/aggregate'
import { BarChartView } from '../charts/BarChartView'
import { PieChartView } from '../charts/PieChartView'
import { WordCloudView } from '../charts/WordCloudView'

interface SummarySlideProps {
  room: Room
  /** Todas as respostas da sala (de todos os slides). */
  responses: ResponseDoc[]
  loading: boolean
}

/** Agrupa as respostas por slide para montar cada miniatura. */
function groupBySlide(responses: ResponseDoc[]): Map<string, ResponseDoc[]> {
  const map = new Map<string, ResponseDoc[]>()
  for (const r of responses) {
    const arr = map.get(r.slideId)
    if (arr) arr.push(r)
    else map.set(r.slideId, [r])
  }
  return map
}

/**
 * Slide final automático de agradecimento: um "obrigado" e uma grade com todos
 * os slides em miniatura (gráficos e nuvens de palavras com os dados ao vivo).
 */
export function SummarySlide({ room, responses, loading }: SummarySlideProps) {
  const bySlide = groupBySlide(responses)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-extrabold text-neutral-900 dark:text-neutral-50 md:text-4xl">
          Obrigado por participar! 🎉
        </h2>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          Resumo de “{room.title}”{loading && ' · carregando resultados…'}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-[220px] grid-cols-2 gap-4 overflow-y-auto pr-1 md:grid-cols-3">
        {room.slides.map((slide, i) => (
          <div
            key={slide.id}
            className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <p className="mb-1 flex items-baseline gap-1.5 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
              <span className="text-neutral-400 dark:text-neutral-500">{i + 1}.</span>
              <span className="truncate">{slide.title || 'Sem título'}</span>
            </p>
            <div className="min-h-0 flex-1">
              <Miniature
                slide={slide}
                slides={room.slides}
                responses={bySlide.get(slide.id) ?? []}
                bySlide={bySlide}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

interface MiniatureProps {
  slide: Slide
  slides: Slide[]
  responses: ResponseDoc[]
  bySlide: Map<string, ResponseDoc[]>
}

/** Corpo do slide reduzido: reaproveita as mesmas views (responsivas). */
function Miniature({ slide, slides, responses, bySlide }: MiniatureProps) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudView words={aggregateWords(responses)} />
    case 'bar':
      return (
        <BarChartView data={aggregateChoices(responses, slide.options)} labelFontSize={11} />
      )
    case 'pie':
      return (
        <PieChartView data={aggregateChoices(responses, slide.options)} labelFontSize={11} />
      )
    case 'quiz':
      // Na miniatura o resumo cabe melhor como lista compacta de alternativas.
      return (
        <AnswerList
          slide={slide}
          responses={responses}
          correctIds={slide.correctOptionIds}
        />
      )
    case 'answer': {
      const quiz = slides.find((s) => s.id === slide.quizSlideId)
      if (quiz?.type !== 'quiz') return <Empty>Pergunta removida.</Empty>
      return (
        <AnswerList
          slide={quiz}
          responses={bySlide.get(quiz.id) ?? []}
          correctIds={quiz.correctOptionIds}
        />
      )
    }
    case 'text':
      return (
        <div className="h-full overflow-hidden">
          <p className="whitespace-pre-wrap text-xs text-neutral-600 dark:text-neutral-300">
            {slide.content || '—'}
          </p>
        </div>
      )
  }
}

function AnswerList({
  slide,
  responses,
  correctIds,
}: {
  slide: { options: { id: string; label: string }[] }
  responses: ResponseDoc[]
  correctIds: string[]
}) {
  const tallies = aggregateChoices(responses, slide.options)
  const correct = new Set(correctIds)
  return (
    <ul className="h-full space-y-1 overflow-y-auto text-xs">
      {tallies.map((t) => (
        <li
          key={t.id}
          className={
            correct.has(t.id)
              ? 'flex justify-between gap-2 rounded bg-green-100 px-2 py-1 font-semibold text-green-900 dark:bg-green-950 dark:text-green-100'
              : 'flex justify-between gap-2 rounded px-2 py-1 text-neutral-600 dark:text-neutral-300'
          }
        >
          <span className="truncate">{t.label}</span>
          <span className="shrink-0 tabular-nums">{t.votes}</span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-neutral-400">
      {children}
    </div>
  )
}
