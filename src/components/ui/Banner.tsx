import { clsx } from 'clsx'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type Tone = 'info' | 'warning' | 'error'

const TONES: Record<Tone, string> = {
  info: 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200',
  error: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}

interface BannerProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  /** Mostra um X para fechar o aviso. */
  onDismiss?: () => void
  className?: string
}

/** Faixa de aviso (informação, alerta ou erro) no topo de uma tela. */
export function Banner({ tone = 'info', icon, children, onDismiss, className }: BannerProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-start gap-2 rounded-lg border p-3 text-sm', TONES[tone], className)}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="-m-1 shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  )
}
