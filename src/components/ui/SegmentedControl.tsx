import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Ícone no lugar do texto (o rótulo vira a dica e o nome acessível). */
  icon?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  value: T | undefined
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  'aria-label': string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Grupo de opções exclusivas lado a lado (alinhamento, formato 16:9/4:3...).
 * Mesmo papel de um grupo de rádios, no visual de botões encostados.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  disabled,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={clsx(
        'inline-flex rounded-lg border border-neutral-300 bg-neutral-100 p-0.5 dark:border-neutral-700 dark:bg-neutral-800',
        disabled && 'opacity-50',
        className,
      )}
    >
      {options.map((option) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.icon ? option.label : undefined}
            title={option.icon ? option.label : undefined}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            // Não rouba o foco de um texto em edição: o estilo vai para a seleção dele.
            onMouseDown={(e) => e.preventDefault()}
            className={clsx(
              'inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md font-medium transition',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed',
              size === 'sm' ? 'h-7 min-w-7 px-1.5 text-xs' : 'h-8 min-w-8 px-2.5 text-sm',
              checked
                ? 'bg-white text-blue-700 shadow-sm dark:bg-neutral-900 dark:text-blue-300'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-50',
            )}
          >
            {option.icon ?? option.label}
          </button>
        )
      })}
    </div>
  )
}
