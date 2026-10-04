import { clsx } from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { FIELD_STYLES } from './fieldStyles'
import { ScrollArea } from './ScrollArea'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  /** Texto menor abaixo do rótulo, só dentro da lista. */
  description?: string
  disabled?: boolean
}

interface SelectProps<T extends string> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  disabled?: boolean
  /** Exibido quando `value` não corresponde a nenhuma opção. */
  placeholder?: string
  id?: string
  className?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

interface ListPosition {
  left: number
  width: number
  maxHeight: number
  top?: number
  bottom?: number
}

/** Distância entre o campo e a lista. */
const GAP = 4
/** Folga mínima entre a lista e a borda da janela. */
const VIEWPORT_MARGIN = 8
const MAX_LIST_HEIGHT = 288
/** Com menos espaço que isto abaixo do campo, a lista abre para cima. */
const MIN_COMFORTABLE_HEIGHT = 160
/** Janela (ms) em que letras digitadas em sequência formam uma só busca. */
const TYPEAHEAD_WINDOW = 600

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Lista suspensa com a identidade da aplicação.
 *
 * Substitui o `<select>` nativo porque a lista aberta dele é desenhada pelo
 * sistema operacional: ignora o tema escuro e as cores da interface. Segue o
 * padrão "select-only combobox" do WAI-ARIA: o foco fica sempre no campo, que
 * aponta a opção ativa por `aria-activedescendant`.
 *
 * Teclado: setas, Home/End e PageUp/PageDown percorrem; Enter ou Espaço
 * escolhem; Esc fecha só a lista (não o modal em volta); digitar letras pula
 * para a opção que começa com elas.
 *
 * A lista é renderizada num portal no `<body>`, com posição fixa calculada a
 * partir do campo. Dentro de um painel com rolagem ou de um modal ela não é
 * cortada, e abre para cima quando falta espaço embaixo.
 */
