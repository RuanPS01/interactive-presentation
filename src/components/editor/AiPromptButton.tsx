import { Check, Copy, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useDialogControl } from '../../hooks/useDialogControl'
import type { DialogControlProps } from '../../hooks/useDialogControl'
import { AI_IMPORT_PROMPT } from '../../utils/aiPrompt'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

/**
 * Abre um modal com um prompt pronto para colar em um assistente de IA. O prompt
 * descreve o formato JSON aceito na importação, então o resultado gerado pode ser
 * salvo como .json e carregado em "Importar JSON".
 */
export function AiPromptButton(props: DialogControlProps) {
  const [open, setOpen] = useDialogControl(props)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

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
      {props.trigger !== false && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
          title="Prompt para gerar slides com IA"
        >
          <Sparkles size={16} /> Prompt de IA
        </Button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="xl"
        title="Gerar conteúdo com IA"
        description={
          <>
            Copie o prompt, cole no assistente de IA, substitua o tema, salve a resposta
            em um arquivo <code>.json</code> e carregue em <strong>Importar</strong>, opção
            &quot;Apresentação (.json)&quot;.
          </>
        }
        footer={
          <>
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
          </>
        }
      >
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300">
          {AI_IMPORT_PROMPT}
        </pre>
      </Modal>
    </>
  )
}
