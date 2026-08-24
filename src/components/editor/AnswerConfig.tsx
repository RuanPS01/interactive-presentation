import { CheckCircle2 } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { AnswerSlide } from '../../types/presentation'
import { Field, Input } from '../ui/Input'

interface AnswerConfigProps {
  slide: AnswerSlide
}

/**
 * O slide de gabarito não tem conteúdo próprio: ele reexibe a pergunta ligada
 * a ele. Aqui só dá para renomeá-lo (o nome aparece na lista de slides) e ver
 * de onde vêm as alternativas.
 */
export function AnswerConfig({ slide }: AnswerConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)
  const quiz = useEditorStore((s) =>
    s.slides.find((x) => x.id === slide.quizSlideId && x.type === 'quiz'),
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <p>
          Slide de resposta gerado automaticamente para{' '}
          <strong>{quiz?.title || 'a pergunta anterior'}</strong>. Ele exibe as
          alternativas com o gabarito destacado. Para removê-lo, desmarque
          “Adicionar um slide de resposta” na pergunta.
        </p>
      </div>

      <Field label="Nome na lista de slides">
        <Input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
        />
      </Field>
    </div>
  )
}
