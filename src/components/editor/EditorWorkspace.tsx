import { Eye, ListOrdered, Maximize2, Minimize2, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useEditorStore } from '../../store/editorStore'
import type { FreeSlide, Slide, SlideAspect } from '../../types/presentation'
import { registerFonts } from '../../utils/fonts/faces'
import { resolveSlideSettings, SLIDE_ASPECTS, SLIDE_FRAMES } from '../../utils/settings'
import { SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { slideTimerSeconds } from '../../utils/timer'
import { FreeSlideCanvas } from '../free/FreeSlideCanvas'
import { ScaledFrame } from '../slides/ScaledFrame'
import { SlideDisplay } from '../slides/SlideDisplay'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ScrollArea } from '../ui/ScrollArea'
import { SegmentedControl } from '../ui/SegmentedControl'
import { StackSection } from '../ui/StackSection'
import { AddSlideMenu } from './AddSlideMenu'
import { FreeSlideConfig } from './FreeSlideConfig'
import { SlideEditor } from './SlideEditor'
import { SlideList } from './SlideList'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

const ASPECT_OPTIONS = SLIDE_ASPECTS.map((aspect) => ({ value: aspect, label: aspect }))

/** A partir desta largura, as três colunas; abaixo, a pilha de seções. */
const WIDE_QUERY = '(min-width: 1024px)'

/**
 * Editor da apresentação, usado na criação e na edição de uma sala já
 * iniciada; trabalha sobre o editor do contexto (ver `store/editorStore`).
 *
 * - A partir de 1024 px: três colunas (slides, configuração, prévia), cada
 *   uma com rolagem própria, e a página com a altura da janela.
 * - Abaixo disso: uma pilha de seções recolhíveis (slides, prévia,
 *   configuração), na rolagem natural da página.
 *
 * Cada painel é escrito uma vez e encaixado na montagem escolhida pela
 * largura (uma montagem por vez, nunca as duas escondidas por CSS).
 *
 * A prévia desenha o slide na moldura do formato escolhido (16:9 ou 4:3, em
 * 1920 x 1080 ou 1440 x 1080) e reduz por inteiro: o que se vê nela tem a
 * mesma proporção da tela do projetor. No slide livre, a prévia é o próprio
 * editor visual, que pode ser ampliado para a tela inteira.
 */
