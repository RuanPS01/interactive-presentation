import { create } from 'zustand'
import type { ThemeMode } from '../types/presentation'

/**
 * Preferência de tema (claro/escuro) do USUÁRIO, persistida no localStorage.
 *
 * Diferente do restante do domínio, o tema não pertence à apresentação: cada
 * pessoa (apresentador ou participante) escolhe o seu e ele é lembrado entre
 * sessões neste dispositivo — não é sincronizado via Firestore.
 */

const STORAGE_KEY = 'ip-theme'

function readStored(): ThemeMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    // localStorage indisponível (ex.: modo privado restrito)
    return null
  }
}

function getInitialTheme(): ThemeMode {
  const stored = readStored()
  if (stored) return stored
  // Sem preferência salva: segue o sistema operacional.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function persist(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // ignora falha de escrita; o tema ainda vale para a sessão atual
  }
}

interface ThemeState {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    persist(theme)
    set({ theme })
  },
  toggleTheme: () =>
    set((s) => {
      const theme: ThemeMode = s.theme === 'dark' ? 'light' : 'dark'
      persist(theme)
      return { theme }
    }),
}))
