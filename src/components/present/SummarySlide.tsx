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
              <Miniature slide={slide} responses={bySlide.get(slide.id) ?? []} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Corpo do slide reduzido: reaproveita as mesmas views (responsivas). */
function Miniature({ slide, responses }: { slide: Slide; responses: ResponseDoc[] }) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudView words={aggregateWords(responses)} />
    case 'bar':
      return <BarChartView data={aggregateChoices(responses, slide.options)} />
    case 'pie':
      return <PieChartView data={aggregateChoices(responses, slide.options)} />
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
