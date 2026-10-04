import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useFreeSlideActions } from '../../hooks/useFreeSlideActions'
import { useEditorStore } from '../../store/editorStore'
import type { FreeElement, FreeSlide, PresentationAssets } from '../../types/presentation'
import { toggleTextFlag } from '../../utils/freeTextFormat'
import { ScaledFrame } from '../slides/ScaledFrame'
import { FreeImageContent, FreeTextContent } from './FreeElementContent'
import { FreeTextEditable } from './FreeTextEditable'
import type { CaretStart } from './FreeTextEditable'
import { elementBoxStyle, textBoxCss } from './layout'
import type { ElementGeometry } from './layout'

/** Alças de redimensionamento: direção em x e y (-1, 0, 1). */
const HANDLES = [
  { sx: -1, sy: -1, cursor: 'nwse-resize' },
  { sx: 0, sy: -1, cursor: 'ns-resize' },
  { sx: 1, sy: -1, cursor: 'nesw-resize' },
  { sx: 1, sy: 0, cursor: 'ew-resize' },
  { sx: 1, sy: 1, cursor: 'nwse-resize' },
  { sx: 0, sy: 1, cursor: 'ns-resize' },
  { sx: -1, sy: 1, cursor: 'nesw-resize' },
  { sx: -1, sy: 0, cursor: 'ew-resize' },
] as const

type Handle = (typeof HANDLES)[number]

const MIN_SIZE = 12
/** Distância (em px de tela) para encaixar numa guia. */
const SNAP_PX = 8

interface Drag {
  id: string
  kind: FreeElement['kind']
  handle: Handle | null
  startX: number
  startY: number
  origin: ElementGeometry
  moved: boolean
}

interface Guides {
  x: number[]
  y: number[]
}

function geometryOf(element: FreeElement): ElementGeometry {
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
  }
}

/** Encaixa as bordas e o centro do elemento nas da moldura e dos outros elementos. */
function snap(
  g: ElementGeometry,
  others: FreeElement[],
  slide: FreeSlide,
  threshold: number,
): { x: number; y: number; guides: Guides } {
  const linesX = [0, slide.width / 2, slide.width]
  const linesY = [0, slide.height / 2, slide.height]
  for (const o of others) {
    linesX.push(o.x, o.x + o.width / 2, o.x + o.width)
    linesY.push(o.y, o.y + o.height / 2, o.y + o.height)
  }
  const pick = (start: number, size: number, lines: number[]) => {
    let best: { delta: number; line: number } | null = null
    for (const edge of [start, start + size / 2, start + size]) {
      for (const line of lines) {
        const delta = line - edge
        if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) {
          best = { delta, line }
        }
      }
    }
    return best
  }
  const bx = pick(g.x, g.width, linesX)
  const by = pick(g.y, g.height, linesY)
  return {
    x: g.x + (bx?.delta ?? 0),
    y: g.y + (by?.delta ?? 0),
    guides: { x: bx ? [bx.line] : [], y: by ? [by.line] : [] },
  }
}

/**
 * Redimensiona pela alça mantendo fixo o ponto oposto, inclusive com o
 * elemento girado (as contas são feitas no eixo do próprio elemento).
 */