export function EditorWorkspace() {
  const slides = useEditorStore((s) => s.slides)
  const settings = useEditorStore((s) => s.settings)
  const selectedIndex = useEditorStore((s) => s.selectedIndex)
  const assets = useEditorStore((s) => s.assets)
  const fonts = useEditorStore((s) => s.fonts)
  // Fontes embutidas (de um PowerPoint ou de um JSON): registradas no
  // documento, os textos que as citam passam a usá-las sozinhos.
  useEffect(() => {
    void registerFonts(Object.values(fonts))
  }, [fonts])
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const [expanded, setExpanded] = useState(false)
  const wide = useMediaQuery(WIDE_QUERY)
  const [open, setOpen] = useState({ slides: true, preview: true, config: true })
  const toggle = (key: keyof typeof open) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  const selectedSlide = slides[selectedIndex]
  const freeSlide = selectedSlide?.type === 'free' ? selectedSlide : undefined
  const frame = SLIDE_FRAMES[settings.slideAspect]
  const previewSettings = resolveSlideSettings(settings, selectedSlide)
  // A prévia mostra o cronômetro parado no tempo configurado, para o
  // apresentador conferir como o slide fica com ele na tela.
  const previewTimerSeconds = slideTimerSeconds(selectedSlide, previewSettings)

  const aspectControl = (
    <SegmentedControl<SlideAspect>
      aria-label="Formato dos slides"
      size="sm"
      value={settings.slideAspect}
      options={ASPECT_OPTIONS}
      onChange={(slideAspect) => updateSettings({ slideAspect })}
    />
  )

  const previewControls = (
    <div className="flex flex-wrap items-center gap-2">
      {aspectControl}
      {freeSlide && (
        <Button variant="secondary" size="sm" onClick={() => setExpanded(true)} title="Editar o slide em tela cheia">
          <Maximize2 size={15} /> Ampliar
        </Button>
      )}
    </div>
  )

  const typeBadge = selectedSlide ? <TypeBadge slide={selectedSlide} /> : null

  const configBody = selectedSlide ? (
    <SlideEditor slide={selectedSlide} />
  ) : (
    <p className="text-sm text-neutral-500 dark:text-neutral-400">Selecione ou adicione um slide para editar.</p>
  )

  const previewStage = freeSlide ? (
    expanded ? (
      <p className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
        Editando no modo ampliado.
      </p>
    ) : (
      <FreeSlideCanvas slide={freeSlide} assets={assets} />
    )
  ) : selectedSlide ? (
    <ScaledFrame
      width={frame.width}
      height={frame.height}
      frameClassName="bg-neutral-50 shadow-md ring-1 ring-black/10 dark:bg-neutral-950 dark:ring-white/10"
    >
      {/* O mesmo respiro da tela do projetor. */}
      <div className="flex h-full w-full flex-col px-6 py-6">
        <SlideDisplay
          slide={selectedSlide}
          slides={slides}
          responses={[]}
          settings={previewSettings}
          assets={assets}
          countdown={
            previewTimerSeconds > 0 ? { endsAt: null, remainingMs: previewTimerSeconds * 1000 } : null
          }
        />
      </div>
    </ScaledFrame>
  ) : (
    <p className="flex h-full items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">
      Sem slide.
    </p>
  )

  const expandedEditor =
    freeSlide && expanded ? (
      <ExpandedFreeEditor slide={freeSlide} aspectControl={aspectControl} onClose={() => setExpanded(false)} />
    ) : null

  if (!wide) {
    return (
      <div className="min-w-0 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <StackSection
          title={`Slides (${slides.length})`}
          icon={ListOrdered}
          open={open.slides}
          onToggle={() => toggle('slides')}
        >
          <div className="space-y-3 p-3">
            <AddSlideMenu />
            <SlideList />
          </div>
        </StackSection>
        <StackSection
          title={freeSlide ? 'Prévia e edição' : 'Prévia'}
          icon={Eye}
          open={open.preview}
          onToggle={() => toggle('preview')}
        >
          <div className="space-y-3 p-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              {typeBadge}
              {previewControls}
            </div>
            <div
              className="w-full overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800/60"
              style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
            >
              {previewStage}
            </div>
          </div>
        </StackSection>
        <StackSection
          title="Configuração"
          icon={SlidersHorizontal}
          badge={typeBadge}
          open={open.config}
          onToggle={() => toggle('config')}
        >
          <div className="p-3">{configBody}</div>
        </StackSection>
        {expandedEditor}
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 xl:grid-cols-[290px_minmax(0,0.9fr)_minmax(0,1.35fr)]">
      {/* Coluna 1: adicionar + lista de slides */}
      <Card className="flex min-h-0 min-w-0 flex-col p-3">
        <div className="mb-3 shrink-0 space-y-3">
          <AddSlideMenu />
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Slides ({slides.length})</h2>
        </div>
        <ScrollArea className="min-h-0 flex-1 pr-1">
          <SlideList />
        </ScrollArea>
      </Card>

      {/* Coluna 2: configuração do slide */}
      <Card className="flex min-h-0 min-w-0 flex-col p-4">
        <div className="mb-4 flex shrink-0 min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Configuração</h2>
          <span className="ml-auto min-w-0">{typeBadge}</span>
        </div>
        <ScrollArea className="min-h-0 flex-1 pr-1">{configBody}</ScrollArea>
      </Card>

      {/* Coluna 3: prévia (e editor visual do slide livre) */}
      <Card className="flex min-h-0 min-w-0 flex-col p-4">
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {freeSlide ? 'Prévia e edição' : 'Prévia'}
          </h2>
          <div className="ml-auto">{previewControls}</div>
        </div>
        <div className="min-h-0 flex-1">{previewStage}</div>
      </Card>

      {expandedEditor}
    </div>
  )
}

/** Selo com o ícone e o nome do tipo do slide selecionado. */
function TypeBadge({ slide }: { slide: Slide }) {
  const Icon = SLIDE_TYPE_ICONS[slide.type]
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      <Icon size={12} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{SLIDE_TYPE_LABELS[slide.type]}</span>
    </span>
  )
}

/** Editor do slide livre ocupando a tela: o slide grande e o painel ao lado. */
function ExpandedFreeEditor({
  slide,
  aspectControl,
  onClose,
}: {
  slide: FreeSlide
  aspectControl: ReactNode
  onClose: () => void
}) {
  const assets = useEditorStore((s) => s.assets)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // O Esc que o slide usou (sair da edição ou da seleção) não fecha o editor.
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Editor ampliado: ${slide.title}`}
      className="fixed inset-0 z-40 flex flex-col bg-neutral-100 dark:bg-neutral-950"
    >
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="min-w-0 truncate text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {slide.title || 'Slide livre'}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {aspectControl}
          <Button variant="secondary" size="sm" onClick={onClose}>
            <Minimize2 size={15} /> Fechar (Esc)
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,40%)] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1">
        <div className="min-h-0 min-w-0 p-4 lg:p-8">
          <FreeSlideCanvas slide={slide} assets={assets} />
        </div>
        <ScrollArea className="min-h-0 border-t border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 lg:border-l lg:border-t-0">
          <FreeSlideConfig slide={slide} />
        </ScrollArea>
      </div>
    </div>,
    document.body,
  )
}
