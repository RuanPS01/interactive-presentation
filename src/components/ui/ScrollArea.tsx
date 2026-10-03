import { clsx } from 'clsx'
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

type Axis = 'y' | 'x' | 'both'

const AXIS: Record<Axis, string> = {
  y: 'overflow-y-auto overflow-x-hidden',
  x: 'overflow-x-auto overflow-y-hidden',
  both: 'overflow-auto',
}

interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Direção da rolagem. Padrão: vertical. */
  axis?: Axis
}

/**
 * Área com rolagem própria e barra fina nas cores neutras da interface, que
 * acompanha o tema (o desenho da barra fica em `index.css`, `.ui-scroll`).
 *
 * A altura é de quem usa: `max-h-*`, ou `flex-1` com `min-h-0` dentro de um
 * flex. Sem limite de altura a área só cresce, e a rolagem nunca aparece.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function ScrollArea(
  { axis = 'y', className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx('ui-scroll', AXIS[axis], className)} {...rest} />
})