function resize(drag: Drag, handle: Handle, dx: number, dy: number, shift: boolean): ElementGeometry {
  const o = drag.origin
  const angle = ((o.rotation ?? 0) * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const lx = dx * cos + dy * sin
  const ly = -dx * sin + dy * cos
  let width = o.width + handle.sx * lx
  let height = o.height + handle.sy * ly
  // Canto de imagem mantém a proporção (Shift solta); no texto, é o contrário.
  const corner = handle.sx !== 0 && handle.sy !== 0
  if (corner && (drag.kind === 'image') !== shift) {
    const ratio = o.width / o.height
    if (Math.abs(width / o.width) > Math.abs(height / o.height)) height = width / ratio
    else width = height * ratio
  }
  width = Math.max(MIN_SIZE, width)
  height = Math.max(MIN_SIZE, height)
  const ax = (-handle.sx * o.width) / 2
  const ay = (-handle.sy * o.height) / 2
  const cx = o.x + o.width / 2
  const cy = o.y + o.height / 2
  const anchorX = cx + ax * cos - ay * sin
  const anchorY = cy + ax * sin + ay * cos
  const nx = (-handle.sx * width) / 2
  const ny = (-handle.sy * height) / 2
  const ncx = anchorX - (nx * cos - ny * sin)
  const ncy = anchorY - (nx * sin + ny * cos)
  return { x: ncx - width / 2, y: ncy - height / 2, width, height, rotation: o.rotation }
}

function rounded(g: ElementGeometry): ElementGeometry {
  return {
    x: Math.round(g.x),
    y: Math.round(g.y),
    width: Math.round(g.width),
    height: Math.round(g.height),
    rotation: g.rotation,
  }
}

interface FreeSlideCanvasProps {
  slide: FreeSlide
  assets: PresentationAssets
  className?: string
}

/**
 * Edição direta do slide livre: clicar seleciona, arrastar move (com guias
 * de alinhamento; Alt desliga o encaixe), as alças redimensionam e o clique
 * duplo num texto abre a edição. Imagens podem ser soltas ou coladas aqui.
 *
 * Teclado (com o slide em foco): setas movem (Shift: 10 px), Delete apaga,
 * Ctrl+D duplica, Enter edita o texto e Esc sai da edição e da seleção.
 */
export function FreeSlideCanvas({ slide, assets, className }: FreeSlideCanvasProps) {
  const selectedId = useEditorStore((s) => s.selectedElementId)
  const editingId = useEditorStore((s) => s.editingElementId)
  const textSelection = useEditorStore((s) => s.textSelection)
  const selectElement = useEditorStore((s) => s.selectElement)
  const setEditingElement = useEditorStore((s) => s.setEditingElement)
  const setTextSelection = useEditorStore((s) => s.setTextSelection)
  const updateElement = useEditorStore((s) => s.updateElement)
  const actions = useFreeSlideActions(slide.id)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef(1)
  const dragRef = useRef<Drag | null>(null)
  const draftRef = useRef<ElementGeometry | null>(null)
  const slideRef = useRef(slide)
  slideRef.current = slide
  const [dragging, setDragging] = useState(false)
  const [draft, setDraft] = useState<{ id: string; geometry: ElementGeometry } | null>(null)
  const [guides, setGuides] = useState<Guides>({ x: [], y: [] })
  const [caret, setCaret] = useState<CaretStart>('end')
  const [dropping, setDropping] = useState(false)

  const selected = slide.elements.find((e) => e.id === selectedId)

  // Arrasto: ouvintes na janela, para seguir o ponteiro mesmo fora do slide.
  useEffect(() => {
    if (!dragging) return
    function onMove(e: PointerEvent) {
      const drag = dragRef.current
      if (!drag) return
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 3) return
      drag.moved = true
      const scale = scaleRef.current
      const dx = (e.clientX - drag.startX) / scale
      const dy = (e.clientY - drag.startY) / scale
      let geometry: ElementGeometry
      if (drag.handle) {
        geometry = resize(drag, drag.handle, dx, dy, e.shiftKey)
        setGuides({ x: [], y: [] })
      } else {
        geometry = { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy }
        if (!e.altKey) {
          const current = slideRef.current
          const others = current.elements.filter((el) => el.id !== drag.id)
          const snapped = snap(geometry, others, current, SNAP_PX / scale)
          geometry = { ...geometry, x: snapped.x, y: snapped.y }
          setGuides(snapped.guides)
        } else {
          setGuides({ x: [], y: [] })
        }
      }
      draftRef.current = geometry
      setDraft({ id: drag.id, geometry })
    }
    function onUp() {
      const drag = dragRef.current
      const geometry = draftRef.current
      dragRef.current = null
      draftRef.current = null
      setDragging(false)
      setDraft(null)
      setGuides({ x: [], y: [] })
      if (drag?.moved && geometry) updateElement(slideRef.current.id, drag.id, rounded(geometry))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, updateElement])

  function startDrag(e: React.PointerEvent, element: FreeElement, handle: Handle | null) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    rootRef.current?.focus({ preventScroll: true })
    if (editingId && editingId !== element.id) setEditingElement(null)
    selectElement(element.id)
    dragRef.current = {
      id: element.id,
      kind: element.kind,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origin: geometryOf(element),
      moved: false,
    }
    setDragging(true)
  }

  function startEditing(element: FreeElement, start: CaretStart) {
    if (element.kind !== 'text') return
    setCaret(start)
    setEditingElement(element.id)
  }

  function stopEditing() {
    setEditingElement(null)
    rootRef.current?.focus({ preventScroll: true })
  }

  function toStage(clientX: number, clientY: number) {
    const rect = stageRef.current?.getBoundingClientRect()
    const scale = scaleRef.current
    if (!rect) return undefined
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (editingId) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        stopEditing()
      }
      return
    }
    if (!selected) return
    const mod = e.ctrlKey || e.metaKey
    const step = e.shiftKey ? 10 : 1
    const nudge = (dx: number, dy: number) => {
      e.preventDefault()
      updateElement(slide.id, selected.id, { x: selected.x + dx, y: selected.y + dy })
    }
    switch (e.key) {
      case 'ArrowLeft':
        return nudge(-step, 0)
      case 'ArrowRight':
        return nudge(step, 0)
      case 'ArrowUp':
        return nudge(0, -step)
      case 'ArrowDown':
        return nudge(0, step)
      case 'Delete':
      case 'Backspace':
        e.preventDefault()
        return actions.remove(selected.id)
      case 'Enter':
        e.preventDefault()
        return startEditing(selected, 'all')
      case 'Escape':
        // Só a seleção: o Esc não chega ao editor ampliado em volta.
        e.preventDefault()
        e.stopPropagation()
        return selectElement(null)
    }
    if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      actions.duplicate(selected.id)
    }
  }

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      aria-label="Slide livre em edição"
      className={clsx(
        'relative h-full w-full outline-none',
        dropping && 'rounded-xl ring-2 ring-blue-500/60',
        className,
      )}
      onKeyDown={onKeyDown}
      onPointerDown={() => {
        // Clique fora dos elementos: tira a seleção e fecha a edição de texto.
        if (editingId) setEditingElement(null)
        selectElement(null)
        rootRef.current?.focus({ preventScroll: true })
      }}
      onPaste={(e) => {
        if (editingId) return
        const files = [...e.clipboardData.files]
        if (files.some((f) => f.type.startsWith('image/'))) {
          e.preventDefault()
          void actions.addImages(files)
        }
      }}
      onDragOver={(e) => {
        if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) {
          e.preventDefault()
          setDropping(true)
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDropping(false)
        void actions.addImages(e.dataTransfer.files, toStage(e.clientX, e.clientY))
      }}
    >
      <ScaledFrame width={slide.width} height={slide.height} frameClassName="shadow-md ring-1 ring-black/10">
        {(scale) => {
          scaleRef.current = scale
          const inv = 1 / scale
          return (
            <div
              ref={stageRef}
              className="relative overflow-hidden"
              style={{ width: slide.width, height: slide.height, background: slide.background, ['--inv' as string]: inv } as CSSProperties}
            >
              {slide.elements.map((element) => {
                const geometry = draft?.id === element.id ? draft.geometry : geometryOf(element)
                const editing = editingId === element.id
                return (
                  <div
                    key={element.id}
                    data-element-id={element.id}
                    className={clsx('free-el', editing ? 'cursor-text' : 'cursor-move')}
                    style={elementBoxStyle(element, geometry)}
                    onPointerDown={(e) => {
                      if (editing) {
                        e.stopPropagation()
                        return
                      }
                      startDrag(e, element, null)
                    }}
                    onDoubleClick={(e) => {
                      if (!editing) startEditing(element, { x: e.clientX, y: e.clientY })
                    }}
                  >
                    {element.kind === 'image' ? (
                      <FreeImageContent element={element} asset={assets[element.assetId]} />
                    ) : editing ? (
                      <div className="h-full w-full" style={textBoxCss(element)}>
                        <FreeTextEditable
                          element={element}
                          caret={caret}
                          onChange={(paragraphs) => updateElement(slide.id, element.id, { paragraphs })}
                          onSelect={(range) => setTextSelection({ elementId: element.id, ...range })}
                          onShortcut={(flag) => {
                            const range =
                              textSelection?.elementId === element.id ? textSelection : null
                            updateElement(slide.id, element.id, toggleTextFlag(element, range, flag))
                          }}
                        />
                      </div>
                    ) : (
                      <FreeTextContent element={element} />
                    )}
                  </div>
                )
              })}

              {selected && (
                <div
                  aria-hidden="true"
                  style={{
                    ...elementBoxStyle(
                      selected,
                      draft?.id === selected.id ? draft.geometry : geometryOf(selected),
                    ),
                    opacity: 1,
                    pointerEvents: 'none',
                    outline: `${2 * inv}px solid #2563eb`,
                  }}
                >
                  {editingId !== selected.id &&
                    HANDLES.map((handle) => (
                      <div
                        key={`${handle.sx}${handle.sy}`}
                        onPointerDown={(e) => startDrag(e, selected, handle)}
                        style={{
                          position: 'absolute',
                          left: `${(handle.sx + 1) * 50}%`,
                          top: `${(handle.sy + 1) * 50}%`,
                          width: 12 * inv,
                          height: 12 * inv,
                          transform: 'translate(-50%, -50%)',
                          background: '#ffffff',
                          border: `${1.5 * inv}px solid #2563eb`,
                          borderRadius: 3 * inv,
                          pointerEvents: 'auto',
                          cursor: handle.cursor,
                        }}
                      />
                    ))}
                </div>
              )}

              {guides.x.map((x) => (
                <div
                  key={`gx${x}`}
                  className="pointer-events-none absolute top-0 h-full bg-pink-500"
                  style={{ left: x - inv / 2, width: inv }}
                />
              ))}
              {guides.y.map((y) => (
                <div
                  key={`gy${y}`}
                  className="pointer-events-none absolute left-0 w-full bg-pink-500"
                  style={{ top: y - inv / 2, height: inv }}
                />
              ))}
            </div>
          )
        }}
      </ScaledFrame>

      {(actions.busy || actions.error) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <p
            className={clsx(
              'pointer-events-auto rounded-lg px-3 py-1.5 text-xs shadow',
              actions.error
                ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                : 'bg-white text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200',
            )}
          >
            {actions.error ?? 'Preparando a imagem…'}
          </p>
        </div>
      )}
    </div>
  )
}
