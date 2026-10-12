import { clsx } from 'clsx'
import { Plus } from 'lucide-react'
import { useEditorStore } from '../../store/editorStore'
import type { SlideType } from '../../types/presentation'
import { CREATABLE_SLIDE_TYPES, SLIDE_TYPE_LABELS } from '../../utils/slideFactory'
import { Menu } from '../ui/Menu'
import { SLIDE_TYPE_ICONS } from './slideTypeIcons'

/** Uma linha do que cada tipo faz, abaixo do nome no menu. */
const HINTS: Partial<Record<SlideType, string>> = {
  wordcloud: 'Respostas curtas viram uma nuvem ao vivo',
  bar: 'Votação com o resultado em barras',
  pie: 'Votação com o resultado em pizza',
  quiz: 'Pergunta com alternativas e gabarito',
  text: 'Um texto grande, sem respostas',
  free: 'Caixas de texto e imagens livres',
}

/**
 * "Adicionar slide": um botão da largura da coluna que abre o menu dos tipos
 * criáveis, cada um com o ícone, o nome e uma linha do que faz. Ocupa uma
 * linha só, e a lista de slides fica à vista logo abaixo.
 */
export function AddSlideMenu({ className }: { className?: string }) {
  const addSlide = useEditorStore((s) => s.addSlide)
  return (
    <Menu
      label="Adicionar slide"
      heading="Escolha o tipo"
      align="start"
      className={clsx('w-full', className)}
      buttonClassName="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      button={
        <>
          <Plus size={16} aria-hidden="true" /> Adicionar slide
        </>
      }
      items={CREATABLE_SLIDE_TYPES.map((type) => {
        const Icon = SLIDE_TYPE_ICONS[type]
        return {
          key: type,
          label: SLIDE_TYPE_LABELS[type],
          hint: HINTS[type],
          icon: <Icon size={16} className="text-neutral-500 dark:text-neutral-400" />,
          onSelect: () => addSlide(type),
        }
      })}
    />
  )
}
