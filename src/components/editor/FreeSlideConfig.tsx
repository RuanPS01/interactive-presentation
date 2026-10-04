import { clsx } from 'clsx'
import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowDown,
  ArrowUp,
  Bold,
  BringToFront,
  Copy,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  RectangleHorizontal,
  SendToBack,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Trash2,
  Type,
  Underline,
} from 'lucide-react'
import { useId, useRef } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useFreeSlideActions } from '../../hooks/useFreeSlideActions'
import { useEditorStore } from '../../store/editorStore'
import type {
  FreeBullet,
  FreeElement,
  FreeImageElement,
  FreeSlide,
  FreeTextAlign,
  FreeTextElement,
  FreeVerticalAlign,
} from '../../types/presentation'
import { elementPlainText, FONT_CHOICES } from '../../utils/freeSlide'
import {
  formatParagraphs,
  formatTextStyle,
  paragraphValue,
  textStyleValue,
  toggleTextFlag,
} from '../../utils/freeTextFormat'
import type { TextRange } from '../../utils/freeTextFormat'
import { clearStyleKey } from '../../utils/richText'
import { Button } from '../ui/Button'
import { ColorInput } from '../ui/ColorInput'
import { Field, Input } from '../ui/Input'
import { ScrollArea } from '../ui/ScrollArea'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select } from '../ui/Select'
import { Slider } from '../ui/Slider'
import { ToggleButton } from '../ui/ToggleButton'

interface FreeSlideConfigProps {
  slide: FreeSlide
}

const SECTION = 'space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800'
const HEADING = 'text-sm font-semibold text-neutral-700 dark:text-neutral-200'
const HINT = 'text-xs text-neutral-500 dark:text-neutral-400'

function elementLabel(element: FreeElement): string {
  if (element.name) return element.name
  if (element.kind === 'image') return 'Imagem'
  const text = elementPlainText(element).replace(/\s+/g, ' ').trim()
  return text ? (text.length > 40 ? `${text.slice(0, 40)}…` : text) : 'Texto vazio'
}

/**
 * Configuração do slide livre: nome, fundo, camadas e as propriedades do
 * elemento selecionado (na prévia ao lado). A edição visual (mover,
 * redimensionar, digitar) acontece na própria prévia.
 */
