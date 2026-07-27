import { useEffect } from 'react'
import type { ThemeMode } from '../types/presentation'

/** Aplica o tema (claro/escuro) alternando a classe `.dark` no <html>. */
export function useApplyTheme(theme: ThemeMode | undefined): void {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
  }, [theme])
}
