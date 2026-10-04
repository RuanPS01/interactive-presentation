import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface ToggleButtonProps {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  /** Nome acessível e dica (o botão costuma mostrar só o ícone). */
  label: string
  children: ReactNode
  disabled?: boolean
  /** Estado intermediário: parte do trecho tem, parte não. */
  mixed?: boolean
}

/** Botão liga/desliga (negrito, itálico...), no visual dos campos. */
export function ToggleButton({
  pressed,
  onPressedChange,
  label,
  children,
  disabled,
  mixed,
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={mixed ? 'mixed' : pressed}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      // Mantém o foco (e a seleção) no texto em edição.
      onMouseDown={(e) => e.preventDefault()}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50',
        pressed
          ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
          : mixed
            ? 'border-blue-300 border-dashed text-neutral-700 dark:text-neutral-200'
            : 'border-neutral-300 bg-white text-neutral-700 hover:border-blue-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200',
      )}
    >
      {children}
    </button>
  )
}
