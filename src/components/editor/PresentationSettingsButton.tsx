import { Settings, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '../ui/Button'
import { FontSizeRow, TimerRow, ToggleRow } from './SettingsControls'

/**
 * Opções que valem para TODOS os slides. Cada slide pode sobrescrever quase
 * todas elas (ver `SlideSettingsSection`); a única exclusivamente global é o
 * pedido de nome, que acontece uma vez, antes de entrar na sala.
 */
export function PresentationSettingsButton() {
  const [open, setOpen] = useState(false)
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        title="Opções que valem para todos os slides"
      >
        <Settings size={16} /> Opções
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Opções da apresentação"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Opções da apresentação
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Valem para todos os slides. Cada slide pode sobrescrevê-las em
                  “Opções deste slide”.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              <ToggleRow
                label="Permitir limpar e trocar a resposta"
                hint="O participante pode apagar o que enviou e escolher de novo."
                checked={settings.allowChangeAnswer}
                onChange={(allowChangeAnswer) => updateSettings({ allowChangeAnswer })}
              />

              <ToggleRow
                label="Solicitar o nome antes de entrar na sala"
                hint="Vale para a sala inteira: o nome é pedido uma única vez."
                checked={settings.askName}
                onChange={(askName) =>
                  updateSettings({
                    askName,
                    // Sem nome não há como identificar as respostas.
                    identifyResponses: askName ? settings.identifyResponses : false,
                  })
                }
              />

              <ToggleRow
                label="Identificar as respostas com o nome do participante"
                hint={
                  settings.askName
                    ? 'Mostra “Nome: resposta” abaixo do slide e no PDF.'
                    : 'Disponível apenas com a solicitação de nome ativada.'
                }
                checked={settings.identifyResponses}
                disabled={!settings.askName}
                onChange={(identifyResponses) => updateSettings({ identifyResponses })}
              />

              <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <TimerRow
                  label="Tempo do cronômetro (slides de questionário)"
                  hint="Vale para os slides de alternativas. Ao acabar, as respostas são encerradas e a apresentação passa para o slide de resposta. Use 0 para deixar a pergunta sem cronômetro. Cada slide pode ter um tempo próprio em “Opções deste slide”."
                  value={settings.quizTimerSeconds}
                  onChange={(quizTimerSeconds) => updateSettings({ quizTimerSeconds })}
                />
              </div>

              <div className="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
                <FontSizeRow
                  label="Tamanho do título"
                  value={settings.titleFontSize}
                  onChange={(titleFontSize) => updateSettings({ titleFontSize })}
                />
                <FontSizeRow
                  label="Tamanho dos rótulos"
                  value={settings.labelFontSize}
                  onChange={(labelFontSize) => updateSettings({ labelFontSize })}
                />
                <FontSizeRow
                  label="Tamanho do corpo"
                  value={settings.bodyFontSize}
                  onChange={(bodyFontSize) => updateSettings({ bodyFontSize })}
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Rótulos são eixos, legendas, alternativas e nomes. O corpo é o
                  conteúdo principal do slide — nos slides de texto ele continua
                  vindo do controle “Tamanho da fonte” do próprio slide.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-neutral-200 p-5 dark:border-neutral-800">
              <Button onClick={() => setOpen(false)}>Concluir</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
