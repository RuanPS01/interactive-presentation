import { clsx } from 'clsx'
import { Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowUp, GripVertical, Link2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { Slide } from '../../types/presentation'
import { SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { Menu } from '../ui/Menu'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

/**
 * Lista dos slides, reordenável ARRASTANDO. Com o mouse, o cartão inteiro
 * arrasta; no toque, só a alça, para o dedo que passa pela lista continuar
 * rolando. A ordem muda na tela durante o arraste e só é gravada no editor ao
 * soltar: gravar a cada troca reposicionaria o gabarito no meio do gesto.
 *
 * O gabarito (`answer`) não arrasta sozinho: ao soltar, o editor o recoloca
 * logo depois da pergunta dele. "Mover para cima", "Mover para baixo" e
 * "Remover" continuam no menu de ações de cada item, para teclado e leitor de
 * tela.
 */
export function SlideList() {
  const slides = useEditorStore((s) => s.slides)
  const reorderSlides = useEditorStore((s) => s.reorderSlides)

  const key = slides.map((s) => s.id).join('|')
  const [order, setOrder] = useState<string[]>(() => slides.map((s) => s.id))
  const orderRef = useRef(order)
  orderRef.current = order
  const dragging = useRef(false)

  // Fora do arraste, a lista segue o editor (slide novo, removido, importado).
  useEffect(() => {
    if (!dragging.current) setOrder(key ? key.split('|') : [])
  }, [key])

  if (slides.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        Nenhum slide ainda. Use &quot;Adicionar slide&quot;.
      </p>
    )
  }

  const byId = new Map(slides.map((slide, index) => [slide.id, { slide, index }]))

  return (
    <Reorder.Group
      as="ol"
      axis="y"
      values={order}
      onReorder={setOrder}
      className="space-y-1.5"
      aria-label="Ordem dos slides"
    >
      {order.map((id) => {
        const entry = byId.get(id)
        if (!entry) return null
        return (
          <SlideRow
            key={id}
            slide={entry.slide}
            index={entry.index}
            total={slides.length}
            onDragStart={() => {
              dragging.current = true
            }}
            onDragEnd={() => {
              dragging.current = false
              reorderSlides(orderRef.current)
            }}
          />
        )
      })}
    </Reorder.Group>
  )
}

/** Deslocamento mínimo (px) para o gesto contar como arraste, e não clique. */
const DRAG_THRESHOLD = 4

function SlideRow({
  slide,
  index,
  total,
  onDragStart,
  onDragEnd,
}: {
  slide: Slide
  index: number
  total: number
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const selected = useEditorStore((s) => s.selectedIndex === index)
  const select = useEditorStore((s) => s.select)
  const moveSlide = useEditorStore((s) => s.moveSlide)
  const removeSlide = useEditorStore((s) => s.removeSlide)
  const controls = useDragControls()
  // O clique que termina um arraste não seleciona o slide solto.
  const justDragged = useRef(false)
  const Icon = SLIDE_TYPE_ICONS[slide.type]
  // O gabarito fica preso à pergunta: não arrasta nem se move sozinho.
  const linked = slide.type === 'answer'
  const typeLabel = SLIDE_TYPE_LABELS[slide.type]

  function startMouseDrag(e: ReactPointerEvent) {
    if (linked || e.pointerType !== 'mouse' || e.button !== 0) return
    // O menu de ações tem o próprio clique.
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return
    controls.start(e)
  }

  return (
    <Reorder.Item
      as="li"
      value={slide.id}
      dragListener={false}
      dragControls={controls}
      layout="position"
      onDragStart={onDragStart}
      onDrag={(_, info) => {
        if (Math.abs(info.offset.y) > DRAG_THRESHOLD) justDragged.current = true
      }}
      onDragEnd={() => {
        onDragEnd()
        // Depois do clique que o soltar dispara.
        window.setTimeout(() => {
          justDragged.current = false
        }, 0)
      }}
      className={clsx('relative', linked && 'pl-4')}
    >
      <div
        onPointerDown={startMouseDrag}
        className={clsx(
          'flex min-w-0 items-center gap-1 rounded-lg border bg-white py-1.5 pl-1 pr-1 transition-colors dark:bg-neutral-900',
          !linked && 'cursor-grab active:cursor-grabbing',
          selected
            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/40 dark:bg-blue-950'
            : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600',
        )}
      >
        {linked ? (
          <span
            className="flex h-8 w-6 shrink-0 items-center justify-center text-neutral-400"
            title="Acompanha a pergunta"
          >
            <Link2 size={14} aria-hidden="true" />
          </span>
        ) : (
          // touch-none: sem ele, arrastar a alça no celular rolaria a página.
          <button
            type="button"
            className="flex h-8 w-6 shrink-0 touch-none items-center justify-center rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            onPointerDown={(e) => {
              e.stopPropagation()
              controls.start(e)
            }}
            title="Arraste para mudar a ordem"
            aria-label="Arraste para mudar a ordem"
          >
            <GripVertical size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!justDragged.current) select(index)
          }}
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left"
          aria-current={selected ? 'true' : undefined}
        >
          <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded bg-neutral-100 px-1 text-[11px] font-semibold tabular-nums text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
              {slide.title || typeLabel}
            </span>
            <span className="flex min-w-0 items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
              <Icon size={12} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{typeLabel}</span>
            </span>
          </span>
        </button>
        <div data-no-drag className="shrink-0">
          <Menu
            label={`Ações do slide ${index + 1}`}
            items={[
              ...(linked
                ? []
                : [
                    {
                      key: 'up',
                      label: 'Mover para cima',
                      icon: <ArrowUp size={16} />,
                      disabled: index === 0,
                      onSelect: () => moveSlide(index, index - 1),
                    },
                    {
                      key: 'down',
                      label: 'Mover para baixo',
                      icon: <ArrowDown size={16} />,
                      disabled: index === total - 1,
                      onSelect: () => moveSlide(index, index + 1),
                    },
                    'separator' as const,
                  ]),
              {
                key: 'remove',
                danger: true,
                icon: <Trash2 size={16} />,
                label: linked ? 'Remover o slide de resposta' : 'Remover slide',
                hint: linked ? 'Desliga a revelação na pergunta' : undefined,
                onSelect: () => removeSlide(slide.id),
              },
            ]}
          />
        </div>
      </div>
    </Reorder.Item>
  )
}
