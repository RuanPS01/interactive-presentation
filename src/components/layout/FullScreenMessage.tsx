import type { ReactNode } from 'react'

/** Mensagem centralizada na tela inteira (carregando, erro, sem acesso). */
export function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center text-neutral-600 dark:text-neutral-300">
      {children}
    </div>
  )
}
