import { useEditorStore } from '../../store/editorStore'
import type { WordCloudSlide, WordLimitMode } from '../../types/presentation'
import { Radio } from '../ui/Checkbox'
import { Field, Input } from '../ui/Input'

interface WordCloudConfigProps {
  slide: WordCloudSlide
}

const MODES: { value: WordLimitMode; label: string }[] = [
  { value: 'unlimited', label: 'Quantas quiser (padrão)' },
  { value: 'one', label: 'Apenas 1 palavra' },
  { value: 'range', label: 'De 1 até um limite' },
]

export function WordCloudConfig({ slide }: WordCloudConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)

  return (
    <div className="space-y-4">
      <Field label="Título do slide">
        <Input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Quantas palavras cada participante pode enviar?
        </legend>
        {MODES.map((mode) => (
          <Radio
            key={mode.value}
            name={`wordmode-${slide.id}`}
            label={mode.label}
            checked={slide.wordLimitMode === mode.value}
            onChange={() => updateSlide(slide.id, { wordLimitMode: mode.value })}
          />
        ))}
      </fieldset>

      {slide.wordLimitMode === 'range' && (
        <Field label="Limite de palavras (N)">
          <Input
            type="number"
            min={1}
            max={50}
            value={slide.maxWords}
            onChange={(e) =>
              updateSlide(slide.id, {
                maxWords: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
              })
            }
          />
        </Field>
      )}
    </div>
  )
}
