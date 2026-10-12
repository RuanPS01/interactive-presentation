import { clsx } from 'clsx'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  FileUp,
  Maximize2,
  Minimize2,
  Presentation as PresentationIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useRoom } from '../hooks/useRoom'
import { useRoomAssets } from '../hooks/useRoomAssets'
import { useRoomFonts } from '../hooks/useRoomFonts'
import { useSlideDownload } from '../hooks/useSlideDownload'
import { withRevealedAnswers } from '../lib/answers'
import { loadRoomPresentation } from '../lib/rooms'
import { useThemeStore } from '../store/themeStore'
import type { Presentation, PresentationAssets } from '../types/presentation'
import { registerFonts } from '../utils/fonts/faces'
import { collectAssetIds } from '../utils/freeSlide'
import { importPresentationFromFile } from '../utils/importExport'
import { toStaticSlides } from '../utils/staticSlides'
import { FreeSlideView } from '../components/free/FreeSlideView'
import { FullScreenMessage } from '../components/layout/FullScreenMessage'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Checkbox } from '../components/ui/Checkbox'
import { Menu } from '../components/ui/Menu'
import { SegmentedControl } from '../components/ui/SegmentedControl'

/**
 * Modo leitura: a apresentação como material, sem sala ao vivo. Abre uma sala
 * já encerrada (`#/view/<código>`) ou um arquivo `.json` da apresentação
 * (`#/view`). As perguntas aparecem como enunciado e alternativas, sem votar.
 */
export function ViewPage() {
  const { code } = useParams<{ code: string }>()
  return code ? <RoomReader code={code} /> : <FileReader />
}

/** Leitura de uma sala encerrada: os slides com os gabaritos já revelados. */
function RoomReader({ code }: { code: string }) {
  const navigate = useNavigate()
  const { room, loading, error } = useRoom(code)
  const presentation = useMemo<Presentation | null>(
    () => (room ? { title: room.title, slides: withRevealedAnswers(room), settings: room.settings } : null),
    [room],
  )
  const assets = useRoomAssets(code, presentation ? collectAssetIds(presentation.slides) : [])
  useRoomFonts(code, room?.revision ?? 0, Boolean(room?.slides.some((s) => s.type === 'free')))

  if (loading) return <FullScreenMessage>Carregando…</FullScreenMessage>
  if (error) return <FullScreenMessage>Erro ao carregar: {error}</FullScreenMessage>
  if (!room || !presentation) {
    return (
      <FullScreenMessage>
        Apresentação não encontrada.
        <Button className="mt-4" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </FullScreenMessage>
    )
  }
  if (room.status !== 'ended') {
    return (
      <FullScreenMessage>
        A leitura fica disponível quando a apresentação terminar.
        <Button className="mt-4" onClick={() => navigate(`/room/${code}`)}>
          Entrar na sala
        </Button>
      </FullScreenMessage>
    )
  }
  return (
    <Reader
      presentation={presentation}
      assets={assets}
      loadForDownload={
        presentation.settings?.allowDownload
          ? () => loadRoomPresentation(code, room, presentation.slides)
          : undefined
      }
    />
  )
}

/** Leitura de um arquivo `.json` exportado daqui (ou gerado pelo prompt de IA). */
function FileReader() {
  const navigate = useNavigate()
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function open(file: File | undefined) {
    if (!file) return
    const result = await importPresentationFromFile(file)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    await registerFonts(Object.values(result.presentation.fonts ?? {}))
    setPresentation(result.presentation)
  }

  if (presentation) {
    return (
      <Reader
        presentation={presentation}
        assets={presentation.assets ?? {}}
        loadForDownload={() => Promise.resolve(presentation)}
        onClose={() => setPresentation(null)}
      />
    )
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-4 self-start" onClick={() => navigate('/')}>
        <ChevronLeft size={16} /> Início
      </Button>
      <div
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setOver(false)
          void open(e.dataTransfer.files[0])
        }}
        className={clsx(
          'flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-8 text-center',
          over ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-neutral-300 dark:border-neutral-700',
        )}
      >
        <BookOpen size={40} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Ler uma apresentação</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Abra o arquivo <code>.json</code> de uma apresentação (o mesmo do Exportar) para lê-la
            slide a slide, sem sala ao vivo. Você também pode arrastá-lo para cá.
          </p>
        </div>
        <Button onClick={() => inputRef.current?.click()}>
          <FileUp size={16} /> Abrir arquivo .json
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            void open(file)
          }}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

type Mode = 'scroll' | 'single'

/** Deslocamento mínimo (px) de um arraste horizontal para trocar de slide. */
const SWIPE_MIN = 50
/** O horizontal precisa ser esta vez maior que o vertical (não confundir com rolar). */
const SWIPE_RATIO = 1.5

