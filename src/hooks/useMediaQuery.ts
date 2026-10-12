import { useSyncExternalStore } from 'react'

/**
 * Verdadeiro enquanto a media query casa (ex.: `'(min-width: 1024px)'`).
 *
 * Serve para escolher UMA montagem por vez (colunas ou pilha) no JavaScript,
 * em vez de montar as duas e esconder uma com CSS: o editor visual do slide
 * livre e a seleção dele existiriam duas vezes na mesma tela.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
