import { useEditorStore } from '../../store/editorStore'
import type { SlideType } from '../../types/presentation'
import { SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

const TYPES: SlideType[] = ['wordcloud', 'bar', 'pie', 'text']

/** Botões para adicionar um novo slide de cada um dos 4 tipos. */
export function AddSlideMenu() {
  const addSlide = useEditorStore((s) => s.addSlide)

  return (
    <div className="grid grid-cols-2 gap-2">
      {TYPES.map((type) => {
        const Icon = SLIDE_TYPE_ICONS[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => addSlide(type)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-300 bg-white p-3 text-center text-xs font-medium text-neutral-700 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Icon size={24} strokeWidth={1.75} />
            {SLIDE_TYPE_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
