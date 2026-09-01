import { clsx } from 'clsx'

interface SlideCountdownProps {
  /** Segundos restantes (já arredondados). */
  seconds: number
  /** Tamanho do número, em px. */
  fontSize: number
  className?: string
}

/** Últimos segundos: o número fica vermelho para chamar a atenção. */
const URGENT_AT = 5

/**
 * Contagem regressiva do slide, grande e legível de longe. O "s" indica que o
 * número está em segundos.
 */
export function SlideCountdown({ seconds, fontSize, className }: SlideCountdownProps) {
  const urgent = seconds <= URGENT_AT
  const over = seconds <= 0

  return (
    <div className={clsx('flex items-baseline justify-center gap-3', className)}>
      <span
        // `role="timer"` sem região viva: um leitor de tela anunciando cada
        // segundo atrapalharia mais do que ajudaria.
        role="timer"
        aria-live="off"
        className={clsx(
          'font-bold tabular-nums leading-none transition-colors',
          urgent
            ? 'text-red-600 dark:text-red-400'
            : 'text-neutral-800 dark:text-neutral-100',
        )}
        style={{ fontSize: `${fontSize}px` }}
      >
        {seconds}s
      </span>
      {over && (
        <span
          className="font-semibold text-red-600 dark:text-red-400"
          style={{ fontSize: `${Math.max(fontSize * 0.3, 14)}px` }}
        >
          Tempo esgotado
        </span>
      )}
    </div>
  )
}
