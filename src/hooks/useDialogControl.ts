import { useState } from 'react'

/**
 * Abertura de um modal que pode vir de fora (um menu "Mais", o código no
 * cabeçalho) ou do botão do próprio componente.
 */
export interface DialogControlProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * `false`: o componente não desenha o próprio botão, só o modal, aberto por
   * quem controla `open`. Assim um mesmo modal atende o botão da janela larga
   * e o item do menu da janela estreita, montado uma vez só.
   */
  trigger?: boolean
}

/** Estado de abertura controlado (quando `open` vem de fora) ou interno. */
export function useDialogControl({ open, onOpenChange }: DialogControlProps) {
  const [inner, setInner] = useState(false)
  const isOpen = open ?? inner
  const setOpen = (next: boolean) => {
    if (open === undefined) setInner(next)
    onOpenChange?.(next)
  }
  return [isOpen, setOpen] as const
}
