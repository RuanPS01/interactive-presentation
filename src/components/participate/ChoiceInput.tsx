import { clsx } from 'clsx'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { saveResponse } from '../../lib/responses'
import type { ChoiceSlide } from '../../types/presentation'

interface ChoiceInputProps {
  code: string
  slide: ChoiceSlide
  participantUid: string
  current: string[]
}

/** Entrada de voto para gráficos de barras/pizza (radio ou checkbox). */
export function ChoiceInput({ code, slide, participantUid, current }: ChoiceInputProps) {
  const [busy, setBusy] = useState(false)
  const selected = new Set(current)

  async function persist(next: string[]) {
    setBusy(true)
    try {
      await saveResponse(code, slide.id, participantUid, 'choice', next)
    } finally {
      setBusy(false)
    }
  }

  async function toggle(optionId: string) {
    if (slide.allowMultiple) {
      const next = new Set(selected)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      await persist([...next])
    } else {
      // Escolha única: substitui a seleção anterior.
      await persist([optionId])
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {slide.allowMultiple
          ? 'Você pode escolher mais de uma opção.'
          : 'Escolha uma opção.'}
      </p>

      <ul className="space-y-2">
        {slide.options.map((option) => {
          const isSelected = selected.has(option.id)
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => void toggle(option.id)}
                disabled={busy}
                aria-pressed={isSelected}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base transition',
                  'disabled:opacity-60',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                    : 'border-neutral-300 bg-white hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900',
                )}
              >
                <span
                  className={clsx(
                    'flex h-5 w-5 shrink-0 items-center justify-center border',
                    slide.allowMultiple ? 'rounded-md' : 'rounded-full',
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-neutral-400',
                  )}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </span>
                <span>{option.label}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {selected.size > 0 && (
        <p className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400">
          <Check size={16} strokeWidth={3} /> Voto registrado
        </p>
      )}
    </div>
  )
}
