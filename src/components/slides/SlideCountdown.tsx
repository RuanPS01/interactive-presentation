import { clsx } from 'clsx'
import { useEffect, useState } from 'react'

interface SlideCountdownProps {
  /** Instante final enquanto o cronômetro corre; `null` quando está parado. */
  endsAt: number | null
  /** Tempo restante (ms) quando o cronômetro está parado. */
  remainingMs: number
  /** Tamanho dos segundos, em px. */
  fontSize: number
}

/** Últimos segundos: o card fica vermelho para chamar a atenção. */
const URGENT_MS = 5000

/**
 * Card do cronômetro, na base do slide do apresentador. Mostra os segundos
 * grandes com os milissegundos ao lado — a fração correndo deixa claro, de
 * longe, que o tempo está passando de verdade.
 *
 * A animação vive aqui, e não no slide: o componente se redesenha a cada
 * quadro sem arrastar junto o quadro de alternativas e os gráficos.
 */
export function SlideCountdown({ endsAt, remainingMs, fontSize }: SlideCountdownProps) {
  const [left, setLeft] = useState(() =>
    endsAt === null ? Math.max(0, remainingMs) : Math.max(0, endsAt - Date.now()),
  )

  useEffect(() => {
    if (endsAt === null) {
      setLeft(Math.max(0, remainingMs))
      return
    }
    let frame = window.requestAnimationFrame(function tick() {
      setLeft(Math.max(0, endsAt - Date.now()))
      frame = window.requestAnimationFrame(tick)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [endsAt, remainingMs])

  const over = left <= 0
  const urgent = left <= URGENT_MS
  const seconds = Math.floor(left / 1000)
  const millis = Math.floor(left % 1000)
  const small = Math.max(fontSize * 0.42, 16)

  return (
    <div className="mt-4 flex shrink-0 justify-center">
      <div
        className={clsx(
          'rounded-2xl border-2 px-8 py-3 text-center transition-colors',
          urgent
            ? 'border-red-500 bg-red-50 dark:border-red-500 dark:bg-red-950/50'
            : 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900',
        )}
      >
        <p
          className={clsx(
            'font-semibold uppercase tracking-widest',
            urgent
              ? 'text-red-600 dark:text-red-300'
              : 'text-neutral-500 dark:text-neutral-400',
          )}
          style={{ fontSize: `${Math.max(fontSize * 0.2, 11)}px` }}
        >
          {over ? 'Tempo esgotado' : 'Tempo restante'}
        </p>
        <p
          // `role="timer"` sem região viva: um leitor de tela anunciando cada
          // fração de segundo atrapalharia mais do que ajudaria.
          role="timer"
          aria-live="off"
          className={clsx(
            'flex items-baseline justify-center font-bold tabular-nums leading-none',
            urgent
              ? 'text-red-600 dark:text-red-400'
              : 'text-neutral-800 dark:text-neutral-100',
          )}
        >
          <span style={{ fontSize: `${fontSize}px` }}>{seconds}</span>
          <span style={{ fontSize: `${small}px` }}>
            .{String(millis).padStart(3, '0')}s
          </span>
        </p>
      </div>
    </div>
  )
}
