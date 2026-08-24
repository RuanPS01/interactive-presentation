import { clsx } from 'clsx'
import { Check, X } from 'lucide-react'
import type { PresentationSettings, QuizSlide } from '../../types/presentation'

interface AnswerRevealProps {
  quiz: QuizSlide | undefined
  /** Ids das opções que ESTE participante escolheu na pergunta. */
  current: string[]
  settings: PresentationSettings
}

/** Compara a escolha do participante com o gabarito (ignora a ordem). */
function isRight(chosen: string[], correct: string[]): boolean {
  if (correct.length === 0 || chosen.length === 0) return false
  const set = new Set(chosen)
  return correct.length === set.size && correct.every((id) => set.has(id))
}

/** Tela do participante no slide de gabarito: mostra o certo e o seu resultado. */
export function AnswerReveal({ quiz, current, settings }: AnswerRevealProps) {
  if (!quiz) {
    return (
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        A pergunta deste gabarito não está mais disponível.
      </p>
    )
  }

  const correct = new Set(quiz.correctOptionIds)
  const hasKey = correct.size > 0
  const answered = current.length > 0
  const right = isRight(current, quiz.correctOptionIds)
  const size = Math.min(settings.bodyFontSize, 20)

  return (
    <div className="space-y-3">
      {hasKey && answered && (
        <p
          className={clsx(
            'flex items-center gap-2 rounded-xl px-4 py-3 font-semibold',
            right
              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
          )}
        >
          {right ? <Check size={20} strokeWidth={3} /> : <X size={20} strokeWidth={3} />}
          {right ? 'Você acertou!' : 'Não foi dessa vez.'}
        </p>
      )}
      {hasKey && !answered && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Você não respondeu esta pergunta.
        </p>
      )}

      <ul className="space-y-2">
        {quiz.options.map((option) => {
          const isCorrect = correct.has(option.id)
          const chosen = current.includes(option.id)
          return (
            <li
              key={option.id}
              className={clsx(
                'flex items-center gap-3 rounded-xl border px-4 py-3',
                isCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : 'border-neutral-200 bg-white opacity-70 dark:border-neutral-800 dark:bg-neutral-900',
              )}
              style={{ fontSize: `${size}px` }}
            >
              {isCorrect && (
                <Check size={18} strokeWidth={3} className="shrink-0 text-green-600" />
              )}
              <span className="min-w-0 flex-1 break-words text-neutral-900 dark:text-neutral-50">
                {option.label}
              </span>
              {chosen && (
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                  sua resposta
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
