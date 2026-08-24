import { useEditorStore } from '../../store/editorStore'
import { CREATABLE_SLIDE_TYPES, SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

/** Botões para adicionar um novo slide de cada tipo criável manualmente. */
export function AddSlideMenu() {
  const addSlide = useEditorStore((s) => s.addSlide)

  return (
    <div className="grid grid-cols-2 gap-2">
      {CREATABLE_SLIDE_TYPES.map((type) => {
        const Icon = SLIDE_TYPE_ICONS[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => addSlide(type)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-neutral-300 bg-white p-3 text-center text-xs font-medium text-neutral-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <Icon size={24} strokeWidth={1.75} />
            {SLIDE_TYPE_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
