import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface PageShellProps {
  children: ReactNode
  className?: string
  /** Ocupa a tela inteira (usado nas telas ao vivo). */
  full?: boolean
}

/** Contêiner de página com largura máxima e respiro. */
export function PageShell({ children, className, full }: PageShellProps) {
  return (
    <div className={clsx('min-h-full w-full', full ? 'flex flex-col' : 'mx-auto max-w-6xl px-4 py-8', className)}>
      {children}
    </div>
  )
}
