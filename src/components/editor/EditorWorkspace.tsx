import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useEditorStore } from '../../store/editorStore'
import type { FreeSlide, SlideAspect } from '../../types/presentation'
import { resolveSlideSettings, SLIDE_ASPECTS, SLIDE_FRAMES } from '../../utils/settings'
import { slideTimerSeconds } from '../../utils/timer'
import { FreeSlideCanvas } from '../free/FreeSlideCanvas'
import { ScaledFrame } from '../slides/ScaledFrame'
import { SlideDisplay } from '../slides/SlideDisplay'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ScrollArea } from '../ui/ScrollArea'
import { SegmentedControl } from '../ui/SegmentedControl'
import { AddSlideMenu } from './AddSlideMenu'
import { FreeSlideConfig } from './FreeSlideConfig'
import { SlideEditor } from './SlideEditor'
import { SlideList } from './SlideList'

const ASPECT_OPTIONS = SLIDE_ASPECTS.map((aspect) => ({ value: aspect, label: aspect }))

/**
 * Editor em 3 colunas: adicionar e listar slides, configurar o selecionado e a
 * prévia. Usado na criação de uma apresentação e na edição de uma sala já
 * iniciada; trabalha sobre o editor do contexto (ver `store/editorStore`).
 *
 * A prévia desenha o slide na moldura do formato escolhido (16:9 ou 4:3, em
 * 1920 x 1080 ou 1440 x 1080) e reduz por inteiro: o que se vê nela tem a
 * mesma proporção da tela do projetor. No slide livre, a prévia é o próprio
 * editor visual, que pode ser ampliado para a tela inteira.
 *
 * Em telas grandes cada coluna rola por conta própria e a página não cresce
 * conforme os slides são adicionados. Abaixo de `lg` volta ao empilhamento
 * natural, sem limite de altura.
 */
export function EditorWorkspace() {
  const slides = useEditorStore((s) => s.slides)
  const settings = useEditorStore((s) => s.settings)
  const selectedIndex = useEditorStore((s) => s.selectedIndex)
  const assets = useEditorStore((s) => s.assets)
  const updateSettings = useEditorStore((s) => s.updateSettings)
  const [expanded, setExpanded] = useState(false)

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

  return (
    <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[260px_minmax(0,0.9fr)_minmax(0,1.35fr)]">
      {/* Coluna 1: adicionar + lista de slides */}
      <div className="flex flex-col gap-4 lg:min-h-0">
        <Card className="shrink-0 p-3">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Adicionar slide
          </h2>
          <AddSlideMenu />
        </Card>
        <Card className="flex flex-col p-3 lg:min-h-0 lg:flex-1">
          <h2 className="mb-2 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Slides ({slides.length})
          </h2>
          <ScrollArea className="lg:min-h-0 lg:flex-1 lg:pr-1">
            <SlideList />
          </ScrollArea>
        </Card>
      </div>

      {/* Coluna 2: configuração do slide */}
      <Card className="flex flex-col p-4 lg:min-h-0">
        <h2 className="mb-4 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Configuração
        </h2>
        <ScrollArea className="lg:min-h-0 lg:flex-1 lg:pr-1">
          {selectedSlide ? (
            <SlideEditor slide={selectedSlide} />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Selecione ou adicione um slide para editar.
            </p>
          )}
        </ScrollArea>
      </Card>

      {/* Coluna 3: prévia (e editor visual do slide livre) */}
      <Card className="flex flex-col p-4 lg:min-h-0">
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            {freeSlide ? 'Prévia e edição' : 'Prévia'}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {aspectControl}
            {freeSlide && (
              <Button variant="secondary" size="sm" onClick={() => setExpanded(true)} title="Editar o slide em tela cheia">
                <Maximize2 size={15} /> Ampliar
              </Button>
            )}
          </div>
        </div>
        <div className="aspect-video min-h-[240px] lg:aspect-auto lg:min-h-0 lg:flex-1">
          {freeSlide ? (
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
                    previewTimerSeconds > 0
                      ? { endsAt: null, remainingMs: previewTimerSeconds * 1000 }
                      : null
                  }
                />
              </div>
            </ScaledFrame>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem slide.</p>
          )}
        </div>
      </Card>

      {freeSlide && expanded && (
        <ExpandedFreeEditor
          slide={freeSlide}
          aspectControl={aspectControl}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  )
}

/** Editor do slide livre ocupando a tela: o slide grande e o painel ao lado. */
function ExpandedFreeEditor({
  slide,
  aspectControl,
  onClose,
}: {
  slide: FreeSlide
  aspectControl: React.ReactNode
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
        <div className="min-h-0 p-4 lg:p-8">
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
