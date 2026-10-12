import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ThemeMode } from '../../types/presentation'

interface ThemeToggleProps {
  theme: ThemeMode
  onToggle: () => void
}

/**
 * Botão de alternância claro/escuro. No celular fica só o ícone (o rótulo
 * aparece a partir de `sm`), para caber na linha com as outras ações.
 */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onToggle}
      title="Alternar tema claro/escuro"
      aria-label="Alternar tema claro/escuro"
    >
      {theme === 'dark' ? (
        <>
          <Sun size={16} /> <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon size={16} /> <span className="hidden sm:inline">Escuro</span>
        </>
      )}
    </Button>
  )
}
