import { FileDown, FileUp, Moon, MoreHorizontal, Settings, Sparkles, Sun } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useThemeStore } from '../../store/themeStore'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Menu } from '../ui/Menu'
import type { MenuEntry } from '../ui/Menu'
import { AiPromptButton } from './AiPromptButton'
import { ExportDialog } from './ExportDialog'
import { ImportDialog } from './ImportDialog'
import { PresentationSettingsButton } from './PresentationSettingsButton'

interface EditorToolbarProps {
  /** Botão de voltar (Início, ou Voltar à apresentação). */
  back: ReactNode
  title: string
  onTitleChange: (title: string) => void
  /** A ação principal, sempre à vista ("Iniciar apresentação", "Salvar"). */
  primary: ReactNode
  /** Texto curto ao lado do título (o estado do rascunho, por exemplo). */
  status?: ReactNode
  /** Ações raras ou destrutivas: ficam no menu mesmo na janela larga. */
  rareItems?: MenuEntry[]
  /** Erro da importação (ou `null` quando ela deu certo). */
  onImportError: (message: string | null) => void
}

interface Action {
  key: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

/**
 * Barra do editor, a mesma na criação e na edição de uma sala.
 *
 * - Sempre à vista: o título (linha inteira no celular, ao lado das ações a
 *   partir de `sm`), a ação principal e o botão "Mais".
 * - A partir de `xl` (1280 px), as ações secundárias (Opções, Prompt de IA,
 *   Importar, Exportar e o tema) aparecem como botões; abaixo disso, ficam no
 *   menu "Mais".
 * - Os modais são montados UMA vez, sem o botão próprio, e os dois caminhos
 *   (botão e item do menu) mudam o mesmo estado de abertura. Montar o
 *   componente duas vezes, um escondido por CSS, abriria dois modais.
 */
export function EditorToolbar({
  back,
  title,
  onTitleChange,
  primary,
  status,
  rareItems = [],
  onImportError,
}: EditorToolbarProps) {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const actions: Action[] = [
    { key: 'settings', label: 'Opções', icon: Settings, onSelect: () => setSettingsOpen(true) },
    { key: 'ai', label: 'Prompt de IA', icon: Sparkles, onSelect: () => setAiOpen(true) },
    { key: 'import', label: 'Importar', icon: FileUp, onSelect: () => setImportOpen(true) },
    { key: 'export', label: 'Exportar', icon: FileDown, onSelect: () => setExportOpen(true) },
  ]
  const themeItem: MenuEntry = {
    key: 'theme',
    label: theme === 'dark' ? 'Tema claro' : 'Tema escuro',
    icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
    onSelect: toggleTheme,
  }
  const narrowItems: MenuEntry[] = [
    ...actions.map(({ key, label, icon: Icon, onSelect }) => ({
      key,
      label,
      onSelect,
      icon: <Icon size={16} />,
    })),
    themeItem,
    ...(rareItems.length > 0 ? ['separator' as const, ...rareItems] : []),
  ]
  const moreButtonClass =
    'flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
          {back}
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título da apresentação"
            aria-label="Título da apresentação"
            className="min-w-0 flex-1 sm:max-w-sm"
          />
          {status && (
            <span className="hidden shrink-0 text-xs text-neutral-500 md:inline dark:text-neutral-400">{status}</span>
          )}
        </div>
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto sm:shrink-0">
          {/* Janela larga: as ações como botões. */}
          <div className="hidden items-center gap-2 xl:flex">
            {actions.map(({ key, label, icon: Icon, onSelect }) => (
              <Button key={key} variant="secondary" size="sm" onClick={onSelect}>
                <Icon size={16} /> {label}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleTheme}
              aria-label="Alternar tema claro/escuro"
              title="Alternar tema claro/escuro"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
            {rareItems.length > 0 && (
              <Menu label="Mais ações" items={rareItems} />
            )}
          </div>
          {/* Abaixo de xl: as mesmas ações no menu. */}
          <Menu
            label="Mais ações"
            className="flex-1 sm:flex-none xl:hidden"
            buttonClassName={moreButtonClass}
            button={
              <>
                <MoreHorizontal size={16} aria-hidden="true" /> Mais
              </>
            }
            items={narrowItems}
          />
          {/* A ação principal, sempre à vista. */}
          <div className="flex flex-1 sm:flex-none">{primary}</div>
        </div>
      </div>

      {/* Os modais, uma vez só, abertos pelos botões ou pelo menu. */}
      <PresentationSettingsButton trigger={false} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AiPromptButton trigger={false} open={aiOpen} onOpenChange={setAiOpen} />
      <ImportDialog trigger={false} open={importOpen} onOpenChange={setImportOpen} onError={onImportError} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
    </>
  )
}
