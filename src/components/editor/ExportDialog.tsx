import { CheckCircle2, FileBraces, Loader2, Presentation, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useEditorStoreApi } from '../../store/editorStore'
import { useThemeStore } from '../../store/themeStore'
import { downloadBlob, exportPresentation, presentationFileName } from '../../utils/importExport'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

type Status =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; warnings: string[] }
  | { kind: 'error'; message: string }

/**
 * Escolha do formato da exportação: o JSON da plataforma (completo, para
 * importar de volta) ou um PowerPoint para abrir em outros programas. O
 * gerador de PPTX só é baixado quando alguém o usa.
 */
export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const store = useEditorStoreApi()
  // Os slides comuns saem no tema da página, como aparecem no projetor.
  const theme = useThemeStore((s) => s.theme)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const working = status.kind === 'working'

  function close() {
    if (working) return
    setStatus({ kind: 'idle' })
    onClose()
  }

  function exportJson() {
    exportPresentation(store.getState().getPresentation())
    close()
  }

  async function exportPptx() {
    setStatus({ kind: 'working' })
    try {
      const presentation = store.getState().getPresentation()
      const { exportPptx: generate } = await import('../../utils/pptxExport')
      const { blob, warnings } = await generate(presentation, { theme })
      downloadBlob(blob, presentationFileName(presentation.title, 'pptx'))
      setStatus({ kind: 'done', warnings })
    } catch (e) {
      setStatus({ kind: 'error', message: `Não foi possível gerar o PowerPoint: ${(e as Error).message}` })
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!working}
      size="lg"
      title="Exportar"
      description="Escolha o formato do arquivo."
      footer={
        <Button onClick={close} disabled={working}>
          {status.kind === 'done' ? 'Concluir' : 'Fechar'}
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ExportOption
            icon={<FileBraces size={28} strokeWidth={1.6} />}
            title="Apresentação (.json)"
            description="O arquivo completo da plataforma, com imagens e fontes. Serve para importar de volta aqui: as perguntas continuam interativas."
            action="Baixar .json"
            disabled={working}
            onChoose={exportJson}
          />
          <ExportOption
            icon={<Presentation size={28} strokeWidth={1.6} />}
            title="PowerPoint (.pptx)"
            description={`Para abrir no PowerPoint, Google Slides ou Keynote. Textos e imagens continuam editáveis, com as fontes embutidas; as perguntas viram slides estáticos com as alternativas, no tema ${theme === 'dark' ? 'escuro' : 'claro'} da página.`}
            action={working ? 'Gerando…' : 'Baixar .pptx'}
            disabled={working}
            onChoose={() => void exportPptx()}
          />
        </div>
        <ExportStatus status={status} />
      </div>
    </Modal>
  )
}

function ExportOption({
  icon,
  title,
  description,
  action,
  disabled,
  onChoose,
}: {
  icon: ReactNode
  title: string
  description: string
  action: string
  disabled: boolean
  onChoose: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-start gap-3">
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900 dark:text-neutral-50">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
      </div>
      <Button variant="secondary" size="sm" className="mt-auto" disabled={disabled} onClick={onChoose}>
        {action}
      </Button>
    </div>
  )
}

function ExportStatus({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'working') {
    return (
      <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Gerando o PowerPoint…
      </p>
    )
  }
  if (status.kind === 'error') {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" /> {status.message}
      </p>
    )
  }
  return (
    <div className="space-y-2 rounded-lg bg-green-50 p-3 text-sm text-green-900 dark:bg-green-950 dark:text-green-100" role="status">
      <p className="flex items-center gap-2 font-medium">
        <CheckCircle2 size={16} /> PowerPoint gerado. O download começou.
      </p>
      {status.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-green-800 dark:text-green-200">
          {status.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
