/**
 * Visual de campo de formulário: borda neutra, fundo do tema, anel azul no
 * foco e esmaecido quando desativado. Fica fora dos componentes para o
 * `Input`, o `Textarea` e o gatilho do `Select` mudarem sempre juntos.
 */
export const FIELD_STYLES =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
