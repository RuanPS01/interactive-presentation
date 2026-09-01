import { ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { Slide } from '../../types/presentation'
import { isInteractiveSlide } from '../../types/presentation'
import { withDefaults } from '../../utils/settings'
import {
  OverrideFontRow,
  OverrideTimerRow,
  OverrideToggleRow,
} from './SettingsControls'

interface SlideSettingsSectionProps {
  slide: Slide
}

/**
 * Sobrescritas deste slide sobre as opções globais. Tudo começa herdando; o
 * que for alterado aqui vale só para o slide (ver `utils/settings.ts`).
 */
export function SlideSettingsSection({ slide }: SlideSettingsSectionProps) {
  const [open, setOpen] = useState(false)
  const global = withDefaults(useEditorStore((s) => s.settings))
  const setOverride = useEditorStore((s) => s.setOverride)
  const overrides = slide.overrides ?? {}

  const interactive = isInteractiveSlide(slide)
  const isText = slide.type === 'text'
  const isQuiz = slide.type === 'quiz'

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-neutral-700 dark:text-neutral-200"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <SlidersHorizontal size={16} />
        Opções deste slide
        {Object.keys(overrides).length > 0 && (
          <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            {Object.keys(overrides).length} personalizada(s)
          </span>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-200 p-3 dark:border-neutral-800">
          <OverrideToggleRow
            label="Permitir limpar e trocar a resposta"
            inherited={global.allowChangeAnswer}
            value={overrides.allowChangeAnswer}
            disabled={!interactive}
            hint={interactive ? undefined : 'Só vale para slides que recebem respostas.'}
            onChange={(v) => setOverride(slide.id, 'allowChangeAnswer', v)}
          />

          <OverrideToggleRow
            label="Identificar as respostas com o nome"
            inherited={global.identifyResponses}
            value={overrides.identifyResponses}
            disabled={!interactive || !global.askName}
            hint={
              global.askName
                ? undefined
                : 'Ative "Solicitar o nome" nas opções da apresentação.'
            }
            onChange={(v) => setOverride(slide.id, 'identifyResponses', v)}
          />

          <OverrideTimerRow
            label="Tempo próprio para esta pergunta"
            inherited={global.quizTimerSeconds}
            value={overrides.quizTimerSeconds}
            disabled={!isQuiz}
            hint={
              isQuiz
                ? '0 deixa esta pergunta sem cronômetro.'
                : 'O cronômetro só vale para slides de questionário (alternativas).'
            }
            onChange={(v) => setOverride(slide.id, 'quizTimerSeconds', v)}
          />

          <OverrideFontRow
            label="Tamanho do título"
            inherited={global.titleFontSize}
            value={overrides.titleFontSize}
            onChange={(v) => setOverride(slide.id, 'titleFontSize', v)}
          />

          <OverrideFontRow
            label="Tamanho dos rótulos"
            inherited={global.labelFontSize}
            value={overrides.labelFontSize}
            onChange={(v) => setOverride(slide.id, 'labelFontSize', v)}
          />

          <OverrideFontRow
            label="Tamanho do corpo"
            inherited={global.bodyFontSize}
            value={overrides.bodyFontSize}
            disabled={isText}
            onChange={(v) => setOverride(slide.id, 'bodyFontSize', v)}
          />
          {isText && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Neste tipo de slide o corpo usa o controle “Tamanho da fonte” acima.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
