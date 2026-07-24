import { Plus, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { ChoiceSlide } from '../../types/presentation'
import { newId } from '../../utils/slideFactory'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'

interface ChoiceConfigProps {
  slide: ChoiceSlide
}

/** Configuração compartilhada por gráfico de barras e de pizza. */
export function ChoiceConfig({ slide }: ChoiceConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)

  function setOptions(options: ChoiceSlide['options']) {
    updateSlide(slide.id, { options })
  }

  return (
    <div className="space-y-4">
      <Field label="Título do slide">
        <Input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Opções
        </span>
        {slide.options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <Input
              value={option.label}
              placeholder={`Opção ${index + 1}`}
              onChange={(e) =>
                setOptions(
                  slide.options.map((o) =>
                    o.id === option.id ? { ...o, label: e.target.value } : o,
                  ),
                )
              }
            />
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remover opção"
              disabled={slide.options.length <= 1}
              onClick={() => setOptions(slide.options.filter((o) => o.id !== option.id))}
            >
              <X size={16} />
            </Button>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOptions([...slide.options, { id: newId(), label: '' }])}
        >
          <Plus size={16} />
          Adicionar opção
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          checked={slide.allowMultiple}
          onChange={(e) => updateSlide(slide.id, { allowMultiple: e.target.checked })}
        />
        Permitir escolher mais de uma opção
      </label>
    </div>
  )
}
