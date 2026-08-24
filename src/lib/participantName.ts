/**
 * Nome informado pelo participante ao entrar numa sala, lembrado por sala
 * neste dispositivo. Evita pedir o nome de novo a cada recarregamento e
 * mantém a identificação das respostas estável.
 */

const STORAGE_KEY = 'ip-participant-names'
export const MAX_NAME_LENGTH = 40

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, string>
  } catch {
    return {}
  }
}

export function getParticipantName(code: string): string | null {
  const name = readAll()[code]
  return typeof name === 'string' && name.trim() ? name : null
}

export function saveParticipantName(code: string, name: string): void {
  try {
    const all = readAll()
    all[code] = name.trim().slice(0, MAX_NAME_LENGTH)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // localStorage indisponível: o nome vale só para a sessão atual.
  }
}

export function clearParticipantName(code: string): void {
  try {
    const all = readAll()
    delete all[code]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // ignora
  }
}
