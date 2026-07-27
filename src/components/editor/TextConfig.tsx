import { clsx } from 'clsx'
import { useEditorStore } from '../../store/editorStore'
import type { TextAlign, TextSlide } from '../../types/presentation'
import { Field, Input, Textarea } from '../ui/Input'

interface TextConfigProps {
  slide: TextSlide
}

const ALIGNMENTS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Esquerda' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Direita' },
]

export function TextConfig({ slide }: TextConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)

  return (
    <div className="space-y-4">
      <Field label="Título do slide">
        <Input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
        />
      </Field>

      <Field label="Texto">
        <Textarea
          rows={5}
          value={slide.content}
          onChange={(e) => updateSlide(slide.id, { content: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
          Alinhamento
        </span>
        <div className="flex gap-2">
          {ALIGNMENTS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => updateSlide(slide.id, { align: a.value })}
              className={clsx(
                'flex-1 rounded-lg border px-3 py-2 text-sm transition',
                slide.align === a.value
                  ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100'
                  : 'border-neutral-300 hover:border-blue-300 dark:border-neutral-700',
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <Field label={`Tamanho da fonte: ${slide.fontSize}px`}>
        <input
          type="range"
          min={16}
          max={120}
          step={2}
          value={slide.fontSize}
          onChange={(e) => updateSlide(slide.id, { fontSize: Number(e.target.value) })}
          className="w-full"
        />
      </Field>
    </div>
  )
}
