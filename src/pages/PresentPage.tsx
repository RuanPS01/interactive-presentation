import { clsx } from 'clsx'
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
  Moon,
  MoreVertical,
  Pencil,
  QrCode,
  RotateCcw,
  Square,
  Sun,
  Users,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFullscreen } from '../hooks/useFullscreen'
import { useParticipant } from '../hooks/useParticipant'
import { useRoom } from '../hooks/useRoom'
import { useResponses } from '../hooks/useResponses'
import { useParticipants } from '../hooks/useParticipants'
import { usePresenterAccess } from '../hooks/usePresenterAccess'
import { useRoomAnswers } from '../hooks/useRoomAnswers'
import { useRoomAssets } from '../hooks/useRoomAssets'
import { useRoomFonts } from '../hooks/useRoomFonts'
import { useRevealCountdown } from '../hooks/useRevealCountdown'
import { useSlideTimer } from '../hooks/useSlideTimer'
import { useThemeStore } from '../store/themeStore'
import {
  createRoom,
  endRoom,
  loadRoomPresentation,
  markAnswerRevealed,
  saveSlideTimers,
  setCurrentSlide,
} from '../lib/rooms'
import { fetchAnswers, withAnswers } from '../lib/answers'
import { getAllResponses } from '../lib/responses'
import { fetchAssets } from '../lib/assets'
import { loadRoomFonts } from '../lib/fonts'
import { savePresenterSession } from '../lib/presenterSessions'
import { collectAssetIds } from '../utils/freeSlide'
import { exportResultsPdf } from '../utils/exportPdf'
import { resolveSlideSettings } from '../utils/settings'
import { findQuizSlide } from '../utils/slides'
import { advanceTimers, closeTimer, slideTimerSeconds } from '../utils/timer'
import type { ResponseDoc, Room } from '../types/presentation'
import { SlideDisplay } from '../components/slides/SlideDisplay'
import { RoomCodeDialog } from '../components/present/RoomCodeDialog'
import { ShareRoom } from '../components/present/ShareRoom'
import { SummarySlide } from '../components/present/SummarySlide'
import { FullScreenMessage } from '../components/layout/FullScreenMessage'
import { PresenterAccessDenied } from '../components/present/PresenterAccessDenied'
import { Banner } from '../components/ui/Banner'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Menu } from '../components/ui/Menu'
import type { MenuEntry } from '../components/ui/Menu'

