import { useEffect } from 'react'
import { loadRoomFonts } from '../lib/fonts'

/**
 * Registra as fontes embutidas da sala neste navegador. Só lê quando a sala
 * tem slides livres (`enabled`) e de novo a cada edição (`revision`). O texto
 * já na tela troca de fonte sozinho quando ela termina de carregar.
 */
export function useRoomFonts(code: string | undefined, revision: number, enabled: boolean): void {
  useEffect(() => {
    if (!code || !enabled) return
    // Sem as fontes, o texto usa a próxima fonte da lista: não é um erro de tela.
    loadRoomFonts(code, revision).catch(() => {})
  }, [code, revision, enabled])
}
