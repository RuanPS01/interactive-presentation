/**
 * Sessões de apresentador salvas neste dispositivo (localStorage).
 *
 * Guarda o código, o token secreto e o título de cada sala que o usuário
 * apresentou, permitindo sugerir a reentrada na tela inicial (retomar a sala
 * ou exportar os resultados de novo) sem depender do histórico do navegador.
 */

const STORAGE_KEY = 'ip-presenter-sessions'
const MAX_SESSIONS = 8

export interface PresenterSession {
  code: string
  token: string
  title: string
  updatedAt: number
}

function isSession(value: unknown): value is PresenterSession {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.code === 'string' &&
    typeof s.token === 'string' &&
    typeof s.title === 'string' &&
    typeof s.updatedAt === 'number'
  )
}

export function listPresenterSessions(): PresenterSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isSession).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

/** Insere ou atualiza (por código) uma sessão, mantendo as mais recentes. */
export function savePresenterSession(session: Omit<PresenterSession, 'updatedAt'>): void {
  try {
    const now = Date.now()
    const others = listPresenterSessions().filter((s) => s.code !== session.code)
    const next = [{ ...session, updatedAt: now }, ...others].slice(0, MAX_SESSIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage indisponível: segue sem persistir.
  }
}

export function removePresenterSession(code: string): void {
  try {
    const next = listPresenterSessions().filter((s) => s.code !== code)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignora
  }
}
