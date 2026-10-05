import { Settings } from 'lucide-react'
import { useDialogControl } from '../../hooks/useDialogControl'
import type { DialogControlProps } from '../../hooks/useDialogControl'
import { useEditorStore } from '../../store/editorStore'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'
import { SLIDE_ASPECTS } from '../../utils/settings'
import type { SlideAspect } from '../../types/presentation'
import { FontSizeRow, TimerRow } from './SettingsControls'

/**
 * Opções que valem para TODOS os slides. Cada slide pode sobrescrever quase
 * todas elas (ver `SlideSettingsSection`); a única exclusivamente global é o
 * pedido de nome, que acontece uma vez, antes de entrar na sala.
 */
export function PresentationSettingsButton(props: DialogControlProps) {
  const [open, setOpen] = useDialogControl(props)
  const settings = useEditorStore((s) => s.settings)
  const updateSettings = useEditorStore((s) => s.updateSettings)

  return (
    <>
      {props.trigger !== false && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          title="Opções que valem para todos os slides"
        >
          <Settings size={16} /> Opções
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Opções da apresentação"
        description={
          <>
            Valem para todos os slides. Cada slide pode sobrescrevê-las em
            “Opções deste slide”.
          </>
        }
        footer={<Button onClick={() => setOpen(false)}>Concluir</Button>}
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-neutral-700 dark:text-neutral-200">
              Formato dos slides
            </span>
            <SegmentedControl<SlideAspect>
              aria-label="Formato dos slides"
              value={settings.slideAspect}
              options={SLIDE_ASPECTS.map((aspect) => ({
                value: aspect,
                label: aspect === '16:9' ? '16:9 (widescreen)' : '4:3 (padrão antigo)',
              }))}
              onChange={(slideAspect) => updateSettings({ slideAspect })}
            />
            <span className="block text-xs text-neutral-500 dark:text-neutral-400">
              Moldura da prévia e tamanho dos slides livres. Trocar o formato
              redimensiona os slides livres para caber, sem cortar nada.
            </span>
          </div>

          <Checkbox
            label="Permitir limpar e trocar a resposta"
            hint="O participante pode apagar o que enviou e escolher de novo."
            checked={settings.allowChangeAnswer}
            onChange={(allowChangeAnswer) => updateSettings({ allowChangeAnswer })}
          />

          <Checkbox
            label="Permitir que os participantes baixem os slides no fim"
            hint="Quando a apresentação termina, o celular oferece os slides em PDF e PowerPoint, sem a resposta de ninguém."
            checked={settings.allowDownload}
            onChange={(allowDownload) => updateSettings({ allowDownload })}
          />

          <Checkbox
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

          <Checkbox
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
              conteúdo principal do slide; nos slides de texto ele continua
              vindo do controle “Tamanho da fonte” do próprio slide.
            </p>
          </div>
        </div>
      </Modal>
    </>
  )
}
