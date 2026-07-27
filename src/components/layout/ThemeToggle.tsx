import { Moon, Sun } from 'lucide-react'
import { Button } from '../ui/Button'
import type { ThemeMode } from '../../types/presentation'

interface ThemeToggleProps {
  theme: ThemeMode
  onToggle: () => void
}

/** Botão de alternância claro/escuro. O apresentador pode usar a qualquer momento. */
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
          <Sun size={16} /> Claro
        </>
      ) : (
        <>
          <Moon size={16} /> Escuro
        </>
      )}
    </Button>
  )
}
