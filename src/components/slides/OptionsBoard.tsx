import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import type { ChoiceOption } from '../../types/presentation'
import type { ChoiceTally } from '../../utils/aggregate'

interface OptionsBoardProps {
  options: ChoiceOption[]
  /** Ids corretos; só destacados quando `reveal` é true. */
  correctOptionIds?: string[]
  /** Contagem de votos por opção (usada na revelação do gabarito). */
  tallies?: ChoiceTally[]
  /** true no slide de resposta: pinta o gabarito e mostra os votos. */
  reveal?: boolean
  /** Tamanho base (px) do texto das alternativas. */
  fontSize: number
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Quadro de alternativas exibido no centro da tela (slides `quiz` e `answer`).
 * Sem gráfico: a leitura é a própria alternativa, em tamanho grande.
 */
export function OptionsBoard({
  options,
  correctOptionIds = [],
  tallies,
  reveal = false,
  fontSize,
}: OptionsBoardProps) {
  const correct = new Set(correctOptionIds)
  const votesById = new Map((tallies ?? []).map((t) => [t.id, t.votes]))
  const totalVotes = (tallies ?? []).reduce((sum, t) => sum + t.votes, 0)
  // Muitas alternativas quebram em duas colunas para caber na altura da tela.
  const twoColumns = options.length > 4

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto py-2">
      <ul
        className={clsx(
          'grid w-full max-w-6xl gap-3',
          twoColumns ? 'md:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {options.map((option, index) => {
          const isCorrect = reveal && correct.has(option.id)
          const isWrong = reveal && correct.size > 0 && !correct.has(option.id)
          const votes = votesById.get(option.id) ?? 0
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
          return (
            <li
              key={option.id}
              className={clsx(
                'flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition',
                isCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-950'
                  : isWrong
                    ? 'border-neutral-200 bg-white opacity-60 dark:border-neutral-800 dark:bg-neutral-900'
                    : 'border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900',
              )}
            >
              <span
                className={clsx(
                  'flex shrink-0 items-center justify-center rounded-xl font-extrabold',
                  isCorrect
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
                )}
                style={{
                  width: `${fontSize * 1.8}px`,
                  height: `${fontSize * 1.8}px`,
                  fontSize: `${fontSize}px`,
                }}
              >
                {isCorrect ? <Check size={fontSize} strokeWidth={3} /> : LETTERS[index] ?? '•'}
              </span>
              <span
                className="min-w-0 flex-1 break-words font-semibold text-neutral-900 dark:text-neutral-50"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.25 }}
              >
                {option.label}
              </span>
              {reveal && tallies && (
                <span
                  className="shrink-0 text-right font-bold tabular-nums text-neutral-500 dark:text-neutral-400"
                  style={{ fontSize: `${fontSize * 0.7}px` }}
                >
                  {votes} · {pct}%
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
