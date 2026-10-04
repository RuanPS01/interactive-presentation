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
  Pencil,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFullscreen } from '../hooks/useFullscreen'
import { useParticipant } from '../hooks/useParticipant'
import { useRoom } from '../hooks/useRoom'
import { useResponses } from '../hooks/useResponses'
import { useParticipants } from '../hooks/useParticipants'
import { usePresenterAccess } from '../hooks/usePresenterAccess'
import { useRoomAssets } from '../hooks/useRoomAssets'
import { useRoomFonts } from '../hooks/useRoomFonts'
import { useRevealCountdown } from '../hooks/useRevealCountdown'
import { useSlideTimer } from '../hooks/useSlideTimer'
import { useThemeStore } from '../store/themeStore'
import { markAnswerRevealed, saveSlideTimers, setCurrentSlide } from '../lib/rooms'
import { getAllResponses } from '../lib/responses'
import { fetchAssets } from '../lib/assets'
import { loadRoomFonts } from '../lib/fonts'
import { collectAssetIds } from '../utils/freeSlide'
import { exportResultsPdf } from '../utils/exportPdf'
import { resolveSlideSettings } from '../utils/settings'
import { advanceTimers, closeTimer, slideTimerSeconds } from '../utils/timer'
import type { ResponseDoc } from '../types/presentation'
import { SlideDisplay } from '../components/slides/SlideDisplay'
import { ShareRoom } from '../components/present/ShareRoom'
import { SummarySlide } from '../components/present/SummarySlide'
import { FullScreenMessage } from '../components/layout/FullScreenMessage'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { PresenterAccessDenied } from '../components/present/PresenterAccessDenied'
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
  const access = usePresenterAccess(code, token, room, uid)

  const currentSlide =
    room && room.slides.length > 0 ? room.slides[room.currentSlideIndex] : undefined
  // No slide de gabarito os resultados vêm da pergunta que ele revela.
  const resultsSlideId =
    currentSlide?.type === 'answer' ? currentSlide.quizSlideId : currentSlide?.id
  const responses = useResponses(code, resultsSlideId)
  const participants = useParticipants(code)
  const slideSettings = resolveSlideSettings(room?.settings, currentSlide)

  // Cronômetro do slide atual e suspense do gabarito: os mesmos dois estados
  // que a plateia vê, para o projetor e os celulares andarem juntos.
  const timer = useSlideTimer(room, currentSlide, slideSettings)
  const answerSlideId = currentSlide?.type === 'answer' ? currentSlide.id : null
  const alreadyRevealed = Boolean(
    answerSlideId && room?.revealedSlideIds?.includes(answerSlideId),
  )
  const reveal = useRevealCountdown(answerSlideId, { revealed: alreadyRevealed })

  // Imagens dos slides livres: as do slide no ar e do seguinte; no slide
  // final, todas (a grade mostra cada slide em miniatura).
  const onSummaryNow = Boolean(room && room.slides.length > 0 && room.currentSlideIndex >= room.slides.length)
  const assetSlides = room
    ? onSummaryNow
      ? room.slides
      : room.slides.slice(room.currentSlideIndex, room.currentSlideIndex + 2)
    : []
  const assets = useRoomAssets(code, collectAssetIds(assetSlides))
  useRoomFonts(code, room?.revision ?? 0, Boolean(room?.slides.some((s) => s.type === 'free')))

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

  /**
   * Troca o slide atual, pausando o cronômetro do slide que sai e
   * iniciando/retomando o do slide que entra. Lê a sala pela referência para
   * continuar estável entre snapshots — assim o ouvinte de teclado não é
   * recadastrado a cada resposta que chega.
   */
  const goTo = useCallback(
    (next: number) => {
      const current = roomRef.current
      if (!code || !current) return
      const count = current.slides.length
      // O índice extra (= nº de slides) é o slide de agradecimento automático.
      const clamped = Math.max(0, Math.min(next, count > 0 ? count : 0))
      if (clamped === current.currentSlideIndex) return
      const timers = advanceTimers(
        current.timers,
        current.slides[current.currentSlideIndex],
        current.slides[clamped],
        current.settings,
      )
      void setCurrentSlide(code, clamped, timers)
    },
    [code],
  )

  // Navegação por teclado e passador de slides (clicker):
  // avança com →, PageDown, Espaço; volta com ←, PageUp.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      const idx = roomRef.current?.currentSlideIndex
      if (idx === undefined) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        goTo(idx + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        goTo(idx - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo])

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
          // As fontes precisam estar carregadas: os slides livres são desenhados em canvas.
          void Promise.all([
            fetchAssets(code, collectAssetIds(currentRoom.slides)),
            loadRoomFonts(code, currentRoom.revision ?? 0).catch(() => {}),
          ]).then(([loaded]) => exportResultsPdf(currentRoom, all, loaded))
        }
      })
      .catch(() => {
        if (!cancelled) setSummaryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [code, activeIndex, slideCount])

  // Sala aberta (ou retomada) num slide cujo cronômetro nunca começou, ou que
  // ficou pausado numa passagem anterior: quem apresenta grava o instante
  // final para todos. Um cronômetro já esgotado não entra aqui — voltar para
  // a pergunta não abre uma contagem nova.
  const currentSlideId = currentSlide?.id
  const timerSeconds = slideTimerSeconds(currentSlide, slideSettings)
  const currentTimer = currentSlideId ? room?.timers?.[currentSlideId] : undefined
  const needsTimer =
    timerSeconds > 0 &&
    (currentTimer === undefined ||
      (currentTimer.endsAt === null && currentTimer.remainingMs > 0))
  useEffect(() => {
    if (access !== 'granted' || !code || !currentSlideId || !needsTimer) return
    const current = roomRef.current
    const slide = current?.slides.find((s) => s.id === currentSlideId)
    if (!current || !slide) return
    void saveSlideTimers(
      code,
      advanceTimers(current.timers, undefined, slide, current.settings),
    ).catch(() => {
      /* sem cronômetro a pergunta segue no ar até o apresentador avançar */
    })
  }, [access, code, currentSlideId, needsTimer])

  // A contagem do projetor zerou: é aqui que a pergunta é encerrada para toda
  // a sala. O apresentador congela o cronômetro em zero — é essa escrita que
  // trava as opções nos celulares, e não o relógio de cada aparelho — e, se o
  // gabarito da própria pergunta vier logo depois, avança na mesma escrita.
  //
  // Um cronômetro já congelado não entra aqui: quem voltou a uma pergunta
  // encerrada foi rever, não avançar.
  const runOutSlideId = timer.runOut ? currentSlideId : undefined
  useEffect(() => {
    if (access !== 'granted' || !code || !runOutSlideId) return
    const current = roomRef.current
    if (!current) return
    const index = current.currentSlideIndex
    const next = current.slides[index + 1]
    if (next?.type === 'answer' && next.quizSlideId === runOutSlideId) {
      // `advanceTimers` congela o slide que sai — o encerramento vai junto.
      goTo(index + 1)
      return
    }
    void saveSlideTimers(code, closeTimer(current.timers, runOutSlideId)).catch(() => {
      /* sem o registro a pergunta segue aberta até o apresentador avançar */
    })
  }, [access, code, runOutSlideId, goTo])

  // Suspense terminado: fica registrado na sala para que voltar ao gabarito
  // (ou chegar atrasado nele) mostre a resposta na hora, sem repetir a espera.
  const revealToRecord = answerSlideId && !reveal.pending && !alreadyRevealed
    ? answerSlideId
    : null
  useEffect(() => {
    if (access !== 'granted' || !code || !revealToRecord) return
    void markAnswerRevealed(code, revealToRecord).catch(() => {
      /* sem o registro o suspense apenas se repete; nada quebra */
    })
  }, [access, code, revealToRecord])

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
    return <PresenterAccessDenied code={code} />
  }

  const total = room.slides.length
  const index = room.currentSlideIndex
  // Índice extra (= total) reservado para o slide de agradecimento automático.
  const maxIndex = total > 0 ? total : 0
  const isSummary = total > 0 && index >= total
  const joinUrl = `${window.location.origin}${window.location.pathname}#/room/${code}`

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
      // Busca todas as respostas da sala (de todos os slides) para o relatório,
      // e as imagens e fontes dos slides livres, que são desenhados em canvas.
      const [all, loaded] = await Promise.all([
        getAllResponses(code),
        fetchAssets(code, collectAssetIds(room.slides)),
        loadRoomFonts(code, room.revision ?? 0).catch(() => {}),
      ])
      await exportResultsPdf(room, all, loaded)
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
        <span
          className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          title="Pessoas conectadas nesta sala"
        >
          <Users size={14} /> {participants.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Editar recomeça a apresentação para todos ao salvar; a tela de
              edição pede confirmação antes. */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/edit/${code}${token ? `/${token}` : ''}`)}
            title="Editar opções e slides desta sala"
          >
            <Pencil size={16} /> Editar
          </Button>
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
          <div className="flex h-full w-full flex-1 flex-col">
            <SummarySlide room={room} responses={allResponses} loading={summaryLoading} assets={assets} />
          </div>
        ) : currentSlide ? (
          // Largura total: a nuvem de palavras e os gráficos aproveitam a tela
          // inteira do projetor (sem limite de largura que deixaria as laterais
          // vazias e cortaria conteúdo largo).
          <div className="flex h-full w-full flex-1 flex-col">
            <SlideDisplay
              slide={currentSlide}
              slides={room.slides}
              responses={responses}
              settings={slideSettings}
              participants={participants.length}
              countdown={
                timer.active
                  ? { endsAt: timer.endsAt, remainingMs: timer.remainingMs }
                  : null
              }
              revealPending={reveal.pending}
              revealDots={reveal.dots}
              assets={assets}
            />
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