function Reader({
  presentation,
  assets,
  loadForDownload,
  onClose,
}: {
  presentation: Presentation
  assets: PresentationAssets
  /** Sem ele, o download não está liberado. */
  loadForDownload?: () => Promise<Presentation>
  /** Fecha o arquivo (leitura de JSON); sem ele, volta ao início. */
  onClose?: () => void
}) {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [mode, setMode] = useState<Mode>('scroll')
  const [showAnswers, setShowAnswers] = useState(false)
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)
  const { download, working, error } = useSlideDownload(
    loadForDownload ?? (() => Promise.reject(new Error('Download não liberado.'))),
  )

  const hasQuestions = presentation.slides.some((s) => s.type === 'quiz')
  const slides = useMemo(
    () => toStaticSlides(presentation, { theme, hints: false, revealQuiz: showAnswers, skipAnswerSlides: true }),
    [presentation, theme, showAnswers],
  )
  const total = slides.length
  const current = Math.min(index, Math.max(0, total - 1))

  function go(delta: number) {
    setIndex((i) => Math.max(0, Math.min(total - 1, i + delta)))
  }

  // Teclado no modo "um por vez": setas, Page Up/Down e espaço.
  useEffect(() => {
    if (mode !== 'single') return
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('[role="menu"], [role="dialog"]'))) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        setIndex((i) => Math.min(total - 1, i + 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        setIndex((i) => Math.max(0, i - 1))
      } else if (e.key === 'Home') {
        e.preventDefault()
        setIndex(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        setIndex(total - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, total])

  // A tela cheia é do palco (só o slide), não da página.
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(stageRef.current && document.fullscreenElement === stageRef.current))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void stageRef.current?.requestFullscreen?.().catch(() => {})
  }

  function onPointerDown(e: ReactPointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    swipe.current = { x: e.clientX, y: e.clientY }
  }
  function onPointerUp(e: ReactPointerEvent) {
    const start = swipe.current
    swipe.current = null
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > SWIPE_RATIO * Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  const ratio = slides[0] ? `${slides[0].width} / ${slides[0].height}` : '16 / 9'
  const widthByHeight = slides[0] ? slides[0].width / slides[0].height : 16 / 9

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-3 py-4 sm:px-6">
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 sm:px-3"
            onClick={() => (onClose ? onClose() : navigate('/'))}
            aria-label={onClose ? 'Fechar o arquivo' : 'Início'}
            title={onClose ? 'Fechar o arquivo' : 'Início'}
          >
            <ChevronLeft size={16} /> <span className="hidden sm:inline">{onClose ? 'Fechar' : 'Início'}</span>
          </Button>
          <h1 className="min-w-0 truncate text-lg font-bold text-neutral-900 dark:text-neutral-50">
            {presentation.title || 'Apresentação'}
          </h1>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <SegmentedControl<Mode>
            aria-label="Modo de leitura"
            size="sm"
            value={mode}
            options={[
              { value: 'scroll', label: 'Rolagem' },
              { value: 'single', label: 'Um por vez' },
            ]}
            onChange={setMode}
          />
          {loadForDownload && (
            <Menu
              label="Baixar"
              buttonClassName="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 transition hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              button={
                <>
                  <Download size={16} aria-hidden="true" /> {working ? 'Gerando…' : 'Baixar'}
                </>
              }
              disabled={working !== null}
              items={[
                { key: 'pdf', label: 'PDF dos slides', icon: <FileText size={16} />, onSelect: () => void download('pdf') },
                {
                  key: 'pptx',
                  label: 'PowerPoint (.pptx)',
                  icon: <PresentationIcon size={16} />,
                  onSelect: () => void download('pptx'),
                },
              ]}
            />
          )}
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
        {hasQuestions && (
          <Checkbox
            className="basis-full"
            label="Mostrar respostas certas"
            hint="Destaca a alternativa correta das perguntas com gabarito."
            checked={showAnswers}
            onChange={setShowAnswers}
          />
        )}
        {error && (
          <p role="alert" className="basis-full text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </header>

      {total === 0 ? (
        <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">Esta apresentação não tem slides.</p>
      ) : mode === 'scroll' ? (
        <ol className="space-y-6">
          {slides.map((slide, i) => (
            <li key={slide.id} className="min-w-0">
              <p className="mb-1.5 flex min-w-0 items-baseline gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                <span className="shrink-0 tabular-nums">
                  {i + 1} / {total}
                </span>
                <span className="truncate font-medium text-neutral-700 dark:text-neutral-200">{slide.title}</span>
              </p>
              <div
                className="w-full overflow-hidden rounded-xl border border-neutral-200 shadow-sm dark:border-neutral-800"
                style={{ aspectRatio: ratio }}
              >
                <FreeSlideView slide={slide} assets={assets} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div
            ref={stageRef}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              swipe.current = null
            }}
            className={clsx(
              'relative select-none overflow-hidden',
              fullscreen ? 'h-full w-full bg-black' : 'rounded-xl border border-neutral-200 shadow-sm dark:border-neutral-800',
            )}
            style={
              fullscreen
                ? undefined
                : { aspectRatio: ratio, width: `min(100%, calc(65vh * ${widthByHeight}))`, touchAction: 'pan-y' }
            }
          >
            <FreeSlideView slide={slides[current]} assets={assets} className="h-full w-full" />
            {fullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="absolute right-3 top-3 rounded-lg bg-black/50 p-2 text-white hover:bg-black/70"
                aria-label="Sair da tela cheia"
                title="Sair da tela cheia"
              >
                <Minimize2 size={20} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => go(-1)} disabled={current <= 0} aria-label="Slide anterior">
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-[4rem] text-center text-sm tabular-nums text-neutral-600 dark:text-neutral-300">
              {current + 1} / {total}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => go(1)}
              disabled={current >= total - 1}
              aria-label="Próximo slide"
            >
              <ChevronRight size={16} />
            </Button>
            <Button variant="secondary" size="sm" onClick={toggleFullscreen} aria-label="Tela cheia" title="Tela cheia">
              <Maximize2 size={16} />
            </Button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Use as setas do teclado, ou arraste para os lados no celular.
          </p>
        </div>
      )}
    </div>
  )
}
