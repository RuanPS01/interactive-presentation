import { useCallback, useEffect, useState } from 'react'

/**
 * Controla o modo tela cheia da página (Fullscreen API) e acompanha o estado
 * atual, inclusive quando o usuário sai com Esc.
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(
    typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  )

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggle = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch {
      /* tela cheia indisponível ou bloqueada pelo navegador */
    }
  }, [])

  return { isFullscreen, toggle }
}
