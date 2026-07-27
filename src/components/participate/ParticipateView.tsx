import type { Slide } from '../../types/presentation'
import { useMyResponse } from '../../hooks/useMyResponse'
import { WordCloudInput } from './WordCloudInput'
import { ChoiceInput } from './ChoiceInput'

interface ParticipateViewProps {
  code: string
  slide: Slide
  participantUid: string
}

/** Controles que o participante vê, conforme o tipo do slide atual. */
export function ParticipateView({ code, slide, participantUid }: ParticipateViewProps) {
  const myResponse = useMyResponse(code, slide.id, participantUid)
  const current = myResponse?.value ?? []

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">{slide.title}</h2>

      {slide.type === 'wordcloud' && (
        <WordCloudInput
          code={code}
          slide={slide}
          participantUid={participantUid}
          current={current}
        />
      )}

      {(slide.type === 'bar' || slide.type === 'pie') && (
        <ChoiceInput
          code={code}
          slide={slide}
          participantUid={participantUid}
          current={current}
        />
      )}

      {slide.type === 'text' && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <p className="mb-2 text-sm font-medium">O apresentador está exibindo um texto:</p>
          <p className="whitespace-pre-wrap">{slide.content}</p>
        </div>
      )}
    </div>
  )
}
