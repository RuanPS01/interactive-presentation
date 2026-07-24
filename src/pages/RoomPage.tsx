import { ChevronLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useParticipant } from '../hooks/useParticipant'
import { useRoom } from '../hooks/useRoom'
import { useApplyTheme } from '../hooks/useApplyTheme'
import { ParticipateView } from '../components/participate/ParticipateView'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function RoomPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { uid, error: authError } = useParticipant()
  const { room, loading, error } = useRoom(code)
  useApplyTheme(room?.theme)

  const currentSlide =
    room && room.slides.length > 0 ? room.slides[room.currentSlideIndex] : undefined

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/join')}>
          <ChevronLeft size={16} /> Trocar sala
        </Button>
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          Sala <strong className="tracking-widest">{code}</strong>
        </span>
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
            <h1 className="mb-1 text-lg font-bold text-neutral-900 dark:text-neutral-50">
              {room.title}
            </h1>

            {authError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">
                Falha ao conectar: {authError}
              </p>
            )}

            {!uid && !authError && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Conectando…</p>
            )}

            {uid && !currentSlide && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Aguardando o apresentador iniciar…
              </p>
            )}

            {uid && currentSlide && code && (
              // A `key` reinicia os controles quando o apresentador troca de slide.
              <ParticipateView
                key={currentSlide.id}
                code={code}
                slide={currentSlide}
                participantUid={uid}
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
