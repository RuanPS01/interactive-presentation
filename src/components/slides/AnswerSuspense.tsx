interface AnswerSuspenseProps {
  /** Quantos pontos das reticências já apareceram (um por segundo). */
  dots: number
  /** Tamanho da frase, em px. */
  fontSize: number
}

/**
 * Tela de suspense do gabarito, exibida nos primeiros segundos do slide de
 * resposta. As reticências são a própria contagem regressiva: ganham um ponto
 * por segundo até a revelação (ver `useRevealCountdown`).
 */
export function AnswerSuspense({ dots, fontSize }: AnswerSuspenseProps) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-6">
      <p
        className="text-center font-bold text-neutral-900 dark:text-neutral-50"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.2 }}
      >
        A resposta certa é
        {/* Ponto a mais a cada segundo; a largura fixa evita o texto "pular". */}
        <span className="inline-block text-left tabular-nums" style={{ width: '2em' }}>
          {'.'.repeat(dots)}
        </span>
      </p>
    </div>
  )
}
