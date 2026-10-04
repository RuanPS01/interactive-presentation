import { clsx } from 'clsx'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ScaledFrameProps {
  /** Tamanho lógico do conteúdo, em px. */
  width: number
  height: number
  /** Conteúdo desenhado no tamanho lógico; a função recebe a escala aplicada. */
  children: ReactNode | ((scale: number) => ReactNode)
  className?: string
  /** Classes da moldura (a área do slide em si, sem as faixas em volta). */
  frameClassName?: string
}

/**
 * Desenha o conteúdo num tamanho lógico fixo (1920 x 1080, por exemplo) e o
 * reduz ou amplia por inteiro para caber no espaço disponível, centralizado e
 * sem distorcer. Texto, imagens e gráficos ficam com a mesma proporção em
 * qualquer tela, como numa apresentação de verdade.
 *
 * A escala é aplicada com `transform`, que não muda o layout interno: o
 * conteúdo continua medindo e quebrando linhas no tamanho lógico.
 */
export function ScaledFrame({ width, height, children, className, frameClassName }: ScaledFrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const scale = box.width > 0 && box.height > 0 ? Math.min(box.width / width, box.height / height) : 0

  return (
    <div ref={ref} className={clsx('relative h-full w-full overflow-hidden', className)}>
      {scale > 0 && (
        <div
          className={clsx('absolute overflow-hidden', frameClassName)}
          style={{
            left: (box.width - width * scale) / 2,
            top: (box.height - height * scale) / 2,
            width: width * scale,
            height: height * scale,
          }}
        >
          <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
            {typeof children === 'function' ? children(scale) : children}
          </div>
        </div>
      )}
    </div>
  )
}
