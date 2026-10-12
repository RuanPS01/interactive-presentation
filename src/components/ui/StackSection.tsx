import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useId } from 'react'
import type { ReactNode } from 'react'

interface StackSectionProps {
  title: string
  icon: LucideIcon
  open: boolean
  onToggle: () => void
  /** Selo à direita do título (o tipo do slide, por exemplo). */
  badge?: ReactNode
  children: ReactNode
}

/**
 * Uma coluna de uma tela de colunas quando ela vira PILHA no celular:
 * cabeçalho clicável com pelo menos 44 px de altura e corpo que se ESCONDE em
 * vez de desmontar (o editor visual do slide livre não perde o elemento
 * selecionado nem a rolagem a cada abre e fecha).
 */
export function StackSection({ title, icon: Icon, open, onToggle, badge, children }: StackSectionProps) {
  const bodyId = useId()
  return (
    <section className="border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-11 w-full items-center gap-2 bg-neutral-100/60 px-3 py-2.5 text-left transition hover:bg-neutral-100 dark:bg-neutral-900/60 dark:hover:bg-neutral-900"
      >
        <Icon size={16} className="shrink-0 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-200">
          {title}
        </span>
        {badge}
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={clsx('shrink-0 text-neutral-500 transition-transform dark:text-neutral-400', open && 'rotate-180')}
        />
      </button>
      <div id={bodyId} className={clsx('min-w-0', !open && 'hidden')}>
        {children}
      </div>
    </section>
  )
}
