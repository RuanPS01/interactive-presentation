import { clsx } from 'clsx'
import type { ResponseDoc, Slide, TextAlign } from '../../types/presentation'
import {
  aggregateChoices,
  aggregateWords,
  participantCount,
  totalVotes,
} from '../../utils/aggregate'
import { BarChartView } from '../charts/BarChartView'
import { PieChartView } from '../charts/PieChartView'
import { WordCloudView } from '../charts/WordCloudView'

interface SlideDisplayProps {
  slide: Slide
  responses: ResponseDoc[]
}

const ALIGN_ITEMS: Record<TextAlign, string> = {
  left: 'justify-start text-left',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
}

/** Exibição do slide na tela do apresentador (projetor), com resultados ao vivo. */
export function SlideDisplay({ slide, responses }: SlideDisplayProps) {
  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-6 text-center text-3xl font-bold text-neutral-900 dark:text-neutral-50 md:text-4xl">
        {slide.title}
      </h2>
      <div className="min-h-0 flex-1">
        <SlideBody slide={slide} responses={responses} />
      </div>
      <SlideFooter slide={slide} responses={responses} />
    </div>
  )
}

function SlideBody({ slide, responses }: SlideDisplayProps) {
  switch (slide.type) {
    case 'wordcloud':
      return <WordCloudView words={aggregateWords(responses)} />
    case 'bar':
      return <BarChartView data={aggregateChoices(responses, slide.options)} />
    case 'pie':
      return <PieChartView data={aggregateChoices(responses, slide.options)} />
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

function SlideFooter({ slide, responses }: SlideDisplayProps) {
  if (slide.type === 'text') return null

  const participants = participantCount(responses)
  let detail: string
  if (slide.type === 'wordcloud') {
    const total = aggregateWords(responses).reduce((sum, w) => sum + w.value, 0)
    detail = `${total} palavra(s)`
  } else {
    detail = `${totalVotes(aggregateChoices(responses, slide.options))} voto(s)`
  }

  return (
    <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
      {participants} participante(s) · {detail}
    </p>
  )
}
