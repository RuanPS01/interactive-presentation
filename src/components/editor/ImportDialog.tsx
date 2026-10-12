import { clsx } from 'clsx'
import { CheckCircle2, FileBraces, FileUp, Loader2, Presentation, TriangleAlert } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { useDialogControl } from '../../hooks/useDialogControl'
import type { DialogControlProps } from '../../hooks/useDialogControl'
import { useEditorStoreApi, useEditorStore } from '../../store/editorStore'
import { importPresentationFromFile } from '../../utils/importExport'
import type { PptxProgress } from '../../utils/pptx'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { SegmentedControl } from '../ui/SegmentedControl'

interface ImportDialogProps extends DialogControlProps {
  /** Mensagem de erro da importação (ou `null` quando ela deu certo). */
  onError: (message: string | null) => void
}

type PptxMode = 'append' | 'replace'

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; progress: PptxProgress }
  | { kind: 'done'; slides: number; images: number; fonts: string[]; warnings: string[]; note: string | null }
  | { kind: 'error'; message: string }

/**
 * "Importar", com a escolha do formato, sobre o editor em uso. A abertura pode
 * vir do próprio botão ou de fora (o menu "Mais" da barra do editor).
 *
 * O JSON substitui a apresentação inteira, como sempre. O PowerPoint vira
 * slides livres, que entram no fim da apresentação ou no lugar dela; o
 * leitor de PPTX só é baixado quando alguém o usa.
 */
