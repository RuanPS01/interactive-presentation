import type { NamedResponse } from '../../utils/aggregate'

interface NamedResponsesListProps {
  responses: NamedResponse[]
  /** Tamanho (px) do texto dos rótulos. */
  fontSize: number
}

/**
 * Quem respondeu o quê. Só aparece quando a sala pede o nome do participante e
 * a identificação está ligada (global ou no slide).
 */
export function NamedResponsesList({ responses, fontSize }: NamedResponsesListProps) {
  if (responses.length === 0) return null

  return (
    <div className="mt-3 max-h-[22vh] overflow-y-auto rounded-xl border border-neutral-200 bg-white/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
      <ul className="flex flex-wrap gap-2" style={{ fontSize: `${fontSize * 0.85}px` }}>
        {responses.map((r) => (
          <li
            key={r.uid}
            className="inline-flex max-w-full items-baseline gap-1.5 rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-800"
          >
            <span className="font-semibold text-neutral-800 dark:text-neutral-100">
              {r.name}:
            </span>
            <span className="min-w-0 break-words text-neutral-600 dark:text-neutral-300">
              {r.answers.join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
