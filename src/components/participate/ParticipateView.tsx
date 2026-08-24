import type { PresentationSettings, Slide } from '../../types/presentation'
import { useMyResponse } from '../../hooks/useMyResponse'
import { findQuizSlide } from '../../utils/slides'
import { AnswerReveal } from './AnswerReveal'
import { WordCloudInput } from './WordCloudInput'
import { ChoiceInput } from './ChoiceInput'

interface ParticipateViewProps {
  code: string
  slide: Slide
  /** Todos os slides da sala (o gabarito precisa achar a pergunta). */
  slides: Slide[]
  participantUid: string
  /** Nome informado ao entrar (null quando a sala não pede). */
  participantName: string | null
  settings: PresentationSettings
}

/** Controles que o participante vê, conforme o tipo do slide atual. */
export function ParticipateView({
  code,
  slide,
  slides,
  participantUid,
  participantName,
  settings,
}: ParticipateViewProps) {
  const quiz = findQuizSlide(slide, slides)
  // No slide de gabarito o que interessa é a resposta dada na pergunta.
  const answerSlideId = slide.type === 'answer' ? (quiz?.id ?? slide.id) : slide.id
  const myResponse = useMyResponse(code, answerSlideId, participantUid)
  const current = myResponse?.value ?? []

  const bodyStyle = { fontSize: `${Math.min(settings.bodyFontSize, 28)}px` }

  return (
    <div className="space-y-4">
      <h2
        className="font-bold text-neutral-900 dark:text-neutral-50"
        style={{ fontSize: `${Math.min(settings.titleFontSize, 30)}px`, lineHeight: 1.2 }}
      >
        {slide.type === 'answer' ? (quiz?.title ?? slide.title) : slide.title}
      </h2>

      {slide.type === 'wordcloud' && (
        <WordCloudInput
          code={code}
          slide={slide}
          participantUid={participantUid}
          participantName={participantName}
          current={current}
          settings={settings}
        />
      )}

      {(slide.type === 'bar' || slide.type === 'pie' || slide.type === 'quiz') && (
        <ChoiceInput
          code={code}
          slide={slide}
          participantUid={participantUid}
          participantName={participantName}
          current={current}
          settings={settings}
        />
      )}

      {slide.type === 'answer' && (
        <AnswerReveal quiz={quiz} current={current} settings={settings} />
      )}

      {slide.type === 'text' && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          <p className="mb-2 text-sm font-medium">O apresentador está exibindo um texto:</p>
          <p className="whitespace-pre-wrap" style={bodyStyle}>
            {slide.content}
          </p>
        </div>
      )}
    </div>
  )
}