/** Teclas vindas de um campo, de um modal ou de um menu não trocam o slide. */
function ignoresSlideKeys(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return true
  return Boolean(el.closest?.('[role="dialog"], [role="menu"]'))
}

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
  const [codeOpen, setCodeOpen] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)
  const [restarting, setRestarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Controle de acesso do apresentador. Só quem é dono (mesmo uid) ou tem o
  // token secreto (na URL) apresenta; a plateia (só com o código) não entra.
  const access = usePresenterAccess(code, token, room, uid)

  // A sala guarda as perguntas sem gabarito; o dono junta com o documento
  // protegido (ver lib/answers.ts) para desenhar o gabarito e o resumo.
  const answers = useRoomAnswers(code, access === 'granted')
  const slides = room ? withAnswers(room.slides, answers) : []
  const ended = room?.status === 'ended'

  const currentSlide =
    room && slides.length > 0 ? slides[room.currentSlideIndex] : undefined
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
  const onSummaryNow = Boolean(room && slides.length > 0 && room.currentSlideIndex >= slides.length)
  const assetSlides = room
    ? onSummaryNow
      ? slides
      : slides.slice(room.currentSlideIndex, room.currentSlideIndex + 2)
    : []
  const assets = useRoomAssets(code, collectAssetIds(assetSlides))
  useRoomFonts(code, room?.revision ?? 0, Boolean(room?.slides.some((s) => s.type === 'free')))

  const [exporting, setExporting] = useState(false)

  // Estado do slide final automático (grade de miniaturas com os resultados).
  const [allResponses, setAllResponses] = useState<ResponseDoc[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  // Referência sempre atual da sala, para o efeito não depender da identidade
  // do objeto (que muda a cada atualização do Firestore).
  const roomRef = useRef(room)
  roomRef.current = room

  /**
   * Troca o slide atual, pausando o cronômetro do slide que sai e
   * iniciando/retomando o do slide que entra. Lê a sala pela referência para
   * continuar estável entre snapshots, assim o ouvinte de teclado não é
   * recadastrado a cada resposta que chega.
   *
   * Passar do último slide (o índice do slide final) ENCERRA a sala: índice,
   * cronômetros e status na mesma escrita. Sala encerrada não anda mais.
   */
  const goTo = useCallback(
    (next: number) => {
      const current = roomRef.current
      if (!code || !current || current.status === 'ended') return
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
      void setCurrentSlide(
        code,
        clamped,
        timers,
        count > 0 && clamped === count ? { status: 'ended' } : undefined,
      )
    },
    [code],
  )

  // Navegação por teclado e passador de slides (clicker): avança com a seta
  // para a direita, PageDown e Espaço; volta com a seta para a esquerda e
  // PageUp. Teclas dentro de modais, menus e campos ficam com eles.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (ignoresSlideKeys(e.target)) return
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

  // Ao chegar no slide final: busca todas as respostas (para a grade). O PDF
  // não baixa sozinho: o slide final tem um botão para isso.
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
  // final para todos. Um cronômetro já esgotado não entra aqui: voltar para
  // a pergunta não abre uma contagem nova. Sala encerrada não muda mais.
  const currentSlideId = currentSlide?.id
  const timerSeconds = slideTimerSeconds(currentSlide, slideSettings)
  const currentTimer = currentSlideId ? room?.timers?.[currentSlideId] : undefined
  const needsTimer =
    !ended &&
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
  // a sala. O apresentador congela o cronômetro em zero (é essa escrita que
  // trava as opções nos celulares, e não o relógio de cada aparelho) e, se o
  // gabarito da própria pergunta vier logo depois, avança na mesma escrita.
  //
  // Um cronômetro já congelado não entra aqui: quem voltou a uma pergunta
  // encerrada foi rever, não avançar.
  const runOutSlideId = timer.runOut && !ended ? currentSlideId : undefined
  useEffect(() => {
    if (access !== 'granted' || !code || !runOutSlideId) return
    const current = roomRef.current
    if (!current) return
    const index = current.currentSlideIndex
    const next = current.slides[index + 1]
    if (next?.type === 'answer' && next.quizSlideId === runOutSlideId) {
      // `advanceTimers` congela o slide que sai: o encerramento vai junto.
      goTo(index + 1)
      return
    }
    void saveSlideTimers(code, closeTimer(current.timers, runOutSlideId)).catch(() => {
      /* sem o registro a pergunta segue aberta até o apresentador avançar */
    })
  }, [access, code, runOutSlideId, goTo])

  // Suspense terminado: fica registrado na sala para que voltar ao gabarito
  // (ou chegar atrasado nele) mostre a resposta na hora, sem repetir a espera.
  // Na mesma escrita, o gabarito da pergunta passa a ser público.
  const revealQuiz = currentSlide?.type === 'answer' ? findQuizSlide(currentSlide, slides) : undefined
  const revealToRecord =
    answerSlideId && !reveal.pending && !alreadyRevealed && !ended && revealQuiz
      ? answerSlideId
      : null
  // A lista de corretas entra como texto para o efeito não reexecutar a cada
  // snapshot (o array muda de identidade toda vez).
  const revealAnswerKey = revealQuiz ? JSON.stringify([revealQuiz.id, revealQuiz.correctOptionIds]) : ''
  useEffect(() => {
    if (access !== 'granted' || !code || !revealToRecord || !revealAnswerKey) return
    const [quizId, correct] = JSON.parse(revealAnswerKey) as [string, string[]]
    void markAnswerRevealed(code, revealToRecord, quizId, correct).catch(() => {
      /* sem o registro o suspense apenas se repete; nada quebra */
    })
  }, [access, code, revealToRecord, revealAnswerKey])

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

  const total = slides.length
  const index = room.currentSlideIndex
  // Índice extra (= total) reservado para o slide de agradecimento automático.
  const maxIndex = total > 0 ? total : 0
  const isSummary = total > 0 && index >= total
  const joinUrl = `${window.location.origin}${window.location.pathname}#/room/${code}`
  const roomWithAnswers: Room = { ...room, slides }

  function showNotice(text: string) {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2500)
  }

  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      showNotice('Link de entrada copiado.')
    } catch {
      setCodeOpen(true) // sem área de transferência: o link está no modal
    }
  }

  async function exportPdf() {
    if (!code) return
    setExporting(true)
    try {
      // Busca todas as respostas da sala (de todos os slides) para o relatório,
      // e as imagens e fontes dos slides livres, que são desenhados em canvas.
      const [all, loaded] = await Promise.all([
        getAllResponses(code),
        fetchAssets(code, collectAssetIds(slides)),
        loadRoomFonts(code, room?.revision ?? 0).catch(() => {}),
      ])
      await exportResultsPdf(roomWithAnswers, all, loaded)
    } finally {
      setExporting(false)
    }
  }

  async function confirmEndRoom() {
    const current = roomRef.current
    if (!code || !current) return
    setEnding(true)
    try {
      const timers = advanceTimers(
        current.timers,
        current.slides[current.currentSlideIndex],
        undefined,
        current.settings,
      )
      await endRoom(code, current.slides.length, timers)
      setConfirmEnd(false)
    } catch (e) {
      showNotice(`Não foi possível encerrar: ${(e as Error).message}`)
    } finally {
      setEnding(false)
    }
  }

  /** Abre uma sala nova com o mesmo conteúdo (imagens, fontes e gabaritos). */
  async function presentAgain() {
    const current = roomRef.current
    if (!code || !current || !uid) return
    setRestarting(true)
    try {
      const key = await fetchAnswers(code)
      const presentation = await loadRoomPresentation(code, current, withAnswers(current.slides, key))
      const created = await createRoom(uid, presentation)
      savePresenterSession({ code: created.code, token: created.token, title: presentation.title })
      navigate(`/present/${created.code}/${created.token}`)
    } catch (e) {
      showNotice(`Não foi possível abrir uma sala nova: ${(e as Error).message}`)
    } finally {
      setRestarting(false)
    }
  }

  const editPath = `/edit/${code}${token ? `/${token}` : ''}`

  // Ações secundárias: botões a partir de xl, menu "Mais" abaixo disso. Uma
  // lista só para os dois caminhos.
  const menuItems: MenuEntry[] = [
    {
      key: 'code',
      label: 'Mostrar o código da sala',
      icon: <QrCode size={16} />,
      onSelect: () => setCodeOpen(true),
    },
    {
      key: 'copy',
      label: 'Copiar link de entrada',
      icon: <Copy size={16} />,
      onSelect: () => void copyJoinLink(),
    },
    ...(!ended
      ? [{ key: 'edit', label: 'Editar', icon: <Pencil size={16} />, onSelect: () => navigate(editPath) }]
      : []),
    {
      key: 'pdf',
      label: exporting ? 'Gerando o PDF…' : 'Exportar PDF',
      icon: <FileText size={16} />,
      disabled: exporting,
      onSelect: () => void exportPdf(),
    },
    {
      key: 'fullscreen',
      label: isFullscreen ? 'Sair da tela cheia' : 'Tela cheia',
      icon: isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />,
      onSelect: () => void toggleFullscreen(),
    },
    {
      key: 'theme',
      label: theme === 'dark' ? 'Tema claro' : 'Tema escuro',
      icon: theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />,
      onSelect: toggleTheme,
    },
    ...(!ended
      ? [
          'separator' as const,
          {
            key: 'end',
            label: 'Encerrar',
            hint: 'Leva todos à tela final e fecha a sala',
            icon: <Square size={16} />,
            danger: true,
            onSelect: () => setConfirmEnd(true),
          },
        ]
      : []),
  ]

  return (
    <div className="flex h-full min-h-[100dvh] flex-col">
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

      {/* Barra superior, sempre numa linha só: o que não cabe vai para o menu. */}
      {!headerHidden && (
        <header className="flex items-center gap-1.5 border-b border-neutral-200 px-2 py-2 sm:gap-2 sm:px-4 dark:border-neutral-800">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 sm:px-3"
            onClick={() => navigate('/')}
            aria-label="Sair"
            title="Sair"
          >
            <LogOut size={16} /> <span className="hidden sm:inline">Sair</span>
          </Button>
          <button
            type="button"
            onClick={() => setCodeOpen(true)}
            className="flex shrink-0 items-baseline gap-2 rounded-lg px-1 py-1 transition hover:bg-neutral-100 sm:px-1.5 dark:hover:bg-neutral-800"
            title="Mostrar o código da sala"
            aria-label={`Código da sala: ${code}. Mostrar o código da sala`}
          >
            <span className="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400">Código:</span>
            <span className="text-base font-bold tracking-[0.15em] text-neutral-900 sm:text-xl sm:tracking-[0.2em] dark:text-neutral-50">
              {code}
            </span>
          </button>
          <ShareRoom joinUrl={joinUrl} onOpen={() => setCodeOpen(true)} className="hidden sm:inline-flex" />
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-100 px-1.5 py-1 text-xs tabular-nums text-neutral-600 sm:px-2 dark:bg-neutral-800 dark:text-neutral-300"
            title="Pessoas conectadas nesta sala"
            aria-label={`${participants.length} pessoa(s) conectada(s)`}
          >
            <Users size={14} /> {participants.length}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {/* Janela larga: as ações secundárias como botões. */}
            <div className="hidden items-center gap-2 xl:flex">
              <Button variant="secondary" size="sm" onClick={() => void copyJoinLink()} title={joinUrl}>
                <Copy size={16} /> Copiar link
              </Button>
              {!ended && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(editPath)}
                  title="Editar opções e slides desta sala"
                >
                  <Pencil size={16} /> Editar
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => void exportPdf()} disabled={exporting}>
                <FileText size={16} /> {exporting ? 'Gerando…' : 'Exportar PDF'}
              </Button>
              {!ended && (
                <Button variant="danger" size="sm" onClick={() => setConfirmEnd(true)}>
                  <Square size={16} /> Encerrar
                </Button>
              )}
              <IconButton
                onClick={() => void toggleFullscreen()}
                label={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </IconButton>
              <IconButton onClick={toggleTheme} label="Alternar tema claro/escuro">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </IconButton>
            </div>

            {/* Navegação de slides, sempre à vista (o teclado e o passador
                também navegam). */}
            <div
              className="flex shrink-0 items-center gap-1 border-l border-neutral-200 pl-1 sm:pl-2 dark:border-neutral-800"
              title={ended ? 'A apresentação foi encerrada' : 'Use as setas do teclado para navegar'}
            >
              <IconButton
                onClick={() => goTo(index - 1)}
                disabled={ended || index <= 0}
                label="Slide anterior"
              >
                <ChevronLeft size={16} />
              </IconButton>
              <span className="min-w-[2.75rem] text-center text-sm tabular-nums text-neutral-500 sm:min-w-[3.5rem] dark:text-neutral-400">
                {total === 0 ? '0 / 0' : isSummary ? 'Fim' : `${index + 1} / ${total}`}
              </span>
              <IconButton
                onClick={() => goTo(index + 1)}
                disabled={ended || index >= maxIndex}
                label={index === total - 1 ? 'Encerrar e ir para o fim' : 'Próximo slide'}
              >
                <ChevronRight size={16} />
              </IconButton>
            </div>

            <IconButton
              onClick={() => setHeaderHidden(true)}
              label="Ocultar cabeçalho"
              className="hidden sm:flex"
            >
              <ChevronUp size={16} />
            </IconButton>

            <Menu
              label="Mais ações"
              className="xl:hidden"
              buttonClassName="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              button={<MoreVertical size={18} aria-hidden="true" />}
              items={menuItems}
            />
          </div>
        </header>
      )}

      {/* Área do slide */}
      <main className="flex min-h-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        {ended && (
          <Banner tone="info" icon={<Check size={16} />} className="mb-4">
            <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span>A apresentação foi encerrada.</span>
              <Button size="sm" onClick={() => void presentAgain()} disabled={restarting || !uid}>
                <RotateCcw size={16} /> {restarting ? 'Abrindo a sala nova…' : 'Apresentar de novo'}
              </Button>
            </span>
          </Banner>
        )}
        {isSummary ? (
          <div className="flex h-full w-full min-w-0 flex-1 flex-col">
            <SummarySlide
              room={roomWithAnswers}
              responses={allResponses}
              loading={summaryLoading}
              assets={assets}
              exporting={exporting}
              onExportPdf={() => void exportPdf()}
            />
          </div>
        ) : currentSlide ? (
          // Largura total: a nuvem de palavras e os gráficos aproveitam a tela
          // inteira do projetor.
          <div className="flex h-full w-full min-w-0 flex-1 flex-col">
            <SlideDisplay
              slide={currentSlide}
              slides={slides}
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

      <RoomCodeDialog code={code} joinUrl={joinUrl} open={codeOpen} onOpenChange={setCodeOpen} />

      <ConfirmDialog
        open={confirmEnd}
        title="Encerrar a apresentação?"
        tone="danger"
        confirmLabel={ending ? 'Encerrando…' : 'Encerrar'}
        busy={ending}
        onConfirm={() => void confirmEndRoom()}
        onCancel={() => setConfirmEnd(false)}
      >
        <p>
          Todos vão para a tela final de agradecimento, e a sala deixa de aceitar
          respostas e mudanças.
        </p>
        <p>Para apresentar de novo depois, uma sala nova será aberta com o mesmo conteúdo.</p>
      </ConfirmDialog>

      {notice && (
        <p
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900"
        >
          {notice}
        </p>
      )}
    </div>
  )
}

/** Botão só com ícone, com 36 px de alvo de toque. */
function IconButton({
  onClick,
  label,
  disabled,
  className,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-900 transition hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700',
        className,
      )}
    >
      {children}
    </button>
  )
}