export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  placeholder = 'Selecione…',
  id,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: SelectProps<T>) {
  const autoId = useId()
  const buttonId = id ?? `${autoId}-campo`
  const listId = `${autoId}-lista`
  const optionId = (index: number) => `${autoId}-opcao-${index}`

  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const typeahead = useRef({ text: '', at: 0 })
  // Só a navegação por teclado (e a abertura) rola a lista até a opção ativa:
  // seguir o mouse faria a lista "andar" sob o ponteiro.
  const followActive = useRef(false)

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [position, setPosition] = useState<ListPosition | null>(null)
  const isOpen = open && !disabled

  const selectedIndex = options.findIndex((o) => o.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  /** Próxima opção habilitada na direção `delta`; no fim da lista, fica onde está. */
  function step(from: number, delta: 1 | -1): number {
    for (let i = from + delta; i >= 0 && i < options.length; i += delta) {
      if (!options[i].disabled) return i
    }
    return from
  }
  const firstEnabled = () => step(-1, 1)
  const lastEnabled = () => step(options.length, -1)

  function moveTo(index: number) {
    followActive.current = true
    setActive(index)
  }

  function openList(initial?: number) {
    if (disabled) return
    moveTo(initial ?? (selected && !selected.disabled ? selectedIndex : firstEnabled()))
    setOpen(true)
  }

  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    setOpen(false)
    buttonRef.current?.focus()
    if (option.value !== value) onChange(option.value)
  }

  /**
   * Busca por digitação. Uma letra nova procura a partir da opção seguinte
   * (repetir "s" alterna entre as que começam com S); letras em sequência
   * refinam a busca a partir da atual. Acentos não contam: "nao" acha "Não".
   */
  function matchTyped(char: string, from: number): number {
    const now = Date.now()
    const continuing = now - typeahead.current.at < TYPEAHEAD_WINDOW
    const text = continuing ? typeahead.current.text + char : char
    typeahead.current = { text, at: now }
    const needle = normalize(text)
    const start = from < 0 ? 0 : from + (continuing ? 0 : 1)
    for (let n = 0; n < options.length; n++) {
      const i = (start + n) % options.length
      if (!options[i].disabled && normalize(options[i].label).startsWith(needle)) return i
    }
    return -1
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    const typed = e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey

    if (!isOpen) {
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
        case 'Enter':
        case ' ':
          e.preventDefault()
          openList()
          return
        case 'Home':
          e.preventDefault()
          openList(firstEnabled())
          return
        case 'End':
          e.preventDefault()
          openList(lastEnabled())
          return
      }
      if (typed) {
        const match = matchTyped(e.key, selectedIndex)
        if (match >= 0) {
          e.preventDefault()
          openList(match)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        moveTo(step(active, 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        moveTo(step(active, -1))
        return
      case 'Home':
      case 'PageUp':
        e.preventDefault()
        moveTo(firstEnabled())
        return
      case 'End':
      case 'PageDown':
        e.preventDefault()
        moveTo(lastEnabled())
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (active >= 0) choose(active)
        else setOpen(false)
        return
      case 'Escape':
        // Fecha só a lista. Sem o stopPropagation, o Esc chegaria ao ouvinte
        // do modal em volta e fecharia o modal inteiro.
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        return
      case 'Tab':
        setOpen(false)
        return
    }
    if (typed) {
      const match = matchTyped(e.key, active)
      if (match >= 0) moveTo(match)
    }
  }

  // Posição da lista: logo abaixo do campo (ou acima, se faltar espaço),
  // recalculada quando a janela ou qualquer painel em volta rola.
  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN
    const above = rect.top - GAP - VIEWPORT_MARGIN
    const upwards = below < MIN_COMFORTABLE_HEIGHT && above > below
    const maxLeft = window.innerWidth - rect.width - VIEWPORT_MARGIN
    setPosition({
      left: Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft)),
      width: rect.width,
      maxHeight: Math.max(0, Math.min(MAX_LIST_HEIGHT, upwards ? above : below)),
      ...(upwards
        ? { bottom: window.innerHeight - rect.top + GAP }
        : { top: rect.bottom + GAP }),
    })
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    updatePosition()
    function onScroll(e: Event) {
      // Rolar a própria lista não move o campo.
      if (popoverRef.current?.contains(e.target as Node)) return
      updatePosition()
    }
    // `capture`: o evento de rolagem não borbulha, e o campo pode estar dentro
    // de qualquer painel com rolagem, não só na janela.
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, updatePosition])

  // Clique fora do campo e da lista fecha.
  useEffect(() => {
    if (!isOpen) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [isOpen])

  // Mantém a opção ativa à vista quando ela muda pelo teclado.
  const listShown = isOpen && position !== null
  useEffect(() => {
    if (!listShown || active < 0 || !followActive.current) return
    followActive.current = false
    document.getElementById(`${autoId}-opcao-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [listShown, active, autoId])

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listId : undefined}
        aria-activedescendant={isOpen && active >= 0 ? optionId(active) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (isOpen ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // No Firefox, o Espaço solto ainda dispararia um clique e reabriria a lista.
        onKeyUp={(e) => {
          if (e.key === ' ') e.preventDefault()
        }}
        className={clsx(
          FIELD_STYLES,
          'flex items-center gap-2 text-left',
          isOpen && 'border-blue-500 ring-2 ring-blue-500/30',
          className,
        )}
      >
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-neutral-400')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={clsx(
            'shrink-0 text-neutral-500 transition-transform dark:text-neutral-400',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            className="ui-popover fixed z-[60] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
            }}
            // Clicar na lista (inclusive na barra de rolagem) não tira o foco do campo.
            onMouseDown={(e) => e.preventDefault()}
          >
            <ScrollArea className="p-1" style={{ maxHeight: position.maxHeight }}>
              <ul
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabel ? undefined : (ariaLabelledBy ?? buttonId)}
              >
                {options.map((option, index) => {
                  const isSelected = index === selectedIndex
                  return (
                    <li
                      key={option.value}
                      id={optionId(index)}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled || undefined}
                      onMouseMove={() => {
                        if (!option.disabled && index !== active) setActive(index)
                      }}
                      onClick={() => choose(index)}
                      className={clsx(
                        'flex select-none items-start gap-2 rounded-lg px-2.5 py-2 text-sm',
                        option.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                        index === active
                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                          : 'text-neutral-700 dark:text-neutral-200',
                        isSelected && 'font-medium',
                      )}
                    >
                      <Check
                        size={16}
                        strokeWidth={2.5}
                        aria-hidden="true"
                        className={clsx(
                          'mt-0.5 shrink-0 text-blue-600 dark:text-blue-400',
                          !isSelected && 'invisible',
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block">{option.label}</span>
                        {option.description && (
                          <span className="block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                            {option.description}
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </ScrollArea>
          </div>,
          document.body,
        )}
    </>
  )
}
