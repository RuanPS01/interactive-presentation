import { useEditorStore } from '../../store/editorStore'
import { resolveSlideSettings } from '../../utils/settings'
import { slideTimerSeconds } from '../../utils/timer'
import { SlideDisplay } from '../slides/SlideDisplay'
import { Card } from '../ui/Card'
import { ScrollArea } from '../ui/ScrollArea'
import { AddSlideMenu } from './AddSlideMenu'
import { SlideEditor } from './SlideEditor'
import { SlideList } from './SlideList'

/**
 * Editor em 3 colunas: adicionar e listar slides, configurar o selecionado e a
 * prévia. Usado na criação de uma apresentação e na edição de uma sala já
 * iniciada; trabalha sobre o editor do contexto (ver `store/editorStore`).
 *
 * Em telas grandes cada coluna rola por conta própria e a página não cresce
 * conforme os slides são adicionados. Abaixo de `lg` volta ao empilhamento
 * natural, sem limite de altura.
 */
export function EditorWorkspace() {
  const slides = useEditorStore((s) => s.slides)
  const settings = useEditorStore((s) => s.settings)
  const selectedIndex = useEditorStore((s) => s.selectedIndex)

  const selectedSlide = slides[selectedIndex]
  const previewSettings = resolveSlideSettings(settings, selectedSlide)
  // A prévia mostra o cronômetro parado no tempo configurado, para o
  // apresentador conferir como o slide fica com ele na tela.
  const previewTimerSeconds = slideTimerSeconds(selectedSlide, previewSettings)

  return (
    <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)]">
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

      {/* Coluna 3: prévia */}
      <Card className="flex flex-col p-4 lg:min-h-0">
        <h2 className="mb-4 shrink-0 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          Prévia
        </h2>
        <ScrollArea axis="both" className="min-h-[360px] flex-1 lg:min-h-0">
          {selectedSlide ? (
            <SlideDisplay
              slide={selectedSlide}
              slides={slides}
              responses={[]}
              settings={previewSettings}
              countdown={
                previewTimerSeconds > 0
                  ? { endsAt: null, remainingMs: previewTimerSeconds * 1000 }
                  : null
              }
            />
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sem slide.</p>
          )}
        </ScrollArea>
      </Card>
    </div>
  )
}