export function FreeSlideConfig({ slide }: FreeSlideConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)
  const selectedId = useEditorStore((s) => s.selectedElementId)
  const selectElement = useEditorStore((s) => s.selectElement)
  const actions = useFreeSlideActions(slide.id)
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = slide.elements.find((e) => e.id === selectedId)
  // Camadas da frente para trás, como no PowerPoint.
  const layers = [...slide.elements].reverse()

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? [...e.target.files] : []
    e.target.value = ''
    if (files.length > 0) void actions.addImages(files)
  }

  return (
    <div className="space-y-4">
      <Field label="Nome na lista de slides">
        <Input value={slide.title} onChange={(e) => updateSlide(slide.id, { title: e.target.value })} />
      </Field>

      <div className="space-y-1">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Fundo do slide</span>
        <ColorInput
          aria-label="Cor de fundo do slide"
          value={slide.background}
          onChange={(background) => updateSlide(slide.id, { background: background ?? '#ffffff' })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={actions.addText}>
          <Type size={16} /> Adicionar texto
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={actions.busy}
        >
          <ImagePlus size={16} /> {actions.busy ? 'Preparando…' : 'Adicionar imagem'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onFiles}
        />
      </div>
      {actions.error && <p className="text-sm text-red-600 dark:text-red-400">{actions.error}</p>}
      <p className={HINT}>
        Clique duas vezes num texto na prévia para editá-lo. Arraste para mover e use as alças
        para redimensionar; imagens também podem ser soltas ou coladas (Ctrl+V) na prévia.
      </p>

      <section className={SECTION}>
        <h3 className={HEADING}>Camadas ({slide.elements.length})</h3>
        {layers.length === 0 ? (
          <p className={HINT}>O slide está vazio.</p>
        ) : (
          <ScrollArea className="max-h-56 space-y-1 pr-1">
            {layers.map((element) => (
              <div
                key={element.id}
                className={clsx(
                  'flex items-center gap-1 rounded-lg border px-2 py-1',
                  element.id === selectedId
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-neutral-200 dark:border-neutral-800',
                )}
              >
                <button
                  type="button"
                  onClick={() => selectElement(element.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm text-neutral-800 dark:text-neutral-100"
                >
                  {element.kind === 'image' ? (
                    <ImageIcon size={15} className="shrink-0 text-neutral-500" />
                  ) : (
                    <Type size={15} className="shrink-0 text-neutral-500" />
                  )}
                  <span className="truncate">{elementLabel(element)}</span>
                </button>
                <IconButton label="Trazer uma camada para frente" onClick={() => actions.reorder(element.id, 'forward')}>
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton label="Enviar uma camada para trás" onClick={() => actions.reorder(element.id, 'backward')}>
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton label="Excluir elemento" onClick={() => actions.remove(element.id)} danger>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
          </ScrollArea>
        )}
      </section>

      {selected ? (
        <ElementPanel slide={slide} element={selected} actions={actions} />
      ) : (
        <p className={clsx(SECTION, HINT)}>Selecione um elemento na prévia para ajustar posição, tamanho e estilo.</p>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string
  onClick: () => void
  children: ReactNode
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={clsx(
        'rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 dark:hover:bg-neutral-800',
        danger ? 'hover:text-red-600' : 'hover:text-neutral-700 dark:hover:text-neutral-100',
      )}
    >
      {children}
    </button>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min,
  suffix,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  suffix?: string
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <Input
          id={id}
          type="number"
          value={Math.round(value * 10) / 10}
          min={min}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (e.target.value !== '' && Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, n) : n)
          }}
        />
        {suffix && <span className="text-xs text-neutral-500 dark:text-neutral-400">{suffix}</span>}
      </div>
    </div>
  )
}

type Actions = ReturnType<typeof useFreeSlideActions>

function ElementPanel({ slide, element, actions }: { slide: FreeSlide; element: FreeElement; actions: Actions }) {
  const updateElement = useEditorStore((s) => s.updateElement)
  const patch = (change: Partial<FreeElement>) => updateElement(slide.id, element.id, change)

  return (
    <>
      <section className={SECTION}>
        <h3 className={HEADING}>{element.kind === 'image' ? 'Imagem selecionada' : 'Texto selecionado'}</h3>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Posição X" value={element.x} onChange={(x) => patch({ x })} suffix="px" />
          <NumberField label="Posição Y" value={element.y} onChange={(y) => patch({ y })} suffix="px" />
          <NumberField label="Largura" value={element.width} min={12} onChange={(width) => patch({ width })} suffix="px" />
          <NumberField label="Altura" value={element.height} min={12} onChange={(height) => patch({ height })} suffix="px" />
        </div>
        <Slider
          label="Rotação"
          valueLabel={`${Math.round(element.rotation ?? 0)}°`}
          min={-180}
          max={180}
          value={element.rotation ?? 0}
          onChange={(rotation) => patch({ rotation })}
        />
        <Slider
          label="Opacidade"
          valueLabel={`${Math.round((element.opacity ?? 1) * 100)}%`}
          min={0}
          max={100}
          value={Math.round((element.opacity ?? 1) * 100)}
          onChange={(value) => patch({ opacity: value / 100 })}
        />
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" size="sm" onClick={() => actions.reorder(element.id, 'front')} title="Trazer para a frente">
            <BringToFront size={15} /> Frente
          </Button>
          <Button variant="secondary" size="sm" onClick={() => actions.reorder(element.id, 'back')} title="Enviar para trás">
            <SendToBack size={15} /> Trás
          </Button>
          <Button variant="secondary" size="sm" onClick={() => actions.duplicate(element.id)} title="Duplicar (Ctrl+D)">
            <Copy size={15} /> Duplicar
          </Button>
          <Button variant="danger" size="sm" onClick={() => actions.remove(element.id)} title="Excluir (Delete)">
            <Trash2 size={15} /> Excluir
          </Button>
        </div>
      </section>

      {element.kind === 'text' ? (
        <TextPanel slide={slide} element={element} />
      ) : (
        <ImagePanel slide={slide} element={element} actions={actions} />
      )}
    </>
  )
}

const BULLETS: { value: string; label: string; bullet?: FreeBullet }[] = [
  { value: 'none', label: 'Sem marcador' },
  { value: 'dot', label: '•  Ponto', bullet: { kind: 'char', char: '•' } },
  { value: 'dash', label: '–  Traço', bullet: { kind: 'char', char: '–' } },
  { value: 'square', label: '▪  Quadrado', bullet: { kind: 'char', char: '▪' } },
  { value: 'arrow', label: '›  Seta', bullet: { kind: 'char', char: '›' } },
  { value: 'num', label: '1.  Números', bullet: { kind: 'number', format: 'arabic', suffix: '.' } },
  { value: 'alpha', label: 'a)  Letras', bullet: { kind: 'number', format: 'alphaLower', suffix: ')' } },
  { value: 'roman', label: 'i.  Romanos', bullet: { kind: 'number', format: 'romanLower', suffix: '.' } },
]

function bulletChoice(bullet: FreeBullet | undefined | 'misto'): string {
  if (bullet === 'misto') return ''
  if (!bullet) return 'none'
  const match = BULLETS.find((b) => JSON.stringify(b.bullet) === JSON.stringify(bullet))
  if (match) return match.value
  return bullet.kind === 'char' ? 'dot' : 'num'
}

function TextPanel({ slide, element }: { slide: FreeSlide; element: FreeTextElement }) {
  const updateElement = useEditorStore((s) => s.updateElement)
  const editingId = useEditorStore((s) => s.editingElementId)
  const selection = useEditorStore((s) => s.textSelection)
  const presentationFonts = useEditorStore((s) => s.fonts)
  const editing = editingId === element.id
  // Com a edição aberta, vale o trecho selecionado no texto; senão, a caixa toda.
  const range: TextRange | null = editing && selection?.elementId === element.id ? selection : null
  const hasRange = Boolean(range && range.end > range.start)

  const apply = (change: Partial<FreeTextElement>) => updateElement(slide.id, element.id, change)
  const value = <K extends Parameters<typeof textStyleValue>[2]>(key: K) => textStyleValue(element, range, key)

  const font = value('fontFamily')
  const size = value('fontSize')
  const color = value('color')
  const highlight = value('highlight')
  const align = paragraphValue(element, range, 'align')
  const bullet = paragraphValue(element, range, 'bullet')
  // As fontes embutidas (de um PowerPoint) vêm primeiro e funcionam em qualquer aparelho.
  const embedded = [...new Set(Object.values(presentationFonts).map((f) => f.family))].sort()
  const fonts = [
    ...new Set([...embedded, ...FONT_CHOICES, ...(typeof font === 'string' && font !== 'misto' ? [font] : [])]),
  ]

  const flag = (key: 'bold' | 'italic' | 'underline' | 'strike') => {
    const current = value(key)
    return { pressed: current === true, mixed: current === 'misto' }
  }

  const baseSize = element.style.fontSize ?? 48
  const [pt, pr, pb, pl] = element.padding ?? [0, 0, 0, 0]

  return (
    <section className={SECTION}>
      <h3 className={HEADING}>Texto</h3>
      <p className={HINT}>
        {hasRange
          ? 'A formatação vale para o trecho selecionado.'
          : 'A formatação vale para a caixa inteira. Para mudar só um trecho, edite o texto (clique duplo) e selecione-o.'}
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <div className="space-y-1">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Fonte</span>
          <Select
            aria-label="Fonte"
            value={font === 'misto' ? '' : (font ?? 'Arial')}
            placeholder="Várias fontes"
            options={fonts.map((f) => ({ value: f, label: embedded.includes(f) ? `${f} (embutida)` : f }))}
            onChange={(fontFamily) => apply(formatTextStyle(element, range, 'fontFamily', fontFamily))}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300" htmlFor={`size-${element.id}`}>
            Tamanho
          </label>
          <Input
            id={`size-${element.id}`}
            type="number"
            min={4}
            max={1000}
            value={size === 'misto' || size === undefined ? '' : Math.round(size * 10) / 10}
            placeholder="Misto"
            onChange={(e) => {
              const n = Number(e.target.value)
              if (e.target.value !== '' && n >= 4) apply(formatTextStyle(element, range, 'fontSize', n))
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ToggleButton label="Negrito (Ctrl+B)" {...flag('bold')} onPressedChange={() => apply(toggleTextFlag(element, range, 'bold'))}>
          <Bold size={16} />
        </ToggleButton>
        <ToggleButton label="Itálico (Ctrl+I)" {...flag('italic')} onPressedChange={() => apply(toggleTextFlag(element, range, 'italic'))}>
          <Italic size={16} />
        </ToggleButton>
        <ToggleButton label="Sublinhado (Ctrl+U)" {...flag('underline')} onPressedChange={() => apply(toggleTextFlag(element, range, 'underline'))}>
          <Underline size={16} />
        </ToggleButton>
        <ToggleButton label="Tachado" {...flag('strike')} onPressedChange={() => apply(toggleTextFlag(element, range, 'strike'))}>
          <Strikethrough size={16} />
        </ToggleButton>
        <SegmentedControl<FreeTextAlign>
          aria-label="Alinhamento horizontal"
          size="sm"
          className="ml-auto"
          value={align === 'misto' ? undefined : (align ?? 'left')}
          options={[
            { value: 'left', label: 'À esquerda', icon: <TextAlignStart size={15} /> },
            { value: 'center', label: 'Centralizado', icon: <TextAlignCenter size={15} /> },
            { value: 'right', label: 'À direita', icon: <TextAlignEnd size={15} /> },
            { value: 'justify', label: 'Justificado', icon: <TextAlignJustify size={15} /> },
          ]}
          onChange={(value) => apply(formatParagraphs(element, range, { align: value }))}
        />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Cor do texto</span>
        <ColorInput
          aria-label="Cor do texto"
          value={color === 'misto' ? undefined : color}
          mixed={color === 'misto'}
          onChange={(c) => apply(formatTextStyle(element, range, 'color', c ?? '#000000'))}
        />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Realce</span>
        <ColorInput
          aria-label="Cor de realce"
          allowNone
          value={highlight === 'misto' ? undefined : highlight}
          mixed={highlight === 'misto'}
          onChange={(c) => apply(formatTextStyle(element, range, 'highlight', c))}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Marcadores</span>
          <Select
            aria-label="Marcadores"
            value={bulletChoice(bullet)}
            placeholder="Vários"
            options={BULLETS.map((b) => ({ value: b.value, label: b.label }))}
            onChange={(choice) => {
              const picked = BULLETS.find((b) => b.value === choice)?.bullet
              // O marcador precisa de margem para ficar pendurado à esquerda do texto.
              const indent = picked ? Math.round(baseSize * 1.1) : undefined
              apply(formatParagraphs(element, range, { bullet: picked, indent, hanging: indent }))
            }}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Posição vertical</span>
          <SegmentedControl<FreeVerticalAlign>
            aria-label="Alinhamento vertical"
            size="sm"
            className="w-full"
            value={element.verticalAlign ?? 'top'}
            options={[
              { value: 'top', label: 'Em cima', icon: <AlignVerticalJustifyStart size={15} /> },
              { value: 'middle', label: 'No meio', icon: <AlignVerticalJustifyCenter size={15} /> },
              { value: 'bottom', label: 'Embaixo', icon: <AlignVerticalJustifyEnd size={15} /> },
            ]}
            onChange={(verticalAlign) => apply({ verticalAlign })}
          />
        </div>
      </div>

      <Slider
        label="Altura da linha"
        valueLabel={(element.lineHeight ?? 1.2).toFixed(2)}
        min={0.8}
        max={2.5}
        step={0.05}
        value={element.lineHeight ?? 1.2}
        onChange={(lineHeight) =>
          apply({
            lineHeight,
            // A altura da caixa passa a valer para todos os parágrafos.
            paragraphs: element.paragraphs.map((p) => ({ ...p, lineHeight: undefined })),
          })
        }
      />

      <Slider
        label="Margem interna"
        valueLabel={`${Math.round(Math.max(pt, pr, pb, pl))}px`}
        min={0}
        max={120}
        value={Math.round(Math.max(pt, pr, pb, pl))}
        onChange={(n) => apply({ padding: [n, n, n, n] })}
      />

      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Fundo da caixa</span>
        <ColorInput
          aria-label="Cor de fundo da caixa de texto"
          allowNone
          value={element.background}
          onChange={(background) => apply({ background })}
        />
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          apply({
            paragraphs: (['bold', 'italic', 'underline', 'strike', 'color', 'highlight', 'fontSize', 'fontFamily'] as const).reduce(
              (paragraphs, key) => clearStyleKey(paragraphs, key),
              element.paragraphs,
            ),
          })
        }
        title="Remove os estilos dos trechos; fica só o estilo da caixa"
      >
        <RectangleHorizontal size={15} /> Uniformizar formatação
      </Button>
    </section>
  )
}

function ImagePanel({
  slide,
  element,
  actions,
}: {
  slide: FreeSlide
  element: FreeImageElement
  actions: Actions
}) {
  const updateElement = useEditorStore((s) => s.updateElement)
  const asset = useEditorStore((s) => s.assets[element.assetId])
  const fileRef = useRef<HTMLInputElement>(null)
  const apply = (change: Partial<FreeImageElement>) => updateElement(slide.id, element.id, change)

  return (
    <section className={SECTION}>
      <h3 className={HEADING}>Imagem</h3>
      <div className="space-y-1">
        <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Encaixe na caixa</span>
        <SegmentedControl
          aria-label="Encaixe da imagem"
          className="w-full"
          value={element.fit ?? 'fill'}
          options={[
            { value: 'fill', label: 'Esticar' },
            { value: 'contain', label: 'Conter' },
            { value: 'cover', label: 'Preencher' },
          ]}
          onChange={(fit) => apply({ fit })}
        />
      </div>
      <Slider
        label="Cantos arredondados"
        valueLabel={`${Math.round(element.radius ?? 0)}px`}
        min={0}
        max={Math.round(Math.min(element.width, element.height) / 2)}
        value={element.radius ?? 0}
        onChange={(radius) => apply({ radius })}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={actions.busy}>
          <ImagePlus size={15} /> Trocar imagem
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!asset}
          onClick={() => asset && apply({ height: Math.round((element.width * asset.height) / asset.width) })}
        >
          Proporção original
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void actions.replaceImage(element.id, file)
          }}
        />
      </div>
      {asset && (
        <p className={HINT}>
          Arquivo de {asset.width} x {asset.height} px.
        </p>
      )}
    </section>
  )
}
