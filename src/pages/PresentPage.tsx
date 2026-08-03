import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  FileText,
  LogOut,
  Maximize2,
  Minimize2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFullscreen } from '../hooks/useFullscreen'
import { useParticipant } from '../hooks/useParticipant'
import { useRoom } from '../hooks/useRoom'
import { useResponses } from '../hooks/useResponses'
import { useThemeStore } from '../store/themeStore'
import { claimPresenter, setCurrentSlide } from '../lib/rooms'
import { savePresenterSession } from '../lib/presenterSessions'
import { getAllResponses } from '../lib/responses'
import { exportResultsPdf } from '../utils/exportPdf'
import type { ResponseDoc } from '../types/presentation'
import { SlideDisplay } from '../components/slides/SlideDisplay'
import { ShareRoom } from '../components/present/ShareRoom'
import { SummarySlide } from '../components/present/SummarySlide'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'

export function PresentPage() {
  const { code, token } = useParams<{ code: string; token?: string }>()
  const navigate = useNavigate()
  const { room, loading, error } = useRoom(code)
  const { uid } = useParticipant()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  // Cabeçalho pode ser ocultado para aproveitar a tela; reaparece pelo botão
  // flutuante ou quando o mouse encosta no topo.
  const [headerHidden, setHeaderHidden] = useState(false)

  // Controle de acesso do apresentador. Só quem é dono (mesmo uid) ou tem o
  // token secreto (na URL) apresenta; a plateia (só com o código) não entra.
  const [access, setAccess] = useState<'checking' | 'granted' | 'denied'>('checking')
  const claimTriedRef = useRef(false)

  const currentSlide =
    room && room.slides.length > 0 ? room.slides[room.currentSlideIndex] : undefined
  const responses = useResponses(code, currentSlide?.id)

  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Estado do slide final automático (grade de miniaturas + download do PDF).
  const [allResponses, setAllResponses] = useState<ResponseDoc[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  // Baixa o PDF só uma vez por sessão, mesmo que se volte ao slide final.
  const pdfDownloadedRef = useRef(false)
  // Referência sempre atual da sala, para o efeito não depender da identidade
  // do objeto (que muda a cada atualização do Firestore).
  const roomRef = useRef(room)
  roomRef.current = room

  // Navegação por teclado e passador de slides (clicker):
  // avança com →, PageDown, Espaço; volta com ←, PageUp. O último passo
  // (índice === nº de slides) é o slide de agradecimento automático.
  useEffect(() => {
    if (!room || !code) return
    const slideCount = room.slides.length
    const maxIndex = slideCount > 0 ? slideCount : 0
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const idx = room!.currentSlideIndex
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        const next = Math.min(idx + 1, maxIndex)
        if (next !== idx) void setCurrentSlide(code!, next)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        const prev = Math.max(idx - 1, 0)
        if (prev !== idx) void setCurrentSlide(code!, prev)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [room, code])

  // Ao chegar no slide final: busca todas as respostas (para a grade) e,
  // no apresentador, dispara o download do PDF de resultados automaticamente.
  const slideCount = room?.slides.length ?? 0
  const activeIndex = room?.currentSlideIndex ?? -1
  useEffect(() => {
    const onSummary = slideCount > 0 && activeIndex >= slideCount
    if (!code || !onSummary) return
    let cancelled = false
    setSummaryLoading(true)
    getAllResponses(code)
      .then((all) => {
        if (cancelled) return
        setAllResponses(all)
        setSummaryLoading(false)
        const currentRoom = roomRef.current
        if (currentRoom && !pdfDownloadedRef.current) {
          pdfDownloadedRef.current = true
          void exportResultsPdf(currentRoom, all)
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, activeIndex, slideCount])

  // Decide o acesso assim que a sala e o uid estiverem prontos.
  const creatorUid = room?.creatorUid
  useEffect(() => {
    if (!code || !creatorUid || !uid) return // ainda carregando
    if (access !== 'checking') return // já decidido
    if (creatorUid === uid) {
      // Já é o dono neste navegador (criou a sala ou já reivindicou).
      setAccess('granted')
      return
    }
    if (!token) {
      setAccess('denied')
      return
    }
    if (claimTriedRef.current) return
    claimTriedRef.current = true
    // Recarregou ou trocou de navegador: prova o token e reassume o controle.
    claimPresenter(code, uid, token)
      .then(() => setAccess('granted'))
      .catch(() => setAccess('denied'))
  }, [code, creatorUid, uid, token, access])

  // Concedido o acesso: lembra a sessão (retomar/reexportar pela tela inicial).
  const roomTitle = room?.title
  useEffect(() => {
    if (access === 'granted' && code && token) {
      savePresenterSession({ code, token, title: roomTitle ?? '' })
    }
  }, [access, code, token, roomTitle])

  if (loading) {
    return <FullScreenMessage>Carregando sala…</FullScreenMessage>
  }
  if (error) {
    return <FullScreenMessage>Erro ao carregar a sala: {error}</FullScreenMessage>
  }
  if (!room || !code) {
    return (
      <FullScreenMessage>
        Sala não encontrada.
        <Button className="mt-4" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </FullScreenMessage>
    )
  }
  if (access === 'checking') {
    return <FullScreenMessage>Verificando acesso de apresentador…</FullScreenMessage>
  }
  if (access === 'denied') {
    return (
      <FullScreenMessage>
        <p className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
          Acesso de apresentador necessário
        </p>
        <p className="mt-1 max-w-md text-sm text-neutral-500 dark:text-neutral-400">
          Este link não tem o token de apresentador desta sala. Se você é da
          plateia, entre como participante usando o código.
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => navigate(`/room/${code}`)}>Entrar como participante</Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            Início
          </Button>
        </div>
      </FullScreenMessage>
    )
  }

  const total = room.slides.length
  const index = room.currentSlideIndex
  // Índice extra (= total) reservado para o slide de agradecimento automático.
  const maxIndex = total > 0 ? total : 0
  const isSummary = total > 0 && index >= total
  const joinUrl = `${window.location.origin}${window.location.pathname}#/room/${code}`

  function goTo(next: number) {
    if (!code) return
    const clamped = Math.max(0, Math.min(next, maxIndex))
    if (clamped !== index) void setCurrentSlide(code, clamped)
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponível: o usuário pode copiar manualmente */
    }
  }

  async function exportPdf() {
    if (!room || !code) return
    setExporting(true)
    try {
      // Busca todas as respostas da sala (de todos os slides) para o relatório.
      const all = await getAllResponses(code)
      await exportResultsPdf(room, all)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-screen flex-col">
      {/* Cabeçalho oculto: faixa no topo (revela ao passar o mouse) + botão
          flutuante para reexibir. */}
      {headerHidden && (
        <>
          <div
            className="fixed inset-x-0 top-0 z-40 h-3"
            onMouseEnter={() => setHeaderHidden(false)}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => setHeaderHidden(false)}
            className="fixed right-3 top-3 z-40 inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white/90 px-2 py-1 text-xs text-neutral-600 shadow-sm backdrop-blur transition hover:bg-white dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-300 dark:hover:bg-neutral-900"
            title="Mostrar cabeçalho"
            aria-label="Mostrar cabeçalho"
          >
            <ChevronDown size={16} /> Cabeçalho
          </button>
        </>
      )}

      {/* Barra superior */}
      {!headerHidden && (
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <LogOut size={16} /> Sair
        </Button>
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Código:</span>
          <span className="text-xl font-bold tracking-[0.2em] text-neutral-900 dark:text-neutral-50">
            {code}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void copyJoinLink()}
          className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300"
          title={joinUrl}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Link copiado' : 'Copiar link de entrada'}
        </button>
        <ShareRoom code={code} joinUrl={joinUrl} />
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void exportPdf()}
            disabled={exporting}
          >
            <FileText size={16} /> {exporting ? 'Gerando…' : 'Exportar PDF'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void toggleFullscreen()}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {/* Navegação de slides no canto superior direito (sem barra inferior,
              aproveitando melhor a tela). Também dá para usar as setas do teclado. */}
          <div
            className="flex items-center gap-1 border-l border-neutral-200 pl-2 dark:border-neutral-800"
            title="Use as setas do teclado para navegar"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(index - 1)}
              disabled={index <= 0}
              aria-label="Slide anterior"
            >
              <ChevronLeft size={16} />
            </Button>
            <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-neutral-500 dark:text-neutral-400">
              {total === 0 ? '—' : isSummary ? 'Fim' : `${index + 1} / ${total}`}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTo(index + 1)}
              disabled={index >= maxIndex}
              aria-label="Próximo slide"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHeaderHidden(true)}
            title="Ocultar cabeçalho"
            aria-label="Ocultar cabeçalho"
            className="border-l border-neutral-200 pl-2 dark:border-neutral-800"
          >
            <ChevronUp size={16} />
          </Button>
        </div>
      </header>
      )}

      {/* Área do slide */}
      <main className="flex min-h-0 flex-1 flex-col px-6 py-6">
        {isSummary ? (
          <div className="mx-auto flex h-full w-full max-w-6xl flex-1 flex-col">
            <SummarySlide room={room} responses={allResponses} loading={summaryLoading} />
          </div>
        ) : currentSlide ? (
          // Largura total: a nuvem de palavras e os gráficos aproveitam a tela
          // inteira do projetor (sem limite de largura que deixaria as laterais
          // vazias e cortaria conteúdo largo).
          <div className="flex h-full w-full flex-1 flex-col">
            <SlideDisplay slide={currentSlide} responses={responses} />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-center text-neutral-500 dark:text-neutral-400">
            Esta apresentação ainda não tem slides.
          </div>
        )}
      </main>
    </div>
  )
}

function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center text-neutral-600 dark:text-neutral-300">
      {children}
    </div>
  )
}
