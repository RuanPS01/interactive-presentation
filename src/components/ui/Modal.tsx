import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ScrollArea } from './ScrollArea'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZES: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** Texto de apoio abaixo do título. */
  description?: ReactNode
  /** Ícone à esquerda do título. */
  icon?: ReactNode
  /** Conteúdo; rola sozinho quando passa da altura da tela. */
  children?: ReactNode
  /** Botões do rodapé, alinhados à direita. */
  footer?: ReactNode
  size?: Size
  /** Recebe o foco ao abrir. Sem ele, o foco vai para o próprio painel. */
  initialFocusRef?: RefObject<HTMLElement>
  /**
   * `false` enquanto uma ação está em andamento: Esc, o fundo e o X deixam de
   * fechar, para ninguém sair no meio de uma gravação.
   */
  dismissible?: boolean
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Janela modal com o visual dos painéis da aplicação: fundo escurecido,
 * cabeçalho com título e botão de fechar, corpo com rolagem própria e rodapé
 * de ações.
 *
 * Fecha com Esc, com o X ou clicando fora. O Tab circula só dentro do painel e,
 * ao fechar, o foco volta para quem abriu o modal.
 */
export function Modal(props: ModalProps) {
  if (!props.open) return null
  // Portal: um ancestral com `transform` ou `overflow` não prende o modal.
  return createPortal(<ModalPanel {...props} />, document.body)
}

function ModalPanel({
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  dismissible = true,
}: ModalProps) {
  const titleId = useId()
  const descriptionId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Capturado na primeira renderização, antes de o foco entrar no modal.
  const [returnFocusTo] = useState(() => document.activeElement as HTMLElement | null)

  // O ouvinte de teclado lê a versão atual das props sem ser recadastrado a
  // cada renderização (quem usa costuma passar funções novas toda vez).
  const closeRef = useRef(() => {})
  useLayoutEffect(() => {
    closeRef.current = () => {
      if (dismissible) onClose()
    }
  })

  useEffect(() => {
    ;(initialFocusRef?.current ?? panelRef.current)?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        closeRef.current()
      } else if (e.key === 'Tab') {
        keepFocusInside(e, panelRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      returnFocusTo?.focus?.()
    }
  }, [initialFocusRef, returnFocusTo])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={() => closeRef.current()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(
          'relative flex max-h-[90dvh] w-full flex-col rounded-2xl bg-white shadow-2xl outline-none dark:bg-neutral-900',
          SIZES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            disabled={!dismissible}
            className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {children && <ScrollArea className="min-h-0 flex-1 p-5">{children}</ScrollArea>}

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-neutral-200 p-5 dark:border-neutral-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/** Faz o Tab dar a volta dentro do painel em vez de escapar para a página atrás. */
function keepFocusInside(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (items.length === 0) {
    e.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const current = document.activeElement
  if (e.shiftKey && (current === first || current === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && current === last) {
    e.preventDefault()
    first.focus()
  }
}
