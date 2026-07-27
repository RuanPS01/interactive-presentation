import { BarChart3, FileText, Play, Presentation, Users, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'
import {
  listPresenterSessions,
  removePresenterSession,
  type PresenterSession,
} from '../lib/presenterSessions'
import { getRoom } from '../lib/rooms'
import { getAllResponses } from '../lib/responses'
import { exportResultsPdf } from '../utils/exportPdf'
import { PageShell } from '../components/layout/PageShell'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'

export function HomePage() {
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  // Sessões de apresentador salvas neste dispositivo (retomar / reexportar).
  const [sessions, setSessions] = useState<PresenterSession[]>(listPresenterSessions)
  const [exportingCode, setExportingCode] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  async function exportSession(s: PresenterSession) {
    setExportingCode(s.code)
    setExportError(null)
    try {
      const room = await getRoom(s.code)
      if (!room) {
        setExportError(`A sala ${s.code} não existe mais.`)
        return
      }
      const all = await getAllResponses(s.code)
      await exportResultsPdf(room, all)
    } catch (e) {
      setExportError((e as Error).message)
    } finally {
      setExportingCode(null)
    }
  }

  function dismissSession(code: string) {
    removePresenterSession(code)
    setSessions(listPresenterSessions())
  }

  return (
    <PageShell>
      <div className="flex justify-end">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <header className="mx-auto mb-12 max-w-2xl pt-8 text-center">
        <div className="mb-4 flex justify-center">
          <BarChart3 size={56} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-50 md:text-5xl">
          Apresentação Interativa
        </h1>
        <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
          Crie enquetes, nuvens de palavras e gráficos ao vivo. A plateia participa
          pelo celular, sem instalar nada e sem criar conta.
        </p>
      </header>

      <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Presentation size={40} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Criar apresentação
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Monte seus slides e apresente.
            </p>
          </div>
          <Button size="lg" className="w-full" onClick={() => navigate('/create')}>
            Criar sala
          </Button>
        </Card>

        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <Users size={40} strokeWidth={1.5} className="text-blue-600 dark:text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              Entrar em uma sala
            </h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Tenha o código em mãos e participe.
            </p>
          </div>
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            onClick={() => navigate('/join')}
          >
            Entrar na sala
          </Button>
        </Card>
      </div>

      {sessions.length > 0 && (
        <div className="mx-auto mt-10 max-w-3xl">
          <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            Continuar como apresentador (neste dispositivo)
          </h2>
          {exportError && (
            <p className="mb-2 text-sm text-red-600 dark:text-red-400">{exportError}</p>
          )}
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.code}>
                <Card className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-neutral-900 dark:text-neutral-50">
                      {s.title || 'Apresentação'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Sala <strong className="tracking-widest">{s.code}</strong>
                    </p>
                  </div>
                  <Button size="sm" onClick={() => navigate(`/present/${s.code}/${s.token}`)}>
                    <Play size={16} /> Retomar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={exportingCode === s.code}
                    onClick={() => void exportSession(s)}
                  >
                    <FileText size={16} /> {exportingCode === s.code ? 'Gerando…' : 'Exportar PDF'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => dismissSession(s.code)}
                    aria-label={`Remover sala ${s.code} da lista`}
                    className="inline-flex rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  >
                    <X size={16} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PageShell>
  )
}
