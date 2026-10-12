import { clsx } from 'clsx'
import { Download, FileText, Loader2, Presentation as PresentationIcon } from 'lucide-react'
import { useSlideDownload } from '../../hooks/useSlideDownload'
import type { Presentation } from '../../types/presentation'
import { Button } from '../ui/Button'

interface DownloadSlidesProps {
  /** Monta a apresentação a baixar (lê imagens e fontes só no clique). */
  loadPresentation: () => Promise<Presentation>
  className?: string
}

/**
 * "Baixar slides": os slides em PDF ou PowerPoint, sem a resposta de ninguém
 * e sem as instruções de votação. Aparece no fim da apresentação, quando o
 * apresentador liberou a opção.
 */
export function DownloadSlides({ loadPresentation, className }: DownloadSlidesProps) {
  const { download, working, error } = useSlideDownload(loadPresentation)

  return (
    <div className={clsx('space-y-2', className)}>
      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-200">
        <Download size={16} aria-hidden="true" /> Baixar slides
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant="secondary" size="sm" disabled={working !== null} onClick={() => void download('pdf')}>
          {working === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
          {working === 'pdf' ? 'Gerando…' : 'PDF dos slides'}
        </Button>
        <Button variant="secondary" size="sm" disabled={working !== null} onClick={() => void download('pptx')}>
          {working === 'pptx' ? <Loader2 size={16} className="animate-spin" /> : <PresentationIcon size={16} />}
          {working === 'pptx' ? 'Gerando…' : 'PowerPoint (.pptx)'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
