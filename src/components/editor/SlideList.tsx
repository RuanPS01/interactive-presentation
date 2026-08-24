import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, Link2, Trash2 } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import { SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

/** Lista ordenável de slides do editor. */
export function SlideList() {
  const slides = useEditorStore((s) => s.slides)
  const selectedIndex = useEditorStore((s) => s.selectedIndex)
  const select = useEditorStore((s) => s.select)
  const moveSlide = useEditorStore((s) => s.moveSlide)
  const removeSlide = useEditorStore((s) => s.removeSlide)

  if (slides.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
        Nenhum slide ainda. Adicione um acima.
      </p>
    )
  }

  return (
    <ol className="space-y-2">
      {slides.map((slide, index) => {
        const Icon = SLIDE_TYPE_ICONS[slide.type]
        // O gabarito fica preso ao seu quiz: não se move sozinho na lista.
        const linked = slide.type === 'answer'
        return (
        <li key={slide.id}>
          <div
            className={clsx(
              'flex items-center gap-2 rounded-xl border p-2 transition',
              index === selectedIndex
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-neutral-200 bg-white hover:border-blue-300 dark:border-neutral-800 dark:bg-neutral-900',
              linked && 'ml-3',
            )}
          >
            <button
              type="button"
              onClick={() => select(index)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <Icon size={18} strokeWidth={1.75} className="shrink-0 text-neutral-500 dark:text-neutral-400" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  {slide.title || SLIDE_TYPE_LABELS[slide.type]}
                </span>
                <span className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {linked && <Link2 size={12} />}
                  {index + 1}. {SLIDE_TYPE_LABELS[slide.type]}
                </span>
              </span>
            </button>
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Mover para cima"
                disabled={index === 0 || linked}
                onClick={() => moveSlide(index, index - 1)}
                className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-100"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                aria-label="Mover para baixo"
                disabled={index === slides.length - 1 || linked}
                onClick={() => moveSlide(index, index + 1)}
                className="px-1 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-100"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <button
              type="button"
              aria-label="Remover slide"
              title={
                linked
                  ? 'Remover o slide de resposta (desliga a revelação na pergunta)'
                  : 'Remover slide'
              }
              onClick={() => removeSlide(slide.id)}
              className="px-1 text-neutral-400 hover:text-red-600"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </li>
        )
      })}
    </ol>
  )
}
