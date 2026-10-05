import { clsx } from 'clsx'
import { MoreVertical } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  key: string
  label: string
  /** Linha de apoio abaixo do rótulo. */
  hint?: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  /** Ação destrutiva: em vermelho. */
  danger?: boolean
}

export type MenuEntry = MenuItem | 'separator'

interface MenuProps {
  /** Nome acessível do botão (e a dica ao passar o mouse). */
  label: string
  items: MenuEntry[]
  /** Conteúdo do botão; sem ele, só o ícone de três pontos. */
  button?: ReactNode
  /** Título dentro do menu (ex.: "Escolha o tipo"). */
  heading?: string
  /** Lado do botão em que a lista se alinha. */
  align?: 'start' | 'end'
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

const GAP = 4
const VIEWPORT_MARGIN = 8
const MENU_WIDTH = 288

interface Position {
  left: number
  width: number
  top?: number
  bottom?: number
  maxHeight: number
}

/**
 * Botão que abre uma lista de ações (padrão "menu button" do WAI-ARIA).
 *
 * A lista é desenhada num portal com posição fixa calculada a partir do
 * botão, como a do `Select`: dentro de uma coluna com rolagem ou de um
 * cabeçalho ela não é cortada, e abre para cima quando falta espaço embaixo.
 *
 * Teclado: Enter, Espaço ou seta para baixo abrem; setas, Home e End
 * percorrem; Esc fecha e devolve o foco ao botão; Tab fecha e segue.
 */
export function Menu({
  label,
  items,
  button,
  heading,
  align = 'end',
  className,
  buttonClassName,
  disabled = false,
}: MenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = Math.min(MENU_WIDTH, window.innerWidth - 2 * VIEWPORT_MARGIN)
    const preferred = align === 'end' ? rect.right - width : rect.left
    const left = Math.max(VIEWPORT_MARGIN, Math.min(preferred, window.innerWidth - width - VIEWPORT_MARGIN))
    const below = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN
    const above = rect.top - GAP - VIEWPORT_MARGIN
    const upwards = below < 200 && above > below
    setPosition({
      left,
      width,
      maxHeight: Math.max(120, upwards ? above : below),
      ...(upwards ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    })
  }, [align])

  const enabledItems = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  useLayoutEffect(() => {
    if (!open) return
    updatePosition()
    function onScroll(e: Event) {
      if (listRef.current?.contains(e.target as Node)) return
      updatePosition()
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // Ao abrir, o foco vai para o primeiro item ativo; clique fora fecha.
  const shown = open && position !== null
  useEffect(() => {
    if (!shown) return
    listRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [shown])

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  function onListKeyDown(e: KeyboardEvent) {
    // As teclas usadas aqui não chegam aos atalhos da página (o passador de
    // slides do projetor, por exemplo).
    e.stopPropagation()
    const list = enabledItems()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      list[(i + 1) % list.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      list[(i - 1 + list.length) % list.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      list[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      list[list.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      close(false)
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={button ? undefined : label}
        title={label}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault()
            setOpen(true)
          }
        }}
        className={clsx(
          buttonClassName ??
            'flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
        )}
      >
        {button ?? <MoreVertical size={16} />}
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            id={id}
            role="menu"
            aria-label={heading ?? label}
            onKeyDown={onListKeyDown}
            className="ui-popover ui-scroll fixed z-[70] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
          >
            {heading && (
              <p className="px-3 pb-1 pt-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">{heading}</p>
            )}
            {items.map((item, i) =>
              item === 'separator' ? (
                <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />
              ) : (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    // O foco volta ao botão antes da ação: um modal aberto por
                    // ela devolve o foco ao botão do menu quando fechar.
                    close(true)
                    item.onSelect()
                  }}
                  className={clsx(
                    'flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm',
                    'hover:bg-neutral-100 focus:bg-neutral-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                    'dark:hover:bg-neutral-800 dark:focus:bg-neutral-800',
                    item.danger ? 'text-red-600 dark:text-red-400' : 'text-neutral-800 dark:text-neutral-100',
                  )}
                >
                  {item.icon && <span className="mt-0.5 shrink-0">{item.icon}</span>}
                  <span className="min-w-0">
                    <span className="block font-medium">{item.label}</span>
                    {item.hint && (
                      <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">{item.hint}</span>
                    )}
                  </span>
                </button>
              ),
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
