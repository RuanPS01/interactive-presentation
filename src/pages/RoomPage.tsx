import { ChevronLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { useRoom } from '../hooks/useRoom'
import { useRevealCountdown } from '../hooks/useRevealCountdown'
import { useSlideTimer } from '../hooks/useSlideTimer'
import { useThemeStore } from '../store/themeStore'
import { joinRoom } from '../lib/participants'
import { getParticipantName, saveParticipantName } from '../lib/participantName'
import { resolveSlideSettings, withDefaults } from '../utils/settings'
import { ParticipateView } from '../components/participate/ParticipateView'
import { NamePrompt } from '../components/participate/NamePrompt'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function RoomPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { uid, error: authError } = useParticipant()
  const { room, loading, error } = useRoom(code)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  // Nome lembrado deste dispositivo para esta sala (só usado se a sala pedir).
  const [name, setName] = useState<string | null>(() =>
    code ? getParticipantName(code) : null,
  )

  const settings = withDefaults(room?.settings)
  const askName = settings.askName
  const needsName = askName && !name
  const ready = Boolean(uid && room && !needsName)

  // Presença: entrar na sala já conta como participante, mesmo sem responder.
  // A dependência é `roomExists` (e não `room`): o objeto da sala muda a cada
  // snapshot do Firestore — inclusive quando o apresentador troca de slide — e
  // isso faria cada participante reescrever a presença o tempo todo.
  const roomExists = Boolean(room)
  useEffect(() => {
    if (!code || !uid || !roomExists || needsName) return
    void joinRoom(code, uid, askName ? (name ?? undefined) : undefined).catch(() => {
      /* falha de presença não impede participar */
    })
  }, [code, uid, roomExists, needsName, name, askName])

  function confirmName(value: string) {
    if (!code) return
    saveParticipantName(code, value)
    setName(value)
  }

  const total = room?.slides.length ?? 0
  // O apresentador passou do último slide: apresentação encerrada (slide final).
  const finished = !!room && total > 0 && room.currentSlideIndex >= total
  const currentSlide =
    room && total > 0 && room.currentSlideIndex < total
      ? room.slides[room.currentSlideIndex]
      : undefined
  const slideSettings = resolveSlideSettings(room?.settings, currentSlide)

  // A contagem regressiva não aparece no celular: o relógio de cada aparelho
  // não bate com o do projetor, e duas contagens diferentes na mesma sala
  // confundem mais do que ajudam. Daqui só interessa o encerramento, que é
  // declarado pelo apresentador (`closed`) — assim as opções travam junto com
  // o cronômetro da tela grande, e não segundos antes.
  const timer = useSlideTimer(room, currentSlide, slideSettings)
  const answerSlideId = currentSlide?.type === 'answer' ? currentSlide.id : null
  const reveal = useRevealCountdown(answerSlideId, {
    // Gabarito já revelado: quem chega agora (ou volta a ele) vê a resposta
    // direto, sem uma espera que não sincroniza mais nada.
    revealed: Boolean(answerSlideId && room?.revealedSlideIds?.includes(answerSlideId)),
  })

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/join')}>
          <ChevronLeft size={16} /> Trocar sala
        </Button>
        <div className="flex items-center gap-3">
          {name && (
            <span className="max-w-[8rem] truncate text-sm text-neutral-500 dark:text-neutral-400">
              {name}
            </span>
          )}
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Sala <strong className="tracking-widest">{code}</strong>
          </span>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      <main className="flex-1">
        {loading && <Info>Entrando na sala…</Info>}

        {!loading && error && <Info>Erro de conexão: {error}</Info>}

        {!loading && !error && !room && (
          <Info>
            Sala não encontrada. Verifique o código com o apresentador.
            <Button className="mt-4" onClick={() => navigate('/join')}>
              Tentar outro código
            </Button>
          </Info>
        )}

        {room && (
          <Card className="p-5">
            {!needsName && (
              <h1 className="mb-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {room.title}
              </h1>
            )}

            {authError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                Falha ao conectar: {authError}
              </p>
            )}

            {!uid && !authError && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Conectando…</p>
            )}

            {uid && needsName && (
              <NamePrompt roomTitle={room.title} onConfirm={confirmName} />
            )}

            {ready && !finished && !currentSlide && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Aguardando o apresentador iniciar…
              </p>
            )}

            {ready && finished && (
              <div className="py-4 text-center">
                <p className="text-3xl">🎉</p>
                <p className="mt-2 text-lg font-semibold text-neutral-900 dark:text-neutral-50">
                  Obrigado por participar!
                </p>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  A apresentação foi encerrada.
                </p>
              </div>
            )}

            {ready && !finished && currentSlide && code && uid && (
              // A `key` reinicia os controles quando o apresentador troca de slide.
              <ParticipateView
                key={currentSlide.id}
                code={code}
                slide={currentSlide}
                slides={room.slides}
                participantUid={uid}
                participantName={askName ? name : null}
                settings={slideSettings}
                timeUp={timer.closed}
                revealPending={reveal.pending}
                revealDots={reveal.dots}
              />
            )}
          </Card>
        )}
      </main>

      <footer className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
        A tela acompanha o apresentador automaticamente.
      </footer>
    </div>
  )
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white p-8 text-center text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      {children}
    </div>
  )
}