export function ImportDialog({ onError, ...control }: ImportDialogProps) {
  const store = useEditorStoreApi()
  const loadPresentation = useEditorStore((s) => s.loadPresentation)
  const [open, setOpen] = useDialogControl(control)
  const [mode, setMode] = useState<PptxMode>('append')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const jsonRef = useRef<HTMLInputElement>(null)
  const pptxRef = useRef<HTMLInputElement>(null)
  const working = status.kind === 'working'

  function close() {
    if (working) return
    setOpen(false)
    setStatus({ kind: 'idle' })
  }

  async function importJson(file: File) {
    const result = await importPresentationFromFile(file)
    if (result.ok) {
      loadPresentation(result.presentation)
      onError(null)
      setOpen(false)
      setStatus({ kind: 'idle' })
    } else {
      setStatus({ kind: 'error', message: result.error })
    }
  }

  async function importPptx(file: File) {
    setStatus({ kind: 'working', progress: { done: 0, total: 0, message: 'Abrindo o arquivo…' } })
    try {
      // Carregado sob demanda: o leitor e as definições de formas são grandes.
      const { importPptx: read } = await import('../../utils/pptx')
      const result = await read(file, (progress) => setStatus({ kind: 'working', progress }))
      if (result.slides.length === 0) {
        setStatus({ kind: 'error', message: 'O arquivo não tem slides visíveis para importar.' })
        return
      }
      const state = store.getState()
      const current = state.settings.slideAspect
      let note: string | null = null
      if (mode === 'replace' || state.slides.length === 0) {
        state.loadPresentation({
          title: mode === 'replace' || !state.title ? result.title || file.name.replace(/\.pptx$/i, '') : state.title,
          slides: result.slides,
          settings: { ...state.settings, slideAspect: result.aspect ?? current },
          assets: Object.fromEntries(result.assets.map((a) => [a.id, a])),
          fonts: Object.fromEntries(result.fonts.map((f) => [f.id, f])),
        })
        if (result.aspect && result.aspect !== current) note = `O formato da apresentação passou para ${result.aspect}, o mesmo do arquivo.`
      } else {
        state.appendSlides(result.slides, result.assets, result.fonts)
        if (result.aspect !== current) {
          note = `O arquivo está em ${result.aspect ?? 'outro formato'} e a apresentação em ${current}: os slides importados aparecem com faixas nas bordas. Troque o formato nas Opções para ajustar.`
        }
      }
      onError(null)
      setStatus({
        kind: 'done',
        slides: result.slides.length,
        images: result.assets.length,
        fonts: [...new Set(result.fonts.map((f) => f.family))],
        warnings: result.warnings,
        note,
      })
    } catch (e) {
      setStatus({ kind: 'error', message: `Não foi possível importar o PowerPoint: ${(e as Error).message}` })
    }
  }

  function pick(kind: 'json' | 'pptx', file: File | undefined) {
    if (!file || working) return
    const isPptx = /\.pptx$/i.test(file.name)
    if (kind === 'pptx' && !isPptx) {
      setStatus({ kind: 'error', message: 'Escolha um arquivo .pptx (PowerPoint 2007 ou mais novo). Arquivos .ppt antigos precisam ser salvos como .pptx antes.' })
      return
    }
    if (kind === 'json' && isPptx) {
      void importPptx(file)
      return
    }
    if (kind === 'json') void importJson(file)
    else void importPptx(file)
  }

  return (
    <>
      {control.trigger !== false && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <FileUp size={16} /> Importar
        </Button>
      )}

      <input
        ref={jsonRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          pick('json', file)
        }}
      />
      <input
        ref={pptxRef}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          pick('pptx', file)
        }}
      />

      <Modal
        open={open}
        onClose={close}
        dismissible={!working}
        size="lg"
        title="Importar"
        description="Escolha o tipo de arquivo. Você também pode arrastá-lo para a opção."
        footer={
          <Button onClick={close} disabled={working}>
            {status.kind === 'done' ? 'Concluir' : 'Fechar'}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ImportOption
              icon={<FileBraces size={28} strokeWidth={1.6} />}
              title="Apresentação (.json)"
              description="Um arquivo exportado daqui ou gerado pelo prompt de IA. Substitui todo o conteúdo do editor."
              disabled={working}
              onChoose={() => jsonRef.current?.click()}
              onDropFile={(file) => pick('json', file)}
            />
            <ImportOption
              icon={<Presentation size={28} strokeWidth={1.6} />}
              title="PowerPoint (.pptx)"
              description="Cada slide vira um slide livre: os textos continuam editáveis e as fotos viram imagens. Formas, fundos, SVG, tabelas e gráficos viram imagem."
              disabled={working}
              onChoose={() => pptxRef.current?.click()}
              onDropFile={(file) => pick('pptx', file)}
            >
              <SegmentedControl<PptxMode>
                aria-label="Onde colocar os slides do PowerPoint"
                size="sm"
                className="w-full"
                value={mode}
                disabled={working}
                options={[
                  { value: 'append', label: 'Adicionar ao fim' },
                  { value: 'replace', label: 'Substituir tudo' },
                ]}
                onChange={setMode}
              />
            </ImportOption>
          </div>

          <ImportStatus status={status} />
        </div>
      </Modal>
    </>
  )
}

function ImportOption({
  icon,
  title,
  description,
  disabled,
  onChoose,
  onDropFile,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  disabled: boolean
  onChoose: () => void
  onDropFile: (file: File | undefined) => void
  children?: ReactNode
}) {
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    onDropFile(e.dataTransfer.files[0])
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={clsx(
        'flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition',
        over
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
          : 'border-neutral-300 dark:border-neutral-700',
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900 dark:text-neutral-50">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{description}</p>
        </div>
      </div>
      {children}
      <Button variant="secondary" size="sm" className="mt-auto" disabled={disabled} onClick={onChoose}>
        Escolher arquivo
      </Button>
    </div>
  )
}

function ImportStatus({ status }: { status: Status }) {
  if (status.kind === 'idle') return null
  if (status.kind === 'working') {
    const { done, total, message } = status.progress
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="space-y-2" role="status" aria-live="polite">
        <p className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-200">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {message}
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
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
        <CheckCircle2 size={16} /> {status.slides} slide(s) importado(s), com {status.images} imagem(ns).
      </p>
      {status.fonts.length > 0 && (
        <p>
          Fonte(s) embutida(s) aproveitada(s): {status.fonts.join(', ')}. Elas aparecem iguais em qualquer aparelho.
        </p>
      )}
      {status.note && <p>{status.note}</p>}
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
