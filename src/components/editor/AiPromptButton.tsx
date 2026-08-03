import { Check, Copy, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AI_IMPORT_PROMPT } from '../../utils/aiPrompt'
import { Button } from '../ui/Button'

/**
 * Abre um modal com um prompt pronto para colar em um assistente de IA. O prompt
 * descreve o formato JSON aceito na importação, então o resultado gerado pode ser
 * salvo como .json e carregado em "Importar JSON".
 */
export function AiPromptButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  // Fecha o modal com Esc.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AI_IMPORT_PROMPT)
      setCopied(true)
      setCopyFailed(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard indisponível (permissão negada ou contexto não seguro):
      // orienta a copiar o texto exibido manualmente.
      setCopyFailed(true)
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        title="Prompt para gerar slides com IA"
      >
        <Sparkles size={16} /> Prompt de IA
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Prompt de IA para gerar conteúdo"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800">
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Gerar conteúdo com IA
                </h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  Copie o prompt, cole no assistente de IA, substitua o tema, salve a resposta
                  em um arquivo <code>.json</code> e carregue em <strong>Importar JSON</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-neutral-500 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
                {AI_IMPORT_PROMPT}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-200 p-5 dark:border-neutral-800">
              {copyFailed && (
                <p className="mr-auto text-sm text-red-600 dark:text-red-400">
                  Não foi possível acessar a área de transferência. Selecione o texto acima e
                  copie com Ctrl+C.
                </p>
              )}
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Fechar
              </Button>
              <Button onClick={() => void copyPrompt()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado' : 'Copiar prompt'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
