import { Plus, X } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { ChoiceOption, QuizSlide } from '../../types/presentation'
import { newId } from '../../utils/slideFactory'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Input'

interface QuizConfigProps {
  slide: QuizSlide
}

/**
 * Slide de alternativas sem gráfico (pergunta e resposta). Além das opções,
 * define o gabarito e se um slide de resposta deve ser mantido logo depois.
 */
export function QuizConfig({ slide }: QuizConfigProps) {
  const updateSlide = useEditorStore((s) => s.updateSlide)
  const correct = new Set(slide.correctOptionIds)

  function setOptions(options: ChoiceOption[]) {
    // Um gabarito que aponta para uma opção removida deixa de existir.
    const ids = new Set(options.map((o) => o.id))
    updateSlide(slide.id, {
      options,
      correctOptionIds: slide.correctOptionIds.filter((id) => ids.has(id)),
    })
  }

  function toggleCorrect(optionId: string) {
    if (slide.allowMultiple) {
      const next = new Set(correct)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      updateSlide(slide.id, { correctOptionIds: [...next] })
    } else {
      // Resposta única: clicar de novo desmarca (pergunta sem gabarito).
      updateSlide(slide.id, {
        correctOptionIds: correct.has(optionId) ? [] : [optionId],
      })
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Pergunta">
        <Input
          value={slide.title}
          onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
            Alternativas
          </span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            marque a(s) correta(s)
          </span>
        </div>

        {slide.options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-2">
            <input
              type={slide.allowMultiple ? 'checkbox' : 'radio'}
              name={`correct-${slide.id}`}
              checked={correct.has(option.id)}
              onChange={() => toggleCorrect(option.id)}
              onClick={() => {
                // Radio não dispara `change` ao clicar no já marcado; o clique
                // permite desmarcar e voltar a "sem gabarito".
                if (!slide.allowMultiple && correct.has(option.id)) toggleCorrect(option.id)
              }}
              title="Marcar como resposta correta"
              aria-label={`Alternativa ${index + 1} é a correta`}
              className="accent-green-600"
            />
            <Input
              value={option.label}
              placeholder={`Alternativa ${index + 1}`}
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
              aria-label="Remover alternativa"
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
          Adicionar alternativa
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          checked={slide.allowMultiple}
          onChange={(e) =>
            updateSlide(slide.id, {
              allowMultiple: e.target.checked,
              // Voltando para resposta única, sobra no máximo um gabarito.
              correctOptionIds: e.target.checked
                ? slide.correctOptionIds
                : slide.correctOptionIds.slice(0, 1),
            })
          }
        />
        Permitir escolher mais de uma alternativa
      </label>

      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={slide.showResponses}
          onChange={(e) => updateSlide(slide.id, { showResponses: e.target.checked })}
        />
        <span>
          Mostrar as respostas dos participantes na tela do apresentador
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            Desligado (padrão), a pergunta fica no ar sem entregar o resultado —
            só o total de quem já respondeu. Ligado, cada alternativa mostra
            votos e porcentagem (e os nomes, se a sala identificar as respostas).
          </span>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={slide.revealAnswer}
          onChange={(e) => updateSlide(slide.id, { revealAnswer: e.target.checked })}
        />
        <span>
          Adicionar um slide de resposta logo depois
          <span className="block text-xs text-neutral-500 dark:text-neutral-400">
            O slide é criado (e removido) automaticamente e mostra a alternativa
            correta com a distribuição dos votos.
          </span>
        </span>
      </label>
    </div>
  )
}
